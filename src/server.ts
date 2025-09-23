import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ClaudeWrapper } from './claudeWrapper';
import { AgentRoutes } from './agentRoutes';
import { chatHistoryRoutes } from './chatHistoryRoutes';
import { ClaudeRequest, StreamingCallback } from './types';
import { sessionManager } from './sessionManager';
import { sessionStore } from './sessionStore';
import { 
  logger, 
  telemetryMiddleware, 
  errorTelemetryMiddleware, 
  healthCheckHandler 
} from './logging';

/**
 * Claude CLI API Server
 * Provides REST API endpoints for Claude CLI with streaming support and session management
 */
export class ClaudeAPIServer {
  private readonly app: express.Application;
  private readonly claudeWrapper: ClaudeWrapper;
  private readonly agentRoutes: AgentRoutes;
  private readonly port: number;

  constructor(port: number = 3000) {
    this.app = express();
    this.port = port;
    this.claudeWrapper = new ClaudeWrapper();
    this.agentRoutes = new AgentRoutes();
    this.setupMiddleware();
    this.setupRoutes();
    
    logger.info('ClaudeAPIServer initialized', 'Server', {
      port: this.port
    });
  }

  /**
   * Configure Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(helmet()); // Security headers
    this.app.use(cors());   // Cross-Origin Resource Sharing
    this.app.use(express.json({ limit: '10mb' }));           // Parse JSON bodies
    this.app.use(express.urlencoded({ extended: true }));    // Parse URL-encoded bodies
    this.app.use(telemetryMiddleware);                       // Telemetry and logging
    this.app.use(errorTelemetryMiddleware);                  // Error handling with telemetry
    
    logger.debug('Express middleware configured', 'Server');
  }

  /**
   * Configure API routes
   */
  private setupRoutes(): void {
    this.setupHealthRoute();
    this.setupExecuteRoute();
    this.setupStreamingRoute();
    this.setupAgentRoutes();
    this.setupChatHistoryRoutes();
    this.setupSessionRoutes();
  }

  /**
   * Health check endpoint
   */
  private setupHealthRoute(): void {
    this.app.get('/health', healthCheckHandler);
  }

  /**
   * Execute Claude prompt endpoint (non-streaming)
   */
  private setupExecuteRoute(): void {
    this.app.post('/claude/execute', async (req, res) => {
      try {
        const request: ClaudeRequest = req.body;
        
        const validationError = this.validateRequest(request);
        if (validationError) {
          return res.status(400).json(validationError);
        }

        const response = await this.claudeWrapper.executePrompt(request);
        res.json(response);
      } catch (error) {
        this.handleError(res, error);
      }
    });
  }

  /**
   * Execute Claude prompt with streaming (Server-Sent Events)
   */
  private setupStreamingRoute(): void {
    this.app.post('/claude/stream', (req, res) => {
      try {
        const request: ClaudeRequest = req.body;
        
        const validationError = this.validateRequest(request);
        if (validationError) {
          return res.status(400).json(validationError);
        }

        this.setupServerSentEvents(res);
        this.sendConnectionEvent(res);
        
        const callback = this.createStreamingCallback(res);
        
        this.claudeWrapper.executePromptStreaming(request, callback)
          .catch(error => {
            this.sendErrorEvent(res, error.message);
            res.end();
          });

        // Handle client disconnect
        req.on('close', () => {
          // Client disconnected - cleanup would go here if needed
        });

      } catch (error) {
        this.handleError(res, error);
      }
    });
  }

  /**
   * Setup agent management routes
   */
  private setupAgentRoutes(): void {
    this.app.use('/agents', this.agentRoutes.getRouter());
  }

  /**
   * Setup chat history routes
   */
  private setupChatHistoryRoutes(): void {
    this.app.use('/chat-history', chatHistoryRoutes);
  }

  /**
   * Validate incoming Claude request
   */
  private validateRequest(request: ClaudeRequest): { success: false; error: string } | null {
    if (!request.prompt || typeof request.prompt !== 'string' || !request.prompt.trim()) {
      return {
        success: false,
        error: 'Prompt is required and must be a non-empty string'
      };
    }

    // For session continuation, model parameter is ignored (Claude CLI requirement)
    // For new sessions, model parameter is optional and will default to 'sonnet'
    if (!request.sessionId && request.model && typeof request.model !== 'string') {
      return {
        success: false,
        error: 'Model must be a string when provided'
      };
    }

    return null;
  }

  /**
   * Handle errors and send appropriate response
   */
  private handleError(res: express.Response, error: unknown): void {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime: 0
    });
  }

  /**
   * Setup Server-Sent Events headers
   */
  private setupServerSentEvents(res: express.Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });
  }

  /**
   * Send connection event to client
   */
  private sendConnectionEvent(res: express.Response): void {
    const connectionData = {
      type: 'connected',
      timestamp: new Date().toISOString()
    };
    res.write(`event: connected\ndata: ${JSON.stringify(connectionData)}\n\n`);
  }

  /**
   * Send error event to client
   */
  private sendErrorEvent(res: express.Response, error: string): void {
    res.write(`event: error\ndata: ${JSON.stringify({ error })}\n\n`);
  }

  /**
   * Create streaming callback handlers
   */
  private createStreamingCallback(res: express.Response): StreamingCallback {
    return {
      onData: (data: any) => {
        res.write(`event: data\ndata: ${JSON.stringify(data)}\n\n`);
      },
      onError: (error: string) => {
        this.sendErrorEvent(res, error);
      },
      onComplete: (sessionId: string) => {
        const completeData = { sessionId, completed: true };
        res.write(`event: complete\ndata: ${JSON.stringify(completeData)}\n\n`);
        res.end();
      }
    };
  }

  /**
   * Start the API server
   */
  public start(): void {
    const server = this.app.listen(this.port, () => {
      this.logServerInfo();
    });

    this.setupGracefulShutdown(server);
  }

  /**
   * Get the Express application instance
   */
  public getApp(): express.Application {
    return this.app;
  }

  /**
   * Log server startup information
   */
  private logServerInfo(): void {
    logger.info('Claude CLI API Server started successfully', 'Server', {
      port: this.port,
      endpoints: {
        health: `http://localhost:${this.port}/health`,
        execute: `POST http://localhost:${this.port}/claude/execute`,
        stream: `POST http://localhost:${this.port}/claude/stream`,
        agents: `http://localhost:${this.port}/agents`,
        chatHistory: `http://localhost:${this.port}/chat-history`
      },
      environment: process.env.NODE_ENV || 'development'
    });
    
    // Also log to console for immediate visibility
    console.log(`🚀 Claude CLI API Server running on port ${this.port}`);
    console.log(`📊 Health check: http://localhost:${this.port}/health`);
    console.log(`🤖 Claude execute: POST http://localhost:${this.port}/claude/execute`);
    console.log(`📡 Claude stream: POST http://localhost:${this.port}/claude/stream`);
    console.log(`👥 Agent management: http://localhost:${this.port}/agents`);
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(server: any): void {
    const shutdown = (signal: string) => {
      logger.info(`Received ${signal}, initiating graceful shutdown`, 'Server', {
        signal,
        uptime: process.uptime()
      });
      
      this.claudeWrapper.destroy();
      server.close(() => {
        logger.info('Server shutdown completed', 'Server');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}