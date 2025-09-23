import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { logger } from './logging';
import { sessionStore, SessionMetadata } from './sessionStore';

/**
 * Session state information
 */
export interface SessionState {
  sessionId: string;
  projectPath: string;
  isActive: boolean;
  lastActivity: number;
  createdAt: number;
  messageCount: number;
  model?: string;
  workingDirectory?: string;
  lastError?: string;
  retryCount: number;
}

/**
 * Session health check result
 */
export interface SessionHealthCheck {
  isValid: boolean;
  exists: boolean;
  isAccessible: boolean;
  lastActivity: number;
  error?: string;
}

/**
 * Session recovery options
 */
export interface SessionRecoveryOptions {
  maxRetries: number;
  retryDelay: number;
  fallbackToNewSession: boolean;
}

/**
 * Enhanced session manager for Claude CLI sessions
 * Provides session state tracking, validation, and recovery mechanisms
 */
export class SessionManager {
  private readonly sessionStates: Map<string, SessionState> = new Map();
  private readonly sessionTimeout: number = 30 * 60 * 1000; // 30 minutes
  private readonly maxRetries: number = 3;
  private readonly claudeProjectsPath: string;

  constructor() {
    this.claudeProjectsPath = path.join(homedir(), '.claude', 'projects');
    this.initializeSessionTracking();
    
    logger.info('SessionManager initialized', 'SessionManager', {
      claudeProjectsPath: this.claudeProjectsPath,
      sessionTimeout: this.sessionTimeout
    });
  }

