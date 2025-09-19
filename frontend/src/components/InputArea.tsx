'use client';

import { Button } from '@/components/ui/button';
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
import { Send, Mic, MicOff, Paperclip } from 'lucide-react';
import { FormEvent } from 'react';
import { AgentDropdown } from '@/components/AgentDropdown';
import { ModelSelector } from '@/components/ModelSelector';
import { type Agent } from '@/lib/agent-api';

interface InputAreaProps {
  inputText: string;
  setInputText: (text: string) => void;
  isStreaming: boolean;
  isRecording: boolean;
  agents: Agent[];
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  showCommandDropdown: boolean;
  showAgentModal: boolean;
  setShowAgentModal: (show: boolean) => void;
  setShowCommandDropdown: (show: boolean) => void;
  onSubmit: (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => void;
  onSelectAgent: (agent: Agent) => void;
  onVoiceRecording: () => void;
  onInputChange: (value: string) => void;
}

export function InputArea({
  inputText,
  setInputText,
  isStreaming,
  isRecording,
  agents,
  selectedModel,
  setSelectedModel,
  showCommandDropdown,
  showAgentModal,
  setShowAgentModal,
  setShowCommandDropdown,
  onSubmit,
  onSelectAgent,
  onVoiceRecording,
  onInputChange
}: InputAreaProps) {
  // Attachment button component
  const AttachmentButton = () => {
    const attachments = usePromptInputAttachments();

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files) {
        attachments.add(files);
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
    <div className="border-t border-gray-200 dark:border-gray-700 p-4">
      <div className="max-w-4xl mx-auto">
        <PromptInput
          onSubmit={onSubmit}
          className="relative border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-blue-500 dark:focus-within:ring-blue-400"
          accept="image/*,.pdf,.txt,.md,.json,.js,.ts,.py,.html,.css,.yml,.yaml"
          multiple={true}
          maxFiles={5}
          maxFileSize={10 * 1024 * 1024}
        >
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
            <div className="relative">
              <PromptInputTextarea
                name="message"
                value={inputText}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder="Message Claude CLI... (type /agents to list agents)"
                disabled={isStreaming}
                className="min-h-[60px] max-h-[200px] resize-none border-0 focus:ring-0 bg-transparent pr-32 py-4 text-gray-900 dark:text-gray-100 placeholder:text-gray-500"
              />

              {/* Agent Dropdown */}
              {showCommandDropdown && (
                <AgentDropdown
                  agents={agents}
                  showAgentModal={showAgentModal}
                  setShowAgentModal={setShowAgentModal}
                  setShowCommandDropdown={setShowCommandDropdown}
                  onSelectAgent={onSelectAgent}
                />
              )}
            </div>
          </PromptInputBody>

          <PromptInputToolbar className="absolute right-2 bottom-2 flex items-center gap-2">
            <ModelSelector
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              disabled={isStreaming}
            />

            <AttachmentButton />

            <Button
              type="button"
              onClick={onVoiceRecording}
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
  );
}