'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Plus, Folder } from 'lucide-react';

interface SidebarProps {
  sessionId: string;
  workingDirectory: string;
  setWorkingDirectory: (directory: string) => void;
  startNewChat: () => void;
}

export function Sidebar({
  sessionId,
  workingDirectory,
  setWorkingDirectory,
  startNewChat
}: SidebarProps) {
  return (
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
  );
}