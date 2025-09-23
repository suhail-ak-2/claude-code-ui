import { logger } from './logging';
import { sessionManager } from './sessionManager';
import { sessionStore } from './sessionStore';

/**
 * Error recovery strategy types
 */
export type RecoveryStrategy = 
  | 'retry'           // Retry the original request
  | 'fallback'        // Fall back to a new session
  | 'abort'           // Abort the operation
  | 'defer'           // Defer to manual intervention

/**
 * Recovery action result
 */
export interface RecoveryResult {
  success: boolean;
  strategy: RecoveryStrategy;
  newSessionId?: string;
  error?: string;
  retryAfter?: number; // milliseconds
}

/**
 * Error classification
 */
export interface ErrorClassification {
  type: 'network' | 'session' | 'system' | 'user' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  retryable: boolean;
  permanent: boolean;
}

/**
 * Recovery context information
 */
export interface RecoveryContext {
  sessionId?: string;
  operationType: 'chat' | 'load_conversation' | 'create_session';
  errorMessage: string;
  originalError: Error;
  retryCount: number;
  maxRetries: number;
  workingDirectory?: string;
  userPrompt?: string;
}

/**
 * Comprehensive error recovery system
 * Handles various failure scenarios with intelligent recovery strategies
 */
export class ErrorRecoverySystem {
  private readonly maxRetries: number = 3;
  private readonly retryDelay: number = 1000; // Base delay in milliseconds
  private readonly backoffMultiplier: number = 2;

  constructor() {
    logger.info('ErrorRecoverySystem initialized', 'ErrorRecovery');
  }

  /**
   * Classify an error to determine appropriate recovery strategy
   */
  classifyError(error: Error, context?: Partial<RecoveryContext>): ErrorClassification {
    const message = error.message.toLowerCase();
    
    // Network-related errors
    if (message.includes('fetch') || message.includes('network') || 
        message.includes('connection') || message.includes('timeout') ||
        message.includes('http 50') || message.includes('http 40')) {
      return {
        type: 'network',
        severity: message.includes('timeout') ? 'medium' : 'high',
        recoverable: true,
        retryable: true,
        permanent: false
      };
    }

    // Session-related errors
    if (message.includes('session') || message.includes('resume') ||
        message.includes('continuation') || message.includes('not found') ||
        message.includes('invalid session')) {
      return {
        type: 'session',
        severity: 'medium',
        recoverable: true,
        retryable: false, // Session errors usually require fallback
        permanent: false
      };
    }

    // System errors
    if (message.includes('claude cli') || message.includes('command') ||
        message.includes('spawn') || message.includes('permission') ||
        message.includes('file system')) {
      return {
        type: 'system',
        severity: 'high',
        recoverable: true,
        retryable: true,
        permanent: false
      };
    }

    // User input errors
    if (message.includes('validation') || message.includes('required') ||
        message.includes('invalid') || message.includes('malformed')) {
      return {
        type: 'user',
        severity: 'low',
        recoverable: false,
        retryable: false,
        permanent: true
      };
    }

    // Unknown/generic errors
    return {
      type: 'unknown',
      severity: 'medium',
      recoverable: true,
      retryable: true,
      permanent: false
    };
  }

  /**
   * Determine the best recovery strategy based on error classification and context
   */
  determineRecoveryStrategy(
    classification: ErrorClassification,
    context: RecoveryContext
  ): RecoveryStrategy {
    // User errors are not recoverable
    if (classification.type === 'user') {
      return 'abort';
    }

    // Critical system errors might need manual intervention
    if (classification.type === 'system' && classification.severity === 'critical') {
      return 'defer';
    }

    // Session errors usually require fallback to new session
    if (classification.type === 'session') {
      // But try retry first if we haven't retried yet
      if (context.retryCount === 0 && context.sessionId) {
        return 'retry';
      }
      return 'fallback';
    }

    // Network errors are retryable up to max retries
    if (classification.type === 'network') {
      if (context.retryCount < context.maxRetries) {
        return 'retry';
      } else {
        return 'abort';
      }
    }

    // System errors might benefit from retry
    if (classification.type === 'system') {
      if (context.retryCount < Math.min(2, context.maxRetries)) {
        return 'retry';
      } else {
        return 'defer';
      }
    }

    // Default strategy for unknown errors
    if (context.retryCount < context.maxRetries) {
      return 'retry';
    } else {
      return 'fallback';
    }
  }

  /**
   * Execute recovery strategy
   */
  async executeRecovery(
    strategy: RecoveryStrategy,
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    logger.info('Executing recovery strategy', 'ErrorRecovery', {
      strategy,
      sessionId: context.sessionId,
      operationType: context.operationType,
      retryCount: context.retryCount
    });

    switch (strategy) {
      case 'retry':
        return this.executeRetry(context);
        
      case 'fallback':
        return this.executeFallback(context);
        
      case 'abort':
        return this.executeAbort(context);
        
      case 'defer':
        return this.executeDefer(context);
        
      default:
        return {
          success: false,
          strategy,
          error: 'Unknown recovery strategy'
        };
    }
  }

