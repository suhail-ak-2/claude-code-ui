import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { logger } from './logging';

/**
 * Persistent session metadata
 */
export interface SessionMetadata {
  sessionId: string;
  projectPath: string;
  model?: string;
  createdAt: number;
  lastActivity: number;
  messageCount: number;
  isActive: boolean;
  retryCount: number;
  lastError?: string;
  tags?: string[];
  customData?: Record<string, any>;
}

/**
 * Session backup data
 */
export interface SessionBackup {
  metadata: SessionMetadata;
  conversationHistory: any[];
  timestamp: number;
}

/**
 * Session store configuration
 */
export interface SessionStoreConfig {
  storePath: string;
  backupEnabled: boolean;
  backupInterval: number; // milliseconds
  maxBackups: number;
  compressionEnabled: boolean;
}

/**
 * Persistent session storage system
 * Provides local persistence for session state and conversation backup
 */
export class SessionStore {
  private readonly config: SessionStoreConfig;
  private readonly metadataFile: string;
  private readonly backupDir: string;
  private sessionMetadata: Map<string, SessionMetadata> = new Map();
  private backupTimer?: NodeJS.Timeout;

  constructor(config?: Partial<SessionStoreConfig>) {
    this.config = {
      storePath: path.join(homedir(), '.claude-cli-api', 'sessions'),
      backupEnabled: true,
      backupInterval: 5 * 60 * 1000, // 5 minutes
      maxBackups: 10,
      compressionEnabled: false,
      ...config
    };

    this.metadataFile = path.join(this.config.storePath, 'metadata.json');
    this.backupDir = path.join(this.config.storePath, 'backups');

    this.initialize();

    logger.info('SessionStore initialized', 'SessionStore', {
      storePath: this.config.storePath,
      backupEnabled: this.config.backupEnabled
    });
  }

