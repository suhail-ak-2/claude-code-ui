'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Folder, MessageSquare, ChevronDown, ChevronRight, Clock, MessageCircle } from 'lucide-react';
import { ChatHistoryAPI, type ProjectSummary, type ConversationSummary } from '@/lib/chat-history-api';

interface SidebarProps {
  sessionId: string;
  workingDirectory: string;
  setWorkingDirectory: (directory: string) => void;
  startNewChat: () => void;
  onConversationSelect?: (projectPath: string, sessionId: string) => void;
}

export function Sidebar({
  sessionId,
  workingDirectory,
  setWorkingDirectory,
  startNewChat,
  onConversationSelect
}: SidebarProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadChatHistory();
  }, []);

  const loadChatHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const projectData = await ChatHistoryAPI.getProjects();
      setProjects(projectData);

      // Auto-expand the first project if there are conversations
      if (projectData.length > 0 && projectData[0].conversations.length > 0) {
        setExpandedProjects(new Set([projectData[0].projectPath]));
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
      setError('Failed to load chat history');
    } finally {
      setLoading(false);
    }
  };

  const toggleProject = (projectPath: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectPath)) {
      newExpanded.delete(projectPath);
    } else {
      newExpanded.add(projectPath);
    }
    setExpandedProjects(newExpanded);
  };

  const handleConversationClick = (conversation: ConversationSummary) => {
    if (onConversationSelect) {
      onConversationSelect(conversation.projectPath, conversation.sessionId);
    }
  };
  return (
    <div className="w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-hidden">
      {/* New Chat Button */}
      <div className="flex-shrink-0 p-3 border-b border-gray-200 dark:border-gray-700">
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
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full w-full" style={{paddingRight: '8px'}}>
          <div className="pl-3 pr-6 py-3">
        <div className="space-y-2">
          {loading && (
            <div className="p-3 text-sm text-gray-600 dark:text-gray-400 text-center">
              <MessageCircle className="w-4 h-4 mx-auto mb-2 animate-spin" />
              Loading chat history...
            </div>
          )}

          {error && (
            <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md">
              {error}
              <Button
                onClick={loadChatHistory}
                variant="ghost"
                size="sm"
                className="ml-2 h-6 text-xs"
              >
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && projects.length === 0 && (
            <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
              <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-50" />
              No chat history found
            </div>
          )}

          {projects.map((project) => (
            <div key={project.projectPath} className="space-y-1">
              <Collapsible
                open={expandedProjects.has(project.projectPath)}
                onOpenChange={() => toggleProject(project.projectPath)}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 h-8 px-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {expandedProjects.has(project.projectPath) ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                    <Folder className="w-3 h-3" />
                    <span className="flex-1 text-left truncate" title={project.displayName}>
                      {project.displayName}
                    </span>
                    <span className="text-gray-400 text-xs">
                      {project.totalConversations}
                    </span>
                  </Button>
                </CollapsibleTrigger>

                <CollapsibleContent className="pl-4 space-y-1">
                  {project.conversations.slice(0, 10).map((conversation) => (
                    <Button
                      key={conversation.sessionId}
                      onClick={() => handleConversationClick(conversation)}
                      variant="ghost"
                      className={`w-full justify-start gap-2 h-auto min-h-8 pl-2 pr-4 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        sessionId === conversation.sessionId
                          ? 'bg-gray-200 dark:bg-gray-600'
                          : ''
                      }`}
                    >
                      <MessageSquare className="w-3 h-3 flex-shrink-0" />
                      <div className="flex-1 text-left min-w-0 overflow-hidden">
                        <div className="truncate font-medium pr-2" title={conversation.title}>
                          {conversation.title}
                        </div>
                        {conversation.lastMessage && (
                          <div className="truncate text-gray-500 dark:text-gray-400 pr-2" title={conversation.lastMessage}>
                            {conversation.lastMessage}
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-gray-400 mt-1">
                          <Clock className="w-3 h-3" />
                          <span>{ChatHistoryAPI.formatTimestamp(conversation.timestamp)}</span>
                          <span>• {conversation.messageCount} msgs</span>
                        </div>
                      </div>
                    </Button>
                  ))}
                  {project.conversations.length > 10 && (
                    <div className="text-xs text-gray-400 text-center py-1">
                      +{project.conversations.length - 10} more conversations
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          ))}

          {sessionId && (
            <div className="mt-4 p-2 text-xs text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Active Session
              </div>
            </div>
          )}
        </div>
          </div>
        </ScrollArea>
      </div>

      {/* Workspace Settings */}
      <div className="flex-shrink-0 p-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
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
      <div className="flex-shrink-0 p-3 border-t border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Claude CLI Interface
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500">
          {sessionId ? 'Connected' : 'Ready to connect'}
        </div>
      </div>
    </div>
  );
}