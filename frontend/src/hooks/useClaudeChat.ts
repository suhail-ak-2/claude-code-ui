'use client';

import { useState, useEffect } from 'react';
import { AgentAPI, type Agent, type CreateAgentRequest } from '@/lib/agent-api';

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
    agents,
    sendMessage,
    startNewChat,
    createAgent,
    loadAgents
  };
}