import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { telemetry } from './telemetry';

/**
 * Extended Express Request with telemetry data
 */
export interface TelemetryRequest extends Request {
  requestId?: string;
  startTime?: number;
}

/**
 * Middleware for automatic API request/response logging and telemetry
 */
export const telemetryMiddleware = (req: TelemetryRequest, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  req.startTime = startTime;
  
  // Start telemetry tracking
  const requestId = telemetry.startApiRequest(
    req.method,
    req.path,
    req.get('User-Agent'),
    req.ip || req.connection.remoteAddress
  );
  
  req.requestId = requestId;

  // Log request
  logger.info(
    `Incoming request: ${req.method} ${req.path}`,
    'API',
    {
      requestId,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      contentLength: req.get('Content-Length'),
      contentType: req.get('Content-Type')
    }
  );

  // Capture original response methods
  const originalSend = res.send;
  const originalJson = res.json;
  const originalEnd = res.end;

  let responseBody: any;
  let responseSent = false;

  // Override response methods to capture data
  res.send = function(data: any): Response {
    if (!responseSent) {
      responseBody = data;
      logResponse();
      responseSent = true;
    }
    return originalSend.call(this, data);
  };

  res.json = function(data: any): Response {
    if (!responseSent) {
      responseBody = data;
      logResponse();
      responseSent = true;
    }
    return originalJson.call(this, data);
  };

  res.end = function(...args: any[]): Response {
    if (!responseSent) {
      responseBody = args[0];
      logResponse();
      responseSent = true;
    }
    return (originalEnd as any).apply(this, args);
  };

  function logResponse(): void {
    const duration = Date.now() - startTime;
    const success = res.statusCode < 400;
    const requestSize = parseInt(req.get('Content-Length') || '0', 10);
    const responseSize = responseBody ? Buffer.byteLength(JSON.stringify(responseBody)) : 0;

    // Extract session info from request body if available
    const sessionId = (req.body && req.body.sessionId) || undefined;
    const workingDirectory = (req.body && req.body.workingDirectory) || undefined;
    const error = !success && responseBody ? 
      (responseBody.error || responseBody.message || 'Unknown error') : undefined;

    // Complete telemetry tracking
    telemetry.completeApiRequest(
      requestId,
      res.statusCode,
      success,
      error,
      requestSize,
      responseSize,
      sessionId,
      workingDirectory
    );

    // Log response
    logger.info(
      `Request completed: ${req.method} ${req.path} - ${res.statusCode}`,
      'API',
      {
        requestId,
        duration,
        statusCode: res.statusCode,
        success,
        requestSize,
        responseSize,
        sessionId,
        workingDirectory,
        error
      }
    );

    // Record performance metric
    telemetry.recordPerformance(
      'API',
      `${req.method} ${req.path}`,
      duration,
      success,
      {
        statusCode: res.statusCode,
        requestSize,
        responseSize,
        sessionId
      }
    );

    // Record error if request failed
    if (!success && error) {
      telemetry.recordError(
        'API',
        `${req.method} ${req.path}`,
        new Error(error),
        res.statusCode >= 500 ? 'high' : 'medium',
        {
          statusCode: res.statusCode,
          requestBody: req.body,
          responseBody
        },
        sessionId,
        requestId
      );
    }
  }

  next();
};

/**
 * Error handling middleware with telemetry
 */
export const errorTelemetryMiddleware = (
  err: Error, 
  req: TelemetryRequest, 
  res: Response, 
  next: NextFunction
): void => {
  const requestId = req.requestId || 'unknown';
  const sessionId = (req.body && req.body.sessionId) || undefined;

  // Record error telemetry
  telemetry.recordError(
    'API',
    `${req.method} ${req.path}`,
    err,
    'critical',
    {
      requestBody: req.body,
      headers: req.headers,
      params: req.params,
      query: req.query
    },
    sessionId,
    requestId
  );

  // Log error
  logger.error(
    `Unhandled error in API request: ${err.message}`,
    'API',
    {
      requestId,
      sessionId,
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack
      },
      request: {
        method: req.method,
        path: req.path,
        body: req.body
      }
    }
  );

  // Send error response
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    requestId,
    timestamp: new Date().toISOString()
  });
};

/**
 * Health check endpoint with system metrics
 */
export const healthCheckHandler = (req: Request, res: Response): void => {
  const snapshot = telemetry.getTelemetrySnapshot('5m');
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Claude CLI API',
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    metrics: {
      requests: snapshot.requests,
      sessions: snapshot.sessions,
      claude: snapshot.claude,
      errors: snapshot.errors,
      performance: snapshot.performance
    },
    system: {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      nodeVersion: process.version,
      platform: process.platform
    }
  });
};