# Claude CLI API Streaming Endpoint Analysis Results

## Overview
Based on live testing of the `/claude/stream` endpoint, here's a comprehensive analysis of the streaming behavior and the different types of streams it provides.

## Stream Event Types Observed

### 1. **Connection Events**
```json
event: connected
data: {"type":"connected","timestamp":"2025-09-17T11:35:11.710Z"}
```
- **Purpose**: Confirms successful connection to the streaming endpoint
- **Timing**: Sent immediately upon connection establishment
- **Content**: Connection type and timestamp

### 2. **System Initialization Events**
```json
event: data
data: {
  "type": "system",
  "subtype": "init",
  "cwd": "/Users/suhail/Documents/claude-cli-api",
  "session_id": "7afc20ff-f419-424c-8a01-0701426047c5",
  "tools": ["Task","Bash","Glob","Grep","ExitPlanMode","Read","Edit","MultiEdit","Write","NotebookEdit","WebFetch","TodoWrite","WebSearch","BashOutput","KillBash"],
  "mcp_servers": [],
  "model": "claude-sonnet-4-20250514",
  "permissionMode": "bypassPermissions",
  "slash_commands": [...],
  "apiKeySource": "/login managed key",
  "output_style": "default",
  "uuid": "be6d8c22-9c59-48e0-8588-ed9d5b59af9d"
}
```
- **Purpose**: Provides session context and available capabilities
- **Key Information**:
  - Session ID for continuity
  - Available tools and commands
  - Working directory
  - Model being used
  - Permission settings

### 3. **Message Lifecycle Events**

#### A) Message Start
```json
event: data
data: {
  "type": "stream_event",
  "event": {
    "type": "message_start",
    "message": {
      "id": "msg_01HfTdvunVFWcK5eZReKvK4f",
      "type": "message",
      "role": "assistant",
      "model": "claude-sonnet-4-20250514",
      "content": [],
      "usage": {...}
    }
  },
  "session_id": "...",
  "uuid": "..."
}
```
- **Purpose**: Indicates Claude is beginning to generate a response
- **Contains**: Message metadata, usage statistics, unique identifiers

#### B) Message Delta (Updates)
```json
event: data
data: {
  "type": "stream_event",
  "event": {
    "type": "message_delta",
    "delta": {"stop_reason": "tool_use", "stop_sequence": null},
    "usage": {...}
  }
}
```
- **Purpose**: Provides updates to message metadata during generation
- **Contains**: Stop reason, usage updates, sequence information

#### C) Message Stop
```json
event: data
data: {
  "type": "stream_event",
  "event": {"type": "message_stop"}
}
```
- **Purpose**: Indicates Claude has finished generating the current message

### 4. **Content Block Events**

#### A) Content Block Start
```json
event: data
data: {
  "type": "stream_event",
  "event": {
    "type": "content_block_start",
    "index": 0,
    "content_block": {"type": "text", "text": ""}
  }
}
```
- **Purpose**: Signals the start of a new content block (text or tool use)
- **Types Observed**: 
  - `text` blocks for regular responses
  - `tool_use` blocks for function calls

#### B) Content Block Delta (Real-time Content)
```json
event: data
data: {
  "type": "stream_event",
  "event": {
    "type": "content_block_delta",
    "index": 0,
    "delta": {"type": "text_delta", "text": "4"}
  }
}
```
- **Purpose**: Provides real-time streaming of content as it's being generated
- **Delta Types**:
  - `text_delta`: Streaming text content
  - `input_json_delta`: Streaming tool parameters as they're generated

#### C) Content Block Stop
```json
event: data
data: {
  "type": "stream_event",
  "event": {
    "type": "content_block_stop",
    "index": 0
  }
}
```
- **Purpose**: Indicates completion of a content block

### 5. **Tool Execution Streams**

#### Tool Use Generation
```json
event: data
data: {
  "type": "stream_event",
  "event": {
    "type": "content_block_start",
    "index": 1,
    "content_block": {
      "type": "tool_use",
      "id": "toolu_019WpE1e6No9vwR41wAeSBGx",
      "name": "Bash",
      "input": {}
    }
  }
}
```
- **Purpose**: Shows when Claude decides to use a tool
- **Streams**: Tool parameters are streamed as `input_json_delta` events

