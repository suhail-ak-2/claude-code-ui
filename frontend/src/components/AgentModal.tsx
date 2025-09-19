'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Globe, FolderOpen } from 'lucide-react';
import { CreateAgentRequest } from '@/lib/agent-api';

interface AgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: CreateAgentRequest;
  setFormData: (data: CreateAgentRequest | ((prev: CreateAgentRequest) => CreateAgentRequest)) => void;
  onCreateAgent: () => void;
}

export function AgentModal({
  open,
  onOpenChange,
  formData,
  setFormData,
  onCreateAgent
}: AgentModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Create New Agent
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="agentName">Agent Name</Label>
              <Input
                id="agentName"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="my-coding-agent"
                className="font-mono"
              />
              <p className="text-xs text-gray-500">Only letters, numbers, hyphens, and underscores</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agentColor">Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="agentColor"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="w-12 h-10 p-1 border rounded"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  placeholder="#3b82f6"
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agentDescription">Description</Label>
            <Input
              id="agentDescription"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="A helpful coding assistant"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="agentModel">Model</Label>
              <Select
                value={formData.model}
                onValueChange={(value) => setFormData(prev => ({ ...prev, model: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sonnet">Claude Sonnet</SelectItem>
                  <SelectItem value="haiku">Claude Haiku</SelectItem>
                  <SelectItem value="opus">Claude Opus</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Scope</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!formData.isGlobal}
                    onChange={() => setFormData(prev => ({ ...prev, isGlobal: false }))}
                    className="w-4 h-4"
                  />
                  <FolderOpen className="w-4 h-4 text-green-500" />
                  <span className="text-sm">Workspace</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={formData.isGlobal}
                    onChange={() => setFormData(prev => ({ ...prev, isGlobal: true }))}
                    className="w-4 h-4"
                  />
                  <Globe className="w-4 h-4 text-blue-500" />
                  <span className="text-sm">Global</span>
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agentContent">Agent Instructions</Label>
            <Textarea
              id="agentContent"
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="You are a helpful coding assistant that specializes in..."
              className="min-h-[120px]"
            />
            <p className="text-xs text-gray-500">
              Define the agent&apos;s role, expertise, and behavior instructions
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={onCreateAgent}
              disabled={!formData.name || !formData.description || !formData.content}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
            >
              Create Agent
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}