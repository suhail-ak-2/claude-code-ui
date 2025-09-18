# Claude CLI API Usage Examples

## Basic Usage

### 1. Start the API Server

```bash
# Development mode
npm run dev

# Production mode
npm run build && npm start

# Custom port
PORT=3001 npm start
```

### 2. Health Check

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-09-16T05:03:39.719Z"
}
```

### 3. Session Management

#### Create a Session

```bash
curl -X POST http://localhost:3001/sessions \
  -H "Content-Type: application/json" \
  -d '{"workingDirectory": "/path/to/your/project"}'
```

Response:
```json
{
  "success": true,
  "sessionId": "c7b3c9e7-ad58-491d-a549-ae008d72b08f",
  "session": {
    "id": "c7b3c9e7-ad58-491d-a549-ae008d72b08f",
    "workingDirectory": "/path/to/your/project",
    "createdAt": "2025-09-16T05:03:39.747Z",
    "lastUsed": "2025-09-16T05:03:39.747Z"
  }
}
```

#### List All Sessions

```bash
curl http://localhost:3001/sessions
```

#### Get Specific Session

```bash
curl http://localhost:3001/sessions/{sessionId}
```

#### Delete Session

```bash
curl -X DELETE http://localhost:3001/sessions/{sessionId}
```

### 4. Claude Interactions

#### Execute Prompt

```bash
curl -X POST http://localhost:3001/claude/execute \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "List files in the current directory",
    "sessionId": "your-session-id",
    "options": {
      "model": "sonnet",
      "dangerouslySkipPermissions": true
    }
  }'
```

#### Execute in Specific Session

```bash
curl -X POST http://localhost:3001/sessions/{sessionId}/execute \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is the content of package.json?",
    "options": {
      "outputFormat": "json"
    }
  }'
```

## JavaScript/Node.js Example

```javascript
const axios = require('axios');

class ClaudeAPIClient {
  constructor(baseURL = 'http://localhost:3001') {
    this.baseURL = baseURL;
    this.sessionId = null;
  }

  async createSession(workingDirectory) {
    const response = await axios.post(`${this.baseURL}/sessions`, {
      workingDirectory
    });
    this.sessionId = response.data.sessionId;
    return response.data;
  }

  async execute(prompt, options = {}) {
    const response = await axios.post(`${this.baseURL}/claude/execute`, {
      prompt,
      sessionId: this.sessionId,
      options
    });
    return response.data;
  }

  async deleteSession() {
    if (this.sessionId) {
      await axios.delete(`${this.baseURL}/sessions/${this.sessionId}`);
      this.sessionId = null;
    }
  }
}

// Usage
async function example() {
  const client = new ClaudeAPIClient();
  
  try {
    // Create session
    await client.createSession('/path/to/project');
    
    // Execute commands
    const result = await client.execute('What is 2+2?', {
      model: 'sonnet',
      dangerouslySkipPermissions: true
    });
    
    console.log(result);
    
  } finally {
    // Cleanup
    await client.deleteSession();
  }
}
```

## Python Example

```python
import requests
import json

class ClaudeAPIClient:
    def __init__(self, base_url='http://localhost:3001'):
        self.base_url = base_url
        self.session_id = None
    
    def create_session(self, working_directory):
        response = requests.post(
            f'{self.base_url}/sessions',
            json={'workingDirectory': working_directory}
        )
        data = response.json()
        self.session_id = data['sessionId']
        return data
    
    def execute(self, prompt, options=None):
        payload = {
            'prompt': prompt,
            'sessionId': self.session_id,
            'options': options or {}
        }
        response = requests.post(
            f'{self.base_url}/claude/execute',
            json=payload
        )
        return response.json()
    
    def delete_session(self):
        if self.session_id:
            requests.delete(f'{self.base_url}/sessions/{self.session_id}')
            self.session_id = None

# Usage
client = ClaudeAPIClient()
client.create_session('/path/to/project')

result = client.execute('Hello, what is 2+2?', {
    'model': 'sonnet',
    'dangerouslySkipPermissions': True
})

print(result)
client.delete_session()
```

## Advanced Options

### Model Selection

```json
{
  "prompt": "Your prompt here",
  "options": {
    "model": "sonnet",  // or "opus", "haiku", or full model name
    "outputFormat": "json",  // "text", "json", or "stream-json"
    "verbose": true
  }
}
```

### Tool Control

```json
{
  "prompt": "Your prompt here",
  "options": {
    "allowedTools": ["Bash", "Edit", "Read"],
    "disallowedTools": ["Write"],
    "dangerouslySkipPermissions": true
  }
}
```

## Error Handling

All responses include a `success` field. Failed requests return:

```json
{
  "success": false,
  "error": "Error description",
  "sessionId": "session-id-if-applicable",
  "executionTime": 1234
}
```

## Security Considerations

1. **Working Directory Validation**: The API validates that working directories exist
2. **Session Isolation**: Each session maintains its own working directory
3. **Timeout Protection**: Commands timeout after 60 seconds to prevent hanging
4. **Permission Flags**: Use `dangerouslySkipPermissions` carefully in trusted environments only

## Troubleshooting

### Claude CLI Authentication

If Claude CLI commands timeout, ensure:

1. Claude CLI is properly authenticated: `claude setup-token`
2. You have an active Claude subscription
3. The Claude CLI path is correct in `claudeWrapper.ts`

### Port Conflicts

If port 3000 is in use:

```bash
PORT=3001 npm start
```

### Session Management

Sessions are stored in memory and will be lost when the server restarts. For production use, consider implementing persistent session storage.