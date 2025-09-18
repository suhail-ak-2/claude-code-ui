import { randomUUID } from 'crypto';
import { logger } from './logger';
import {
  ApiRequestTelemetry,
  ClaudeExecutionTelemetry,
  SessionAnalytics,
  PerformanceMetrics,
  ErrorTelemetry,
  SystemMetrics,
  TelemetrySnapshot
} from './types';

/**
 * Telemetry collector for API analytics and monitoring
 */
export class TelemetryCollector {
  private static instance: TelemetryCollector;
  private apiRequests: Map<string, ApiRequestTelemetry> = new Map();
  private claudeExecutions: Map<string, ClaudeExecutionTelemetry> = new Map();
  private sessions: Map<string, SessionAnalytics> = new Map();
  private performanceMetrics: PerformanceMetrics[] = [];
  private errors: ErrorTelemetry[] = [];
  private systemMetrics: SystemMetrics[] = [];
  
  private readonly MAX_STORED_METRICS = 1000;
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  
  private constructor() {
    this.startPeriodicCleanup();
    this.startSystemMetricsCollection();
  }

  public static getInstance(): TelemetryCollector {
    if (!TelemetryCollector.instance) {
      TelemetryCollector.instance = new TelemetryCollector();
    }
    return TelemetryCollector.instance;
  }

  /**
   * Start tracking an API request
   */
  public startApiRequest(
    method: string,
    endpoint: string,
    userAgent?: string,
    ip?: string
  ): string {
    const requestId = randomUUID();
    const telemetry: ApiRequestTelemetry = {
      requestId,
      method,
      endpoint,
      userAgent,
      ip,
      startTime: Date.now(),
      success: false
    };

    this.apiRequests.set(requestId, telemetry);
    
    logger.debug(
      `API request started: ${method} ${endpoint}`,
      'Telemetry',
      { requestId, userAgent, ip }
    );

    return requestId;
  }

  /**
   * Complete API request tracking
   */
  public completeApiRequest(
    requestId: string,
    statusCode: number,
    success: boolean,
    error?: string,
    requestSize?: number,
    responseSize?: number,
    sessionId?: string,
    workingDirectory?: string
  ): void {
    const telemetry = this.apiRequests.get(requestId);
    if (!telemetry) return;

    telemetry.endTime = Date.now();
    telemetry.duration = telemetry.endTime - telemetry.startTime;
    telemetry.statusCode = statusCode;
    telemetry.success = success;
    telemetry.error = error;
    telemetry.requestSize = requestSize;
    telemetry.responseSize = responseSize;
    telemetry.sessionId = sessionId;
    telemetry.workingDirectory = workingDirectory;

    logger.info(
      `API request completed: ${telemetry.method} ${telemetry.endpoint}`,
      'Telemetry',
      {
        requestId,
        duration: telemetry.duration,
        statusCode,
        success,
        error: error || undefined
      }
    );

    // Update session analytics if sessionId provided
    if (sessionId) {
      this.updateSessionAnalytics(sessionId, telemetry);
    }
  }

  /**
   * Start tracking Claude CLI execution
   */
  public startClaudeExecution(
    sessionId: string | undefined,
    isResume: boolean,
    promptLength: number,
    model: string,
    workingDirectory?: string,
    isStreaming: boolean = false
  ): string {
    const executionId = randomUUID();
    const telemetry: ClaudeExecutionTelemetry = {
      executionId,
      sessionId,
      isResume,
      promptLength,
      model,
      workingDirectory,
      startTime: Date.now(),
      success: false,
      isStreaming
    };

    this.claudeExecutions.set(executionId, telemetry);

    logger.debug(
      `Claude execution started: ${isResume ? 'resume' : 'new'} session`,
      'Telemetry',
      { executionId, sessionId, model, promptLength, isStreaming }
    );

    return executionId;
  }

