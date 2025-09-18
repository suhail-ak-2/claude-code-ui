/**
 * Logging and telemetry type definitions
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Base log entry interface
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  component: string;
  metadata?: Record<string, any>;
}

/**
 * API request telemetry data
 */
export interface ApiRequestTelemetry {
  requestId: string;
  method: string;
  endpoint: string;
  userAgent?: string;
  ip?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  statusCode?: number;
  success: boolean;
  error?: string;
  requestSize?: number;
  responseSize?: number;
  sessionId?: string;
  workingDirectory?: string;
}

/**
 * Claude CLI execution telemetry
 */
export interface ClaudeExecutionTelemetry {
  executionId: string;
  sessionId?: string;
  isResume: boolean;
  promptLength: number;
  model: string;
  workingDirectory?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
  outputTokens?: number;
  inputTokens?: number;
  totalCost?: number;
  toolsUsed?: string[];
  isStreaming: boolean;
  exitCode?: number;
}

/**
 * Session analytics data
 */
export interface SessionAnalytics {
  sessionId: string;
  createdAt: number;
  lastActivity: number;
  totalRequests: number;
  totalTokensUsed: number;
  totalCost: number;
  averageResponseTime: number;
  errors: number;
  workingDirectories: string[];
  modelsUsed: string[];
  toolsUsed: string[];
  isActive: boolean;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  timestamp: number;
  component: string;
  operation: string;
  duration: number;
  success: boolean;
  metadata?: Record<string, any>;
}

/**
 * Error tracking data
 */
export interface ErrorTelemetry {
  errorId: string;
  timestamp: number;
  component: string;
  operation: string;
  error: Error;
  context?: Record<string, any>;
  sessionId?: string;
  requestId?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * System metrics
 */
export interface SystemMetrics {
  timestamp: number;
  cpuUsage?: number;
  memoryUsage?: {
    used: number;
    free: number;
    total: number;
  };
  activeConnections: number;
  totalRequests: number;
  errors: number;
  uptime: number;
}

/**
 * Telemetry aggregation data
 */
export interface TelemetrySnapshot {
  timestamp: number;
  timeWindow: '1m' | '5m' | '15m' | '1h' | '24h';
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
  };
  sessions: {
    active: number;
    created: number;
    total: number;
  };
  claude: {
    executions: number;
    averageExecutionTime: number;
    totalTokens: number;
    totalCost: number;
  };
  errors: {
    total: number;
    byComponent: Record<string, number>;
    byType: Record<string, number>;
  };
  performance: {
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
}