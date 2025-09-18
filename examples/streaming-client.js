const axios = require('axios');

class ClaudeStreamingClient {
  constructor(baseURL = 'http://localhost:3001') {
    this.baseURL = baseURL;
  }

  async createSession(workingDirectory) {
    const response = await axios.post(`${this.baseURL}/sessions`, {
      workingDirectory
    });
    return response.data;
  }

  streamPrompt(prompt, options = {}) {
    return new Promise((resolve, reject) => {
      const { sessionId, model = 'sonnet', dangerouslySkipPermissions = true } = options;
      
      // Determine endpoint
      const endpoint = sessionId ? 
        `${this.baseURL}/sessions/${sessionId}/stream` : 
        `${this.baseURL}/claude/stream`;

      // Create request body
      const requestBody = {
        prompt: prompt,
        options: {
          model: model,
          dangerouslySkipPermissions: dangerouslySkipPermissions
        }
      };

      console.log(`🚀 Starting stream to: ${endpoint}`);
      console.log(`📝 Prompt: ${prompt}`);

      // Use axios to create the streaming request
      axios.post(endpoint, requestBody, {
        responseType: 'stream'
      }).then(response => {
        let buffer = '';
        let sessionIdFromStream = sessionId;

        response.data.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\
');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              const event = line.substring(7);
              console.log(`📡 Event: ${event}`);
            } else if (line.startsWith('data: ')) {
              const data = line.substring(6);
              if (data.trim()) {
                try {
                  const parsed = JSON.parse(data);
                  this.handleStreamData(parsed);
                  
                  // Capture session ID
                  if (parsed.session_id) {
                    sessionIdFromStream = parsed.session_id;
                  }
                  if (parsed.sessionId) {
                    sessionIdFromStream = parsed.sessionId;
                  }
                } catch (e) {
                  console.log(`📄 Raw data: ${data}`);
                }
              }
            }
          }
        });

        response.data.on('end', () => {
          console.log('✅ Stream completed');
          resolve({ success: true, sessionId: sessionIdFromStream });
        });

        response.data.on('error', (error) => {
          console.error('❌ Stream error:', error);
          reject(error);
        });

      }).catch(error => {
        console.error('❌ Connection error:', error.message);
        reject(error);
      });
    });
  }

  handleStreamData(data) {
    if (data.type === 'connected') {
      console.log('🔗 Connected to streaming endpoint');
    } else if (data.type === 'system') {
      console.log('🖥️  System:', JSON.stringify(data, null, 2));
    } else if (data.type === 'assistant' && data.message) {
      console.log('🤖 Assistant response received');
    } else if (data.type === 'result') {
      console.log('🎯 Result:', data.result || 'No result text');
    } else if (data.type === 'text' && data.text) {
      console.log('💬 Text:', data.text);
    } else if (data.error) {
      console.error('❌ Error:', data.error);
    } else if (data.completed) {
      console.log('✅ Request completed successfully');
    } else {
      console.log('📊 Data:', JSON.stringify(data, null, 2));
    }
  }

  async deleteSession(sessionId) {
    const response = await axios.delete(`${this.baseURL}/sessions/${sessionId}`);
    return response.data;
  }
}

// Example usage
async function example() {
  const client = new ClaudeStreamingClient();
  
  try {
    console.log('🎉 Claude CLI Streaming Client Example\
');

    // Create a session
    console.log('1. Creating session...');
    const session = await client.createSession(process.cwd());
    console.log(`✅ Session created: ${session.sessionId}\
`);

    // Stream a simple math question
    console.log('2. Streaming math question...');
    await client.streamPrompt('What is 2+2? Please explain step by step.', {
      sessionId: session.sessionId,
      model: 'sonnet',
      dangerouslySkipPermissions: true
    });

    console.log('\
3. Streaming file listing...');
    await client.streamPrompt('List the files in the current directory', {
      sessionId: session.sessionId,
      dangerouslySkipPermissions: true
    });

    // Clean up
    console.log('\
4. Cleaning up...');
    await client.deleteSession(session.sessionId);
    console.log('✅ Session deleted');

    console.log('\
🎊 Example completed successfully!');

  } catch (error) {
    console.error('❌ Example failed:', error.message);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  example();
}

module.exports = ClaudeStreamingClient;