'use client';

import { Button } from '@/components/ui/button';
import {
  Context,
  ContextTrigger,
  ContextContent,
  ContextContentHeader,
  ContextContentBody,
  ContextContentFooter,
  ContextInputUsage,
  ContextOutputUsage,
  ContextCacheUsage
} from '@/components/ai-elements/context';
import { MoreHorizontal, Folder } from 'lucide-react';
import { getModelConfig } from '@/lib/model-config';

interface HeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  workingDirectory: string;
  sessionId: string;
  currentUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cachedInputTokens: number;
    reasoningTokens: number;
  };
  selectedModel: string;
}

export function Header({
  sidebarOpen,
  setSidebarOpen,
  workingDirectory,
  sessionId,
  currentUsage,
  selectedModel
}: HeaderProps) {
  const modelConfig = getModelConfig(selectedModel);

  return (
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
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
              Claude CLI
            </h1>
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Folder className="w-3 h-3" />
              {workingDirectory.split('/').pop() || 'Root'}
            </div>
          </div>

          {/* Live Token Usage */}
          {sessionId && currentUsage.totalTokens > 0 && (
            <Context
              maxTokens={modelConfig.maxTokens}
              usedTokens={currentUsage.totalTokens}
              usage={{
                inputTokens: currentUsage.inputTokens,
                outputTokens: currentUsage.outputTokens,
                totalTokens: currentUsage.totalTokens,
                cachedInputTokens: currentUsage.cachedInputTokens,
                reasoningTokens: currentUsage.reasoningTokens
              }}
              modelId={modelConfig.displayModelId}
            >
              <ContextTrigger />
              <ContextContent>
                <ContextContentHeader />
                <ContextContentBody>
                  <ContextInputUsage />
                  <ContextOutputUsage />
                  <ContextCacheUsage />
                </ContextContentBody>
                <ContextContentFooter />
              </ContextContent>
            </Context>
          )}
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
  );
}