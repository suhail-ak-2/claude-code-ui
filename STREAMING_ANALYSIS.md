# Claude CLI API Streaming Endpoint Analysis

## Overview

This document provides a comprehensive analysis of the `/claude/stream` endpoint behavior based on live testing. The streaming endpoint uses **Server-Sent Events (SSE)** to provide real-time visibility into Claude's processing, tool execution, and response generation.

## Stream Event Types

The API uses Server-Sent Events format with the following event types:

### 1. **`connected`** - Connection Establishment
Sent immediately when a client connects to the streaming endpoint.

```json
event: connected
data: {"type":"connected","timestamp":"2025-09-17T05:08:58.116Z"}
```

### 2. **`data`** - Main Content Stream
Contains multiple subtypes that represent different phases of Claude's processing:

#### a) System Initialization (`type: "system"`)
Provides session context and available capabilities.

```json
{
  "type": "system",
  "subtype": "init", 
  "cwd": "/Users/suhail/Documents/claude-code-ui",
  "session_id": "5a3a974f-5cfc-47f6-9279-7fb11b6b2f8c",
  "tools": ["Task","Bash","Glob","Grep","ExitPlanMode","Read","Edit","MultiEdit","Write","NotebookEdit","WebFetch","TodoWrite","WebSearch","BashOutput","KillBash"],
  "mcp_servers": [],
  "model": "claude-sonnet-4-20250514",
  "permissionMode": "bypassPermissions",
  "slash_commands": ["clear","compact","context","cost","init","migrate-installer","output-style:new","pr-comments","release-notes","statusline","todos","review","security-review","vim"],
  "apiKeySource": "/login managed key",
  "output_style": "default",
  "uuid": "060f1a6a-51e7-49a7-b2f8-ca2281f83d80"
}
```

#### b) Real-time Streaming Events (`type: "stream_event"`)
These events provide granular visibility into Claude's response generation:

**Message Lifecycle Events:**
- `message_start` - Claude begins generating a response
- `message_delta` - Message metadata updates (usage, stop_reason)
- `message_stop` - Claude finishes generating the response

**Content Block Events:**
- `content_block_start` - Start of a content block (text or tool_use)
- `content_block_delta` - Incremental content chunks
- `content_block_stop` - End of a content block

**Example Text Streaming:**
```json
{
  "type": "stream_event",
  "event": {
    "type": "content_block_delta",
    "index": 0,
    "delta": {
      "type": "text_delta",
      "text": "4\
\
Step by step:\
1. Start with the first"
    }
  },
  "session_id": "5a3a974f-5cfc-47f6-9279-7fb11b6b2f8c",
  "parent_tool_use_id": null,
  "uuid": "5b50918c-1c2a-4e2b-8c86-1bdb7b0be17f"
}
```

#### c) Tool Usage (`type: "assistant"`)
Shows when Claude decides to use tools with full parameters:

```json
{
  "type": "assistant",
  "message": {
    "id": "msg_01VRGLSi4R5ypAXFvCNrHGUp",
    "type": "message",
    "role": "assistant",
    "model": "claude-sonnet-4-20250514",
    "content": [{
      "type": "tool_use",
      "id": "toolu_01VAeG6rPYV6tbV5xHepLkrj",
      "name": "Bash",
      "input": {
        "command": "ls -la",
        "description": "List files in current directory"
      }
    }],
    "stop_reason": "tool_use"
  },
  "session_id": "251093bd-695f-4de6-9c6c-b68c86e17697"
}
```

#### d) Tool Results (`type: "user"`)
Contains the output from tool execution:

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [{
      "tool_use_id": "toolu_01VAeG6rPYV6tbV5xHepLkrj",
      "type": "tool_result",
      "content": "total 184\
drwxr-xr-x@  12 suhail  staff    384 Sep 17 10:37 .\
drwx------+  32 suhail  staff   1024 Sep 16 13:56 ..\
...",
      "is_error": false
    }]
  },
  "session_id": "251093bd-695f-4de6-9c6c-b68c86e17697"
}
```

**Error Tool Results:**
```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [{
      "type": "tool_result",
      "content": "cat: /nonexistent/file.txt: No such file or directory",
      "is_error": true,
      "tool_use_id": "toolu_01WxdBwxmcniGrM4iDJWnD4U"
    }]
  }
}
```

#### e) Final Result Summary (`type: "result"`)
Provides execution summary with metrics:

```json
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "duration_ms": 3516,
  "duration_api_ms": 4442,
  "num_turns": 1,
  "result": "4\
\
Step by step:\
1. Start with the first number: 2\
2. Add the second number: 2\
3. 2 + 2 = 4",
  "session_id": "5a3a974f-5cfc-47f6-9279-7fb11b6b2f8c",
  "total_cost_usd": 0.039294550000000004,
  "usage": {
    "input_tokens": 3,
    "cache_creation_input_tokens": 9865,
    "cache_read_input_tokens": 4802,
    "output_tokens": 44,
    "server_tool_use": {
      "web_search_requests": 0
    },
    "service_tier": "standard",
    "cache_creation": {
      "ephemeral_1h_input_tokens": 0,
      "ephemeral_5m_input_tokens": 9865
    }
  },
  "permission_denials": [],
  "uuid": "193b1cdc-c30a-4b93-9b7e-a26cfd3704c6"
}
```

### 3. **`complete`** - Stream Completion
Signals the end of the streaming session:

```json
event: complete
data: {"sessionId":"5a3a974f-5cfc-47f6-9279-7fb11b6b2f8c","completed":true}
```

### 4. **`error`** - Error Events
Sent when system-level errors occur:

```json
event: error
data: {"error":"error message"}
```

## Stream Flow Patterns

### Simple Text Response Flow
1. **Connection** → `connected` event
2. **System Init** → `system` data with session info  
3. **Message Start** → `message_start` stream event
4. **Content Streaming** → Multiple `content_block_delta` events with text chunks
5. **Message Complete** → `message_stop` stream event
6. **Final Result** → `result` data with summary
7. **Stream End** → `complete` event

### Tool Usage Flow
1. **Connection** → `connected` event
2. **System Init** → `system` data
3. **Message Start** → `message_start` 
4. **Tool Planning** → `content_block_start` with `tool_use` type
5. **Tool Parameters** → `content_block_delta` with `input_json_delta` (tool parameters streaming)
6. **Tool Execution** → `assistant` message with complete tool call
7. **Tool Result** → `user` message with tool output
8. **Response Generation** → New `message_start` → text streaming → `message_stop`
9. **Final Result** → `result` summary
10. **Stream End** → `complete` event

### Multi-Tool Flow
Complex queries may involve multiple tool calls in sequence, with each tool execution following the pattern above before moving to the next tool or generating the final response.

## Key Features

### Real-time Text Streaming
- Text appears incrementally via `content_block_delta` events
- Each delta contains a `text_delta` with partial content
- Enables typewriter-effect user interfaces

### Tool Execution Visibility
- See tool calls as they're planned with streaming parameters
- Full visibility into tool inputs and outputs
- Error states clearly marked with `is_error: true`

### Session Management
- Each stream maintains context with unique session IDs
- Sessions can be reused across multiple requests
- Working directory isolation per session

### Performance Metrics
- Real-time token usage tracking
- Cost calculation per request
- Execution time measurements (both total and API-specific)
- Turn count for conversation tracking

### Error Handling
- Tool execution errors are captured and streamed
- System errors trigger dedicated error events
- Graceful degradation - streams complete even with tool failures

## Usage Examples

### Basic Streaming Request
```bash
curl -N -X POST http://localhost:3000/claude/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is 2+2? Please explain step by step."}'
```

### Session Reuse
```bash
# First request - creates new session
curl -N -X POST http://localhost:3000/claude/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello, my name is John"}'
# Note the session_id in the response