  /**
   * Complete Claude CLI execution tracking
   */
  public completeClaudeExecution(
    executionId: string,
    success: boolean,
    error?: string,
    outputTokens?: number,
    inputTokens?: number,
    totalCost?: number,
    toolsUsed?: string[],
    exitCode?: number
  ): void {
    const telemetry = this.claudeExecutions.get(executionId);
    if (!telemetry) return;

    telemetry.endTime = Date.now();
    telemetry.duration = telemetry.endTime - telemetry.startTime;
    telemetry.success = success;
    telemetry.error = error;
    telemetry.outputTokens = outputTokens;
    telemetry.inputTokens = inputTokens;
    telemetry.totalCost = totalCost;
    telemetry.toolsUsed = toolsUsed;
    telemetry.exitCode = exitCode;

    logger.info(
      `Claude execution completed: ${success ? 'success' : 'failed'}`,
      'Telemetry',
      {
        executionId,
        duration: telemetry.duration,
        outputTokens,
        inputTokens,
        totalCost,
        toolsUsed,
        exitCode,
        error: error || undefined
      }
    );
  }

  /**
   * Record performance metric
   */
  public recordPerformance(
    component: string,
    operation: string,
    duration: number,
    success: boolean,
    metadata?: Record<string, any>
  ): void {
    const metric: PerformanceMetrics = {
      timestamp: Date.now(),
      component,
      operation,
      duration,
      success,
      metadata
    };

    this.performanceMetrics.push(metric);
    this.trimArray(this.performanceMetrics, this.MAX_STORED_METRICS);

    logger.debug(
      `Performance recorded: ${component}.${operation}`,
      'Telemetry',
      { duration, success, metadata }
    );
  }

  /**
   * Record error telemetry
   */
  public recordError(
    component: string,
    operation: string,
    error: Error,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    context?: Record<string, any>,
    sessionId?: string,
    requestId?: string
  ): void {
    const errorTelemetry: ErrorTelemetry = {
      errorId: randomUUID(),
      timestamp: Date.now(),
      component,
      operation,
      error,
      context,
      sessionId,
      requestId,
      severity
    };

    this.errors.push(errorTelemetry);
    this.trimArray(this.errors, this.MAX_STORED_METRICS);

    logger.error(
      `Error recorded: ${component}.${operation}`,
      'Telemetry',
      {
        errorId: errorTelemetry.errorId,
        severity,
        error: error.message,
        context,
        sessionId,
        requestId
      }
    );
  }

  /**
   * Update session analytics
   */
  private updateSessionAnalytics(sessionId: string, apiRequest: ApiRequestTelemetry): void {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      session = {
        sessionId,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        totalRequests: 0,
        totalTokensUsed: 0,
        totalCost: 0,
        averageResponseTime: 0,
        errors: 0,
        workingDirectories: [],
        modelsUsed: [],
        toolsUsed: [],
        isActive: true
      };
      this.sessions.set(sessionId, session);
    }

    session.lastActivity = Date.now();
    session.totalRequests++;
    
    if (!apiRequest.success) {
      session.errors++;
    }

    if (apiRequest.workingDirectory && !session.workingDirectories.includes(apiRequest.workingDirectory)) {
      session.workingDirectories.push(apiRequest.workingDirectory);
    }

