import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { 
  Agent, 
  AgentMetadata, 
  CreateAgentRequest, 
  UpdateAgentRequest, 
  AgentResponse, 
  AgentListResponse 
} from './types';
import { logger } from './logging';

/**
 * AgentManager handles CRUD operations for Claude agent files
 * Supports both global (~/.claude/agents/) and local (.claude/agents/) storage
 */
export class AgentManager {
  private readonly globalAgentsDir: string;

  constructor() {
    this.globalAgentsDir = path.join(os.homedir(), '.claude', 'agents');
    this.ensureGlobalAgentsDir();
    
    logger.info('AgentManager initialized', 'AgentManager', {
      globalAgentsDir: this.globalAgentsDir
    });
  }

  /**
   * Create a new agent
   */
  async createAgent(request: CreateAgentRequest): Promise<AgentResponse> {
    try {
      logger.info('Creating new agent', 'AgentManager', {
        name: request.name,
        isGlobal: request.isGlobal,
        workingDirectory: request.workingDirectory
      });

      // Validate agent name
      if (!this.isValidAgentName(request.name)) {
        return {
          success: false,
          error: 'Invalid agent name. Use only letters, numbers, hyphens, and underscores.'
        };
      }

      const agentDir = this.getAgentDirectory(request.isGlobal, request.workingDirectory);
      const agentPath = path.join(agentDir, `${request.name}.md`);

      // Check if agent already exists
      if (fs.existsSync(agentPath)) {
        return {
          success: false,
          error: `Agent '${request.name}' already exists`
        };
      }

      // Ensure agent directory exists
      this.ensureDirectory(agentDir);

      // Create agent content with frontmatter
      const agentContent = this.createAgentFileContent(request);

      // Debug: Log what we're writing
      logger.debug('Writing agent content', 'AgentManager', {
        name: request.name,
        contentPreview: agentContent.substring(0, 200) + '...',
        contentLength: agentContent.length
      });

      // Write agent file
      fs.writeFileSync(agentPath, agentContent, 'utf8');

      // Parse and return the created agent
      const agent = await this.parseAgentFile(agentPath, !!request.isGlobal);

      logger.info('Agent created successfully', 'AgentManager', {
        name: request.name,
        filePath: agentPath
      });

      return {
        success: true,
        agent
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create agent', 'AgentManager', {
        name: request.name,
        error: errorMessage
      });

      return {
        success: false,
        error: `Failed to create agent: ${errorMessage}`
      };
    }
  }

  /**
   * Get an agent by name
   */
  async getAgent(name: string, isGlobal?: boolean, workingDirectory?: string): Promise<AgentResponse> {
    try {
      logger.debug('Getting agent', 'AgentManager', {
        name,
        isGlobal,
        workingDirectory
      });

      // If isGlobal is specified, look in that specific location
      if (isGlobal !== undefined) {
        const agentDir = this.getAgentDirectory(isGlobal, workingDirectory);
        const agentPath = path.join(agentDir, `${name}.md`);

        if (fs.existsSync(agentPath)) {
          const agent = await this.parseAgentFile(agentPath, isGlobal);
          return { success: true, agent };
        }
      } else {
        // Search in both local (if workingDirectory provided) and global
        const searchPaths: { path: string; isGlobal: boolean }[] = [];

        if (workingDirectory) {
          const localDir = this.getAgentDirectory(false, workingDirectory);
          searchPaths.push({ path: path.join(localDir, `${name}.md`), isGlobal: false });
        }

        searchPaths.push({ path: path.join(this.globalAgentsDir, `${name}.md`), isGlobal: true });

        for (const { path: agentPath, isGlobal: agentIsGlobal } of searchPaths) {
          if (fs.existsSync(agentPath)) {
            const agent = await this.parseAgentFile(agentPath, agentIsGlobal);
            return { success: true, agent };
          }
        }
      }

      return {
        success: false,
        error: `Agent '${name}' not found`
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get agent', 'AgentManager', {
        name,
        error: errorMessage
      });

      return {
        success: false,
        error: `Failed to get agent: ${errorMessage}`
      };
    }
  }

  /**
   * Update an existing agent
   */
  async updateAgent(
    name: string, 
    updates: UpdateAgentRequest, 
    isGlobal?: boolean, 
    workingDirectory?: string
  ): Promise<AgentResponse> {
    try {
      logger.info('Updating agent', 'AgentManager', {
        name,
        isGlobal,
        workingDirectory
      });

      // First, get the existing agent
      const existingResult = await this.getAgent(name, isGlobal, workingDirectory);
      if (!existingResult.success || !existingResult.agent) {
        return existingResult;
      }

      const agent = existingResult.agent;

      // Update metadata
      const updatedMetadata: AgentMetadata = {
        ...agent.metadata,
        ...updates.metadata,
        name, // name cannot be changed
      };

      if (updates.description) updatedMetadata.description = updates.description;
      if (updates.model) updatedMetadata.model = updates.model;
      if (updates.color) updatedMetadata.color = updates.color;

      // Create updated content
      const updatedContent = this.createAgentFileContent({
        name,
        description: updatedMetadata.description,
        content: updates.content || agent.content,
        model: updatedMetadata.model,
        color: updatedMetadata.color,
        metadata: updatedMetadata
      });

      // Write updated content
      fs.writeFileSync(agent.filePath, updatedContent, 'utf8');

      // Parse and return updated agent
      const updatedAgent = await this.parseAgentFile(agent.filePath, agent.isGlobal);

      logger.info('Agent updated successfully', 'AgentManager', {
        name,
        filePath: agent.filePath
      });

      return {
        success: true,
        agent: updatedAgent
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update agent', 'AgentManager', {
        name,
        error: errorMessage
      });

      return {
        success: false,
        error: `Failed to update agent: ${errorMessage}`
      };
    }
  }

  /**
   * Delete an agent
   */
  async deleteAgent(name: string, isGlobal?: boolean, workingDirectory?: string): Promise<AgentResponse> {
    try {
      logger.info('Deleting agent', 'AgentManager', {
        name,
        isGlobal,
        workingDirectory
      });

      // First, get the existing agent to confirm it exists and get its path
      const existingResult = await this.getAgent(name, isGlobal, workingDirectory);
      if (!existingResult.success || !existingResult.agent) {
        return existingResult;
      }

      const agent = existingResult.agent;

      // Delete the file
      fs.unlinkSync(agent.filePath);

      logger.info('Agent deleted successfully', 'AgentManager', {
        name,
        filePath: agent.filePath
      });

      return {
        success: true,
        agent
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to delete agent', 'AgentManager', {
        name,
        error: errorMessage
      });

      return {
        success: false,
        error: `Failed to delete agent: ${errorMessage}`
      };
    }
  }

  /**
   * List all agents
   */
  async listAgents(workingDirectory?: string): Promise<AgentListResponse> {
    try {
      logger.debug('Listing agents', 'AgentManager', {
        workingDirectory
      });

      const agents: Agent[] = [];

      // Get global agents
      if (fs.existsSync(this.globalAgentsDir)) {
        const globalAgents = await this.getAgentsFromDirectory(this.globalAgentsDir, true);
        agents.push(...globalAgents);
      }

      // Get local agents if working directory is provided
      if (workingDirectory) {
        const localDir = this.getAgentDirectory(false, workingDirectory);
        if (fs.existsSync(localDir)) {
          const localAgents = await this.getAgentsFromDirectory(localDir, false);
          agents.push(...localAgents);
        }
      }

      // Sort agents by name
      agents.sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));

      logger.debug('Listed agents successfully', 'AgentManager', {
        count: agents.length,
        workingDirectory
      });

      return {
        success: true,
        agents
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to list agents', 'AgentManager', {
        error: errorMessage,
        workingDirectory
      });

      return {
        success: false,
        error: `Failed to list agents: ${errorMessage}`
      };
    }
  }

  /**
   * Get agent directory path based on global flag and working directory
   */
  private getAgentDirectory(isGlobal?: boolean, workingDirectory?: string): string {
    if (isGlobal) {
      return this.globalAgentsDir;
    } else {
      if (!workingDirectory) {
        throw new Error('Working directory is required for local agents');
      }
      return path.join(workingDirectory, '.claude', 'agents');
    }
  }

  /**
   * Ensure directory exists
   */
  private ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Ensure global agents directory exists
   */
  private ensureGlobalAgentsDir(): void {
    this.ensureDirectory(this.globalAgentsDir);
  }

  /**
   * Validate agent name
   */
  private isValidAgentName(name: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(name);
  }

  /**
   * Create agent file content with frontmatter
   */
  private createAgentFileContent(request: CreateAgentRequest | any): string {
    const frontmatter: Record<string, any> = {
      name: request.name,
      description: request.description,
    };

    if (request.model) frontmatter.model = request.model;
    if (request.color) frontmatter.color = request.color;

    // Add any additional metadata
    if (request.metadata) {
      Object.keys(request.metadata).forEach(key => {
        if (!['name', 'description', 'model', 'color'].includes(key)) {
          frontmatter[key] = request.metadata[key];
        }
      });
    }

    // Create YAML frontmatter
    const frontmatterLines = ['---'];
    Object.keys(frontmatter).forEach(key => {
      const value = frontmatter[key];
      if (typeof value === 'string') {
        // Escape quotes in string values for YAML
        const escapedValue = value.includes(':') || value.includes('"') ? `"${value.replace(/"/g, '\\"')}"` : value;
        frontmatterLines.push(`${key}: ${escapedValue}`);
      } else {
        frontmatterLines.push(`${key}: ${JSON.stringify(value)}`);
      }
    });
    frontmatterLines.push('---');

    return frontmatterLines.join('\n') + '\n\n' + request.content;
  }

  /**
   * Parse agent file and extract metadata and content
   */
  private async parseAgentFile(filePath: string, isGlobal: boolean): Promise<Agent> {
    const content = fs.readFileSync(filePath, 'utf8');

    // Split content into lines
    const lines = content.split('\n');

    if (lines[0].trim() !== '---') {
      throw new Error(`Invalid agent file format: ${filePath} - missing frontmatter start`);
    }
    
    let frontmatterEndIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '---') {
        frontmatterEndIndex = i;
        break;
      }
    }
    
    if (frontmatterEndIndex === -1) {
      throw new Error(`Invalid agent file format: ${filePath} - missing frontmatter end`);
    }
    
    const frontmatterLines = lines.slice(1, frontmatterEndIndex);
    const contentLines = lines.slice(frontmatterEndIndex + 1);
    
    // Parse YAML-like frontmatter (simple key: value parsing)
    const metadata: AgentMetadata = { name: '', description: '' };
    
    frontmatterLines.forEach(line => {
      const match = line.match(/^(\w+):\s*(.*)$/);
      if (match) {
        const [, key, value] = match;
        try {
          // Try to parse as JSON first (for complex values)
          metadata[key] = JSON.parse(value);
        } catch {
          // If not valid JSON, treat as string
          metadata[key] = value;
        }
      }
    });

    return {
      metadata,
      content: contentLines.join('\n').trim(),
      filePath,
      isGlobal
    };
  }

  /**
   * Get all agents from a directory
   */
  private async getAgentsFromDirectory(directory: string, isGlobal: boolean): Promise<Agent[]> {
    const agents: Agent[] = [];
    
    const files = fs.readdirSync(directory);
    
    for (const file of files) {
      if (file.endsWith('.md')) {
        try {
          const agentPath = path.join(directory, file);
          const agent = await this.parseAgentFile(agentPath, isGlobal);
          agents.push(agent);
        } catch (error) {
          logger.warn('Failed to parse agent file', 'AgentManager', {
            file,
            directory,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }
    
    return agents;
  }
}