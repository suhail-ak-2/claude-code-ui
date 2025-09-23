'use client';

import { useState, useEffect } from 'react';
import { AgentAPI, type Agent, type CreateAgentRequest } from '@/lib/agent-api';
import { ChatHistoryAPI, type ConversationMessage } from '@/lib/chat-history-api';

interface StreamMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  type?: 'text' | 'tool_use' | 'tool_result';
  toolName?: string;
  toolInput?: any;
  toolResult?: string;
  isStreaming?: boolean;
}

interface StreamEvent {
  type: string;
  subtype?: string;
  session_id?: string;
  event?: any;
  result?: string;
  is_error?: boolean;
  usage?: any;
  message?: {
    content: Array<{
      type: string;
      content: string;
      tool_use_id?: string;
    }>;
  };
}

export function useClaudeChat(workingDirectory: string) {
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('claude-sonnet-4-20250514');
  const [sessionError, setSessionError] = useState<string>('');
  const [retryCount, setRetryCount] = useState<number>(0);
  const [isRecovering, setIsRecovering] = useState<boolean>(false);
  const [currentUsage, setCurrentUsage] = useState<{
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cachedInputTokens: number;
    reasoningTokens: number;
  }>({
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cachedInputTokens: 0,
    reasoningTokens: 0
  });

  // Load agents when working directory changes
  useEffect(() => {
    const loadAgentsEffect = async () => {
      console.log('Loading agents for:', workingDirectory);
      const result = await AgentAPI.listAgents(workingDirectory);
      console.log('Agent API result:', result);
      if (result.success && result.agents) {
        setAgents(result.agents);
        console.log('Loaded agents:', result.agents);
      }
    };
    loadAgentsEffect();
  }, [workingDirectory]);

  const loadAgents = async () => {
    const result = await AgentAPI.listAgents(workingDirectory);
    if (result.success && result.agents) {
      setAgents(result.agents);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setSessionId('');
    setSessionError('');
    setRetryCount(0);
    setIsRecovering(false);
  };

  const clearSessionError = () => {
    setSessionError('');
    setRetryCount(0);
    setIsRecovering(false);
  };

  const attemptSessionRecovery = async (originalSessionId: string, prompt: string) => {
    console.log('Attempting session recovery for:', originalSessionId);
    setIsRecovering(true);
    
    try {
      // Try to continue with original sessionId one more time
      const recoveryResult = await sendMessageWithRetry(prompt, originalSessionId, 1);
      
      if (recoveryResult.success) {
        console.log('Session recovery successful');
        setSessionError('');
        setRetryCount(0);
        setIsRecovering(false);
        return true;
      } else {
        // If recovery fails, start a new session
        console.log('Session recovery failed, starting new session');
        setSessionId('');
        setSessionError('');
        setRetryCount(0);
        
        const newSessionResult = await sendMessageWithRetry(prompt, undefined, 1);
        setIsRecovering(false);
        return newSessionResult.success;
      }
    } catch (error) {
      console.error('Session recovery error:', error);
      setIsRecovering(false);
      setSessionError('Failed to recover session');
      return false;
    }
  };

  const loadConversation = async (projectPath: string, sessionId: string) => {
    try {
      console.log('Loading conversation:', { projectPath, sessionId });

      // Create properly encoded project ID to match backend
      const projectId = projectPath.startsWith('/') 
        ? '-' + projectPath.substring(1).replace(/\//g, '-')
        : projectPath.replace(/\//g, '-');

      const conversation = await ChatHistoryAPI.getConversation(
        projectId,
        sessionId
      );

      console.log('Raw conversation data:', conversation);
      console.log('Total messages in conversation:', conversation.messages.length);

      // Convert conversation messages to StreamMessage format
      const streamMessages: StreamMessage[] = [];

      for (let i = 0; i < conversation.messages.length; i++) {
        const msg = conversation.messages[i];
        console.log(`Processing message ${i + 1}:`, { type: msg.type, hasMessage: !!msg.message });

        try {
          if (msg.type === 'user' && msg.message?.content) {
            // Handle user messages
            let content = '';

            if (Array.isArray(msg.message.content)) {
              // Handle array content format
              content = msg.message.content
                .map(c => {
                  if (typeof c === 'string') return c;
                  if (c && typeof c === 'object' && 'text' in c) return c.text;
                  if (c && typeof c === 'object' && 'type' in c && c.type === 'text') return c.text;
                  return JSON.stringify(c);
                })
                .filter(Boolean)
                .join(' ');
            } else if (typeof msg.message.content === 'string') {
              content = msg.message.content;
            } else {
              content = JSON.stringify(msg.message.content);
            }

            if (content.trim()) {
              streamMessages.push({
                id: msg.uuid,
                role: 'user',
                content: content,
                type: 'text'
              });
              console.log(`Added user message: "${content.substring(0, 50)}..."`);
            }
          } else if (msg.type === 'assistant' && msg.message?.content) {
            // Handle assistant messages - may include text and tool uses
            const content = msg.message.content;

            if (Array.isArray(content)) {
              for (let j = 0; j < content.length; j++) {
                const block = content[j];
                console.log(`Processing assistant block ${j + 1}:`, { type: block.type });

                if (block.type === 'text' && block.text) {
                  streamMessages.push({
                    id: `${msg.uuid}-text-${j}`,
                    role: 'assistant',
                    content: block.text,
                    type: 'text'
                  });
                  console.log(`Added assistant text: "${block.text.substring(0, 50)}..."`);
                } else if (block.type === 'tool_use') {
                  streamMessages.push({
                    id: `${msg.uuid}-tool-${block.id}`,
                    role: 'assistant',
                    content: `Using ${block.name}`,
                    type: 'tool_use',
                    toolName: block.name,
                    toolInput: JSON.stringify(block.input || {}) as string,
                    toolResult: '', // Will be filled by tool results
                    isStreaming: false
                  });
                  console.log(`Added tool use: ${block.name}`);
                }
              }
            } else if (typeof content === 'string') {
              streamMessages.push({
                id: msg.uuid,
                role: 'assistant',
                content,
                type: 'text'
              });
              console.log(`Added assistant string: "${content.substring(0, 50)}..."`);
            }
          } else {
            console.log(`Skipped message type: ${msg.type}`);
          }
        } catch (msgError) {
          console.error(`Error processing message ${i + 1}:`, msgError, msg);
        }
      }

      console.log(`Converted ${streamMessages.length} messages for display`);

      if (streamMessages.length === 0) {
        console.warn('No displayable messages found in conversation. This might be a summary-only or metadata-only conversation.');

        // Create a placeholder message indicating this is a summary-only conversation
        const summaryMessage = conversation.messages.find(m => m.type === 'summary');
        if (summaryMessage) {
          streamMessages.push({
            id: 'summary-placeholder',
            role: 'assistant',
            content: `This conversation appears to be a summary or metadata-only entry. No chat messages were found to display.`,
            type: 'text'
          });
        }
      }

      // Update state with loaded messages and ensure session continuation
      setMessages(streamMessages);
      setSessionId(sessionId);

      // Store the conversation context for session continuation
      console.log('Session loaded for continuation:', {
        sessionId,
        projectPath: conversation.projectPath,
        messageCount: streamMessages.length
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to load conversation:', error);
      return { success: false, error: 'Failed to load conversation' };
    }
  };

  const handleStreamEvent = (data: StreamEvent) => {
    const { event } = data;

    if (event.type === 'content_block_start' && event.content_block?.type === 'text') {
      const textMessage: StreamMessage = {
        id: `text-${Date.now()}-${event.index}`,
        role: 'assistant',
        content: '',
        isStreaming: true
      };
      setMessages(prev => [...prev, textMessage]);
    } else if (event.type === 'content_block_delta' && event.delta?.text) {
      setMessages(prev => {
        const lastStreamingIndex = prev.findLastIndex(msg =>
          msg.role === 'assistant' && msg.isStreaming && msg.type !== 'tool_use'
        );

        if (lastStreamingIndex !== -1) {
          return prev.map((msg, idx) => {
            if (idx === lastStreamingIndex) {
              const newContent = msg.content + event.delta.text;
              return { ...msg, content: newContent };
            }
            return msg;
          });
        }
        return prev;
      });
    } else if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
      const toolMessage: StreamMessage = {
        id: `tool-${Date.now()}-${event.content_block.id}`,
        role: 'assistant',
        content: '',
        type: 'tool_use',
        toolName: event.content_block.name,
        toolInput: event.content_block.input || {},
        isStreaming: true
      };

      setMessages(prev => [...prev, toolMessage]);
    } else if (event.type === 'content_block_delta' && event.delta?.partial_json) {
      setMessages(prev => {
        const lastToolIndex = prev.findLastIndex(msg =>
          msg.type === 'tool_use' && msg.isStreaming
        );

        if (lastToolIndex !== -1) {
          return prev.map((msg, idx) => {
            if (idx === lastToolIndex) {
              const accumulatedJson = msg.content + event.delta.partial_json;

              try {
                const parsedInput = JSON.parse(accumulatedJson);
                return {
                  ...msg,
                  content: accumulatedJson,
                  toolInput: parsedInput
                };
              } catch {
                return {
                  ...msg,
                  content: accumulatedJson,
                  toolInput: {
                    ...msg.toolInput,
                    _streaming_content: accumulatedJson
                  }
                };
              }
            }
            return msg;
          });
        }
        return prev;
      });
    } else if (event.type === 'content_block_stop') {
      setMessages(prev =>
        prev.map((msg) => {
          if (msg.isStreaming && ((event.index === 0 && msg.type !== 'tool_use') || msg.type === 'tool_use')) {
            return { ...msg, isStreaming: false };
          }
          return msg;
        })
      );
    }
  };

  const handleResult = (data: StreamEvent) => {
    if (data.usage) {
      // Update token usage from the result
      const usage = data.usage;
      setCurrentUsage({
        inputTokens: usage.input_tokens || 0,
        outputTokens: usage.output_tokens || 0,
        totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
        cachedInputTokens: usage.cache_read_input_tokens || 0,
        reasoningTokens: 0 // Claude doesn't have reasoning tokens yet
      });

      setMessages(prev =>
        prev.map((msg) =>
          msg.isStreaming ? { ...msg, isStreaming: false } : msg
        )
      );
    }
  };

  const performSendMessage = async (prompt: string, useSessionId?: string): Promise<boolean> => {
    const userMessage: StreamMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: prompt
    };
    setMessages(prev => [...prev, userMessage]);

    setIsStreaming(true);

    try {
      // Build request with proper session continuation
      const requestBody: {
        prompt: string;
        workingDirectory: string;
        sessionId?: string;
        model?: string;
      } = {
        prompt,
        workingDirectory: workingDirectory,
      };

      // Use provided sessionId or current sessionId
      const currentSessionId = useSessionId ?? sessionId;
      
      // Add sessionId if we have one for continuation
      if (currentSessionId) {
        requestBody.sessionId = currentSessionId;
        console.log('Continuing session:', currentSessionId);
      } else {
        // Only set model for new sessions (Claude CLI requirement)
        requestBody.model = selectedModel;
        console.log('Starting new session with model:', selectedModel);
      }

      const response = await fetch('http://localhost:3000/claude/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let streamComplete = false;
      let hasError = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done || streamComplete) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data: StreamEvent = JSON.parse(line.slice(6));

              if (data.type === 'system' && data.session_id) {
                setSessionId(data.session_id);
              } else if (data.type === 'stream_event' && data.event) {
                handleStreamEvent(data);
              } else if (data.type === 'user' && data.message?.content?.[0]?.type === 'tool_result') {
                const toolResult = data.message.content[0];
                setMessages(prev => {
                  const lastToolIndex = prev.findLastIndex(msg =>
                    msg.type === 'tool_use'
                  );

                  if (lastToolIndex !== -1) {
                    return prev.map((msg, idx) => {
                      if (idx === lastToolIndex) {
                        return {
                          ...msg,
                          toolResult: toolResult.content,
                          isStreaming: false
                        };
                      }
                      return msg;
                    });
                  }
                  return prev;
                });
              } else if (data.type === 'stream_event' && data.event?.type === 'message_delta' && data.event?.usage) {
                // Update usage during streaming
                const usage = data.event.usage;
                setCurrentUsage({
                  inputTokens: usage.input_tokens || 0,
                  outputTokens: usage.output_tokens || 0,
                  totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
                  cachedInputTokens: usage.cache_read_input_tokens || 0,
                  reasoningTokens: 0
                });
              } else if (data.type === 'result') {
                handleResult(data);
              } else if (data.type === 'complete') {
                streamComplete = true;
                break;
              } else if (data.type === 'error' || data.is_error) {
                console.error('Stream error:', data);
                hasError = true;
                streamComplete = true;
                break;
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }

      setIsStreaming(false);
      setMessages(prev =>
        prev.map((msg) =>
          msg.isStreaming ? { ...msg, isStreaming: false } : msg
        )
      );

      return !hasError;
    } catch (error) {
      console.error('Error in performSendMessage:', error);
      setIsStreaming(false);
      setMessages(prev =>
        prev.map((msg) =>
          msg.isStreaming ? { ...msg, isStreaming: false } : msg
        )
      );
      return false;
    }
  };

  const sendMessageWithRetry = async (
    prompt: string, 
    useSessionId?: string, 
    maxRetries: number = 3
  ): Promise<{ success: boolean; error?: string }> => {
    let currentRetry = 0;
    
    while (currentRetry < maxRetries) {
      try {
        const success = await performSendMessage(prompt, useSessionId);
        if (success) {
          return { success: true };
        }
        
        currentRetry++;
        if (currentRetry < maxRetries) {
          console.log(`Send message retry ${currentRetry}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * currentRetry)); // Exponential backoff
        }
      } catch (error) {
        console.error(`Send message attempt ${currentRetry + 1} failed:`, error);
        currentRetry++;
        
        if (currentRetry < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * currentRetry));
        } else {
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      }
    }
    
    return { success: false, error: 'Max retries exceeded' };
  };

  const sendMessage = async (prompt: string) => {
    if (!prompt.trim() || isStreaming) return;

    // Clear any previous session errors
    setSessionError('');

    try {
      const result = await sendMessageWithRetry(prompt, sessionId);
      if (!result.success) {
        // If retry failed, attempt session recovery if we had a session
        if (sessionId && retryCount < 3) {
          setRetryCount(prev => prev + 1);
          setSessionError(result.error || 'Session continuation failed');
          
          console.log('Attempting automatic session recovery');
          const recoverySuccess = await attemptSessionRecovery(sessionId, prompt);
          
          if (!recoverySuccess) {
            setSessionError('Unable to continue session. Please start a new conversation.');
          }
        } else {
          setSessionError(result.error || 'Failed to send message');
        }
      }
    } catch (error) {
      console.error('Unexpected error in sendMessage:', error);
      setSessionError('An unexpected error occurred');
    }
  };

  const createAgent = async (agentData: CreateAgentRequest) => {
    const result = await AgentAPI.createAgent({
      ...agentData,
      workingDirectory: agentData.isGlobal ? undefined : workingDirectory
    });

    if (result.success) {
      await loadAgents();
      return { success: true };
    } else {
      return { success: false, error: result.error || 'Failed to create agent' };
    }
  };

  return {
    messages,
    sessionId,
    isStreaming,
    agents,
    currentUsage,
    selectedModel,
    setSelectedModel,
    sendMessage,
    startNewChat,
    loadConversation,
    createAgent,
    loadAgents
  };
}