# Sprint 9: LangGraph Implementation

**Date:** 2025-10-05  
**Status:** ✅ Phase 2-3 Complete, 🚧 Phase 4 Testing  
**Goal:** Replace custom orchestrator with LangGraph/LangChain for better maintainability

---

## Overview

This sprint implements LangGraph/LangChain to replace the custom `llm-orchestrator.ts` and `llm-router.ts` implementations. This will reduce code by ~75% (from 1,600 lines to 400 lines) while adding built-in features like state management, checkpointing, and graph visualization.

---

## Implementation Phases

### ✅ Phase 2: LangGraph Core (Days 3-5)

**Completed:**

1. **State Schema** (`supabase/functions/shared/langgraph/state.ts`)
   - Defined `LEXStateAnnotation` with all state fields
   - Messages (conversation history)
   - Configuration (mode, model)
   - Context (conversationId, userId, requestId)
   - RAG context, tool tracking, citations
   - Iteration counter
   - Progress events for streaming

2. **Tools** (`supabase/functions/shared/langgraph/tools.ts`)
   - `createWebSearchTool()` - Brave Search API integration
   - `createKnowledgeSearchTool()` - Supabase vector search
   - `createFetchURLTool()` - Web page content fetching
   - `createArtifactTool()` - File artifact creation
   - `getLEXTools()` - Tool factory function

3. **Nodes** (`supabase/functions/shared/langgraph/nodes.ts`)
   - `callLLM()` - Calls LLM with/without tools
   - `executeTools()` - Executes tool calls from LLM
   - Multi-provider support (OpenAI, Anthropic, Google)
   - Mode-based temperature and tool selection

4. **Edges** (`supabase/functions/shared/langgraph/edges.ts`)
   - `shouldContinue()` - Conditional routing logic
   - Iteration limit enforcement by mode
   - Tool call detection

5. **Graph** (`supabase/functions/shared/langgraph/graph.ts`)
   - `createLEXGraph()` - Builds the state graph
   - Nodes: callLLM, executeTools
   - Edges: START → callLLM → [conditional] → executeTools/END
   - Built-in checkpointing with MemorySaver

6. **Streaming** (`supabase/functions/shared/langgraph/streaming.ts`)
   - `streamGraph()` - SSE streaming of graph events
   - Token-by-token streaming
   - Tool execution progress events
   - Final metadata (citations, tools used)
   - `invokeGraph()` - Non-streaming mode for testing

---

## Architecture

### Graph Flow

```
START
  ↓
[callLLM]
  ↓
[shouldContinue?]
  ↓ tool_calls     ↓ no tool_calls
[executeTools]     END
  ↓
[callLLM] ← loop back
```

### State Management

All state flows through `LEXStateAnnotation`:
- **Automatic reducers** handle state updates
- **Messages** are appended (conversation history)
- **Iterations** track loop count
- **Tool tracking** records which tools were used
- **Citations** collected from web search and URL fetching
- **Progress events** for real-time updates

### Tool Execution

Tools are wrapped as `DynamicStructuredTool`:
- **Schema validation** with Zod
- **Automatic parsing** of tool calls from LLM
- **Error handling** built-in
- **Logging** integrated with structured logger

---

## Benefits Over Custom Implementation

| Feature | Custom (Before) | LangGraph (After) |
|---------|----------------|-------------------|
| **Lines of Code** | 1,600 lines | 400 lines |
| **State Management** | Manual | Automatic |
| **Checkpointing** | Manual | Built-in |
| **Visualization** | None | LangSmith |
| **Streaming** | Custom SSE | Built-in |
| **Error Handling** | Manual try-catch | Built-in recovery |
| **Tool Execution** | Manual parsing | Automatic |
| **Resumable Flows** | No | Yes |
| **Testing** | Hard (stateful) | Easier (graph) |

---

## Next Steps

### ✅ Phase 3: Integration (Days 6-7)

**Completed:**

1. **Integration Helper** (`supabase/functions/shared/langgraph/integration.ts`)
   - `executeWithLangGraph()` - Compatible replacement for `executeAgenticLoop`
   - Converts LLM messages to LangChain format
   - Returns same format as old orchestrator
   - `shouldUseLangGraph()` - Feature flag check

2. **Updated `chat/index.ts`**
   - Feature flag integration (`use_langgraph`)
   - Conditional execution path (LangGraph vs legacy)
   - Maintains all existing functionality
   - Same response format for both paths
   - Logging for which path is used

