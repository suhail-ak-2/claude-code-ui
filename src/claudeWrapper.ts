import * as pty from 'node-pty';
import * as fs from 'fs';
import { ClaudeRequest, ClaudeResponse, ClaudeOptions, StreamingCallback } from './types';
import { logger, telemetry } from './logging';

/**
 * Wrapper class for Claude CLI using node-pty for persistent session support
 * Provides both blocking and streaming execution modes with session management
 */
export class ClaudeWrapper {
  private readonly claudePath: string = '/Users/suhail/.bun/bin/claude';
  private readonly commandTimeout: number = 120000; // 2 minutes

  constructor() {
    this.validateClaudeCLI();
    logger.info('ClaudeWrapper initialized', 'ClaudeWrapper', {
      claudePath: this.claudePath,
      commandTimeout: this.commandTimeout
    });
  }

  /**
   * Validates that Claude CLI is available at the specified path
   * @throws Error if Claude CLI is not found
   */
  private validateClaudeCLI(): void {
    if (!fs.existsSync(this.claudePath)) {
      const error = new Error(`Claude CLI not found at ${this.claudePath}`);
      logger.error('Claude CLI validation failed', 'ClaudeWrapper', {
        claudePath: this.claudePath,
        error: error.message
      });
      throw error;
    }
    logger.debug('Claude CLI validation successful', 'ClaudeWrapper', {
      claudePath: this.claudePath
    });
  }

