'use client';

import { useState } from 'react';
import { Conversation } from '@/components/ai-elements/conversation';
import { MessageContent } from '@/components/ai-elements/message';
import { 
  PromptInput, 
  PromptInputBody, 
  PromptInputTextarea, 
  PromptInputToolbar, 
  PromptInputSubmit,
  PromptInputAttachments,
  usePromptInputAttachments,
  type PromptInputMessage 
} from '@/components/ai-elements/prompt-input';
import { Response } from '@/components/ai-elements/response';
import { Tool, ToolHeader, ToolContent } from '@/components/ai-elements/tool';
import { CodeBlock } from '@/components/ai-elements/code-block';
import { Loader } from '@/components/ai-elements/loader';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Bot, User, Plus, MoreHorizontal, Send, Folder, Mic, MicOff, Paperclip } from 'lucide-react';
import { FormEvent } from 'react';

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

export default function ClaudeChatInterface() {
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [workingDirectory, setWorkingDirectory] = useState('/Users/suhail/Documents/claude-cli-api');
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  const handleSubmit = async (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = message.text || '';
    if (!prompt.trim() || isStreaming) return;

    // Add user message
    const userMessage: StreamMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: prompt
    };
    setMessages(prev => [...prev, userMessage]);
    
    setIsStreaming(true);
    setInputText(''); // Clear input after submitting

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
              
              // Handle different event types
              if (data.type === 'system' && data.session_id) {
                setSessionId(data.session_id);
              } else if (data.type === 'stream_event' && data.event) {
                handleStreamEvent(data);
              } else if (data.type === 'user' && data.message?.content?.[0]?.type === 'tool_result') {
                // Handle tool result - find the most recent tool and update it
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

  const handleStreamEvent = (data: StreamEvent) => {
    const { event } = data;
    
    if (event.type === 'content_block_start' && event.content_block?.type === 'text') {
      // Start a new text block - always create a new message for each text block
      const textMessage: StreamMessage = {
        id: `text-${Date.now()}-${event.index}`,
        role: 'assistant',
        content: '',
        isStreaming: true
      };
      setMessages(prev => [...prev, textMessage]);
    } else if (event.type === 'content_block_delta' && event.delta?.text) {
      // Handle regular text streaming - find the last streaming text assistant message
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
      // Add tool use as a separate message
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
      // Handle tool input streaming
      setMessages(prev => {
        const lastToolIndex = prev.findLastIndex(msg => 
          msg.type === 'tool_use' && msg.isStreaming
        );
        
        if (lastToolIndex !== -1) {
          return prev.map((msg, idx) => {
            if (idx === lastToolIndex) {
              const accumulatedJson = msg.content + event.delta.partial_json;
              
              // Try to parse the accumulated JSON to update toolInput
              try {
                const parsedInput = JSON.parse(accumulatedJson);
                return { 
                  ...msg, 
                  content: accumulatedJson,
                  toolInput: parsedInput 
                };
              } catch {
                // If JSON is incomplete, update content and show partial input
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
      // Stop streaming for the current block
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

  const startNewChat = () => {
    setMessages([]);
    setSessionId('');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/wav' });
        // Here you would typically send the audio to a speech-to-text service
        // For now, we'll just add a placeholder
        setInputText(prev => prev + "[Voice input recorded - speech-to-text integration needed]");
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Unable to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  // Custom attachment button component
  const AttachmentButton = () => {
    const attachments = usePromptInputAttachments();
    
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files) {
        attachments.add(files);
        // Reset the input
        event.target.value = '';
      }
    };

    return (
      <div className="relative">
        <input
          type="file"
          accept="image/*,.pdf,.txt,.md,.json,.js,.ts,.py,.html,.css,.yml,.yaml"
          multiple
          onChange={handleFileSelect}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        <Button
          type="button"
          variant="ghost"
          className="w-8 h-8 rounded-lg bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors p-0"
        >
          <Paperclip className="w-4 h-4" />
        </Button>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          {/* New Chat Button */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <Button 
              onClick={startNewChat}
              className="w-full justify-start gap-3 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600"
              variant="outline"
            >
              <Plus className="w-4 h-4" />
              New chat
            </Button>
          </div>
          
          {/* Chat History */}
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-1">
              {sessionId && (
                <div className="p-3 text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-md">
                  Current Session
                </div>
              )}
            </div>
          </ScrollArea>
          
          {/* Workspace Settings */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Folder className="w-4 h-4" />
              Workspace
            </div>
            <div className="space-y-2">
              <Input
                value={workingDirectory}
                onChange={(e) => setWorkingDirectory(e.target.value)}
                placeholder="/path/to/workspace"
                className="text-xs h-8 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              />
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Current: {workingDirectory.split('/').pop() || 'Root'}
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Claude CLI Interface
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500">
              {sessionId ? 'Connected' : 'Ready to connect'}
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(true)}
                className="p-2"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            )}
            <div>
              <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                Claude CLI
              </h1>
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Folder className="w-3 h-3" />
                {workingDirectory.split('/').pop() || 'Root'}
              </div>
            </div>
          </div>
          {sidebarOpen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(false)}
              className="p-2"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[60vh]">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <Bot className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    How can I help you today?
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    I'm Claude CLI - I can help with coding, file operations, and more!
                  </p>
                </div>
              </div>
            ) : (
              <Conversation className="py-8">
                {messages.map((message) => (
                  <div key={message.id} className={`flex gap-4 px-4 py-6 ${
                    message.role === 'user' 
                      ? 'bg-gray-50 dark:bg-gray-800/50' 
                      : ''
                  }`}>
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarFallback className={
                        message.role === 'user' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-green-500 text-white'
                      }>
                        {message.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 space-y-2">
                      <div className="font-medium text-gray-800 dark:text-gray-200">
                        {message.role === 'user' ? 'You' : 'Claude'}
                      </div>
                      
                      <MessageContent>
                        {message.type === 'tool_use' ? (
                          <Tool className="my-4">
                            <ToolHeader 
                              type={`tool-${message.toolName || 'unknown'}`}
                              state={message.isStreaming ? 'input-streaming' : (message.toolResult ? 'output-available' : 'input-available')}
                            />
                            <ToolContent>
                              <div className="space-y-3">
                                {/* Tool Input */}
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      Input {message.isStreaming && <Loader />}
                                    </span>
                                    {message.isStreaming && (
                                      <span className="text-xs text-blue-500 animate-pulse">Streaming...</span>
                                    )}
                                  </div>
                                  {message.isStreaming && message.content ? (
                                    <div className="bg-gray-50 dark:bg-gray-800 rounded border p-3">
                                      <div className="text-xs text-gray-500 mb-2">Streaming JSON:</div>
                                      <div className="font-mono text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                        {message.content}
                                        <span className="animate-pulse">|</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <CodeBlock 
                                      language="json" 
                                      code={JSON.stringify(message.toolInput, null, 2)} 
                                    />
                                  )}
                                </div>
                                
                                {/* Tool Result */}
                                {message.toolResult && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                        ✓ Result
                                      </span>
                                    </div>
                                    <CodeBlock 
                                      language="text" 
                                      code={message.toolResult} 
                                    />
                                  </div>
                                )}
                                
                                {/* Tool Status */}
                                {!message.toolResult && !message.isStreaming && (
                                  <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
                                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                                    Executing...
                                  </div>
                                )}
                              </div>
                            </ToolContent>
                          </Tool>
                        ) : (
                          <div className="prose dark:prose-invert max-w-none">
                            {message.role === 'assistant' ? (
                              <Response className="text-gray-700 dark:text-gray-300">
                                {message.content}
                              </Response>
                            ) : (
                              <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                {message.content}
                              </div>
                            )}
                          </div>
                        )}
                      </MessageContent>
                      
                      {message.isStreaming && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Loader />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </Conversation>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="max-w-4xl mx-auto">
            <PromptInput 
              onSubmit={handleSubmit} 
              className="relative border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-blue-500 dark:focus-within:ring-blue-400"
              accept="image/*,.pdf,.txt,.md,.json,.js,.ts,.py,.html,.css,.yml,.yaml"
              multiple={true}
              maxFiles={5}
              maxFileSize={10 * 1024 * 1024} // 10MB
            >
              {/* File Attachments Display */}
              <PromptInputAttachments className="p-2 border-b border-gray-200 dark:border-gray-600">
                {(attachment) => (
                  <div key={attachment.id} className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-1 text-sm">
                    <span className="truncate max-w-[200px]">{attachment.filename}</span>
                    <button 
                      onClick={() => {/* Remove attachment logic */}}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      ×
                    </button>
                  </div>
                )}
              </PromptInputAttachments>
              
              <PromptInputBody className="relative">
                <PromptInputTextarea 
                  name="message"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Message Claude CLI..."
                  disabled={isStreaming}
                  className="min-h-[60px] max-h-[200px] resize-none border-0 focus:ring-0 bg-transparent pr-32 py-4 text-gray-900 dark:text-gray-100 placeholder:text-gray-500"
                />
              </PromptInputBody>
              
              <PromptInputToolbar className="absolute right-2 bottom-2 flex items-center gap-2">
                {/* File Attachment Button */}
                <AttachmentButton />
                
                {/* Voice Recording Button */}
                <Button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isStreaming}
                  className={`w-8 h-8 rounded-lg transition-colors p-0 ${
                    isRecording 
                      ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                      : 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                  variant="ghost"
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
                
                {/* Send Button */}
                <PromptInputSubmit 
                  disabled={isStreaming || (!inputText.trim() && !isRecording)}
                  className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-600 dark:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed p-0"
                >
                  {isStreaming ? (
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </PromptInputSubmit>
              </PromptInputToolbar>
            </PromptInput>
            
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-4">
                <span>Claude CLI can make mistakes. Check important info.</span>
                {isRecording && (
                  <span className="flex items-center gap-1 text-red-500 animate-pulse">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    Recording...
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-400">
                Attach files, record voice, or type your message
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}