#### Tool Parameter Streaming
```json
event: data
data: {
  "type": "stream_event",
  "event": {
    "type": "content_block_delta",
    "index": 1,
    "delta": {
      "type": "input_json_delta",
      "partial_json": "{\"command\": \"ls | head -3\", \"description\": \"List first 3 files in current directory\"}"
    }
  }
}
```
- **Purpose**: Real-time streaming of tool parameters as Claude generates them
- **Behavior**: JSON is built incrementally in `partial_json` field

#### Tool Results
```json
event: data
data: {
  "type": "user",
  "message": {
    "role": "user",
    "content": [{
      "tool_use_id": "toolu_019WpE1e6No9vwR41wAeSBGx",
      "type": "tool_result",
      "content": "dist\
examples\
FRONTEND_SETUP.md",
      "is_error": false
    }]
  }
}
```
- **Purpose**: Shows the result of tool execution
- **Error Handling**: `is_error` field indicates success/failure

### 6. **Error Handling Streams**

#### Tool Error Results
```json
event: data
data: {
  "type": "user",
  "message": {
    "role": "user",
    "content": [{
      "type": "tool_result",
      "content": "<tool_use_error>File does not exist.</tool_use_error>",
      "is_error": true,
      "tool_use_id": "toolu_01C5HkRa9zZiDAT4iYBA2oFn"
    }]
  }
}
```
- **Purpose**: Communicates tool execution errors
- **Format**: Error wrapped in `<tool_use_error>` tags
- **Flag**: `is_error: true` clearly indicates failure

### 7. **Session and Result Summary**

#### Final Result Event
```json
event: data
data: {
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "duration_ms": 7428,
  "duration_api_ms": 8472,
  "num_turns": 4,
  "result": "The 3 files are:\
- dist\
- examples  \
- FRONTEND_SETUP.md",
  "session_id": "7afc20ff-f419-424c-8a01-0701426047c5",
  "total_cost_usd": 0.01229335,
  "usage": {...},
  "permission_denials": []
}
```
- **Purpose**: Comprehensive summary of the entire interaction
- **Metrics**: Duration, cost, token usage, turn count
- **Status**: Success/error indication
- **Content**: Final consolidated result

#### Completion Event
```json
event: complete
data: {"sessionId":"7afc20ff-f419-424c-8a01-0701426047c5","completed":true}
```
- **Purpose**: Signals end of streaming session
- **Session Continuity**: Provides session ID for future requests

## Key Observations

### 1. **Real-time Granularity**
- Text content streams character by character via `text_delta` events
- Tool parameters stream as JSON is built incrementally
- Each piece of content has its own event with timing information

### 2. **Session Management**
- Each session gets a unique ID that persists across requests
- Session context (working directory, available tools) is established early
- Session IDs can be reused to maintain conversation context

### 3. **Tool Execution Visibility**
- Complete visibility into tool selection and parameter generation
- Real-time streaming of tool parameters as they're being constructed
- Clear error reporting with structured error messages
- Tool results are immediately streamed back

### 4. **Error Handling**
- Graceful error handling for file operations and other failures
- Errors are clearly flagged with `is_error: true`
- Error messages are descriptive and actionable
- System continues processing after non-fatal errors

### 5. **Performance Metrics**
- Detailed timing information (API duration vs total duration)
- Token usage tracking with cache information
- Cost tracking in USD
- Turn count for conversation length

### 6. **Message Structure**
- Each message goes through a complete lifecycle (start → content blocks → stop)
- Content blocks can be text or tool use
- Multiple content blocks can exist in a single message
- Each event has unique UUIDs for tracking

## Use Cases Demonstrated

1. **Simple Computation**: Direct text responses (2+2=4)
2. **Tool Execution**: File operations, bash commands
3. **Multi-step Operations**: Read file → Create file → List directory
4. **Error Scenarios**: Handling non-existent files gracefully
5. **Session Continuity**: Reusing sessions across requests

## Technical Implementation Notes

- **Protocol**: Server-Sent Events (SSE) with structured JSON payloads
- **Real-time**: Sub-second latency for streaming content
- **Reliability**: Robust error handling and recovery
- **Scalability**: Session-based architecture supports multiple concurrent users
- **Observability**: Comprehensive logging and metrics for monitoring

This streaming architecture provides excellent visibility into Claude's thinking process, tool usage decisions, and execution flow, making it ideal for interactive applications requiring real-time feedback.