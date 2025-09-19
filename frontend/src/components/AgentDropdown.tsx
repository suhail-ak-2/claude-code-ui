'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { Users, Plus, Globe, FolderOpen } from 'lucide-react';
import { Agent } from '@/lib/agent-api';

interface AgentDropdownProps {
  agents: Agent[];
  showAgentModal: boolean;
  setShowAgentModal: (show: boolean) => void;
  setShowCommandDropdown: (show: boolean) => void;
  onSelectAgent: (agent: Agent) => void;
}

export function AgentDropdown({
  agents,
  showAgentModal,
  setShowAgentModal,
  setShowCommandDropdown,
  onSelectAgent
}: AgentDropdownProps) {
  return (
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl z-[9999]">
      <div className="p-3 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Users className="w-4 h-4" />
            {agents.length > 0 ? 'Available Agents' : 'Agent Management'}
          </span>
          <Dialog
            open={showAgentModal}
            onOpenChange={(open) => {
              setShowAgentModal(open);
              if (open) setShowCommandDropdown(false);
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="text-xs">
                <Plus className="w-3 h-3 mr-1" />
                New Agent
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      </div>

      <ScrollArea className="max-h-48">
        <div className="p-2 space-y-1">
          {agents.length > 0 ? (
            agents.map((agent) => (
              <div
                key={agent.metadata.name}
                onClick={() => onSelectAgent(agent)}
                className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: agent.metadata.color || '#3b82f6' }}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{agent.metadata.name}</span>
                    {agent.isGlobal ? (
                      <Globe className="w-3 h-3 text-blue-500" />
                    ) : (
                      <FolderOpen className="w-3 h-3 text-green-500" />
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {agent.metadata.description}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-2">
              <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-2">
                No agents found
              </div>
              <Dialog
                open={showAgentModal}
                onOpenChange={(open) => {
                  setShowAgentModal(open);
                  if (open) setShowCommandDropdown(false);
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Create your first agent
                  </Button>
                </DialogTrigger>
              </Dialog>
              <div className="text-xs text-gray-400 px-2 py-1">
                Create agents to customize Claude&apos;s behavior for specific tasks
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}