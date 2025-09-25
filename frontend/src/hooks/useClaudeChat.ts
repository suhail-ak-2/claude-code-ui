'use client';

import { useState, useEffect } from 'react';
import { AgentAPI, type Agent, type CreateAgentRequest } from '@/lib/agent-api';
import { ChatHistoryAPI } from '@/lib/chat-history-api';

interface StreamMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  type?: 'text' | 'tool_use' | 'tool_result';
  toolName?: string;
  toolInput?: Record<string, unknown> | string;
  toolResult?: string;
  isStreaming?: boolean;
  hasImages?: boolean;
  images?: Array<{
    data: string;
    media_type: string;
    alt?: string;
  }>;
}

interface StreamEvent {
  type: string;
  subtype?: string;
  session_id?: string;
  event?: Record<string, unknown>;
  result?: string;
  is_error?: boolean;
  usage?: Record<string, unknown>;
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
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('claude-sonnet-4-20250514');
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
  };

  const loadConversation = async (projectPath: string, sessionId: string) => {
    try {
      setIsLoadingConversation(true);
      console.log('Loading conversation:', { projectPath, sessionId });

      const conversation = await ChatHistoryAPI.getConversation(
        encodeURIComponent(projectPath.replace(/\//g, '-')),
        sessionId
      );

      console.log('Raw conversation data:', conversation);
      console.log('Total messages in conversation:', conversation.messages.length);

      // Convert conversation messages to StreamMessage format
      const streamMessages: StreamMessage[] = [];
      const toolUseMap = new Map<string, StreamMessage>(); // Track tool uses by their ID

      for (let i = 0; i < conversation.messages.length; i++) {
        const msg = conversation.messages[i];
        console.log(`Processing message ${i + 1}:`, { type: msg.type, role: msg.message?.role });

        try {
          // Skip sidechain messages (these are sub-agent conversations)
          if (msg.isSidechain) {
            console.log(`Skipped sidechain message`);
            continue;
          }

          if (msg.type === 'user' && msg.message?.role === 'user') {
            // Handle user messages - content can be string or array (for mixed content or tool results)
            const content = msg.message.content;
            
            if (typeof content === 'string') {
              // Regular user message
              if (content.trim()) {
                streamMessages.push({
                  id: msg.uuid,
                  role: 'user',
                  content: content.trim(),
                  type: 'text'
                });
                console.log(`Added user message: "${content.substring(0, 50)}..."`);
              }
            } else if (Array.isArray(content)) {
              // Array content - could be tool results or mixed content (text + images)
              let hasToolResults = false;
              let textContent = '';
              let hasImages = false;
              const imageData: Array<{ data: string; media_type: string; alt?: string }> = [];
              
              // Check if this is a tool result message or mixed content message
              for (const item of content) {
                if (item.type === 'tool_result' && item.tool_use_id && typeof item.tool_use_id === 'string') {
                  // This is a tool result message
                  hasToolResults = true;
                  const toolMessage = toolUseMap.get(item.tool_use_id);
                  if (toolMessage) {
                    // Handle tool result content - empty results are still valid completions
                    let resultContent = '';
                    if (typeof item.content === 'string') {
                      resultContent = item.content;
                    } else if (item.content) {
                      resultContent = JSON.stringify(item.content);
                    }
                    
                    // Check if we have stdout/stderr in the message's toolUseResult
                    const toolUseResult = msg.toolUseResult;
                    if (toolUseResult && (toolUseResult.stdout || toolUseResult.stderr)) {
                      const output = [];
                      if (toolUseResult.stdout) output.push(`stdout: ${toolUseResult.stdout}`);
                      if (toolUseResult.stderr) output.push(`stderr: ${toolUseResult.stderr}`);
                      resultContent = output.length > 0 ? output.join('\
') : resultContent;
                    }
                    
                    // Set result (even if empty) and mark as completed
                    toolMessage.toolResult = resultContent || '(No output)';
                    toolMessage.isStreaming = false;
                    console.log(`Added tool result for ${toolMessage.toolName} (ID: ${item.tool_use_id}): ${resultContent ? 'with content' : 'empty result'}`);
                  }
                } else if (item.type === 'text' && item.text) {
                  // Text content in mixed message
                  textContent += item.text;
                } else if (item.type === 'image' && item.source && typeof item.source === 'object' && 
                          'data' in item.source && 'media_type' in item.source &&
                          typeof item.source.data === 'string' && typeof item.source.media_type === 'string') {
                  // Image content in mixed message
                  hasImages = true;
                  imageData.push({
                    data: item.source.data,
                    media_type: item.source.media_type,
                    alt: `Image ${imageData.length + 1}`
                  });
                }
              }
              
              // If this is not a tool result message, create a user message
              if (!hasToolResults && (textContent.trim() || hasImages)) {
                const displayContent = textContent.trim() || (hasImages ? '[Image attached]' : '');
                streamMessages.push({
                  id: msg.uuid,
                  role: 'user',
                  content: displayContent,
                  type: 'text',
                  hasImages: hasImages,
                  images: imageData.length > 0 ? imageData : undefined
                });
                console.log(`Added mixed user message: "${displayContent.substring(0, 50)}..." (hasImages: ${hasImages})`);
              }
            }
          } else if (msg.type === 'assistant' && msg.message?.role === 'assistant') {
            // Handle assistant messages - content is array of objects
            const assistantContent = msg.message.content;

            if (Array.isArray(assistantContent)) {
              for (let j = 0; j < assistantContent.length; j++) {
                const block = assistantContent[j];
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
                  const toolBlock = block as { type: 'tool_use'; id: string; name: string; input?: Record<string, unknown> };
                  const toolMessage: StreamMessage = {
                    id: `${msg.uuid}-tool-${toolBlock.id}`,
                    role: 'assistant',
                    content: `Using ${toolBlock.name}`,
                    type: 'tool_use',
                    toolName: toolBlock.name,
                    toolInput: toolBlock.input || {},
                    toolResult: '', // Will be filled by tool results
                    isStreaming: true // Will be set to false when tool result is received
                  };
                  
                  streamMessages.push(toolMessage);
                  toolUseMap.set(toolBlock.id, toolMessage); // Track for later tool result matching
                  console.log(`Added tool use: ${toolBlock.name} (ID: ${toolBlock.id})`);
                }
              }
            } else if (typeof assistantContent === 'string') {
              streamMessages.push({
                id: msg.uuid,
                role: 'assistant',
                content: assistantContent,
                type: 'text'
              });
              console.log(`Added assistant string: "${assistantContent.substring(0, 50)}..."`);
            }
          } else {
            console.log(`Skipped message type: ${msg.type}, role: ${msg.message?.role}`);
          }
        } catch (msgError) {
          console.error(`Error processing message ${i + 1}:`, msgError, msg);
        }
      }

      console.log(`Converted ${streamMessages.length} messages for display`);
      console.log(`Matched ${Array.from(toolUseMap.values()).filter(t => t.toolResult).length} tool results`);

      // Mark any remaining tool messages as completed (no result found)
      Array.from(toolUseMap.values()).forEach(toolMsg => {
        if (toolMsg.isStreaming) {
          toolMsg.isStreaming = false;
          if (!toolMsg.toolResult) {
            toolMsg.toolResult = '(No output)';
          }
          console.log(`Marked tool ${toolMsg.toolName} as completed (${toolMsg.toolResult === '(No output)' ? 'no result' : 'with result'})`);
        }
      });

      if (streamMessages.length === 0) {
        console.warn('No displayable messages found in conversation. This might be a summary-only or metadata-only conversation.');
      }

      // Update state with loaded messages
      setMessages(streamMessages);
      setSessionId(sessionId);

      return { success: true };
    } catch (error) {
      console.error('Failed to load conversation:', error);
      return { success: false, error: 'Failed to load conversation' };
    } finally {
      setIsLoadingConversation(false);
    }
  };

  const handleStreamEvent = (data: StreamEvent) => {
    const { event } = data;
    if (!event) return;

    const eventAny = event as {
      type?: string;
      index?: number;
      content_block?: {
        type?: string;
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      };
      delta?: {
        text?: string;
        partial_json?: string;
      };
    };

    if (eventAny.type === 'content_block_start' && eventAny.content_block?.type === 'text') {
      const textMessage: StreamMessage = {
        id: `text-${Date.now()}-${eventAny.index || 0}`,
        role: 'assistant',
        content: '',
        isStreaming: true
      };
      setMessages(prev => [...prev, textMessage]);
    } else if (eventAny.type === 'content_block_delta' && eventAny.delta?.text) {
      setMessages(prev => {
        const lastStreamingIndex = prev.findLastIndex(msg =>
          msg.role === 'assistant' && msg.isStreaming && msg.type !== 'tool_use'
        );

        if (lastStreamingIndex !== -1) {
          return prev.map((msg, idx) => {
            if (idx === lastStreamingIndex && eventAny.delta?.text) {
              const newContent = msg.content + eventAny.delta.text;
              return { ...msg, content: newContent };
            }
            return msg;
          });
        }
        return prev;
      });
    } else if (eventAny.type === 'content_block_start' && eventAny.content_block?.type === 'tool_use') {
      const toolMessage: StreamMessage = {
        id: `tool-${Date.now()}-${eventAny.content_block.id}`,
        role: 'assistant',
        content: '',
        type: 'tool_use',
        toolName: eventAny.content_block.name,
        toolInput: eventAny.content_block.input || {},
        isStreaming: true
      };

      setMessages(prev => [...prev, toolMessage]);
    } else if (eventAny.type === 'content_block_delta' && eventAny.delta?.partial_json) {
      setMessages(prev => {
        const lastToolIndex = prev.findLastIndex(msg =>
          msg.type === 'tool_use' && msg.isStreaming
        );

        if (lastToolIndex !== -1) {
          return prev.map((msg, idx) => {
            if (idx === lastToolIndex && eventAny.delta?.partial_json) {
              const accumulatedJson = msg.content + eventAny.delta.partial_json;

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
                    ...(typeof msg.toolInput === 'object' && msg.toolInput !== null ? msg.toolInput : {}),
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
    } else if (eventAny.type === 'content_block_stop') {
      setMessages(prev =>
        prev.map((msg) => {
          if (msg.isStreaming && ((eventAny.index === 0 && msg.type !== 'tool_use') || msg.type === 'tool_use')) {
            return { ...msg, isStreaming: false };
          }
          return msg;
        })
      );
    }
  };

  const handleResult = (data: StreamEvent) => {
    if (data.usage && typeof data.usage === 'object') {
      // Update token usage from the result
      const usage = data.usage as {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number;
      };
      setCurrentUsage({
        inputTokens: Number(usage.input_tokens) || 0,
        outputTokens: Number(usage.output_tokens) || 0,
        totalTokens: (Number(usage.input_tokens) || 0) + (Number(usage.output_tokens) || 0),
        cachedInputTokens: Number(usage.cache_read_input_tokens) || 0,
        reasoningTokens: 0 // Claude doesn't have reasoning tokens yet
      });

      setMessages(prev =>
        prev.map((msg) =>
          msg.isStreaming ? { ...msg, isStreaming: false } : msg
        )
      );
    }
  };

  const sendMessage = async (prompt: string) => {
    if (!prompt.trim() || isStreaming) return;

    const userMessage: StreamMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: prompt
    };
    setMessages(prev => [...prev, userMessage]);

    setIsStreaming(true);

    try {
      const response = await fetch('http://localhost:3000/claude/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          sessionId: sessionId || undefined,
          workingDirectory: workingDirectory,
          model: selectedModel,
        }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let streamComplete = false;

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
                const usage = data.event.usage as {
                  input_tokens?: number;
                  output_tokens?: number;
                  cache_read_input_tokens?: number;
                };
                setCurrentUsage({
                  inputTokens: Number(usage.input_tokens) || 0,
                  outputTokens: Number(usage.output_tokens) || 0,
                  totalTokens: (Number(usage.input_tokens) || 0) + (Number(usage.output_tokens) || 0),
                  cachedInputTokens: Number(usage.cache_read_input_tokens) || 0,
                  reasoningTokens: 0
                });
              } else if (data.type === 'result') {
                handleResult(data);
              } else if (data.type === 'complete') {
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
    } catch (error) {
      console.error('Error streaming:', error);
      setIsStreaming(false);
      setMessages(prev =>
        prev.map((msg) =>
          msg.isStreaming ? { ...msg, isStreaming: false } : msg
        )
      );
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
    isLoadingConversation,
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