# Second request - reuses session  
curl -N -X POST http://localhost:3000/claude/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is my name?", "sessionId": "abc-123-def"}'
```

### Tool Usage Request
```bash
curl -N -X POST http://localhost:3000/claude/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "List the files in the current directory and tell me what type of project this is."}'
```

## Client Implementation Considerations

### JavaScript EventSource Example
```javascript
const eventSource = new EventSource('http://localhost:3000/claude/stream', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prompt: "Your prompt here",
    sessionId: "optional-session-id"
  })
});

eventSource.addEventListener('connected', (event) => {
  console.log('Connected:', JSON.parse(event.data));
});

eventSource.addEventListener('data', (event) => {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'stream_event':
      if (data.event.type === 'content_block_delta' && 
          data.event.delta.type === 'text_delta') {
        // Append text to UI
        appendText(data.event.delta.text);
      }
      break;
    case 'result':
      console.log('Final result:', data.result);
      console.log('Cost:', data.total_cost_usd);
      break;
  }
});

eventSource.addEventListener('complete', (event) => {
  console.log('Stream completed:', JSON.parse(event.data));
  eventSource.close();
});

eventSource.addEventListener('error', (event) => {
  console.error('Stream error:', JSON.parse(event.data));
});
```

### Handling Tool Execution
```javascript
eventSource.addEventListener('data', (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'assistant' && 
      data.message.content[0]?.type === 'tool_use') {
    // Tool is being executed
    const tool = data.message.content[0];
    console.log(`Executing ${tool.name}:`, tool.input);
    showToolExecution(tool.name, tool.input);
  }
  
  if (data.type === 'user' && 
      data.message.content[0]?.type === 'tool_result') {
    // Tool result received
    const result = data.message.content[0];
    if (result.is_error) {
      showToolError(result.content);
    } else {
      showToolSuccess(result.content);
    }
  }
});
```

## Performance Characteristics

Based on testing:

- **Simple text responses**: ~3-5 seconds end-to-end
- **Single tool execution**: ~7-12 seconds  
- **Multi-tool workflows**: ~15-30+ seconds depending on complexity
- **Token costs**: Vary based on model and usage, tracked in real-time
- **Streaming latency**: Near real-time text delivery (< 100ms chunks)

## Error Scenarios

### Tool Execution Failures
- Tool failures are captured in tool results with `is_error: true`
- The stream continues and Claude can respond to the error
- Example: File not found, permission denied, command errors

### Network Issues
- Client disconnections are handled gracefully
- Server continues processing until completion
- Reconnection requires starting a new stream

### System Errors
- API rate limits, authentication failures
- Trigger `error` events and stream termination
- Client should handle reconnection logic

## Security Considerations

- **Permission Mode**: Currently set to `bypassPermissions` - review for production
- **Working Directory**: Sessions are isolated but share server filesystem access  
- **Tool Access**: Full tool suite available - consider restricting for specific use cases
- **Session Management**: Session IDs should be treated as sensitive data

## Monitoring and Debugging

### Key Metrics to Track
- `duration_ms` - Total execution time
- `duration_api_ms` - API-specific time  
- `total_cost_usd` - Cost per request
- `num_turns` - Conversation complexity
- `usage.output_tokens` - Response length

### Debug Information
- Each event includes `uuid` for tracing
- `session_id` for conversation tracking
- `parent_tool_use_id` for tool execution context
- Full tool parameters and results are logged

---

*Generated on: 2025-09-17*  
*API Version: 1.0.0*  
*Claude Model: claude-sonnet-4-20250514*