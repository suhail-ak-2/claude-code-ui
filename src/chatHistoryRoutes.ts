import { Router } from 'express';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as path from 'path';
import { homedir } from 'os';

const router = Router();

interface ConversationSummary {
  sessionId: string;
  title: string;
  timestamp: string;
  projectPath: string;
  messageCount: number;
  lastMessage?: string;
}

interface ProjectSummary {
  projectPath: string;
  displayName: string;
  conversations: ConversationSummary[];
  totalConversations: number;
}

interface ConversationMessage {
  uuid: string;
  type: string;
  timestamp: string;
  message?: any;
  parentUuid?: string;
  sessionId: string;
}

// Get all projects and their conversation summaries
router.get('/projects', async (req, res) => {
  try {
    const claudeProjectsPath = path.join(homedir(), '.claude', 'projects');

    // Check if projects directory exists
    try {
      await fs.access(claudeProjectsPath);
    } catch {
      return res.json([]);
    }

    const projectDirs = await fs.readdir(claudeProjectsPath);
    const projects: ProjectSummary[] = [];

    for (const projectDir of projectDirs) {
      if (projectDir.startsWith('.')) continue;

      const projectPath = path.join(claudeProjectsPath, projectDir);
      const stat = await fs.stat(projectPath);

      if (!stat.isDirectory()) continue;

      try {
        const files = await fs.readdir(projectPath);
        const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
        const conversations: ConversationSummary[] = [];

        for (const file of jsonlFiles) {
          const sessionId = file.replace('.jsonl', '');
          const filePath = path.join(projectPath, file);

          try {
            // Read first few lines to get conversation info
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim());

            if (lines.length === 0) continue;

            // Extract summary and basic info
            let title = 'Untitled Conversation';
            let timestamp = '';
            let messageCount = 0;
            let lastMessage = '';
            let hasUserMessages = false;

            // Look for summary and check for actual conversation content
            for (let i = 0; i < lines.length; i++) {
              try {
                const parsed = JSON.parse(lines[i]);
                if (parsed.type === 'summary' && parsed.summary) {
                  title = parsed.summary;
                }
                if (parsed.timestamp) {
                  timestamp = parsed.timestamp;
                }
                if (parsed.type === 'user' || parsed.type === 'assistant') {
                  hasUserMessages = true;
                }
                messageCount++;
              } catch {
                // Skip invalid JSON lines
              }
            }

            // Skip conversations that only have summaries or system messages
            if (!hasUserMessages && messageCount < 3) {
              console.log(`Skipping conversation ${sessionId} - appears to be summary-only`);
              continue;
            }

            // Get last user message for preview
            for (let i = lines.length - 1; i >= 0; i--) {
              try {
                const parsed = JSON.parse(lines[i]);
                if (parsed.type === 'user' && parsed.message?.content) {
                  const content = Array.isArray(parsed.message.content)
                    ? parsed.message.content[0]?.text || parsed.message.content[0]
                    : parsed.message.content;

                  if (typeof content === 'string') {
                    lastMessage = content.substring(0, 100);
                    break;
                  }
                }
              } catch {
                // Skip invalid JSON lines
              }
            }

            conversations.push({
              sessionId,
              title,
              timestamp: timestamp || new Date().toISOString(),
              projectPath: decodeProjectPath(projectDir),
              messageCount: lines.length,
              lastMessage
            });

          } catch (error) {
            console.error(`Error reading conversation file ${file}:`, error);
          }
        }

        // Sort conversations by timestamp (newest first)
        conversations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        projects.push({
          projectPath: decodeProjectPath(projectDir),
          displayName: formatProjectName(decodeProjectPath(projectDir)),
          conversations,
          totalConversations: conversations.length
        });

      } catch (error) {
        console.error(`Error reading project ${projectDir}:`, error);
      }
    }

    // Sort projects by most recent conversation
    projects.sort((a, b) => {
      const aLatest = a.conversations[0]?.timestamp || '';
      const bLatest = b.conversations[0]?.timestamp || '';
      return new Date(bLatest).getTime() - new Date(aLatest).getTime();
    });

    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get specific conversation details
router.get('/conversation/:projectId/:sessionId', async (req, res) => {
  try {
    const { projectId, sessionId } = req.params;
    const claudeProjectsPath = path.join(homedir(), '.claude', 'projects');
    const projectPath = path.join(claudeProjectsPath, projectId);
    const conversationPath = path.join(projectPath, `${sessionId}.jsonl`);

    try {
      await fs.access(conversationPath);
    } catch {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const content = await fs.readFile(conversationPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    const messages: ConversationMessage[] = [];

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        messages.push({
          uuid: parsed.uuid,
          type: parsed.type,
          timestamp: parsed.timestamp,
          message: parsed.message,
          parentUuid: parsed.parentUuid,
          sessionId: parsed.sessionId
        });
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    }

    res.json({
      sessionId,
      projectPath: decodeProjectPath(projectId),
      messages,
      totalMessages: messages.length
    });

  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// Helper function to decode project path from directory name by reading the session file
function decodeProjectPath(encodedPath: string): string {
  try {
    const claudeProjectsPath = path.join(homedir(), '.claude', 'projects');
    const projectPath = path.join(claudeProjectsPath, encodedPath);

    // Get the first .jsonl file in the directory to read the cwd
    const files = fsSync.readdirSync(projectPath);
    const jsonlFile = files.find((f: string) => f.endsWith('.jsonl'));

    if (jsonlFile) {
      const filePath = path.join(projectPath, jsonlFile);
      const content = fsSync.readFileSync(filePath, 'utf-8');
      const firstLine = content.split('\n')[0];

      if (firstLine) {
        const parsed = JSON.parse(firstLine);
        if (parsed.cwd) {
          return parsed.cwd;
        }
      }
    }
  } catch (error) {
    console.error('Error reading project path from session file:', error);
  }

  // Fallback: simple replacement
  if (encodedPath.startsWith('-')) {
    return '/' + encodedPath.substring(1).replace(/-/g, '/');
  }
  return encodedPath.replace(/-/g, '/');
}

// Helper function to format project name for display
function formatProjectName(projectPath: string): string {
  const parts = projectPath.split('/');
  const lastPart = parts[parts.length - 1];

  // If it's a home directory path, show relative to home
  if (projectPath.startsWith('/Users/')) {
    const homeRelative = parts.slice(3).join('/'); // Skip /Users/username
    return homeRelative || 'Home';
  }

  return lastPart || projectPath;
}

export { router as chatHistoryRoutes };