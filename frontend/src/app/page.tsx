'use client';

import { useState, FormEvent } from 'react';
import { Conversation } from '@/components/ai-elements/conversation';
import { type PromptInputMessage } from '@/components/ai-elements/prompt-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot } from 'lucide-react';

// Custom components
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { InputArea } from '@/components/InputArea';
import { AgentModal } from '@/components/AgentModal';
import { ChatMessage } from '@/components/ChatMessage';

// Custom hooks
import { useClaudeChat } from '@/hooks/useClaudeChat';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

// Types
import { type Agent, type CreateAgentRequest } from '@/lib/agent-api';
import { ChatHistoryAPI } from '@/lib/chat-history-api';

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
    currentUsage,
    selectedModel,
    setSelectedModel,
    sendMessage,
    startNewChat,
    loadConversation,
    createAgent
  } = useClaudeChat(workingDirectory);

  const { isRecording, startRecording, stopRecording } = useVoiceRecorder();

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

  const handleConversationSelect = async (projectPath: string, selectedSessionId: string) => {
    try {
      // Update working directory to match the project
      setWorkingDirectory(projectPath);

      // Load the conversation using the hook
      const result = await loadConversation(projectPath, selectedSessionId);

      if (result.success) {
        console.log('Successfully loaded conversation');
      } else {
        alert(result.error || 'Failed to load conversation');
      }

    } catch (error) {
      console.error('Failed to load conversation:', error);
      alert('Failed to load conversation');
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Sidebar */}
      {sidebarOpen && (
        <Sidebar
          sessionId={sessionId}
          workingDirectory={workingDirectory}
          setWorkingDirectory={setWorkingDirectory}
          startNewChat={startNewChat}
          onConversationSelect={handleConversationSelect}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <Header
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          workingDirectory={workingDirectory}
          sessionId={sessionId}
          currentUsage={currentUsage}
          selectedModel={selectedModel}
        />

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
        <InputArea
          inputText={inputText}
          setInputText={setInputText}
          isStreaming={isStreaming}
          isRecording={isRecording}
          agents={agents}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          showCommandDropdown={showCommandDropdown}
          showAgentModal={showAgentModal}
          setShowAgentModal={setShowAgentModal}
          setShowCommandDropdown={setShowCommandDropdown}
          onSubmit={handleSubmit}
          onSelectAgent={selectAgent}
          onVoiceRecording={handleVoiceRecording}
          onInputChange={handleInputChange}
        />
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