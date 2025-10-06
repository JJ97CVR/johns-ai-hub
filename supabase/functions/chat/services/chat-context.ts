/**
 * Chat Context Service
 * Sprint 6: Architecture Refactoring
 * Sprint 2: Integrated with Structured Prompts
 * 
 * Handles building context from files, memory, and conversation history.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getThreadMemory } from '../../shared/memory.ts';
import type { Message as LLMMessage } from '../../shared/llm-router.ts';
import { buildSystemPrompt as buildPrompt, type PromptConfig } from '../../shared/prompts/prompt-manager.ts';
import type { ChatMode } from '../../shared/mode-strategy.ts';
import type { PartNumberInfo } from '../../shared/part-intelligence.ts';

export interface FileContext {
  fileContext: string;
  hasImages: boolean;
  imageUrls: string[];
}

export interface ChatContext {
  systemPrompt: string;
  messages: LLMMessage[];
  fileContext: FileContext;
}

/**
 * Build system prompt with thread memory and entities
 * Now uses structured prompt manager (Sprint 2)
 * FAS 4: Enhanced with part number intelligence
 */
export function buildSystemPrompt(
  threadSummary: string, 
  entities: Record<string, any>,
  mode: ChatMode = 'auto',
  partInfo?: PartNumberInfo
): string {
  const config: PromptConfig = {
    version: 'latest',
    options: {
      mode,
      threadSummary,
      entities,
    },
  };

  let prompt = buildPrompt(config);
  
  // FAS 4: Add part-specific guidance when part number detected
  if (partInfo?.isPartNumber && partInfo.partNumber) {
    prompt += `\n\n## 🔧 ARTIKELNUMMER-FÖRFRÅGAN AKTIV
Du har just fått en fråga om Volvo artikelnummer **${partInfo.partNumber}**.

**VIKTIGT - Följ denna struktur:**
1. 🔍 **Identifiera** vad artikelnumret avser (komponent/reservdel)
2. 📍 **Placering** - Förklara VAR den sitter på bilen
3. 🚗 **Kompatibilitet** - Ange VILKA Volvo-modeller den passar
4. 🔧 **Monteringsinfo** - Om möjligt, ge monteringsanvisningar eller tips

**REGLER:**
- Svara ALLTID med konkret, verifierbar information från källor
- Gissa ALDRIG - säg "Jag hittade ingen information" om osäker
- Inkludera alltid källhänvisningar när tillgängliga
- Var tydlig om artikelnumret är originaldel eller aftermarket

**Konfidensgrad:** ${partInfo.confidence === 'high' ? '🟢 HÖG' : partInfo.confidence === 'medium' ? '🟡 MEDEL' : '🔴 LÅG'}`;
  }
  
  return prompt;
}

/**
 * Load file context and detect images for multi-modal support
 */
export async function loadFileContext(
  supabaseClient: SupabaseClient,
  fileIds: string[] | undefined
): Promise<FileContext> {
  let fileContext = '';
  let hasImages = false;
  const imageUrls: string[] = [];
  
  if (!fileIds || fileIds.length === 0) {
    return { fileContext, hasImages, imageUrls };
  }
  
  const { data: files } = await supabaseClient
    .from('uploaded_files')
    .select('id, filename, file_type, content_preview, parsed_data, storage_path')
    .in('id', fileIds);
  
  if (!files || files.length === 0) {
    return { fileContext, hasImages, imageUrls };
  }
  
  // Detect images
  const imageFiles = files.filter(f => f.file_type.startsWith('image/'));
  hasImages = imageFiles.length > 0;
  
  if (hasImages) {
    for (const img of imageFiles) {
      const { data: urlData } = supabaseClient.storage
        .from('chat-files')
        .getPublicUrl(img.storage_path);
      
      if (urlData) {
        imageUrls.push(urlData.publicUrl);
      }
    }
  }
  
  // Build text context
  fileContext = '\n\n=== UPLOADED FILES ===\n';
  for (const file of files) {
    fileContext += `\nFile: ${file.filename} (${file.file_type})\n`;
    if (file.parsed_data) {
      fileContext += `Data preview: ${JSON.stringify(file.parsed_data).slice(0, 500)}...\n`;
    } else if (file.content_preview && !file.file_type.startsWith('image/')) {
      fileContext += `Content: ${file.content_preview}\n`;
    }
  }
  
  return { fileContext, hasImages, imageUrls };
}

/**
 * Build complete chat context with system prompt, history, and file context
 * FAS 4: Enhanced with part number support
 */
export async function buildChatContext(
  supabaseClient: SupabaseClient,
  conversationId: string,
  conversationHistory: any[],
  userMessage: string,
  fileIds?: string[],
  partInfo?: PartNumberInfo
): Promise<ChatContext> {
  // Get thread memory
  const threadMemory = await getThreadMemory(supabaseClient, conversationId);
  
  // Build system prompt (FAS 4: with part info)
  const systemPrompt = buildSystemPrompt(
    threadMemory.threadSummary,
    threadMemory.entities,
    'auto',
    partInfo
  );
  
  // Load file context
  const fileCtx = await loadFileContext(supabaseClient, fileIds);
  
  // Build messages array
  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map((msg: any) => ({
      role: msg.role as any,
      content: msg.content,
    })),
    // Multi-modal support - format user message with images
    {
      role: 'user',
      content: fileCtx.hasImages && fileCtx.imageUrls.length > 0
        ? [
            { type: 'text', text: userMessage + fileCtx.fileContext },
            ...fileCtx.imageUrls.map(url => ({
              type: 'image_url' as const,
              image_url: { url }
            }))
          ]
        : userMessage + fileCtx.fileContext,
    }
  ];
  
  return {
    systemPrompt,
    messages,
    fileContext: fileCtx,
  };
}