  /**
   * Initialize the session store
   */
  private initialize(): void {
    try {
      // Create directories if they don't exist
      if (!fs.existsSync(this.config.storePath)) {
        fs.mkdirSync(this.config.storePath, { recursive: true });
      }

      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }

      // Load existing metadata
      this.loadMetadata();

      // Start backup timer if enabled
      if (this.config.backupEnabled) {
        this.startBackupTimer();
      }
    } catch (error) {
      logger.error('Failed to initialize SessionStore', 'SessionStore', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Load session metadata from disk
   */
  private loadMetadata(): void {
    try {
      if (fs.existsSync(this.metadataFile)) {
        const data = fs.readFileSync(this.metadataFile, 'utf-8');
        const metadata = JSON.parse(data);
        
        for (const [sessionId, session] of Object.entries(metadata)) {
          this.sessionMetadata.set(sessionId, session as SessionMetadata);
        }

        logger.debug(`Loaded ${this.sessionMetadata.size} session metadata entries`, 'SessionStore');
      }
    } catch (error) {
      logger.error('Failed to load session metadata', 'SessionStore', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Save session metadata to disk
   */
  private saveMetadata(): void {
    try {
      const metadata = Object.fromEntries(this.sessionMetadata.entries());
      fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2));
      
      logger.debug(`Saved ${this.sessionMetadata.size} session metadata entries`, 'SessionStore');
    } catch (error) {
      logger.error('Failed to save session metadata', 'SessionStore', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Start the backup timer
   */
  private startBackupTimer(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }

    this.backupTimer = setInterval(() => {
      this.performBackup();
    }, this.config.backupInterval);
  }

  /**
   * Store or update session metadata
   */
  public storeSession(metadata: SessionMetadata): void {
    this.sessionMetadata.set(metadata.sessionId, { ...metadata });
    this.saveMetadata();

    logger.debug('Session metadata stored', 'SessionStore', {
      sessionId: metadata.sessionId,
      projectPath: metadata.projectPath
    });
  }

  /**
   * Get session metadata
   */
  public getSession(sessionId: string): SessionMetadata | undefined {
    return this.sessionMetadata.get(sessionId);
  }

  /**
   * Update session activity
   */
  public updateSessionActivity(sessionId: string, increment: boolean = true): void {
    const session = this.sessionMetadata.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      if (increment) {
        session.messageCount++;
      }
      session.isActive = true;
      this.sessionMetadata.set(sessionId, session);
      this.saveMetadata();
    }
  }

  /**
   * Mark session as having an error
   */
  public markSessionError(sessionId: string, error: string): void {
    const session = this.sessionMetadata.get(sessionId);
    if (session) {
      session.lastError = error;
      session.retryCount++;
      session.isActive = session.retryCount < 3; // Max 3 retries
      this.sessionMetadata.set(sessionId, session);
      this.saveMetadata();

      logger.warn('Session marked with error in store', 'SessionStore', {
        sessionId,
        error,
        retryCount: session.retryCount
      });
    }
  }

  /**
   * Get all sessions with optional filtering
   */
  public getSessions(filter?: {
    isActive?: boolean;
    projectPath?: string;
    since?: number;
  }): SessionMetadata[] {
    let sessions = Array.from(this.sessionMetadata.values());

    if (filter) {
      if (filter.isActive !== undefined) {
        sessions = sessions.filter(s => s.isActive === filter.isActive);
      }
      if (filter.projectPath) {
        sessions = sessions.filter(s => s.projectPath === filter.projectPath);
      }
      if (filter.since) {
        sessions = sessions.filter(s => s.lastActivity > filter.since);
      }
    }

    return sessions.sort((a, b) => b.lastActivity - a.lastActivity);
  }

  /**
   * Remove session from store
   */
  public removeSession(sessionId: string): boolean {
    const removed = this.sessionMetadata.delete(sessionId);
    if (removed) {
      this.saveMetadata();
      logger.debug('Session removed from store', 'SessionStore', { sessionId });
    }
    return removed;
  }

  /**
   * Create a backup of active sessions
   */
  public async performBackup(): Promise<void> {
    try {
      const activeSessions = this.getSessions({ isActive: true });
      
      if (activeSessions.length === 0) {
        logger.debug('No active sessions to backup', 'SessionStore');
        return;
      }

      const timestamp = Date.now();
      const backupFile = path.join(this.backupDir, `backup-${timestamp}.json`);
      
      const backupData = {
        timestamp,
        sessionCount: activeSessions.length,
        sessions: activeSessions
      };

      fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
      
      // Cleanup old backups
      this.cleanupOldBackups();

      logger.info('Session backup created', 'SessionStore', {
        backupFile,
        sessionCount: activeSessions.length
      });
    } catch (error) {
      logger.error('Failed to create session backup', 'SessionStore', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Restore sessions from backup
   */
  public async restoreFromBackup(backupFile?: string): Promise<boolean> {
    try {
      let backupPath: string;

      if (backupFile) {
        backupPath = path.isAbsolute(backupFile) ? backupFile : path.join(this.backupDir, backupFile);
      } else {
        // Find the most recent backup
        const backups = fs.readdirSync(this.backupDir)
          .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
          .sort()
          .reverse();

        if (backups.length === 0) {
          logger.warn('No backups found for restoration', 'SessionStore');
          return false;
        }

        backupPath = path.join(this.backupDir, backups[0]);
      }

      const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
      
      // Restore session metadata
      for (const session of backupData.sessions) {
        this.sessionMetadata.set(session.sessionId, session);
      }

      this.saveMetadata();

      logger.info('Sessions restored from backup', 'SessionStore', {
        backupFile: backupPath,
        sessionCount: backupData.sessions.length
      });

      return true;
    } catch (error) {
      logger.error('Failed to restore from backup', 'SessionStore', {
        backupFile,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Cleanup old backup files
   */
  private cleanupOldBackups(): void {
    try {
      const backups = fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
        .map(f => ({
          file: f,
          path: path.join(this.backupDir, f),
          timestamp: parseInt(f.replace('backup-', '').replace('.json', ''))
        }))
        .sort((a, b) => b.timestamp - a.timestamp);

      // Remove excess backups
      if (backups.length > this.config.maxBackups) {
        const toRemove = backups.slice(this.config.maxBackups);
        
        for (const backup of toRemove) {
          fs.unlinkSync(backup.path);
        }

        logger.debug(`Cleaned up ${toRemove.length} old backup files`, 'SessionStore');
      }
    } catch (error) {
      logger.error('Failed to cleanup old backups', 'SessionStore', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get session statistics
   */
  public getStats(): {
    totalSessions: number;
    activeSessions: number;
    sessionsWithErrors: number;
    averageMessageCount: number;
    oldestSession?: number;
    newestSession?: number;
  } {
    const sessions = Array.from(this.sessionMetadata.values());
    
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.isActive).length,
      sessionsWithErrors: sessions.filter(s => s.lastError).length,
      averageMessageCount: sessions.length > 0 
        ? sessions.reduce((sum, s) => sum + s.messageCount, 0) / sessions.length 
        : 0,
      oldestSession: sessions.length > 0 
        ? Math.min(...sessions.map(s => s.createdAt))
        : undefined,
      newestSession: sessions.length > 0 
        ? Math.max(...sessions.map(s => s.createdAt))
        : undefined
    };
  }

  /**
   * Export session data for analysis or migration
   */
  public exportSessions(format: 'json' | 'csv' = 'json'): string {
    const sessions = Array.from(this.sessionMetadata.values());

    if (format === 'csv') {
      const headers = ['sessionId', 'projectPath', 'model', 'createdAt', 'lastActivity', 'messageCount', 'isActive', 'retryCount', 'lastError'];
      const rows = sessions.map(s => [
        s.sessionId,
        s.projectPath,
        s.model || '',
        new Date(s.createdAt).toISOString(),
        new Date(s.lastActivity).toISOString(),
        s.messageCount,
        s.isActive,
        s.retryCount,
        s.lastError || ''
      ]);

      return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    return JSON.stringify(sessions, null, 2);
  }

  /**
   * Cleanup and shutdown
   */
  public destroy(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }

    // Final backup before shutdown
    if (this.config.backupEnabled) {
      this.performBackup();
    }

    logger.info('SessionStore destroyed', 'SessionStore');
  }
}

/**
 * Global session store instance
 */
export const sessionStore = new SessionStore();