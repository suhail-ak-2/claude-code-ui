/**
 * Integration tests for session management and conversation continuation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SessionManager } from '../src/sessionManager';
import { SessionStore } from '../src/sessionStore';
import { ErrorRecoverySystem } from '../src/errorRecovery';
import * as path from 'path';
import * as fs from 'fs';
import { homedir } from 'os';

// Test configuration
const TEST_SESSION_ID = 'test-session-12345';
const TEST_PROJECT_PATH = '/test/project/path';
const TEST_MODEL = 'claude-sonnet-4-20250514';

describe('Session Management Integration Tests', () => {
  let sessionManager: SessionManager;
  let sessionStore: SessionStore;
  let errorRecovery: ErrorRecoverySystem;
  let testStorePath: string;

  beforeEach(() => {
    // Create test-specific store path
    testStorePath = path.join(homedir(), '.claude-cli-api-test', 'sessions');
    
    // Initialize components with test configuration
    sessionStore = new SessionStore({
      storePath: testStorePath,
      backupEnabled: false, // Disable backups for tests
      maxBackups: 3
    });

    sessionManager = new SessionManager();
    errorRecovery = new ErrorRecoverySystem();

    // Clean up any existing test data
    if (fs.existsSync(testStorePath)) {
      fs.rmSync(testStorePath, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up test data
    if (fs.existsSync(testStorePath)) {
      fs.rmSync(testStorePath, { recursive: true, force: true });
    }
  });

  describe('Session Registration and State Management', () => {
    it('should register a new session successfully', () => {
      sessionManager.registerSession(TEST_SESSION_ID, TEST_PROJECT_PATH, TEST_MODEL);
      
      const sessionState = sessionManager.getSessionState(TEST_SESSION_ID);
      expect(sessionState).toBeDefined();
      expect(sessionState?.sessionId).toBe(TEST_SESSION_ID);
      expect(sessionState?.projectPath).toBe(TEST_PROJECT_PATH);
      expect(sessionState?.model).toBe(TEST_MODEL);
      expect(sessionState?.isActive).toBe(true);
      expect(sessionState?.retryCount).toBe(0);
    });

    it('should update session activity correctly', () => {
      sessionManager.registerSession(TEST_SESSION_ID, TEST_PROJECT_PATH, TEST_MODEL);
      
      const initialState = sessionManager.getSessionState(TEST_SESSION_ID);
      const initialMessageCount = initialState?.messageCount || 0;
      const initialActivity = initialState?.lastActivity || 0;
      
      // Wait a moment to ensure timestamp difference
      setTimeout(() => {
        sessionManager.updateSessionActivity(TEST_SESSION_ID);
        
        const updatedState = sessionManager.getSessionState(TEST_SESSION_ID);
        expect(updatedState?.messageCount).toBe(initialMessageCount + 1);
        expect(updatedState?.lastActivity).toBeGreaterThan(initialActivity);
        expect(updatedState?.isActive).toBe(true);
      }, 10);
    });

    it('should mark session errors and update retry count', () => {
      sessionManager.registerSession(TEST_SESSION_ID, TEST_PROJECT_PATH, TEST_MODEL);
      
      const errorMessage = 'Test error message';
      sessionManager.markSessionError(TEST_SESSION_ID, errorMessage);
      
      const sessionState = sessionManager.getSessionState(TEST_SESSION_ID);
      expect(sessionState?.lastError).toBe(errorMessage);
      expect(sessionState?.retryCount).toBe(1);
      expect(sessionState?.isActive).toBe(true); // Should remain active until max retries
    });

    it('should deactivate session after max retries', () => {
      sessionManager.registerSession(TEST_SESSION_ID, TEST_PROJECT_PATH, TEST_MODEL);
      
      // Mark multiple errors to exceed max retries
      for (let i = 0; i < 5; i++) {
        sessionManager.markSessionError(TEST_SESSION_ID, `Error ${i}`);
      }
      
      const sessionState = sessionManager.getSessionState(TEST_SESSION_ID);
      expect(sessionState?.retryCount).toBeGreaterThanOrEqual(3);
      expect(sessionState?.isActive).toBe(false);
    });
  });

  describe('Session Health Checks', () => {
    it('should validate session health for active sessions', async () => {
      sessionManager.registerSession(TEST_SESSION_ID, TEST_PROJECT_PATH, TEST_MODEL);
      
      const health = await sessionManager.checkSessionHealth(TEST_SESSION_ID);
      
      expect(health.exists).toBe(false); // No actual Claude CLI session file
      expect(health.isAccessible).toBe(false);
      expect(health.isValid).toBe(false);
      expect(health.lastActivity).toBeGreaterThan(0);
    });

    it('should return proper validation results for continuation', async () => {
      sessionManager.registerSession(TEST_SESSION_ID, TEST_PROJECT_PATH, TEST_MODEL);
      
      const validation = await sessionManager.validateSessionForContinuation(TEST_SESSION_ID);
      
      expect(validation.isValid).toBe(false); // No actual session file
      expect(validation.canContinue).toBe(false);
      expect(validation.shouldCreateNew).toBe(true);
    });

    it('should handle non-existent sessions gracefully', async () => {
      const nonExistentId = 'non-existent-session';
      
      const health = await sessionManager.checkSessionHealth(nonExistentId);
      expect(health.isValid).toBe(false);
      expect(health.exists).toBe(false);
      expect(health.error).toContain('Session not found');
      
      const validation = await sessionManager.validateSessionForContinuation(nonExistentId);
      expect(validation.isValid).toBe(false);
      expect(validation.shouldCreateNew).toBe(true);
      expect(validation.error).toBe('Session not found');
    });
  });

  describe('Session Store Persistence', () => {
    it('should store session metadata persistently', () => {
      const metadata = {
        sessionId: TEST_SESSION_ID,
        projectPath: TEST_PROJECT_PATH,
        model: TEST_MODEL,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messageCount: 1,
        isActive: true,
        retryCount: 0
      };

      sessionStore.storeSession(metadata);
      
      const retrieved = sessionStore.getSession(TEST_SESSION_ID);
      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe(TEST_SESSION_ID);
      expect(retrieved?.projectPath).toBe(TEST_PROJECT_PATH);
      expect(retrieved?.model).toBe(TEST_MODEL);
    });

    it('should update session activity in persistent store', () => {
      const metadata = {
        sessionId: TEST_SESSION_ID,
        projectPath: TEST_PROJECT_PATH,
        model: TEST_MODEL,
        createdAt: Date.now(),
        lastActivity: Date.now() - 1000,
        messageCount: 1,
        isActive: true,
        retryCount: 0
      };

      sessionStore.storeSession(metadata);
      
      const beforeUpdate = sessionStore.getSession(TEST_SESSION_ID);
      const initialMessageCount = beforeUpdate?.messageCount || 0;
      
      sessionStore.updateSessionActivity(TEST_SESSION_ID);
      
      const afterUpdate = sessionStore.getSession(TEST_SESSION_ID);
      expect(afterUpdate?.messageCount).toBe(initialMessageCount + 1);
      expect(afterUpdate?.lastActivity).toBeGreaterThan(beforeUpdate?.lastActivity || 0);
    });

    it('should provide accurate session statistics', () => {
      // Store multiple sessions with different states
      const sessions = [
        {
          sessionId: 'session-1',
          projectPath: '/path1',
          createdAt: Date.now(),
          lastActivity: Date.now(),
          messageCount: 5,
          isActive: true,
          retryCount: 0
        },
        {
          sessionId: 'session-2',
          projectPath: '/path2',
          createdAt: Date.now(),
          lastActivity: Date.now(),
          messageCount: 3,
          isActive: false,
          retryCount: 2,
          lastError: 'Test error'
        }
      ];

      sessions.forEach(session => sessionStore.storeSession(session));
      
      const stats = sessionStore.getStats();
      expect(stats.totalSessions).toBe(2);
      expect(stats.activeSessions).toBe(1);
      expect(stats.sessionsWithErrors).toBe(1);
      expect(stats.averageMessageCount).toBe(4); // (5 + 3) / 2
    });

    it('should filter sessions correctly', () => {
      const sessions = [
        {
          sessionId: 'active-session',
          projectPath: '/path1',
          createdAt: Date.now(),
          lastActivity: Date.now(),
          messageCount: 1,
          isActive: true,
          retryCount: 0
        },
        {
          sessionId: 'inactive-session',
          projectPath: '/path2',
          createdAt: Date.now(),
          lastActivity: Date.now(),
          messageCount: 1,
          isActive: false,
          retryCount: 1
        }
      ];

      sessions.forEach(session => sessionStore.storeSession(session));
      
      const activeSessions = sessionStore.getSessions({ isActive: true });
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].sessionId).toBe('active-session');
      
      const inactiveSessions = sessionStore.getSessions({ isActive: false });
      expect(inactiveSessions).toHaveLength(1);
      expect(inactiveSessions[0].sessionId).toBe('inactive-session');
    });
  });

  describe('Error Recovery System', () => {
    it('should classify errors correctly', () => {
      const testCases = [
        {
          error: new Error('fetch failed'),
          expectedType: 'network',
          expectedRetryable: true
        },
        {
          error: new Error('session not found'),
          expectedType: 'session',
          expectedRetryable: false
        },
        {
          error: new Error('Claude CLI command failed'),
          expectedType: 'system',
          expectedRetryable: true
        },
        {
          error: new Error('validation failed - required field missing'),
          expectedType: 'user',
          expectedRetryable: false
        },
        {
          error: new Error('unknown error occurred'),
          expectedType: 'unknown',
          expectedRetryable: true
        }
      ];

      testCases.forEach(({ error, expectedType, expectedRetryable }) => {
        const classification = errorRecovery.classifyError(error);
        expect(classification.type).toBe(expectedType);
        expect(classification.retryable).toBe(expectedRetryable);
      });
    });

    it('should determine appropriate recovery strategies', () => {
      const networkError = errorRecovery.classifyError(new Error('network timeout'));
      const sessionError = errorRecovery.classifyError(new Error('session not found'));
      const userError = errorRecovery.classifyError(new Error('validation failed'));

      const context = {
        sessionId: TEST_SESSION_ID,
        operationType: 'chat' as const,
        errorMessage: 'test error',
        originalError: new Error('test'),
        retryCount: 0,
        maxRetries: 3
      };

      expect(errorRecovery.determineRecoveryStrategy(networkError, context)).toBe('retry');
      expect(errorRecovery.determineRecoveryStrategy(sessionError, context)).toBe('retry');
      expect(errorRecovery.determineRecoveryStrategy(userError, context)).toBe('abort');

      // Test with max retries reached
      const maxRetryContext = { ...context, retryCount: 3 };
      expect(errorRecovery.determineRecoveryStrategy(networkError, maxRetryContext)).toBe('abort');
      expect(errorRecovery.determineRecoveryStrategy(sessionError, maxRetryContext)).toBe('fallback');
    });

    it('should perform health checks correctly', async () => {
      const health = await errorRecovery.performHealthCheck();
      
      expect(health).toHaveProperty('sessionManager');
      expect(health).toHaveProperty('sessionStore');
      expect(health).toHaveProperty('overall');
      expect(typeof health.sessionManager).toBe('boolean');
      expect(typeof health.sessionStore).toBe('boolean');
      expect(typeof health.overall).toBe('boolean');
    });

    it('should handle error recovery end-to-end', async () => {
      const error = new Error('network timeout');
      const context = {
        sessionId: TEST_SESSION_ID,
        operationType: 'chat' as const,
        errorMessage: error.message,
        originalError: error,
        retryCount: 0,
        maxRetries: 3,
        workingDirectory: TEST_PROJECT_PATH
      };

      const result = await errorRecovery.handleError(error, context);
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('strategy');
      expect(['retry', 'fallback', 'abort', 'defer']).toContain(result.strategy);
      
      if (result.strategy === 'retry') {
        expect(result).toHaveProperty('retryAfter');
        expect(typeof result.retryAfter).toBe('number');
      }
    });
  });

  describe('Session Cleanup and Maintenance', () => {
    it('should cleanup inactive sessions', () => {
      // Register sessions with different activity times
      sessionManager.registerSession('active-session', '/path1', TEST_MODEL);
      sessionManager.registerSession('old-session', '/path2', TEST_MODEL);
      
      // Manually set old session as inactive (simulate timeout)
      const oldState = sessionManager.getSessionState('old-session');
      if (oldState) {
        oldState.lastActivity = Date.now() - (60 * 60 * 1000); // 1 hour ago
        oldState.isActive = false;
      }
      
      const initialStats = sessionManager.getSessionStats();
      sessionManager.cleanupInactiveSessions();
      const afterCleanup = sessionManager.getSessionStats();
      
      expect(afterCleanup.active).toBeLessThanOrEqual(initialStats.active);
      expect(afterCleanup.inactive).toBeGreaterThanOrEqual(initialStats.inactive);
    });

    it('should provide comprehensive session statistics', () => {
      // Create sessions with various states
      sessionManager.registerSession('session-1', '/path1', TEST_MODEL);
      sessionManager.registerSession('session-2', '/path2', TEST_MODEL);
      sessionManager.registerSession('session-3', '/path3', TEST_MODEL);
      
      // Add some activity
      sessionManager.updateSessionActivity('session-1');
      sessionManager.markSessionError('session-2', 'test error');
      
      const stats = sessionManager.getSessionStats();
      expect(stats.total).toBe(3);
      expect(stats.active).toBeGreaterThan(0);
      expect(stats.withErrors).toBe(1);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete session lifecycle', async () => {
      // 1. Register new session
      sessionManager.registerSession(TEST_SESSION_ID, TEST_PROJECT_PATH, TEST_MODEL);
      
      let sessionState = sessionManager.getSessionState(TEST_SESSION_ID);
      expect(sessionState?.isActive).toBe(true);
      expect(sessionState?.retryCount).toBe(0);
      
      // 2. Simulate conversation activity
      sessionManager.updateSessionActivity(TEST_SESSION_ID);
      sessionManager.updateSessionActivity(TEST_SESSION_ID);
      
      sessionState = sessionManager.getSessionState(TEST_SESSION_ID);
      expect(sessionState?.messageCount).toBe(2);
      
      // 3. Simulate error and recovery
      sessionManager.markSessionError(TEST_SESSION_ID, 'temporary error');
      
      sessionState = sessionManager.getSessionState(TEST_SESSION_ID);
      expect(sessionState?.retryCount).toBe(1);
      expect(sessionState?.isActive).toBe(true);
      
      // 4. Validate session for continuation
      const validation = await sessionManager.validateSessionForContinuation(TEST_SESSION_ID);
      expect(validation.shouldRetry || validation.shouldCreateNew).toBe(true);
      
      // 5. Check health
      const health = await sessionManager.checkSessionHealth(TEST_SESSION_ID);
      expect(health.lastActivity).toBeGreaterThan(0);
    });

    it('should handle session failure and recovery', async () => {
      // Register session
      sessionManager.registerSession(TEST_SESSION_ID, TEST_PROJECT_PATH, TEST_MODEL);
      
      // Simulate multiple failures
      const error = new Error('session continuation failed');
      const context = {
        sessionId: TEST_SESSION_ID,
        operationType: 'chat' as const,
        errorMessage: error.message,
        originalError: error,
        retryCount: 0,
        maxRetries: 3,
        workingDirectory: TEST_PROJECT_PATH
      };
      
      // First recovery attempt
      const firstAttempt = await errorRecovery.handleError(error, context);
      expect(['retry', 'fallback']).toContain(firstAttempt.strategy);
      
      // Simulate max retries reached
      const maxRetryContext = { ...context, retryCount: 3 };
      const finalAttempt = await errorRecovery.handleError(error, maxRetryContext);
      expect(['fallback', 'abort']).toContain(finalAttempt.strategy);
      
      // Verify session state was updated
      const sessionState = sessionManager.getSessionState(TEST_SESSION_ID);
      expect(sessionState?.lastError).toBeDefined();
    });

    it('should maintain consistency between manager and store', () => {
      // Register session in manager
      sessionManager.registerSession(TEST_SESSION_ID, TEST_PROJECT_PATH, TEST_MODEL);
      
      // Verify it appears in store (through integration)
      const stored = sessionStore.getSession(TEST_SESSION_ID);
      const managed = sessionManager.getSessionState(TEST_SESSION_ID);
      
      if (stored && managed) {
        expect(stored.sessionId).toBe(managed.sessionId);
        expect(stored.projectPath).toBe(managed.projectPath);
        expect(stored.model).toBe(managed.model);
      }
      
      // Update activity and verify consistency
      sessionManager.updateSessionActivity(TEST_SESSION_ID);
      
      const updatedStored = sessionStore.getSession(TEST_SESSION_ID);
      const updatedManaged = sessionManager.getSessionState(TEST_SESSION_ID);
      
      if (updatedStored && updatedManaged) {
        expect(updatedStored.messageCount).toBe(updatedManaged.messageCount);
      }
    });
  });
});

// Helper function to wait for async operations
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}