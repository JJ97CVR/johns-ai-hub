/**
 * LEX Agent State Schema - LangGraph
 * Sprint 9: LangGraph Integration
 * 
 * Defines the state structure for the agentic loop with automatic reducers
 */

import { BaseMessage } from 'npm:@langchain/core@^0.2.27/messages';
import { Annotation } from 'npm:@langchain/langgraph@^0.0.34';

/**
 * LEX Agent State Schema
 * 
 * This defines all state that flows through the graph:
 * - Messages (conversation history)
 * - Configuration (mode, model)
 * - Context (conversation ID, user ID)
 * - Retrieved knowledge
 * - Tool tracking
 * - Citations
 * - Iteration counter
 */
export const LEXStateAnnotation = Annotation.Root({
  // Core conversation state
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  
  // Configuration
  mode: Annotation<'fast' | 'auto' | 'extended'>({
    reducer: (current, update) => update ?? current,
    default: () => 'auto',
  }),
  
  model: Annotation<string>({
    reducer: (current, update) => update ?? current,
    default: () => 'anthropic/claude-sonnet-4',
  }),
  
  // Context
  conversationId: Annotation<string>({
    reducer: (current, update) => update ?? current,
    default: () => '',
  }),
  
  userId: Annotation<string>({
    reducer: (current, update) => update ?? current,
    default: () => '',
  }),
  
  requestId: Annotation<string>({
    reducer: (current, update) => update ?? current,
    default: () => '',
  }),
  
  // Supabase client (for tools)
  supabaseClient: Annotation<any>({
    reducer: (current, update) => update ?? current,
    default: () => null,
  }),
  
  // RAG context
  retrievedContext: Annotation<string[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  
  // Tool tracking
  toolsUsed: Annotation<string[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  
  // Citations
  citations: Annotation<Array<{ title?: string; url: string; excerpt?: string }>>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  
  // Iteration count (for max iteration limit)
  iterations: Annotation<number>({
    reducer: (current, update) => update ?? current,
    default: () => 0,
  }),
  
  // Progress events (for streaming)
  progressEvents: Annotation<string[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
});

export type LEXState = typeof LEXStateAnnotation.State;
