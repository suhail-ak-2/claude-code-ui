'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Sparkles, Zap, Brain, Map } from 'lucide-react';

interface ModelOption {
  id: string;
  name: string;
  description: string;
  pricing: string;
  icon: React.ReactNode;
  recommended?: boolean;
}

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  disabled?: boolean;
}

const MODELS: ModelOption[] = [
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Default (recommended)',
    description: 'Use the default model (currently Sonnet 4)',
    pricing: '$3/$15 per Mtok',
    icon: <Sparkles className="w-4 h-4" />,
    recommended: true
  },
  {
    id: 'opus',
    name: 'Opus',
    description: 'Opus 4.1 for complex tasks',
    pricing: '$15/$75 per Mtok',
    icon: <Brain className="w-4 h-4" />
  },
  {
    id: 'sonnet',
    name: 'Sonnet (1M context)',
    description: 'Sonnet 4 for long sessions',
    pricing: '$6/$22.50 per Mtok',
    icon: <Zap className="w-4 h-4" />
  },
  {
    id: 'opusplan',
    name: 'Opus Plan Mode',
    description: 'Use Opus 4.1 in plan mode, Sonnet 4 otherwise',
    pricing: 'Variable pricing',
    icon: <Map className="w-4 h-4" />
  }
];

export function ModelSelector({ selectedModel, onModelChange, disabled }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = MODELS.find(model => model.id === selectedModel) || MODELS[0];

  const handleModelSelect = (modelId: string) => {
    onModelChange(modelId);
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-8 px-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-gray-600 dark:text-gray-400 flex-shrink-0">
              {selectedOption.icon}
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
              {selectedOption.name}
            </span>
            <ChevronDown className="w-3 h-3 text-gray-500 dark:text-gray-400 flex-shrink-0" />
          </div>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-80 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg rounded-lg"
      >
        <DropdownMenuLabel className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-2 py-1">
          Select Model
        </DropdownMenuLabel>
        <div className="text-xs text-gray-500 dark:text-gray-400 px-2 pb-2">
          Switch between Claude models. Applies to this session.
        </div>
        <DropdownMenuSeparator className="my-2 bg-gray-200 dark:bg-gray-600" />

        {MODELS.map((model, index) => (
          <DropdownMenuItem
            key={model.id}
            onClick={() => handleModelSelect(model.id)}
            className={`p-3 rounded-md cursor-pointer transition-colors ${
              selectedModel === model.id
                ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <div className="flex items-start gap-3 w-full">
              <div className="flex-shrink-0 mt-0.5">
                <div className={`p-1.5 rounded-md ${
                  selectedModel === model.id
                    ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {model.icon}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-medium ${
                    selectedModel === model.id
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {index + 1}. {model.name}
                  </span>
                  {model.recommended && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded">
                      ✓
                    </span>
                  )}
                </div>

                <div className={`text-xs mb-1 ${
                  selectedModel === model.id
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {model.description}
                </div>

                <div className={`text-xs font-mono ${
                  selectedModel === model.id
                    ? 'text-blue-500 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {model.pricing}
                </div>
              </div>

              {selectedModel === model.id && (
                <div className="flex-shrink-0 text-blue-500 dark:text-blue-400">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                </div>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}