  /**
   * Execute retry strategy
   */
  private async executeRetry(context: RecoveryContext): Promise<RecoveryResult> {
    const delay = this.calculateRetryDelay(context.retryCount);
    
    logger.info('Executing retry recovery', 'ErrorRecovery', {
      sessionId: context.sessionId,
      retryCount: context.retryCount,
      delay
    });

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, delay));

    // For session-related operations, validate the session first
    if (context.sessionId && context.operationType === 'chat') {
      try {
        const validation = await sessionManager.validateSessionForContinuation(context.sessionId);
        
        if (!validation.canContinue) {
          logger.warn('Session validation failed during retry, falling back', 'ErrorRecovery', {
            sessionId: context.sessionId,
            validation
          });
          return this.executeFallback(context);
        }
      } catch (validationError) {
        logger.error('Session validation error during retry', 'ErrorRecovery', {
          sessionId: context.sessionId,
          error: validationError instanceof Error ? validationError.message : 'Unknown error'
        });
        return this.executeFallback(context);
      }
    }

    return {
      success: true,
      strategy: 'retry',
      retryAfter: delay
    };
  }

  /**
   * Execute fallback strategy (create new session)
   */
  private async executeFallback(context: RecoveryContext): Promise<RecoveryResult> {
    logger.info('Executing fallback recovery', 'ErrorRecovery', {
      originalSessionId: context.sessionId,
      operationType: context.operationType
    });

    // Mark the original session as failed if it exists
    if (context.sessionId) {
      sessionManager.markSessionError(
        context.sessionId, 
        `Fallback triggered: ${context.errorMessage}`
      );
      
      // Update store as well
      sessionStore.markSessionError(
        context.sessionId,
        `Fallback recovery executed: ${context.errorMessage}`
      );
    }

    return {
      success: true,
      strategy: 'fallback',
      newSessionId: undefined // Will be generated by new session creation
    };
  }

  /**
   * Execute abort strategy
   */
  private async executeAbort(context: RecoveryContext): Promise<RecoveryResult> {
    logger.warn('Executing abort recovery', 'ErrorRecovery', {
      sessionId: context.sessionId,
      operationType: context.operationType,
      errorMessage: context.errorMessage
    });

    if (context.sessionId) {
      sessionManager.markSessionError(
        context.sessionId,
        `Operation aborted: ${context.errorMessage}`
      );
    }

    return {
      success: false,
      strategy: 'abort',
      error: 'Operation aborted due to unrecoverable error'
    };
  }

  /**
   * Execute defer strategy (manual intervention required)
   */
  private async executeDefer(context: RecoveryContext): Promise<RecoveryResult> {
    logger.error('Executing defer recovery - manual intervention required', 'ErrorRecovery', {
      sessionId: context.sessionId,
      operationType: context.operationType,
      errorMessage: context.errorMessage
    });

    if (context.sessionId) {
      sessionManager.markSessionError(
        context.sessionId,
        `Manual intervention required: ${context.errorMessage}`
      );
    }

    return {
      success: false,
      strategy: 'defer',
      error: 'Manual intervention required - please check system status'
    };
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    return Math.min(
      this.retryDelay * Math.pow(this.backoffMultiplier, retryCount),
      30000 // Max 30 seconds
    );
  }

  /**
   * Main recovery orchestration method
   */
  async handleError(
    error: Error,
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    logger.error('Handling error with recovery system', 'ErrorRecovery', {
      error: error.message,
      context: {
        sessionId: context.sessionId,
        operationType: context.operationType,
        retryCount: context.retryCount
      }
    });

    // Classify the error
    const classification = this.classifyError(error, context);
    
    logger.debug('Error classified', 'ErrorRecovery', {
      classification,
      errorMessage: error.message
    });

    // Determine recovery strategy
    const strategy = this.determineRecoveryStrategy(classification, context);
    
    logger.info('Recovery strategy determined', 'ErrorRecovery', {
      strategy,
      classification,
      retryCount: context.retryCount
    });

    // Execute recovery
    const result = await this.executeRecovery(strategy, context);
    
    logger.info('Recovery execution completed', 'ErrorRecovery', {
      strategy: result.strategy,
      success: result.success,
      newSessionId: result.newSessionId
    });

    return result;
  }

  /**
   * Health check for recovery system components
   */
  async performHealthCheck(): Promise<{
    sessionManager: boolean;
    sessionStore: boolean;
    overall: boolean;
  }> {
    try {
      // Test session manager
      const managerStats = sessionManager.getSessionStats();
      const managerHealthy = typeof managerStats.total === 'number';

      // Test session store
      const storeStats = sessionStore.getStats();
      const storeHealthy = typeof storeStats.totalSessions === 'number';

      const overall = managerHealthy && storeHealthy;

      logger.info('Recovery system health check completed', 'ErrorRecovery', {
        sessionManager: managerHealthy,
        sessionStore: storeHealthy,
        overall
      });

      return {
        sessionManager: managerHealthy,
        sessionStore: storeHealthy,
        overall
      };
    } catch (error) {
      logger.error('Recovery system health check failed', 'ErrorRecovery', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        sessionManager: false,
        sessionStore: false,
        overall: false
      };
    }
  }
}

/**
 * Global error recovery system instance
 */
export const errorRecovery = new ErrorRecoverySystem();