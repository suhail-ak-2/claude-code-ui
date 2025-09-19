import express from 'express';
import { AgentManager } from './agentManager';
import { CreateAgentRequest, UpdateAgentRequest } from './types';
import { logger } from './logging';

/**
 * Agent API routes for CRUD operations
 */
export class AgentRoutes {
  private readonly router: express.Router;
  private readonly agentManager: AgentManager;

  constructor() {
    this.router = express.Router();
    this.agentManager = new AgentManager();
    this.setupRoutes();
    
    logger.info('AgentRoutes initialized', 'AgentRoutes');
  }

  /**
   * Get the Express router
   */
  public getRouter(): express.Router {
    return this.router;
  }

  /**
   * Setup all agent routes
   */
  private setupRoutes(): void {
    // Create agent
    this.router.post('/', this.createAgent.bind(this));
    
    // List agents
    this.router.get('/', this.listAgents.bind(this));
    
    // Get specific agent
    this.router.get('/:name', this.getAgent.bind(this));
    
    // Update agent
    this.router.put('/:name', this.updateAgent.bind(this));
    
    // Delete agent
    this.router.delete('/:name', this.deleteAgent.bind(this));
  }

  /**
   * Create a new agent
   * POST /agents
   */
  private async createAgent(req: express.Request, res: express.Response): Promise<void> {
    try {
      const request: CreateAgentRequest = req.body;
      
      // Validate required fields
      const validationError = this.validateCreateRequest(request);
      if (validationError) {
        res.status(400).json({
          success: false,
          error: validationError
        });
        return;
      }

      logger.info('Creating agent via API', 'AgentRoutes', {
        name: request.name,
        isGlobal: request.isGlobal,
        workingDirectory: request.workingDirectory
      });

      const result = await this.agentManager.createAgent(request);
      
      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      this.handleError(res, error, 'create agent');
    }
  }

  /**
   * List all agents
   * GET /agents?workingDirectory=/path/to/dir
   */
  private async listAgents(req: express.Request, res: express.Response): Promise<void> {
    try {
      const workingDirectory = req.query.workingDirectory as string;

      logger.debug('Listing agents via API', 'AgentRoutes', {
        workingDirectory
      });

      const result = await this.agentManager.listAgents(workingDirectory);
      
      res.json(result);

    } catch (error) {
      this.handleError(res, error, 'list agents');
    }
  }

  /**
   * Get a specific agent
   * GET /agents/:name?isGlobal=true&workingDirectory=/path/to/dir
   */
  private async getAgent(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { name } = req.params;
      const isGlobal = req.query.isGlobal === 'true' ? true : 
                      req.query.isGlobal === 'false' ? false : undefined;
      const workingDirectory = req.query.workingDirectory as string;

      logger.debug('Getting agent via API', 'AgentRoutes', {
        name,
        isGlobal,
        workingDirectory
      });

      const result = await this.agentManager.getAgent(name, isGlobal, workingDirectory);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(404).json(result);
      }

    } catch (error) {
      this.handleError(res, error, 'get agent');
    }
  }

  /**
   * Update an existing agent
   * PUT /agents/:name?isGlobal=true&workingDirectory=/path/to/dir
   */
  private async updateAgent(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { name } = req.params;
      const updates: UpdateAgentRequest = req.body;
      const isGlobal = req.query.isGlobal === 'true' ? true : 
                      req.query.isGlobal === 'false' ? false : undefined;
      const workingDirectory = req.query.workingDirectory as string;

      logger.info('Updating agent via API', 'AgentRoutes', {
        name,
        isGlobal,
        workingDirectory,
        hasContent: !!updates.content,
        hasDescription: !!updates.description
      });

      const result = await this.agentManager.updateAgent(name, updates, isGlobal, workingDirectory);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(404).json(result);
      }

    } catch (error) {
      this.handleError(res, error, 'update agent');
    }
  }

  /**
   * Delete an agent
   * DELETE /agents/:name?isGlobal=true&workingDirectory=/path/to/dir
   */
  private async deleteAgent(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { name } = req.params;
      const isGlobal = req.query.isGlobal === 'true' ? true : 
                      req.query.isGlobal === 'false' ? false : undefined;
      const workingDirectory = req.query.workingDirectory as string;

      logger.info('Deleting agent via API', 'AgentRoutes', {
        name,
        isGlobal,
        workingDirectory
      });

      const result = await this.agentManager.deleteAgent(name, isGlobal, workingDirectory);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(404).json(result);
      }

    } catch (error) {
      this.handleError(res, error, 'delete agent');
    }
  }

  /**
   * Validate create agent request
   */
  private validateCreateRequest(request: CreateAgentRequest): string | null {
    if (!request.name || typeof request.name !== 'string' || !request.name.trim()) {
      return 'Agent name is required and must be a non-empty string';
    }

    if (!request.description || typeof request.description !== 'string' || !request.description.trim()) {
      return 'Agent description is required and must be a non-empty string';
    }

    if (!request.content || typeof request.content !== 'string' || !request.content.trim()) {
      return 'Agent content is required and must be a non-empty string';
    }

    // Validate agent name format
    if (!/^[a-zA-Z0-9_-]+$/.test(request.name)) {
      return 'Agent name can only contain letters, numbers, hyphens, and underscores';
    }

    // Validate that either isGlobal is true or workingDirectory is provided
    if (!request.isGlobal && !request.workingDirectory) {
      return 'Either isGlobal must be true or workingDirectory must be provided for local agents';
    }

    return null;
  }

  /**
   * Handle errors and send appropriate response
   */
  private handleError(res: express.Response, error: unknown, operation: string): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error(`Failed to ${operation}`, 'AgentRoutes', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      error: `Failed to ${operation}: ${errorMessage}`
    });
  }
}