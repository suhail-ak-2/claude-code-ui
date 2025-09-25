'use client';

import { Message, MessageContent } from '@/components/ai-elements/message';
import { Response } from '@/components/ai-elements/response';
import { Tool, ToolHeader, ToolContent } from '@/components/ai-elements/tool';
import { CodeBlock } from '@/components/ai-elements/code-block';
import { Loader } from '@/components/ai-elements/loader';
import { Image } from '@/components/ai-elements/image';

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

interface ChatMessageProps {
  message: StreamMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div className={`w-full max-w-none ${message.type === 'tool_use' ? 'mb-2' : 'mb-4'}`}>
      <Message from={message.role} key={message.id}>
        <MessageContent variant="flat" className="max-w-none break-words">
        {message.type === 'tool_use' ? (
          <Tool>
            <ToolHeader
              type={`tool-${message.toolName || 'unknown'}`}
              state={message.isStreaming ? 'input-streaming' : (message.toolResult ? 'output-available' : 'input-available')}
            />
            <ToolContent>
              <div className="space-y-2">
                {/* Tool Input */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
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
                      code={typeof message.toolInput === 'string' 
                        ? message.toolInput 
                        : JSON.stringify(message.toolInput, null, 2)}
                    />
                  )}
                </div>

                {/* Tool Result */}
                {message.toolResult && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">
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
                  <div className="flex items-center gap-2 text-xs text-yellow-600 dark:text-yellow-400 uppercase tracking-wide font-medium">
                    <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></div>
                    Executing
                  </div>
                )}
              </div>
            </ToolContent>
          </Tool>
        ) : (
          message.role === 'assistant' ? (
            <Response>
              {message.content}
            </Response>
          ) : (
            <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere">
              {message.images && message.images.length > 0 && (
                <div className="mb-3 space-y-2">
                  {message.images.map((image, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <Image
                        base64={image.data}
                        uint8Array={new Uint8Array()}
                        mediaType={image.media_type}
                        alt={image.alt || `Image ${index + 1}`}
                        className="max-h-96 object-contain bg-gray-50 dark:bg-gray-800"
                      />
                      {image.alt && (
                        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
                          {image.alt}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {message.content && (
                <div>{message.content}</div>
              )}
            </div>
          )
        )}

        {message.isStreaming && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader />
          </div>
        )}
        </MessageContent>
      </Message>
    </div>
  );
}