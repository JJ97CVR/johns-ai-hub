import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { retrieveRelevantKnowledge } from '../shared/knowledge-retrieval.ts';
import type { Message as LLMMessage } from '../shared/llm-router.ts';
import { strategyFor, needsTools, trimHistory, type ChatMode } from '../shared/mode-strategy.ts';
import { getThreadMemory, updateThreadMemory, extractEntitiesFromMessages, enrichQueryWithEntities } from '../shared/memory.ts';
import { normalizePartNo, isVolvoPartNumber } from '../shared/parts.ts';
import { detectPartNumber } from '../shared/part-intelligence.ts';  // FAS 3: Part intelligence
// P0 Refactored modules
import { getCorsHeaders } from '../shared/cors.ts';
import { hashQuery, learnFromConversation } from '../shared/learning.ts';
import { cacheResponse } from '../shared/analytics.ts';
import { validateChatRequest } from '../shared/request-validation.ts';
// Sprint 9: LangGraph (legacy orchestrator removed)
import { executeWithLangGraph, type LangGraphContext } from '../shared/langgraph/integration.ts';
import type { OrchestratorConfig } from '../shared/llm-orchestrator.ts';
import { streamChatResponse, streamCachedResponse } from '../shared/streaming.ts';
import { withRetry } from '../shared/db-retry.ts';
// Sprint 6: Service modules
import { saveUserMessage, saveAssistantMessage, updateAssistantMessage, updateConversationTitle, updateConversationTimestamp, saveCodeBlocks, linkFilesToMessage, verifyFileOwnership } from './services/chat-messages.ts';
import { buildSystemPrompt, loadFileContext, buildChatContext } from './services/chat-context.ts';
import { extractCodeBlocks, scrubPreamble, parseModelString } from './services/chat-utils.ts';
// Sprint 6: Event-driven analytics & feature flags (UPDATED: analytics-queue merged into analytics)
import { enqueueAnalyticsEvent } from '../shared/analytics.ts';
import { isFeatureEnabled } from '../shared/feature-flags.ts';
import { MAX_HISTORY_TOKENS, DEFAULT_MAX_ITERATIONS } from '../shared/constants.ts';
// Sprint 1: Observability
import { createObservableLogger, observeLLMCall, type ObservabilityContext } from '../shared/observability.ts';
// Sprint 3: Context & Performance
import { compactHistory, calculateAdaptiveTopK, calculateTokenBudget, willFitInBudget } from '../shared/context-compaction.ts';
// PERFORMANCE OPTIMIZATION: Phase 1-3
import { persistQueue } from '../shared/persistence-queue.ts';
import { LazyLoader, createAndStartLoaders } from '../shared/lazy-loader.ts';
import { getExecutionStrategy, getStrategyConfig, logStrategyDecision } from '../shared/mode-router.ts';
// Phase 1: AI Response Caching & Phase 3: Smart Model Routing
import { getCachedAIResponse, cacheAIResponse, type CacheMetadata } from '../shared/ai-response-cache.ts';
import { selectOptimalModel, type QueryAnalysis } from '../shared/smart-model-router.ts';

// System prompt now handled by chat-context service