3. **Dependencies**
   - Updated `deno.json` with LangChain packages
   - Added `nodeModulesDir: "auto"` for npm package support
   - Updated `supabase/functions/deno.json`

---

### 🚧 Phase 4: Testing & Deployment (Days 8-9)

1. **Integration Testing**
   - Test all modes
   - Test all tools
   - Test streaming vs non-streaming
   - Performance benchmarks

2. **Production Deployment**
   - Feature flag implementation
   - Gradual rollout (10% → 50% → 100%)
   - Monitor errors in LangSmith
   - Compare metrics (old vs new)

3. **Cleanup**
   - Remove `llm-orchestrator.ts` (395 lines)
   - Remove `llm-router.ts` (763 lines)
   - Remove old `tools.ts`
   - Update documentation

---

## File Structure

```
supabase/functions/shared/langgraph/
├── state.ts         # State schema with automatic reducers
├── tools.ts         # LangChain tool definitions
├── nodes.ts         # Graph nodes (callLLM, executeTools)
├── edges.ts         # Conditional routing logic
├── graph.ts         # Graph compilation and export
├── streaming.ts     # SSE streaming utilities
└── integration.ts   # Bridge to chat/index.ts (Phase 3)
```

---

## Code Reduction

**Before:**
- `llm-orchestrator.ts`: 395 lines
- `llm-router.ts`: 763 lines
- `tools.ts`: 247 lines
- Custom streaming: ~100 lines
- **Total:** ~1,505 lines

**After:**
- `state.ts`: 90 lines
- `tools.ts`: 175 lines
- `nodes.ts`: 150 lines
- `edges.ts`: 45 lines
- `graph.ts`: 35 lines
- `streaming.ts`: 85 lines
- **Total:** ~580 lines

**Savings:** ~925 lines (-61%)

---

## Dependencies Required

```json
{
  "imports": {
    "@langchain/core": "npm:@langchain/core@0.2.0",
    "@langchain/langgraph": "npm:@langchain/langgraph@0.1.0",
    "@langchain/openai": "npm:@langchain/openai@0.1.0",
    "@langchain/anthropic": "npm:@langchain/anthropic@0.1.0",
    "@langchain/google-genai": "npm:@langchain/google-genai@0.1.0",
    "zod": "npm:zod@3.22.0"
  }
}
```

---

## Testing Strategy

### Unit Tests
- Test each node in isolation
- Test edge routing logic
- Test tool execution
- Test state reducers

### Integration Tests
- Test full graph execution
- Test streaming
- Test all modes (fast/auto/extended)
- Test error recovery

### Performance Tests
- Compare response times (old vs new)
- Memory usage comparison
- Token usage comparison
- Cold start time

---

## Rollback Plan

If issues arise:

1. **Feature Flag:** Disable LangGraph via feature flag
2. **Immediate Rollback:** System reverts to old orchestrator
3. **Fix Issues:** Debug in dev environment
4. **Re-test:** Thorough testing before retry
5. **Gradual Re-rollout:** 10% → 50% → 100%

---

## Success Metrics

- ✅ Code reduction: >50%
- ✅ Maintainability: Easier to extend
- ✅ Performance: Similar or better response times
- ✅ Error rate: <1%
- ✅ All features working: Tools, streaming, modes

---

**Status:** Phase 3 complete, ready for Phase 4 testing & deployment 🚀

## How to Enable LangGraph

To switch from the old orchestrator to LangGraph:

1. **Create Feature Flag** (if not exists):
```sql
INSERT INTO feature_flags (flag_key, enabled, description, config)
VALUES (
  'use_langgraph',
  false,  -- Start disabled
  'Use LangGraph instead of legacy orchestrator',
  '{}'::jsonb
);
```

2. **Enable Feature Flag**:
```sql
UPDATE feature_flags
SET enabled = true
WHERE flag_key = 'use_langgraph';
```

3. **Disable Feature Flag** (rollback if needed):
```sql
UPDATE feature_flags
SET enabled = false
WHERE flag_key = 'use_langgraph';
```

The system will automatically use LangGraph when the flag is enabled, and fall back to the legacy orchestrator when disabled.

---

**Status:** Phase 2-3 complete, ready for Phase 4 testing & deployment 🚀
