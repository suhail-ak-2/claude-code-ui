/**
 * Model configuration utility for Claude models
 */

export interface ModelConfig {
  maxTokens: number;
  displayModelId: string;
}

/**
 * Get model configuration based on model ID
 */
export function getModelConfig(modelId: string): ModelConfig {
  switch (modelId) {
    case 'claude-sonnet-4-20250514':
      return {
        maxTokens: 200000, // 200K context
        displayModelId: 'anthropic:claude-sonnet-4-20250514'
      };
    case 'opus':
      return {
        maxTokens: 200000, // 200K context
        displayModelId: 'anthropic:claude-opus-4-1-20250805'
      };
    case 'sonnet':
      return {
        maxTokens: 1000000, // 1M context
        displayModelId: 'anthropic:claude-3-5-sonnet-20241022'
      };
    case 'opusplan':
      return {
        maxTokens: 200000, // 200K context
        displayModelId: 'anthropic:claude-opus-4-1-20250805'
      };
    default:
      return {
        maxTokens: 200000,
        displayModelId: 'anthropic:claude-sonnet-4-20250514'
      };
  }
}