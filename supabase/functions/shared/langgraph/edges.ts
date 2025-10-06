/**
 * LEX Graph Edges - LangGraph
 * Sprint 9: LangGraph Integration
 * 
 * Defines conditional edges for routing through the graph
 */

import type { LEXState } from './state.ts';
import { logInfo } from '../logger-utils.ts';

/**
 * Edge: Should continue calling tools?
 * 
 * Returns 'executeTools' if the last message has tool calls and we haven't hit iteration limit
 * Returns 'END' if no tool calls or iteration limit reached
 */
export function shouldContinue(state: LEXState): 'executeTools' | 'END' {
  const requestId = state.requestId || 'unknown';
  const lastMessage = state.messages[state.messages.length - 1];
  
  // Check if last message has tool calls
  const toolCalls = (lastMessage as any).tool_calls;
  if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
    // Check iteration limit based on mode
    const maxIterations = getMaxIterations(state.mode);
    
    if (state.iterations >= maxIterations) {
      logInfo('langgraph', `Max iterations (${maxIterations}) reached, ending loop`, {
        requestId,
        mode: state.mode,
        iterations: state.iterations,
      });
      return 'END';
    }
    
    logInfo('langgraph', 'Tool calls found, continuing to execute tools', {
      requestId,
      toolCount: toolCalls.length,
      iteration: state.iterations,
    });
    return 'executeTools';
  }
  
  logInfo('langgraph', 'No tool calls, ending loop', { requestId });
  return 'END';
}

/**
 * Get max iterations based on mode
 */
function getMaxIterations(mode: 'fast' | 'auto' | 'extended'): number {
  switch (mode) {
    case 'fast':
      return 1;
    case 'auto':
      return 3;
    case 'extended':
      return 5;
    default:
      return 3;
  }
}
