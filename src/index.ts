import { ClaudeAPIServer } from './server';
import { initializeLogging, logger } from './logging';

/**
 * Claude CLI API Server Entry Point
 * 
 * This server provides a REST API interface to Claude CLI with:
 * - Session persistence across server restarts
 * - Real-time streaming with Server-Sent Events
 * - Working directory support
 * - Comprehensive error handling
 * - Advanced logging and telemetry
 */

// Initialize logging system first
initializeLogging();

const PORT = parseInt(process.env.PORT || '3000', 10);

logger.info('Starting Claude CLI API server', 'Main', {
  port: PORT,
  workingDirectory: process.cwd(),
  nodeVersion: process.version,
  platform: process.platform,
  environment: process.env.NODE_ENV || 'development'
});

console.log('🚀 Starting Claude CLI API server with node-pty support...');
console.log(`📊 Port: ${PORT}`);
console.log(`🏠 Working directory: ${process.cwd()}`);

// Create and start the server
const server = new ClaudeAPIServer(PORT);
server.start();

// Graceful shutdown handlers (Note: Server class also handles these)
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal} in main process, delegating to server`, 'Main', {
    signal,
    uptime: process.uptime()
  });
  // Server handles the actual shutdown
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception occurred', 'Main', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  });
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection occurred', 'Main', {
    reason: reason instanceof Error ? {
      name: reason.name,
      message: reason.message,
      stack: reason.stack
    } : reason,
    promise: promise.toString()
  });
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export { ClaudeAPIServer };