  /**
   * Initialize session tracking from existing Claude CLI sessions
   */
  private initializeSessionTracking(): void {
    try {
      if (!fs.existsSync(this.claudeProjectsPath)) {
        logger.debug('Claude projects directory does not exist', 'SessionManager');
        return;
      }

      const projects = fs.readdirSync(this.claudeProjectsPath);
      let sessionCount = 0;

      for (const projectDir of projects) {
        if (projectDir.startsWith('.')) continue;

        const projectPath = path.join(this.claudeProjectsPath, projectDir);
        const stat = fs.statSync(projectPath);

        if (!stat.isDirectory()) continue;

        try {
          const files = fs.readdirSync(projectPath);
          const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

          for (const file of jsonlFiles) {
            const sessionId = file.replace('.jsonl', '');
            const filePath = path.join(projectPath, file);
            const stats = fs.statSync(filePath);

            // Extract project path from first line of session file
            let actualProjectPath = '';
            try {
              const content = fs.readFileSync(filePath, 'utf-8');
              const firstLine = content.split('\n')[0];
              if (firstLine) {
                const parsed = JSON.parse(firstLine);
                actualProjectPath = parsed.cwd || '';
              }
            } catch (e) {
              logger.debug(`Could not extract project path from ${filePath}`, 'SessionManager');
            }

            const sessionState: SessionState = {
              sessionId,
              projectPath: actualProjectPath,
              isActive: this.isRecentlyActive(stats.mtime.getTime()),
              lastActivity: stats.mtime.getTime(),
              createdAt: stats.birthtime.getTime(),
              messageCount: 0, // Will be populated on demand
              retryCount: 0
            };

            this.sessionStates.set(sessionId, sessionState);
            sessionCount++;
          }
        } catch (error) {
          logger.debug(`Error reading project directory ${projectDir}`, 'SessionManager', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      logger.info(`Initialized session tracking for ${sessionCount} sessions`, 'SessionManager');
    } catch (error) {
      logger.error('Failed to initialize session tracking', 'SessionManager', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Check if a timestamp represents recent activity
   */
  private isRecentlyActive(timestamp: number): boolean {
    return Date.now() - timestamp < this.sessionTimeout;
  }

  /**
   * Register a new session or update existing session state
   */
  registerSession(sessionId: string, projectPath: string, model?: string): void {
    const existingState = this.sessionStates.get(sessionId);
    
    const sessionState: SessionState = {
      sessionId,
      projectPath,
      isActive: true,
      lastActivity: Date.now(),
      createdAt: existingState?.createdAt || Date.now(),
      messageCount: existingState?.messageCount || 0,
      model,
      retryCount: 0
    };

    this.sessionStates.set(sessionId, sessionState);
    
    logger.debug('Session registered', 'SessionManager', {
      sessionId,
      projectPath,
      model
    });
  }

  /**
   * Update session activity
   */
  updateSessionActivity(sessionId: string): void {
    const sessionState = this.sessionStates.get(sessionId);
    if (sessionState) {
      sessionState.lastActivity = Date.now();
      sessionState.isActive = true;
      sessionState.messageCount++;
      this.sessionStates.set(sessionId, sessionState);
    }
  }

  /**
   * Mark session as having an error
   */
  markSessionError(sessionId: string, error: string): void {
    const sessionState = this.sessionStates.get(sessionId);
    if (sessionState) {
      sessionState.lastError = error;
      sessionState.retryCount++;
      sessionState.isActive = sessionState.retryCount < this.maxRetries;
      this.sessionStates.set(sessionId, sessionState);
      
      logger.warn('Session marked with error', 'SessionManager', {
        sessionId,
        error,
        retryCount: sessionState.retryCount
      });
    }
  }

  /**
   * Check session health
   */
  async checkSessionHealth(sessionId: string): Promise<SessionHealthCheck> {
    const sessionState = this.sessionStates.get(sessionId);
    
    if (!sessionState) {
      return {
        isValid: false,
        exists: false,
        isAccessible: false,
        lastActivity: 0,
        error: 'Session not found in tracking'
      };
    }

    try {
      // Check if session file exists
      const sessionFile = await this.getSessionFilePath(sessionId, sessionState.projectPath);
      const exists = fs.existsSync(sessionFile);
      
      if (!exists) {
        return {
          isValid: false,
          exists: false,
          isAccessible: false,
          lastActivity: sessionState.lastActivity,
          error: 'Session file does not exist'
        };
      }

      // Check if file is accessible
      try {
        fs.accessSync(sessionFile, fs.constants.R_OK | fs.constants.W_OK);
      } catch (error) {
        return {
          isValid: false,
          exists: true,
          isAccessible: false,
          lastActivity: sessionState.lastActivity,
          error: 'Session file is not accessible'
        };
      }

      // Check if session is recently active
      const isRecentlyActive = this.isRecentlyActive(sessionState.lastActivity);
      
      return {
        isValid: isRecentlyActive && sessionState.isActive && sessionState.retryCount < this.maxRetries,
        exists: true,
        isAccessible: true,
        lastActivity: sessionState.lastActivity,
        error: !isRecentlyActive ? 'Session inactive due to timeout' : 
               !sessionState.isActive ? 'Session marked as inactive' :
               sessionState.retryCount >= this.maxRetries ? 'Session exceeded max retries' : undefined
      };
    } catch (error) {
      return {
        isValid: false,
        exists: false,
        isAccessible: false,
        lastActivity: sessionState.lastActivity,
        error: error instanceof Error ? error.message : 'Unknown error during health check'
      };
    }
  }

  /**
   * Get session file path for a given session ID and project path
   */
  private async getSessionFilePath(sessionId: string, projectPath: string): Promise<string> {
    // Convert project path to directory name (matches Claude CLI behavior)
    const encodedPath = projectPath.startsWith('/') 
      ? '-' + projectPath.substring(1).replace(/\//g, '-')
      : projectPath.replace(/\//g, '-');
    
    return path.join(this.claudeProjectsPath, encodedPath, `${sessionId}.jsonl`);
  }

  /**
   * Validate session before continuation
   */
  async validateSessionForContinuation(sessionId: string): Promise<{
    isValid: boolean;
    canContinue: boolean;
    shouldRetry: boolean;
    shouldCreateNew: boolean;
    error?: string;
  }> {
    const health = await this.checkSessionHealth(sessionId);
    const sessionState = this.sessionStates.get(sessionId);
    
    if (!sessionState) {
      return {
        isValid: false,
        canContinue: false,
        shouldRetry: false,
        shouldCreateNew: true,
        error: 'Session not found'
      };
    }

    if (!health.exists) {
      return {
        isValid: false,
        canContinue: false,
        shouldRetry: false,
        shouldCreateNew: true,
        error: 'Session file does not exist'
      };
    }

    if (!health.isAccessible) {
      return {
        isValid: false,
        canContinue: false,
        shouldRetry: sessionState.retryCount < this.maxRetries,
        shouldCreateNew: sessionState.retryCount >= this.maxRetries,
        error: 'Session file not accessible'
      };
    }

    if (!health.isValid) {
      const shouldRetry = sessionState.retryCount < this.maxRetries && 
                         sessionState.isActive;
      
      return {
        isValid: false,
        canContinue: false,
        shouldRetry,
        shouldCreateNew: !shouldRetry,
        error: health.error
      };
    }

    return {
      isValid: true,
      canContinue: true,
      shouldRetry: false,
      shouldCreateNew: false
    };
  }

  /**
   * Get session state
   */
  getSessionState(sessionId: string): SessionState | undefined {
    return this.sessionStates.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): SessionState[] {
    return Array.from(this.sessionStates.values())
      .filter(session => session.isActive && this.isRecentlyActive(session.lastActivity));
  }

  /**
   * Cleanup inactive sessions
   */
  cleanupInactiveSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, sessionState] of this.sessionStates.entries()) {
      if (!this.isRecentlyActive(sessionState.lastActivity)) {
        sessionState.isActive = false;
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Marked ${cleanedCount} sessions as inactive`, 'SessionManager');
    }
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    total: number;
    active: number;
    inactive: number;
    withErrors: number;
  } {
    const sessions = Array.from(this.sessionStates.values());
    return {
      total: sessions.length,
      active: sessions.filter(s => s.isActive && this.isRecentlyActive(s.lastActivity)).length,
      inactive: sessions.filter(s => !s.isActive || !this.isRecentlyActive(s.lastActivity)).length,
      withErrors: sessions.filter(s => s.lastError).length
    };
  }
}

/**
 * Global session manager instance
 */
export const sessionManager = new SessionManager();