  /**
   * Execute a Claude prompt and return the complete response
   * @param request - The Claude request containing prompt and options
   * @returns Promise resolving to ClaudeResponse with success/error status
   */
  async executePrompt(request: ClaudeRequest): Promise<ClaudeResponse> {
    const startTime = Date.now();

    logger.info('Starting Claude CLI execution', 'ClaudeWrapper', {
      sessionId: request.sessionId,
      promptLength: request.prompt.length,
      workingDirectory: request.workingDirectory,
      model: request.model || 'sonnet'
    });

    // Start telemetry tracking
    const executionId = telemetry.startClaudeExecution(
      request.sessionId,
      !!request.sessionId,
      request.prompt.length,
      request.model || 'sonnet',
      request.workingDirectory,
      false
    );

    try {
      const result = await this.runClaudeCommand(
        request.prompt,
        request.workingDirectory,
        request.model,
        request.options
      );
      
      const executionTime = Date.now() - startTime;

      // Complete telemetry tracking
      telemetry.completeClaudeExecution(executionId, true);

      logger.info('Claude CLI execution completed successfully', 'ClaudeWrapper', {
        executionId,
        executionTime,
        resultLength: result.length
      });

      return {
        success: true,
        data: result,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Complete telemetry tracking with error
      telemetry.completeClaudeExecution(executionId, false, errorMessage);

      // Record error telemetry
      telemetry.recordError(
        'ClaudeWrapper',
        'executePrompt',
        error instanceof Error ? error : new Error(errorMessage),
        'high',
        {
          sessionId: request.sessionId,
          promptLength: request.prompt.length,
          workingDirectory: request.workingDirectory
        },
        request.sessionId
      );

      logger.error('Claude CLI execution failed', 'ClaudeWrapper', {
        executionId,
        executionTime,
        error: errorMessage
      });

      return {
        success: false,
        error: errorMessage,
        executionTime
      };
    }
  }

  /**
   * Execute a Claude prompt with real-time streaming callbacks
   * @param request - The Claude request containing prompt, options, and optional sessionId
   * @param callback - Callbacks for handling streaming data, errors, and completion
   * @returns Promise resolving to the final response text
   */
  async executePromptStreaming(request: ClaudeRequest, callback: StreamingCallback): Promise<string> {
    logger.info('Starting Claude CLI streaming execution', 'ClaudeWrapper', {
      sessionId: request.sessionId,
      promptLength: request.prompt.length,
      workingDirectory: request.workingDirectory,
      model: request.model || 'sonnet',
      isStreaming: true
    });

    // Start telemetry tracking
    const executionId = telemetry.startClaudeExecution(
      request.sessionId,
      !!request.sessionId,
      request.prompt.length,
      request.model || 'sonnet',
      request.workingDirectory,
      true
    );

    // Wrap callback to add telemetry
    const telemetryCallback: StreamingCallback = {
      onData: (data: any) => {
        logger.debug('Claude CLI streaming data received', 'ClaudeWrapper', {
          executionId,
          dataType: data.type,
          sessionId: data.session_id
        });
        callback.onData(data);
      },
      onError: (error: string) => {
        telemetry.completeClaudeExecution(executionId, false, error);
        telemetry.recordError(
          'ClaudeWrapper',
          'executePromptStreaming',
          new Error(error),
          'high',
          { sessionId: request.sessionId },
          request.sessionId
        );
        logger.error('Claude CLI streaming error', 'ClaudeWrapper', {
          executionId,
          error
        });
        callback.onError(error);
      },
      onComplete: (sessionId: string) => {
        telemetry.completeClaudeExecution(executionId, true);
        logger.info('Claude CLI streaming completed', 'ClaudeWrapper', {
          executionId,
          sessionId
        });
        callback.onComplete(sessionId);
      }
    };

    return this.runClaudeCommandStreaming(
      request.prompt,
      request.workingDirectory,
      request.model,
      request.options,
      request.sessionId,
      telemetryCallback
    );
  }

  /**
   * Execute Claude CLI command in blocking mode (non-streaming)
   */
  private runClaudeCommand(
    prompt: string,
    workingDirectory: string | undefined,
    model: string | undefined,
    options: ClaudeOptions | undefined
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = this.buildClaudeArgs(prompt, model, options, false);
      const process = this.spawnClaudeProcess(args, workingDirectory);
      
      let stdout = '';
      
      process.onData((data) => {
        stdout += this.processClaudeOutput(data.toString());
      });

      process.onExit((exitCode) => {
        if (exitCode.exitCode === 0) {
          resolve(stdout || 'No output received');
        } else {
          reject(new Error(`Claude CLI exited with code ${exitCode.exitCode}`));
        }
      });

      this.setupTimeout(process, reject);
    });
  }

  /**
   * Execute Claude CLI command with streaming support
   */
  private runClaudeCommandStreaming(
    prompt: string,
    workingDirectory: string | undefined,
    model: string | undefined,
    options: ClaudeOptions | undefined,
    sessionId: string | undefined,
    callback: StreamingCallback
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = this.buildClaudeArgs(prompt, model, options, true, sessionId);
      const process = this.spawnClaudeProcess(args, workingDirectory);
      
      let stdout = '';
      let detectedSessionId = '';
      let buffer = '';

      process.onData((data) => {
        const cleanOutput = this.cleanOutput(data.toString());
        buffer += cleanOutput;
        
        buffer = this.parseStreamingJSON(buffer, (parsedJson) => {
          if (parsedJson && Object.keys(parsedJson).length > 0) {
            if (parsedJson.session_id) {
              detectedSessionId = parsedJson.session_id;
            }
            callback.onData(parsedJson);
            if (parsedJson.type === 'text' && parsedJson.text) {
              stdout += parsedJson.text;
            }
          }
        });
      });

      process.onExit((exitCode) => {
        if (exitCode.exitCode === 0) {
          callback.onComplete(detectedSessionId || sessionId || '');
          resolve(stdout || 'No output received');
        } else {
          const error = `Claude CLI exited with code ${exitCode.exitCode}`;
          callback.onError(error);
          reject(new Error(error));
        }
      });

      this.setupTimeout(process, reject, callback);
    });
  }

  /**
   * Build Claude CLI arguments array based on request parameters
   */
  private buildClaudeArgs(
    prompt: string,
    model: string | undefined,
    options: ClaudeOptions | undefined,
    isStreaming: boolean,
    sessionId?: string
  ): string[] {
    const args: string[] = [];
    
    // Handle session resumption vs new session
    if (sessionId) {
      args.push('--resume', sessionId, '--print', prompt);
    } else {
      args.push('--print', prompt);
    }
    
    // Add common arguments
    args.push(
      '--output-format', 'stream-json',
      '--verbose',
      '--permission-mode', 'bypassPermissions',
      '--mcp-config', '.mcp.json'
    );
    
    // Add partial messages for streaming (not supported with --resume)
    if (isStreaming) {
      args.push('--include-partial-messages');
    }
    
    // Add model (only for new sessions)
    if (!sessionId) {
      const selectedModel = model || 'sonnet';
      args.push('--model', selectedModel);
    }
    
    // Add tool restrictions if specified
    this.addToolRestrictions(args, options);
    
    return args;
  }

  /**
   * Add tool restriction arguments to the args array
   */
  private addToolRestrictions(args: string[], options: ClaudeOptions | undefined): void {
    if (!options) return;
    
    if (options.allowedTools?.length) {
      options.allowedTools.forEach(tool => {
        args.push('--allowedTools', tool);
      });
    }
    
    if (options.disallowedTools?.length) {
      options.disallowedTools.forEach(tool => {
        args.push('--disallowedTools', tool);
      });
    }
  }

  /**
   * Spawn Claude CLI process with consistent environment for session persistence
   */
  private spawnClaudeProcess(args: string[], workingDirectory?: string): pty.IPty {
    return pty.spawn(this.claudePath, args, {
      cwd: workingDirectory || process.cwd(),
      env: {
        ...process.env,
        HOME: process.env.HOME, // Ensure HOME is consistent for session persistence
        USER: process.env.USER,  // Ensure USER is consistent for session persistence
      }
    });
  }

  /**
   * Clean ANSI control characters from output
   */
  private cleanOutput(rawOutput: string): string {
    return rawOutput.replace(/\x1b\[[0-9;]*[mGKH]/g, '');
  }

  /**
   * Process Claude CLI output for non-streaming mode
   */
  private processClaudeOutput(rawOutput: string): string {
    const cleanOutput = this.cleanOutput(rawOutput);
    const lines = cleanOutput.split('\n').filter(line => line.trim());
    let result = '';
    
    for (const line of lines) {
      // Skip empty lines and terminal prompts
      if (!line.trim() || line.includes('$') || line.includes('%')) continue;
      
      try {
        const response = JSON.parse(line);
        if (response.type === 'result' && response.result) {
          result += response.result;
        }
      } catch (parseError) {
        // If not JSON, treat as plain text
        if (line.trim()) {
          result += line + '\n';
        }
      }
    }
    
    return result;
  }

  /**
   * Setup timeout for Claude CLI process
   */
  private setupTimeout(
    process: pty.IPty, 
    reject: (error: Error) => void, 
    callback?: StreamingCallback
  ): void {
    setTimeout(() => {
      process.kill();
      const errorMessage = 'Claude CLI command timed out';
      if (callback) {
        callback.onError(errorMessage);
      }
      reject(new Error(errorMessage));
    }, this.commandTimeout);
  }

  /**
   * Parse streaming JSON from buffer, handling incomplete JSON objects
   */
  private parseStreamingJSON(buffer: string, onParsed: (json: any) => void): string {
    let remaining = buffer;
    let braceCount = 0;
    let start = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < remaining.length; i++) {
      const char = remaining[i];
      
      if (escaped) {
        escaped = false;
        continue;
      }
      
      if (char === '\\' && inString) {
        escaped = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (inString) continue;
      
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        
        if (braceCount === 0) {
          const jsonStr = remaining.substring(start, i + 1);
          try {
            const parsed = JSON.parse(jsonStr);
            onParsed(parsed);
          } catch (e) {
            // Skip invalid JSON
          }
          start = i + 1;
        }
      }
    }
    
    return remaining.substring(start);
  }

  /**
   * Cleanup method for the wrapper
   * Currently no cleanup needed for node-pty approach
   */
  destroy(): void {
    // No cleanup required
  }
}