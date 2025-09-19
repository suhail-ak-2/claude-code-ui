'use client';

import { MessageContent } from '@/components/ai-elements/message';
import { Response } from '@/components/ai-elements/response';
import { Tool, ToolHeader, ToolContent } from '@/components/ai-elements/tool';
import { CodeBlock } from '@/components/ai-elements/code-block';
import { Loader } from '@/components/ai-elements/loader';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot, User } from 'lucide-react';

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

interface ChatMessageProps {
  message: StreamMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  return (
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
  );
}