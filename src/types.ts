/**
 * Type definitions for Claude CLI API
 */

/**
 * Request interface for Claude CLI operations
 */
export interface ClaudeRequest {
  /** The prompt to send to Claude */
  prompt: string;
  
  /** Optional working directory for file operations */
  workingDirectory?: string;
  
  /** Optional session ID for resuming conversations */
  sessionId?: string;
  
  /** Optional configuration options */
  options?: ClaudeOptions;
}

/**
 * Configuration options for Claude CLI
 */
export interface ClaudeOptions {
  /** Model to use (e.g., 'sonnet', 'haiku', 'opus') */
  model?: string;
  
  /** Output format for Claude CLI responses */
  outputFormat?: 'text' | 'json' | 'stream-json';
  
  /** Enable verbose logging */
  verbose?: boolean;
  
  /** List of allowed tools that Claude can use */
  allowedTools?: string[];
  
  /** List of tools that Claude cannot use */
  disallowedTools?: string[];
  
  /** Skip permission prompts (use with caution) */
  dangerouslySkipPermissions?: boolean;
}

/**
 * Response interface for non-streaming Claude CLI operations
 */
export interface ClaudeResponse {
  /** Whether the operation was successful */
  success: boolean;
  
  /** The response data from Claude (if successful) */
  data?: string;
  
  /** Error message (if unsuccessful) */
  error?: string;
  
  /** Execution time in milliseconds */
  executionTime: number;
}

/**
 * Callback interface for streaming Claude CLI operations
 */
export interface StreamingCallback {
  /**
   * Called when data is received from Claude CLI
   * @param data - Parsed JSON data from Claude CLI stream
   */
  onData: (data: any) => void;
  
  /**
   * Called when an error occurs during streaming
   * @param error - Error message
   */
  onError: (error: string) => void;
  
  /**
   * Called when the streaming operation completes
   * @param sessionId - The session ID for this conversation
   */
  onComplete: (sessionId: string) => void;
}

/**
 * Common Claude CLI stream event types
 */
export interface ClaudeStreamEvent {
  type: 'system' | 'stream_event' | 'assistant' | 'user' | 'result';
  subtype?: string;
  session_id?: string;
  uuid?: string;
  [key: string]: any;
}

/**
 * Claude CLI system initialization event
 */
export interface ClaudeSystemEvent extends ClaudeStreamEvent {
  type: 'system';
  subtype: 'init';
  cwd: string;
  session_id: string;
  tools: string[];
  model: string;
  permissionMode: string;
}

/**
 * Claude CLI streaming message event
 */
export interface ClaudeMessageEvent extends ClaudeStreamEvent {
  type: 'stream_event';
  event: {
    type: 'message_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_delta' | 'message_stop';
    [key: string]: any;
  };
}

/**
 * Claude CLI result event
 */
export interface ClaudeResultEvent extends ClaudeStreamEvent {
  type: 'result';
  subtype: 'success' | 'error';
  is_error: boolean;
  duration_ms: number;
  result?: string;
  session_id: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    [key: string]: any;
  };
}

/**
 * Agent metadata from frontmatter
 */
export interface AgentMetadata {
  name: string;
  description: string;
  model?: string;
  color?: string;
  [key: string]: string | undefined;
}

/**
 * Agent file structure
 */
export interface Agent {
  metadata: AgentMetadata;
  content: string;
  filePath: string;
  isGlobal: boolean;
}

/**
 * Agent creation request
 */
export interface CreateAgentRequest {
  name: string;
  description: string;
  content: string;
  model?: string;
  color?: string;
  isGlobal?: boolean;
  workingDirectory?: string;
  metadata?: Record<string, any>;
}

/**
 * Agent update request
 */
export interface UpdateAgentRequest {
  description?: string;
  content?: string;
  model?: string;
  color?: string;
  metadata?: Record<string, any>;
}

/**
 * Agent list response
 */
export interface AgentListResponse {
  success: boolean;
  agents?: Agent[];
  error?: string;
}

/**
 * Agent operation response
 */
export interface AgentResponse {
  success: boolean;
  agent?: Agent;
  error?: string;
}
