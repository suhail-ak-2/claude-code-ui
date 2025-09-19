'use client';

import { useState } from 'react';
import { Conversation } from '@/components/ai-elements/conversation';
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
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Bot, User, Plus, MoreHorizontal, Send, Folder, Mic, MicOff, Paperclip } from 'lucide-react';
import { FormEvent } from 'react';

// Custom components
import { AgentDropdown } from '@/components/AgentDropdown';
import { AgentModal } from '@/components/AgentModal';
import { ChatMessage } from '@/components/ChatMessage';

// Custom hooks
import { useClaudeChat } from '@/hooks/useClaudeChat';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

// Types
import { type Agent, type CreateAgentRequest } from '@/lib/agent-api';

export default function ClaudeChatInterface() {
  const [inputText, setInputText] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [workingDirectory, setWorkingDirectory] = useState('/Users/suhail/Documents/claude-cli-api');
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [showCommandDropdown, setShowCommandDropdown] = useState(false);
  const [agentFormData, setAgentFormData] = useState<CreateAgentRequest>({
    name: '',
    description: '',
    content: '',
    model: 'sonnet',
    color: '#3b82f6',
    isGlobal: false,
    workingDirectory: workingDirectory
  });

  // Custom hooks
  const {
    messages,
    sessionId,
    isStreaming,
    agents,
    sendMessage,
    startNewChat,
    createAgent
  } = useClaudeChat(workingDirectory);

  const { isRecording, startRecording, stopRecording } = useVoiceRecorder();

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

  const handleSubmit = async (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = message.text || '';
    if (!prompt.trim() || isStreaming) return;

    setInputText('');
    setShowCommandDropdown(false); // Close any open dropdowns
    await sendMessage(prompt);
  };

  const handleInputChange = (value: string) => {
    setInputText(value);

    // Check for /agents command
    const shouldShow = value.includes('/agents');
    console.log('Input changed:', { value, shouldShow, agents: agents.length });

    setShowCommandDropdown(shouldShow);
  };

  const selectAgent = (agent: Agent) => {
    setInputText(`Use @${agent.metadata.name} agent: `);
    setShowCommandDropdown(false);
  };

  const handleCreateAgent = async () => {
    const result = await createAgent(agentFormData);

    if (result.success) {
      setShowAgentModal(false);
      setAgentFormData({
        name: '',
        description: '',
        content: '',
        model: 'sonnet',
        color: '#3b82f6',
        isGlobal: false,
        workingDirectory: workingDirectory
      });
    } else {
      alert(result.error || 'Failed to create agent');
    }
  };

  const handleVoiceRecording = async () => {
    if (isRecording) {
      const voiceText = stopRecording();
      if (voiceText) {
        setInputText(prev => prev + voiceText);
      }
    } else {
      const success = await startRecording();
      if (!success) {
        alert('Unable to access microphone. Please check permissions.');
      }
    }
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
                    I&apos;m Claude CLI - I can help with coding, file operations, and more!
                  </p>
                </div>
              </div>
            ) : (
              <Conversation className="py-8">
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
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
                    onChange={(e) => handleInputChange(e.target.value)}
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
                      onSelectAgent={selectAgent}
                    />
                  )}
                </div>
              </PromptInputBody>

              <PromptInputToolbar className="absolute right-2 bottom-2 flex items-center gap-2">
                <AttachmentButton />

                <Button
                  type="button"
                  onClick={handleVoiceRecording}
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
      </div>

      {/* Agent Creation Modal */}
      <AgentModal
        open={showAgentModal}
        onOpenChange={setShowAgentModal}
        formData={agentFormData}
        setFormData={setAgentFormData}
        onCreateAgent={handleCreateAgent}
      />
    </div>
  );
}