# GTM GA Assistant

A desktop application for efficiently managing Google Tag Manager (GTM) and Google Analytics (GA) implementations. Built with Electron and React.

**Version:** 2.0.0

## Features

### 🎯 Spec Mode
Write and manage GTM and GA measurement specifications. Hover over website elements to automatically create measurement documentation with precise positioning.

### 📖 View Mode
View saved specifications in read-only format. Share measurement specifications with team members without allowing edits.

### ✅ Verification Mode
Validate that installed tags match your measurement specifications. Ensure your website implementation complies with the planned measurement strategy.

## Why GTM GA Assistant?

GTM GA Assistant solves the friction of working with GTM and GA:

- **No more tab switching** - Check installed tags directly in the app without opening multiple developer tools
- **Simplified management** - Navigate complex GTM container configurations with visual clarity
- **Team collaboration** - Share and track measurement plans with team members
- **Local & fast** - Work offline at full speed without cloud dependencies

## Tech Stack

- **Framework:** [Electron](https://www.electronjs.org/) + [React](https://react.dev/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) + [Framer Motion](https://www.framer.com/motion/)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Storage:** [electron-store](https://github.com/sindresorhus/electron-store)
- **Icons:** [Lucide React](https://lucide.dev/)

## Architecture

The app uses a two-WebContentsView architecture for optimal performance and clarity:

```
┌─────────────────────────────────────┐
│   Electron BaseWindow                │
│                                     │
│  ┌──────────────────────────────┐  │
│  │ uiView (React UI Layer)      │  │
│  │ - Spec/View/Verification UI  │  │
│  │ - Badges & overlays          │  │
│  │ (Transparent background)     │  │
│  └──────────────────────────────┘  │
│           ↕ IPC Channel             │
│  ┌──────────────────────────────┐  │
│  │ guestView (Target Website)   │  │
│  │ - Website content            │  │
│  │ - Actual DOM & events        │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

Benefits of this approach:
- **Independent rendering** - UI and website render on separate threads
- **Clear focus management** - No ambiguity about which layer receives input
- **No event interference** - UI clicks won't affect the target website
- **Smooth performance** - Badge animations don't impact website scrolling

## Installation

### Prerequisites
- Node.js 16+
- npm or pnpm

### Setup

```bash
# Install dependencies
npm install
# or
pnpm install

# Run development server
npm run dev

# Build for production
npm run electron:build

# Run linter
npm run lint
```

## Usage

### Starting the App

```bash
npm run dev
```

The application will open with the home screen showing available modes.

### Spec Mode

1. **Open target website** - Enter the URL of the website you want to document
2. **Create measurement spec** - Click "Create New Spec" or open an existing one
3. **Navigate website** - Browse the website to find elements you want to document
4. **Add measurements** - Hover over elements to place badges and create documentation
5. **Save spec** - Your specifications are automatically saved to local storage

### View Mode

1. **Select spec** - Choose a saved specification from the list
2. **Read specifications** - View measurement details in read-only format
3. **Share** - Export specs to share with team members

### Verification Mode

1. **Load spec** - Choose a specification to verify against
2. **Browse website** - Navigate the target website
3. **Check implementation** - The app highlights installed tags and compares against spec
4. **View results** - See which measurements are properly implemented and which are missing

## Project Structure

```
src/
├── main/              # Electron main process
├── renderer/          # React application
│   ├── features/      # Feature modules (spec, verification, overlay)
│   ├── components/    # Reusable UI components
│   ├── context/       # React context for app state
│   ├── shared/        # Shared utilities and configuration
│   └── entities/      # Data models and storage
├── preload/           # Preload scripts for IPC communication
└── shared/            # Shared types and utilities
```

## Key Features Implementation

### Badge Positioning
Smart positioning algorithm that:
- Avoids placing badges outside viewport
- Adapts to element location near screen edges
- Handles nested/overlapping elements
- Animates smoothly on element hover

### GTM/GA Parsing
Comprehensive parsing for:
- GTM container scripts
- Google Analytics tags
- Data layer events
- Custom variables and triggers

### Local Storage
Persistent storage for:
- Measurement specifications
- Configuration preferences
- Recently viewed specs

## Development

### Adding New Features

1. Create feature folder in `src/renderer/features/`
2. Follow the existing pattern: `components/`, `hooks/`, `services/`
3. Use React context for state management
4. Communicate with main process via IPC when needed

### IPC Communication

Example of sending messages from renderer to main process:

```typescript
// In renderer process
window.electron.send('channel-name', data);

// In main process (preload)
ipcRenderer.on('channel-name', (event, data) => {
  // Handle message
});
```

### Building for Distribution

```bash
npm run electron:build
```

This creates:
- `.dmg` for macOS
- `.exe` installer for Windows
- `.AppImage` for Linux

## Architecture Evolution

This project went through significant architectural refinement:

**v1.0** - WebView-based approach
- UI and website in single DOM tree
- Frequent focus management issues
- Event propagation conflicts

**v2.0** - WebContentsView architecture
- Separate render processes for UI and website
- Clear responsibility boundaries
- Significantly improved performance and stability

Read the full development story in [BLOG_POST.md](./BLOG_POST.md).

## Key Learnings

1. **Good architecture matters more than feature count** - Stable design enables confident development
2. **Solve root causes** - Fixing symptoms at code level doesn't scale
3. **Invest in initial design** - Prevents exponential technical debt later
4. **Clear responsibility separation** - Reduces complexity and improves maintainability

## Contributing

Pull requests welcome. For major changes, please open an issue first to discuss proposed changes.

## License

MIT

---

Built with 🎯 for better GTM/GA management
