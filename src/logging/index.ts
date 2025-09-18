/**
 * Logging and telemetry module exports
 */

export { Logger, logger } from './logger';
export { TelemetryCollector, telemetry } from './telemetry';
export { 
  telemetryMiddleware, 
  errorTelemetryMiddleware, 
  healthCheckHandler,
  TelemetryRequest 
} from './middleware';

export * from './types';

/**
 * Initialize logging system
 */
export const initializeLogging = (options?: {
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  logToFile?: boolean;
  logDirectory?: string;
}): void => {
  // Import here to avoid circular dependency
  const { logger } = require('./logger');
  // Configure logger
  logger.configure({
    logLevel: options?.logLevel || (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
    logToFile: options?.logToFile ?? (process.env.NODE_ENV === 'production'),
    logDirectory: options?.logDirectory || './logs',
    logToConsole: true
  });

  logger.info('Logging system initialized', 'Logging', {
    logLevel: logger.getLogLevel(),
    environment: process.env.NODE_ENV || 'development'
  });

  // Setup log rotation for production
  if (process.env.NODE_ENV === 'production') {
    // Rotate logs daily at midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const timeToMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      logger.rotateLogFile();
      // Then rotate every 24 hours
      setInterval(() => {
        logger.rotateLogFile();
      }, 24 * 60 * 60 * 1000);
    }, timeToMidnight);
  }
};