# Streams A Lot

> **Note:** This project is currently under active production and development. Features are being actively built and refined.

A real-time collaborative workspace platform that combines Kanban boards, code editing, and terminal functionality into a single unified experience.

## Features

### Authentication & User Management
- Registration with email + OTP verification
- JWT authentication (access + refresh tokens)
- Password reset via OTP email flow
- User profile management
- Rate limiting on auth endpoints

### Workspace & Team Management
- Create and manage workspaces
- Role-based membership (Owner, Admin, Editor, Viewer)
- Email invitations with role assignment
- Pending invitation notifications

### Kanban Boards
- Trello-style boards with columns and cards
- Real-time card operations over WebSockets
- Version-based conflict detection
- Live presence indicators
- Cursor and selection broadcasting
- Full audit trail

### Collaborative Code Editor
- Real-time collaborative editing using CRDTs
- CodeMirror 6 with syntax highlighting
- Support for Python, JavaScript/TypeScript, HTML, CSS, JSON, Markdown
- Live cursors and awareness
- Auto-save with debounce
- Language detection from file extension
- Basic syntax diagnostics

### Code Execution Engine
- Multi-language execution in sandboxed environment
- Supported languages: Python, JavaScript, C, C++, Java, Go, Rust, Ruby, Bash
- Compilation support for compiled languages
- Timeout handling per language

### Terminal (PTY)
- Bidirectional terminal sessions via WebSockets
- xterm.js frontend terminal emulator
- Shell types: Bash and Python REPL
- Terminal resize support

### UI/UX
- Dark mode and light mode with smooth transitions
- Tailwind CSS with custom design system
- Polished animations
- File tree sidebar
- Tab-based file editing
- Status bar with connection info

## Tech Stack

### Backend
- Django 6.0
- Django REST Framework 3.17
- Django Channels 4.2 (WebSocket support)
- Redis (channel layer, caching)
- pycrdt (CRDT engine)
- SQLite3 (development)

### Frontend
- React 18
- TypeScript 5.6
- Vite 6
- Zustand 5 (state management)
- CodeMirror 6 (code editor)
- Yjs (CRDT library)
- xterm.js 5.5 (terminal)
- Tailwind CSS 3.4

## Project Structure

```
Streams_A_Lot/
  core/              # Django project config
  apps/
    base/            # Abstract BaseModel, utilities
    user/            # User model, auth logic
    colab/           # Collaboration app
  frontend/          # React + Vite SPA
    src/
      api/           # API modules
      components/    # UI components
      hooks/         # Custom hooks
      pages/         # Page components
      store/         # State management
```

## Getting Started

*Setup instructions coming soon as the project is still under development.*

## API Documentation

*API documentation will be available once the project reaches a stable release.*

## License

*License information to be added.*

---

**Author:** servercraft-stack (davidonyekachi29@gmail.com)