Deno.serve(async (req) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const corsHeaders = getCorsHeaders(req);
  
  // Create structured logger (will be enhanced with more context after validation)
  let logger = createObservableLogger('chat', { requestId });
  
  await logger.info('Incoming request', {
    metadata: {
      method: req.method,
      url: req.url,
    },
  });
  
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    await logger.debug('OPTIONS preflight handled');
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Early block if origin not allowed
  const originAllowed = !!corsHeaders['Access-Control-Allow-Origin'];
  if (!originAllowed) {
    await logger.error('CORS origin blocked', undefined, {
      metadata: { origin: req.headers.get('origin') },
    });
    return new Response(
      JSON.stringify({ error: 'CORS: Origin not allowed' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const startTime = Date.now();
  const timings = { rag: 0, llm: 0, tools: 0, cache: 0 };
  
  // Get Lovable API key once for the entire request
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

  try {
    // STEP 1: Validate request (auth, rate limits, input validation)
    const validation = await validateChatRequest({ req, corsHeaders, requestId });
    
    if (!validation.valid) {
      const { message, status, headers } = validation.error!;
      return new Response(
        JSON.stringify({ error: message }),
        { 
          status, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            ...headers 
          } 
        }
      );
    }
    
    const { user, userClient, body } = validation.data!;
    const { conversationId, message, fileIds, model, mode = 'auto' as ChatMode } = body;
    
    // FAS 3: Smart Mode Upgrade - Auto-upgrade från fast till auto vid part number
    const partInfo = detectPartNumber(message);
    let effectiveMode = mode;
    
    if (partInfo.isPartNumber && mode === 'fast') {
      logger = createObservableLogger('chat', {
        requestId,
        conversationId,
        userId: user.id,
        mode: 'auto',  // Show upgraded mode in logs
      });
      
      await logger.info('Auto-upgrading from fast to auto mode due to part number', {
        metadata: { 
          originalMode: mode,
          partNumber: partInfo.partNumber,
          confidence: partInfo.confidence
        }
      });
      effectiveMode = 'auto';
    } else {
      // Enhance logger with user context
      logger = createObservableLogger('chat', {
        requestId,
        conversationId,
        userId: user.id,
        mode,
      });
    }
    
    // Get strategy for the selected mode (use effective mode)
    const strategy = strategyFor(effectiveMode);
    
    await logger.info('Chat request received', {
      metadata: {
        mode,
        messageLength: message?.length,
        model: strategy.model,
        allowTools: strategy.allowTools,
        topK: strategy.topK,
        maxTokens: strategy.maxTokens,
        deadlineMs: strategy.deadlineMs,
      },
    });
    
    // Use service role for RAG operations and system data access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // PHASE 1 OPTIMIZATION: Async Persistence - Generate IDs, queue writes
    const userMessageId = crypto.randomUUID();
    
    // Queue user message persistence (non-blocking)
    persistQueue.add({
      type: 'user_message',
      data: { id: userMessageId, conversationId, message }
    });
    
    // Queue conversation title update (non-blocking)
    persistQueue.add({
      type: 'conversation_title',
      data: { conversationId, title: message.slice(0, 50) }
    });
    
    // Verify file ownership (must be synchronous for security)
    if (fileIds?.length > 0) {
      await logger.info('Verifying file ownership', {
        metadata: { fileCount: fileIds.length },
      });
      
      const verification = await verifyFileOwnership(userClient, fileIds, conversationId);
      
      if (!verification.valid) {
        await logger.error('File ownership verification failed', undefined, {
          metadata: { error: verification.error },
        });
        return new Response(
          JSON.stringify({ error: verification.error }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Queue file linking (non-blocking)
      await logger.debug('File ownership verified, queueing file link');
      persistQueue.add({
        type: 'file_link',
        data: { fileIds, messageId: userMessageId }
      });
    }
    
    await logger.info('User message queued for persistence', {
      metadata: { userMessageId, persistQueueStats: persistQueue.getStats() },
    });
    
    // PHASE 3: Determine execution strategy (use effective mode)
    const executionStrategy = getExecutionStrategy(effectiveMode, message);
    const strategyConfig = getStrategyConfig(executionStrategy, effectiveMode);
    logStrategyDecision(executionStrategy, strategyConfig, effectiveMode, message);
    
    // PHASE 2 OPTIMIZATION: Lazy Loading - Start all loaders in parallel
    const loaders = createAndStartLoaders({
      memory: new LazyLoader(
        () => getThreadMemory(supabaseClient, conversationId),
        'thread-memory'
      ),
      history: new LazyLoader(
        async () => {
          const { data } = await supabaseClient
            .from('messages')
            .select('role, content')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true })
            .limit(100);  // FIX #1: Prevent loading 1000s of messages
          return (data || []).map(msg => ({
            role: msg.role as any,
            content: msg.content,
          })) as LLMMessage[];
        },
        'conversation-history'
      ),
      rag: new LazyLoader(
        async () => {
          if (strategyConfig.skipRAG) {
            return { results: [], cached: false };
          }
          const enrichedQuery = enrichQueryWithEntities(message, {});
          const adaptiveTopK = calculateAdaptiveTopK(enrichedQuery, strategyConfig.ragTopK);
          return retrieveRelevantKnowledge(enrichedQuery, { 
            mode, 
            partNo: isVolvoPartNumber(message) ? normalizePartNo(message) : null,
            topK: adaptiveTopK,
          });
        },
        'rag-knowledge'
      ),
    });
    
    await logger.info('Lazy loaders started', {
      metadata: { 
        strategy: executionStrategy,
        skipping: {
          rag: strategyConfig.skipRAG,
          memory: strategyConfig.skipMemory,
        }
      },
    });
    
    // Detect part number early (fast operation)
    const partNo = isVolvoPartNumber(message) ? normalizePartNo(message) : null;
    if (partNo) {
      await logger.info('Part number detected', {
        metadata: { partNo },
      });
    }
    
    // STEP 4: Check response cache (conditional based on strategy)
    if (!strategyConfig.skipCache) {
      try {
        await logger.debug('Checking response cache');
        
        // Try to get RAG result if ready (non-blocking with timeout)
        const ragResult = await loaders.rag.getIfReady(200);
        
        if (ragResult?.cached && 'response' in ragResult && ragResult.response) {
          await logger.info('Cache hit - returning cached response');
          
          // Save assistant message directly to database
          const { message: savedMessage, error: messageError } = await saveAssistantMessage(
            supabaseClient,
            conversationId
          );
          
          if (messageError || !savedMessage) {
            throw new Error('Failed to save assistant message');
          }
          
          const assistantMessageId = savedMessage.id;
          
          // Update with cached content
          const updateResult = await updateAssistantMessage(
            supabaseClient,
            assistantMessageId,
            ragResult.response
          );
          
          if (!updateResult.success) {
            await logger.error('Failed to update assistant message with cached content', updateResult.error, {
              metadata: { assistantMessageId, cacheType: 'rag' }
            });
          }
          
          // Enqueue analytics event (async, non-blocking)
          await enqueueAnalyticsEvent(supabaseClient, {
            eventType: 'cache_hit',
            eventData: {
              query: message.slice(0, 200),
              queryHash: await hashQuery(message),
              queryType: 'cached',
              processingTimeMs: Date.now() - startTime,
              cacheHit: true,
              model: 'cache',
              provider: 'cache',
              assistantMessageId,
            },
            conversationId,
            userId: user.id,
          });
          
          // Return as SSE stream
          return streamCachedResponse(
            ragResult.response,
            assistantMessageId,
            conversationId,
            mode,
            corsHeaders
          );
        }
        
        await logger.debug('Cache miss - proceeding with LLM');
      } catch (error) {
        await logger.error('Cache check error', error instanceof Error ? error : undefined, {
          metadata: { 
            errorMessage: error instanceof Error ? error.message : 'Unknown error' 
          },
        });
      }
    } else {
      await logger.debug('Skipping cache check for strategy', {
        metadata: { strategy: executionStrategy },
      });
    }
    
    // PHASE 1: Check AI Response Cache (full AI answer caching)
    if (!strategyConfig.skipCache) {
      try {
        const queryHash = await hashQuery(message);
        const cachedAI = await getCachedAIResponse(
          supabaseClient,
          queryHash,
          mode,
          requestId
        );
        
        if (cachedAI) {
          await logger.info('AI Cache HIT - returning cached AI response', {
            metadata: {
              queryHash,
              hit_count: cachedAI.hit_count,
              cache_age_hours: Math.round((Date.now() - new Date(cachedAI.created_at).getTime()) / 3600000),
            },
          });
          
          // Save assistant message directly to database
          const { message: savedMessage, error: messageError } = await saveAssistantMessage(
            supabaseClient,
            conversationId
          );
          
          if (messageError || !savedMessage) {
            throw new Error('Failed to save assistant message');
          }
          
          const assistantMessageId = savedMessage.id;
          
          // Update with cached content
          const updateResult = await updateAssistantMessage(
            supabaseClient,
            assistantMessageId,
            cachedAI.response_content,
            cachedAI.citations && cachedAI.citations.length > 0 ? cachedAI.citations : undefined,
            cachedAI.tools_used && cachedAI.tools_used.length > 0 ? cachedAI.tools_used : undefined
          );
          
          if (!updateResult.success) {
            await logger.error('Failed to update assistant message with AI cached content', updateResult.error, {
              metadata: { assistantMessageId, cacheType: 'ai_response' }
            });
          }
          
          // Enqueue analytics event
          await enqueueAnalyticsEvent(supabaseClient, {
            eventType: 'cache_hit',
            eventData: {
              query: message.slice(0, 200),
              queryHash,
              queryType: 'ai_cached',
              processingTimeMs: Date.now() - startTime,
              cacheHit: true,
              model: cachedAI.model,
              provider: 'ai_cache',
              assistantMessageId,
            },
            conversationId,
            userId: user.id,
          });
          
          // Return as SSE stream
          return streamCachedResponse(
            cachedAI.response_content,
            assistantMessageId,
            conversationId,
            mode,
            corsHeaders
          );
        }
        
        await logger.debug('AI cache miss - proceeding with LLM');
      } catch (error) {
        await logger.error('AI cache check error', error instanceof Error ? error : undefined, {
          metadata: { 
            errorMessage: error instanceof Error ? error.message : 'Unknown error' 
          },
        });
      }
    }
    
    // STEP 5: Load file context + Multi-modal Vision Support (using service)
    const fileContextData = await loadFileContext(supabaseClient, fileIds);
    const fileContext = fileContextData.fileContext;
    const hasImages = fileContextData.hasImages;
    const imageUrls = fileContextData.imageUrls;
    
    if (hasImages) {
      await logger.info('Vision mode enabled', {
        metadata: { imageCount: imageUrls.length },
      });
    }
    
    // STEP 6: Try to get loaded data (non-blocking with fallback)
    const threadMemory = await loaders.memory.getIfReady(100) || { 
      threadSummary: '', 
      entities: {} 
    };
    
    const conversationHistory = await loaders.history.getIfReady(800) || [];  // FIX #2: Higher timeout for DB fetch
    
    // Extract entities (conditional based on strategy)
    const extractedEntities = strategyConfig.skipEntityExtraction 
      ? {} 
      : extractEntitiesFromMessages([
          ...conversationHistory,
          { role: 'user', content: message }
        ]);
    
    await logger.debug('Data loaded', {
      metadata: { 
        hasMemory: threadMemory.threadSummary.length > 0,
        historyLength: conversationHistory.length,
        entitiesCount: Object.keys(extractedEntities).length,
      },
    });
    
    // FIX #3: Trim FIRST (remove old messages), THEN compact (summarize) - use effective mode
    const trimResult = trimHistory(conversationHistory, effectiveMode);
    const trimmedHistory = trimResult.history;  // Extract just the history array
    
    const tokenBudget = calculateTokenBudget(8000, effectiveMode);
    const compactionResult = await compactHistory(
      trimmedHistory,  // Use trimmed history, not full
      {
        maxTokens: tokenBudget.history,
        reserveForResponse: tokenBudget.response,
        reserveForSystem: tokenBudget.system,
      },
      lovableApiKey
    );
    
    const compactedHistory = compactionResult.messages.filter(m => m.role !== 'system');
    
    // Build system prompt with thread memory (FAS 4: with part info)
    const systemPromptWithMemory = buildSystemPrompt(
      threadMemory.threadSummary,
      threadMemory.entities,
      effectiveMode,  // Use effective mode (potentially upgraded)
      partInfo  // FAS 4: Pass part info for enhanced prompt
    );
    
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPromptWithMemory },
      ...compactedHistory.map((msg: any) => ({
        role: msg.role as any,
        content: msg.content,
      })),
      // Multi-modal support - format user message with images
      {
        role: 'user',
        content: hasImages && imageUrls.length > 0
          ? [
              { type: 'text', text: message + fileContext },
              ...imageUrls.map(url => ({
                type: 'image_url' as const,
                image_url: { url }
              }))
            ]
          : message + fileContext,
      }
    ];
    
    if (hasImages) {
      await logger.debug('Vision mode content prepared', {
        metadata: { imageCount: imageUrls.length },
      });
    }
    
    // PHASE 3: Smart Model Routing - Select optimal model based on query complexity
    const { model: selectedModel, analysis: queryAnalysis } = selectOptimalModel(
      model,
      message,
      requestId
    );
    
    // Log smart routing decision
    if (queryAnalysis) {
      await logger.info('Smart model routing applied', {
        metadata: {
          complexity: queryAnalysis.complexity,
          selectedModel,
          confidence: queryAnalysis.confidence,
          reasoning: queryAnalysis.reasoning,
        },
      });
    }
    
    // STEP 7: Execute agentic loop with tools (use effective mode)
    const maxIterations = DEFAULT_MAX_ITERATIONS[effectiveMode as keyof typeof DEFAULT_MAX_ITERATIONS] || DEFAULT_MAX_ITERATIONS.auto;
    
    // Check feature flag for tools
    const toolsFeatureEnabled = await isFeatureEnabled(supabaseClient, 'web_search');
    const shouldUseTools = toolsFeatureEnabled && strategy.allowTools && (effectiveMode === 'extended' || needsTools(message, effectiveMode));  // Sprint 2: Pass effective mode to needsTools
    
    await logger.info('Tool policy determined', {
      metadata: { allowTools: shouldUseTools, mode: effectiveMode, maxIterations },
    });
    
    const orchestratorConfig: OrchestratorConfig = {
      model: selectedModel,
      mode: effectiveMode,  // Use effective mode
      maxIterations,
      maxTokens: strategy.maxTokens,
      temperature: strategy.temperature,
      deadlineMs: strategy.deadlineMs,
      shouldUseTools,
    };
    
    let assistantContent = '';
    let toolsUsed: string[] = [];
    let citations: any[] = [];
    let progressEvents: string[] = [];
    let tokensIn = 0;
    let tokensOut = 0;
    
    // PHASE 1A: Generate UUID first, then INSERT empty message (prevents "temp-assistant-..." errors)
    const assistantMessageId = crypto.randomUUID();
    
    const { error: msgError } = await supabaseClient
      .from('messages')
      .insert({
        id: assistantMessageId, // Explicit UUID
        conversation_id: conversationId,
        role: 'assistant',
        content: '', // Empty initially - Realtime shows placeholder
      });
    
    if (msgError) {
      throw new Error(`Failed to create assistant message: ${msgError.message}`);
    }
    
    await logger.info('Assistant message created (empty)', {
      metadata: { assistantMessageId, conversationId }
    });
    
    try {
      // Sprint 9: LangGraph only (legacy orchestrator removed)
      await logger.info('Using LangGraph for execution', {
        metadata: { requestId },
      });
      
      const langGraphContext: LangGraphContext = {
        supabaseClient,
        conversationId,
        userId: user.id,
        requestId,
        mode,
        partNo,
        extractedEntities,
        startTime,
        messages,
        config: orchestratorConfig,
        // PHASE 2: Pass lazy loaders to LangGraph
        memoryLoader: loaders.memory,
        historyLoader: loaders.history,
        ragLoader: loaders.rag,
      };
      
      const result = await executeWithLangGraph(langGraphContext, assistantMessageId);
      
      assistantContent = result.assistantContent;
      toolsUsed = result.toolsUsed;
      citations = result.citations;
      progressEvents = result.progressEvents;
      timings.llm = result.timings.llm;
      timings.tools = result.timings.tools;
      tokensIn = result.tokensIn || 0;
      tokensOut = result.tokensOut || 0;
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'AI service unavailable';
      await logger.error('Chat error caught', error instanceof Error ? error : undefined, {
        metadata: { errorMessage: errorMsg },
      });
      
      // Return timeout error
      if (errorMsg.includes('deadline')) {
        if (assistantContent) {
          await supabaseClient
            .from('messages')
            .insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: assistantContent + '\n\n_(Svaret avbröts på grund av tidsgräns)_',
            });
        }
        
        return new Response(
          JSON.stringify({ 
            error: `Tidsgräns överskriden (${strategy.deadlineMs / 1000}s). Försök med Snabb-läge för snabbare svar.`,
            timeout: true,
            mode,
          }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMsg,
          fallback: true,
          mode,
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Fallback if no content generated
    if (!assistantContent) {
      assistantContent = 'Jag kunde tyvärr inte generera ett svar. Försök igen.';
    }
    
    // Scrub any narration preamble
    assistantContent = scrubPreamble(assistantContent);
    
    // Extract and queue code blocks (non-blocking)
    const codeBlocks = extractCodeBlocks(assistantContent);
    if (codeBlocks.length > 0) {
      persistQueue.add({
        type: 'code_blocks',
        data: { messageId: assistantMessageId, codeBlocks }
      });
    }
    
    // Queue conversation timestamp update (non-blocking)
    persistQueue.add({
      type: 'conversation_timestamp',
      data: { conversationId }
    });
    
    // STEP 11: Async learning and memory updates
    learnFromConversation(
      supabaseClient, 
      conversationId, 
      assistantMessageId,
      user.id, 
      message, 
      assistantContent
    ).catch(err => logger.error('Learning error', err instanceof Error ? err : undefined, { 
      metadata: { errorMessage: err instanceof Error ? err.message : 'Unknown error' } 
    }));
    
    if (lovableApiKey) {
      updateThreadMemory(
        supabaseClient, 
        conversationId, 
        messages, 
        assistantContent,
        lovableApiKey
      ).catch(err => logger.error('Thread memory update error', err instanceof Error ? err : undefined, { 
        metadata: { errorMessage: err instanceof Error ? err.message : 'Unknown error' } 
      }));
    }
    
    // STEP 12: Enqueue analytics event (async, non-blocking)
    const knowledgeUrls = citations
      .filter(c => typeof c.url === 'string' && c.url.includes('knowledge'))
      .map(c => c.url);
    
    // Track LLM usage and costs (Sprint 1: Observability)
    const obsContext: ObservabilityContext = {
      requestId,
      conversationId,
      userId: user.id,
      model: selectedModel,
      mode,
    };
    
    await observeLLMCall({
      supabase: supabaseClient,
      logger,
      context: obsContext,
      tokensIn,
      tokensOut,
      processingTimeMs: Date.now() - startTime,
      toolsCalled: toolsUsed.length > 0 ? toolsUsed : undefined,
    });
    
    // PHASE 1: Cache AI response for future requests
    if (!strategyConfig.skipCache) {
      try {
        const queryHash = await hashQuery(message);
        const cacheMetadata: CacheMetadata = {
          model: selectedModel,
          mode,
          citations,
          tools_used: toolsUsed,
          confidence_score: citations.length > 0 ? 0.95 : 0.85,
        };
        
        await cacheAIResponse(
          supabaseClient,
          message,
          queryHash,
          assistantContent,
          cacheMetadata,
          requestId
        );
        
        await logger.debug('AI response cached', {
          metadata: { queryHash, mode, model: selectedModel },
        });
      } catch (error) {
        await logger.error('AI cache save error', error instanceof Error ? error : undefined, {
          metadata: { 
            errorMessage: error instanceof Error ? error.message : 'Unknown error' 
          },
        });
      }
    }
    
    
    await enqueueAnalyticsEvent(supabaseClient, {
      eventType: 'query',
      eventData: {
        query: message,
        queryHash: await hashQuery(message),
        queryType: mode,
        processingTimeMs: Date.now() - startTime,
        cacheHit: false,
        model: selectedModel,
        provider: selectedModel.split('/')[0],
        toolsCalled: toolsUsed.length > 0 ? toolsUsed : undefined,
        knowledgeUsed: knowledgeUrls.length > 0 ? knowledgeUrls : undefined,
        entitiesUsed: Object.keys(extractedEntities).length > 0 ? extractedEntities : undefined,
        assistantMessageId,
        metadata: {
          timings,
          hasImages,
          fileCount: fileIds?.length || 0,
        },
      },
      conversationId,
      userId: user.id,
    });
    
    // STEP 13: Stream final answer with real tokens
    const modelParts = selectedModel.split('/');
    const provider = (modelParts[0] || 'google') as 'openai' | 'anthropic' | 'google';
    const baseModel = modelParts[1] || selectedModel;
    
    // Cache the response
    await cacheResponse(supabaseClient, message, assistantContent);
    
    // PHASE 1C: Final UPDATE with metadata (content already updated via streaming)
    const { error: updateError } = await supabaseClient
      .from('messages')
      .update({
        // Content already updated progressively during streaming
        citations: citations.length > 0 ? citations : null,
        tools_used: toolsUsed.length > 0 ? toolsUsed : null,
      })
      .eq('id', assistantMessageId);
    
    if (updateError) {
      await logger.error('Failed to finalize assistant message', updateError instanceof Error ? updateError : undefined, {
        metadata: { 
          assistantMessageId, 
          contentLength: assistantContent.length,
          errorMessage: updateError.message
        }
      });
    }
    
    await logger.info('Assistant message finalized', {
      metadata: { 
        assistantMessageId, 
        contentLength: assistantContent.length,
        citationsCount: citations.length,
        toolsCount: toolsUsed.length 
      }
    });
    
    // Return simple success (Realtime handles all UI updates)
    return new Response(
      JSON.stringify({ 
        success: true,
        messageId: assistantMessageId,
        conversationId,
        mode 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    await logger.error('Chat error', error as Error, {
      metadata: {
        processingTimeMs: Date.now() - startTime,
      },
    });
    
    const processingTime = Date.now() - startTime;
    return new Response(
      JSON.stringify({ error: 'Request failed', requestId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } finally {
    const totalTime = Date.now() - startTime;
    await logger.info('Request completed', {
      metadata: {
        totalTimeMs: totalTime,
        timings,
      },
    });
  }
});

// Helper functions moved to services/chat-utils.ts
