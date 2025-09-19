// Agent API service for frontend
export interface Agent {
  metadata: {
    name: string;
    description: string;
    model?: string;
    color?: string;
    [key: string]: string | undefined;
  };
  content: string;
  filePath: string;
  isGlobal: boolean;
}

export interface CreateAgentRequest {
  name: string;
  description: string;
  content: string;
  model?: string;
  color?: string;
  isGlobal?: boolean;
  workingDirectory?: string;
  metadata?: Record<string, any>;
}

export interface AgentResponse {
  success: boolean;
  agent?: Agent;
  error?: string;
}

export interface AgentListResponse {
  success: boolean;
  agents?: Agent[];
  error?: string;
}

const API_BASE_URL = 'http://localhost:3000';

export class AgentAPI {
  static async createAgent(request: CreateAgentRequest): Promise<AgentResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create agent',
      };
    }
  }

  static async listAgents(workingDirectory?: string): Promise<AgentListResponse> {
    try {
      const url = new URL(`${API_BASE_URL}/agents`);
      if (workingDirectory) {
        url.searchParams.append('workingDirectory', workingDirectory);
      }

      const response = await fetch(url.toString());
      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list agents',
      };
    }
  }

  static async getAgent(
    name: string,
    isGlobal?: boolean,
    workingDirectory?: string
  ): Promise<AgentResponse> {
    try {
      const url = new URL(`${API_BASE_URL}/agents/${name}`);
      if (isGlobal !== undefined) {
        url.searchParams.append('isGlobal', isGlobal.toString());
      }
      if (workingDirectory) {
        url.searchParams.append('workingDirectory', workingDirectory);
      }

      const response = await fetch(url.toString());
      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get agent',
      };
    }
  }

  static async updateAgent(
    name: string,
    updates: Partial<CreateAgentRequest>,
    isGlobal?: boolean,
    workingDirectory?: string
  ): Promise<AgentResponse> {
    try {
      const url = new URL(`${API_BASE_URL}/agents/${name}`);
      if (isGlobal !== undefined) {
        url.searchParams.append('isGlobal', isGlobal.toString());
      }
      if (workingDirectory) {
        url.searchParams.append('workingDirectory', workingDirectory);
      }

      const response = await fetch(url.toString(), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update agent',
      };
    }
  }

  static async deleteAgent(
    name: string,
    isGlobal?: boolean,
    workingDirectory?: string
  ): Promise<AgentResponse> {
    try {
      const url = new URL(`${API_BASE_URL}/agents/${name}`);
      if (isGlobal !== undefined) {
        url.searchParams.append('isGlobal', isGlobal.toString());
      }
      if (workingDirectory) {
        url.searchParams.append('workingDirectory', workingDirectory);
      }

      const response = await fetch(url.toString(), {
        method: 'DELETE',
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete agent',
      };
    }
  }
}