    // Update average response time
    if (apiRequest.duration) {
      session.averageResponseTime = 
        (session.averageResponseTime * (session.totalRequests - 1) + apiRequest.duration) / session.totalRequests;
    }
  }

  /**
   * Get telemetry snapshot for monitoring
   */
  public getTelemetrySnapshot(timeWindow: '1m' | '5m' | '15m' | '1h' | '24h' = '5m'): TelemetrySnapshot {
    const now = Date.now();
    const windowMs = this.getTimeWindowMs(timeWindow);
    const cutoff = now - windowMs;

    const recentRequests = Array.from(this.apiRequests.values())
      .filter(r => r.startTime > cutoff);
    
    const recentExecutions = Array.from(this.claudeExecutions.values())
      .filter(e => e.startTime > cutoff);
    
    const recentErrors = this.errors.filter(e => e.timestamp > cutoff);
    const recentPerformance = this.performanceMetrics.filter(p => p.timestamp > cutoff);

    return {
      timestamp: now,
      timeWindow,
      requests: {
        total: recentRequests.length,
        successful: recentRequests.filter(r => r.success).length,
        failed: recentRequests.filter(r => !r.success).length,
        averageResponseTime: this.calculateAverage(recentRequests.map(r => r.duration || 0))
      },
      sessions: {
        active: Array.from(this.sessions.values()).filter(s => s.isActive && s.lastActivity > cutoff).length,
        created: Array.from(this.sessions.values()).filter(s => s.createdAt > cutoff).length,
        total: this.sessions.size
      },
      claude: {
        executions: recentExecutions.length,
        averageExecutionTime: this.calculateAverage(recentExecutions.map(e => e.duration || 0)),
        totalTokens: recentExecutions.reduce((sum, e) => sum + (e.outputTokens || 0) + (e.inputTokens || 0), 0),
        totalCost: recentExecutions.reduce((sum, e) => sum + (e.totalCost || 0), 0)
      },
      errors: {
        total: recentErrors.length,
        byComponent: this.groupBy(recentErrors, 'component'),
        byType: this.groupBy(recentErrors, e => e.error.name)
      },
      performance: {
        averageResponseTime: this.calculateAverage(recentPerformance.map(p => p.duration)),
        p95ResponseTime: this.calculatePercentile(recentPerformance.map(p => p.duration), 95),
        p99ResponseTime: this.calculatePercentile(recentPerformance.map(p => p.duration), 99)
      }
    };
  }

  /**
   * Start periodic cleanup of old data
   */
  private startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanupOldData();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Start system metrics collection
   */
  private startSystemMetricsCollection(): void {
    setInterval(() => {
      this.collectSystemMetrics();
    }, 60000); // Every minute
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): void {
    const metrics: SystemMetrics = {
      timestamp: Date.now(),
      memoryUsage: {
        used: process.memoryUsage().heapUsed,
        free: process.memoryUsage().heapTotal - process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal
      },
      activeConnections: this.apiRequests.size,
      totalRequests: Array.from(this.apiRequests.values()).length,
      errors: this.errors.length,
      uptime: process.uptime()
    };

    this.systemMetrics.push(metrics);
    this.trimArray(this.systemMetrics, 100); // Keep last 100 system metrics
  }

  /**
   * Clean up old data
   */
  private cleanupOldData(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago

    // Clean old API requests
    for (const [id, request] of this.apiRequests.entries()) {
      if (request.startTime < cutoff) {
        this.apiRequests.delete(id);
      }
    }

    // Clean old Claude executions
    for (const [id, execution] of this.claudeExecutions.entries()) {
      if (execution.startTime < cutoff) {
        this.claudeExecutions.delete(id);
      }
    }

    // Mark inactive sessions
    for (const session of this.sessions.values()) {
      if (session.lastActivity < cutoff) {
        session.isActive = false;
      }
    }

    logger.debug('Telemetry cleanup completed', 'Telemetry');
  }

  // Helper methods
  private getTimeWindowMs(window: string): number {
    const windows: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000
    };
    return windows[window] || windows['5m'];
  }

  private calculateAverage(numbers: number[]): number {
    return numbers.length > 0 ? numbers.reduce((sum, n) => sum + n, 0) / numbers.length : 0;
  }

  private calculatePercentile(numbers: number[], percentile: number): number {
    if (numbers.length === 0) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private groupBy<T>(items: T[], keyFn: string | ((item: T) => string)): Record<string, number> {
    const result: Record<string, number> = {};
    for (const item of items) {
      const key = typeof keyFn === 'string' ? (item as any)[keyFn] : keyFn(item);
      result[key] = (result[key] || 0) + 1;
    }
    return result;
  }

  private trimArray<T>(array: T[], maxLength: number): void {
    while (array.length > maxLength) {
      array.shift();
    }
  }
}

// Export singleton instance
export const telemetry = TelemetryCollector.getInstance();