# Claude Code UI

A modern web interface for Claude CLI with real-time streaming support, built with AI Elements and shadcn/ui components.

## 🌟 Features

### **🎯 Modern Chat Interface**
- **ChatGPT-style design** with clean, focused layout
- **Real-time streaming** - Watch Claude think and respond live
- **Session persistence** - Conversations continue across interactions
- **Working directory support** - Set project context for Claude CLI

### **🛠️ Advanced Tool Visualization**
- **Live tool streaming** - Watch Claude construct file operations in real-time
- **Think → Act → Think flow** - See Claude's thought process interwoven with tool usage
- **Tool result display** - Bash, Read, Write, Search tools with proper formatting
- **Code highlighting** - Syntax highlighting for all code blocks

### **📎 Multimodal Input**
- **Voice recording** - Record voice messages (speech-to-text ready)
- **File attachments** - Upload images, PDFs, code files, and documents
- **Rich text input** - Auto-resizing textarea with keyboard shortcuts

### **🎨 Beautiful Components**
- **AI Elements integration** - Showcases all AI Elements components
- **shadcn/ui styling** - Professional, accessible design system
- **Responsive layout** - Works on desktop, tablet, and mobile
- **Dark mode support** - Seamless theme switching

## 🚀 Quick Start

### **Prerequisites**
- Node.js 16+
- Claude CLI installed and configured
- Git

### **1. Backend Setup**
```bash
# Clone the repository
git clone https://github.com/suhail-ak-2/claude-code-ui.git
cd claude-code-ui

# Install backend dependencies
npm install

# Build the project
npm run build

# Start the API server
npm run dev
```
The API server will run on `http://localhost:3000`

### **2. Frontend Setup**
```bash
# Open a new terminal and navigate to frontend
cd frontend

# Install frontend dependencies
npm install

# Start the development server
npm run dev
```
The web interface will be available at `http://localhost:3001`

### **3. Start Using**
1. Open `http://localhost:3001` in your browser
2. Set your working directory in the sidebar
3. Start chatting with Claude CLI through the beautiful interface!

## 📡 API Endpoints

### **Streaming Endpoint**
```bash
POST http://localhost:3000/claude/stream
Content-Type: application/json

{
  "prompt": "What files are in the current directory?",
  "sessionId": "uuid-from-previous-response", // optional
  "workingDirectory": "/path/to/project" // optional
}
```

### **Execute Endpoint**
```bash
POST http://localhost:3000/claude/execute
Content-Type: application/json

{
  "prompt": "Help me understand this code",
  "sessionId": "session-uuid", // optional
  "options": {
    "model": "sonnet",
    "dangerouslySkipPermissions": true
  }
}
```

## 🎨 UI Components Showcase

The frontend demonstrates all AI Elements components:

- **Conversation** - Chat layout and message flow
- **Message** - User and assistant message cards
- **Response** - Formatted AI responses with streaming
- **Tool** - Interactive tool usage display with real-time input streaming
- **CodeBlock** - Syntax-highlighted code with copy functionality
- **PromptInput** - Advanced input with attachments and voice
- **Loader** - Elegant loading states
- **Actions** - Quick action buttons
- **Suggestion** - Pre-filled prompt suggestions

## 🔧 Features in Detail

### **Real-time Tool Streaming**
Watch Claude construct tool calls character by character:
```
🔧 tool-Write | Input Streaming...
{"file_path": "/path/to/file.js", "content": "import React|
```

### **Session Management**
- Automatic session creation and persistence
- Conversation history in sidebar
- Working directory context maintained

### **Advanced Input**
- **Voice Recording**: Click microphone to record voice messages
- **File Attachments**: Drag & drop or click to attach files
- **Multiline Support**: Auto-resizing textarea
- **Keyboard Shortcuts**: Enter to send, Shift+Enter for new line

### **Developer Tools**
- **TypeScript throughout** - Full type safety
- **Comprehensive logging** - Debug and monitor API usage
- **Error handling** - Graceful error states
- **Performance optimized** - Efficient streaming and rendering

## 📁 Project Structure

```
claude-code-ui/
├── src/                    # Backend API source
│   ├── server.ts          # Express server with streaming endpoints
│   ├── claudeWrapper.ts   # Claude CLI process management
│   ├── types.ts           # TypeScript definitions
│   └── logging/           # Logging and telemetry
├── frontend/              # Next.js frontend
│   ├── src/
│   │   ├── app/page.tsx   # Main chat interface
│   │   ├── components/
│   │   │   ├── ai-elements/  # AI Elements components
│   │   │   └── ui/           # shadcn/ui components
│   └── package.json
├── examples/              # Example clients
└── README.md
```

## 🚀 Deployment

### **Local Development**
1. Start backend: `npm run dev` (port 3000)
2. Start frontend: `cd frontend && npm run dev` (port 3001)

### **Production**
1. Build backend: `npm run build`
2. Build frontend: `cd frontend && npm run build`
3. Start backend: `npm start`
4. Serve frontend: `cd frontend && npm start`

## 🤝 Contributing

This project showcases the power of Claude CLI with a modern web interface. Contributions welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

ISC License - feel free to use this project as a foundation for your own Claude CLI interfaces!

## 🙏 Acknowledgments

- Built with [Claude CLI](https://docs.anthropic.com/claude/claude-code)
- UI powered by [AI Elements](https://ai-sdk.dev/elements)
- Styled with [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide React](https://lucide.dev/)

---

**Perfect for Claude Code users who want a beautiful, modern interface for their CLI interactions!** 🎉