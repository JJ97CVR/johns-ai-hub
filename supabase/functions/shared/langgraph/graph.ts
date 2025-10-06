/**
 * LEX Agent Graph - LangGraph
 * Sprint 9: LangGraph Integration
 * 
 * Builds the state graph for the agentic loop:
 * 
 * Flow:
 * START → callLLM → [shouldContinue?]
 *                   ↓ executeTools  ↓ END
 *                   callLLM ←───────┘
 */

import { StateGraph, MemorySaver } from 'npm:@langchain/langgraph@^0.0.34';
import { LEXStateAnnotation } from './state.ts';
import { callLLM, executeTools } from './nodes.ts';
import { shouldContinue } from './edges.ts';
import { logInfo } from '../logger-utils.ts';

/**
 * Create LEX Agent Graph
 */
export function createLEXGraph() {
  logInfo('langgraph', 'Creating LEX agent graph');
  
  // Initialize graph with state schema
  const graph = new StateGraph(LEXStateAnnotation)
    // Add nodes
    .addNode('callLLM', callLLM)
    .addNode('executeTools', executeTools)
    
    // Add edges
    .addEdge('__start__', 'callLLM') // Start → callLLM
    .addConditionalEdges(
      'callLLM',
      shouldContinue,
      {
        'executeTools': 'executeTools',
        'END': '__end__',
      }
    )
    .addEdge('executeTools', 'callLLM'); // Loop back
  
  // Compile with checkpointing
  const checkpointer = new MemorySaver();
  const compiledGraph = graph.compile({ checkpointer });
  
  logInfo('langgraph', 'LEX agent graph compiled successfully');
  
  return compiledGraph;
}

// Export singleton
export const lexGraph = createLEXGraph();
