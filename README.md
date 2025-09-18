# Claude CLI API

A Node.js TypeScript API wrapper for Claude CLI with real-time streaming support.

## Features

- RESTful API endpoints for Claude CLI interaction
- Real-time streaming with Server-Sent Events (SSE)
- Session management with working directory isolation
- TypeScript support with proper type definitions
- Express.js server with CORS and security middleware

## Quick Start

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm run dev
```

## API Endpoints

### Execute Claude Command
```bash
POST /claude/execute
{
  "prompt": "What is 2+2?",
  "sessionId": "session-uuid", // optional
  "options": {
    "model": "sonnet",
    "dangerouslySkipPermissions": true
  }
}
```

### Streaming Endpoint
```bash
GET /claude/stream
Content-Type: text/event-stream

POST body: {
  "prompt": "Write a story...",
  "sessionId": "uuid-from-previous-response", // optional - reuse session
  "workingDirectory": "/path/to/project" // optional
}
```

## Streaming Events

The streaming endpoint returns Server-Sent Events with these types:
- `connected` - Connection established
- `data` - Claude CLI output (system, stream_event, assistant, result)
- `complete` - Stream finished

Real-time partial responses are delivered via `stream_event` events with `content_block_delta` containing text chunks.

## Session Management

Claude CLI automatically manages sessions. No explicit session creation is needed:

1. **New session**: Don't provide `sessionId` - Claude creates a new session
2. **Reuse session**: Use `sessionId` from previous response's `session_id` field
3. **Session persistence**: Sessions maintain conversation context across requests

```bash
# First request - creates new session
curl -N http://localhost:3000/claude/stream \
  -d '{"prompt": "Hello, my name is John"}'
# Response includes: "session_id": "abc-123-def"

# Second request - reuses session  
curl -N http://localhost:3000/claude/stream \
  -d '{"prompt": "What is my name?", "sessionId": "abc-123-def"}'
# Claude remembers: "Your name is John"
```

## Example Usage

See `examples/` directory for:
- `streaming-client.html` - Interactive web client
- `streaming-client.js` - Node.js client example
- `api-usage.md` - Detailed API documentation

## Requirements

- Node.js 16+
- Claude CLI installed and configured
- TypeScript 4.5+