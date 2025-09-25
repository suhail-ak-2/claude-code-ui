export interface ConversationSummary {
  sessionId: string;
  title: string;
  timestamp: string;
  projectPath: string;
  messageCount: number;
  lastMessage?: string;
}

export interface ProjectSummary {
  projectPath: string;
  displayName: string;
  conversations: ConversationSummary[];
  totalConversations: number;
}

export interface ConversationMessage {
  uuid: string;
  type: string;
  timestamp: string;
  message?: {
    role?: string;
    content?: string | Array<{ type: string; text?: string; [key: string]: unknown }>;
    [key: string]: unknown;
  };
  parentUuid?: string;
  sessionId: string;
  isSidechain?: boolean;
  toolUseResult?: {
    stdout?: string;
    stderr?: string;
    interrupted?: boolean;
    isImage?: boolean;
  };
}

export interface ConversationDetails {
  sessionId: string;
  projectPath: string;
  messages: ConversationMessage[];
  totalMessages: number;
}

const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '';

export class ChatHistoryAPI {
  static async getProjects(): Promise<ProjectSummary[]> {
    const response = await fetch(`${API_BASE}/chat-history/projects`);
    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }
    return response.json();
  }

  static async getConversation(projectId: string, sessionId: string): Promise<ConversationDetails> {
    const response = await fetch(`${API_BASE}/chat-history/conversation/${encodeURIComponent(projectId)}/${sessionId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch conversation: ${response.statusText}`);
    }
    return response.json();
  }

  static formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  static truncateTitle(title: string, maxLength: number = 50): string {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength - 3) + '...';
  }

  static truncateMessage(message: string, maxLength: number = 80): string {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength - 3) + '...';
  }
}