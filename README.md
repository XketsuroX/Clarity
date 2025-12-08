# Clarity - Smart Task Management System

Clarity is a desktop task management application built with **Electron**, **Vue 3**, and **TypeScript**. It features an intelligent scheduler that automatically prioritizes tasks based on urgency, dependencies, and available time slots.

> **Course:** CS3343 Software Engineering Practice
> **Semester:** 2025/26 Sem A

## ✨ Features

*   **Task Management**: Create, edit, and delete tasks with rich details (priority, duration, due date).
*   **Smart Scheduling**: An algorithm-based scheduler that suggests what to work on next based on urgency and time capacity.
*   **Dependency Tracking**: Manage task dependencies (e.g., Task B cannot start until Task A is finished) with cycle detection.
*   **Categorization**: Organize tasks using Categories and Tags.
*   **Data Persistence**: Local SQLite database storage using TypeORM.

## 🛠 Tech Stack

*   **Core**: Electron, Node.js
*   **Frontend**: Vue 3, TypeScript, Vite
*   **Database**: SQLite, TypeORM
*   **Testing**: Jest (Unit & Bottom-Up Integration Tests)

## 🚀 Getting Started

### Prerequisites

*   Node.js (v16 or higher recommended)
*   npm or yarn

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/clarity.git
    cd clarity
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  **Important**: Rebuild native modules (SQLite) for Electron:
    ```bash
    npm run postinstall
    ```

### Running in Development Mode

Start the app with hot-reload:

```bash
npm run dev
```

### Build & Release
To package the application into an executable (.exe):

The output installer will be located in the `dist` directory.

### Testing
This project uses Jest for testing. We follow a Bottom-Up Integration Testing strategy.

Run all tests:
```
npm test
```

Run specific test file:
```
npx jest src/main/__tests__/tagManager.test.ts
```

### Project Structure
```
src/
├── main/                 # Electron Main Process (Backend Logic)
│   ├── __tests__/        # Jest Test Files
│   ├── CategoryManager.ts
│   ├── TaskManager.ts
│   ├── Scheduler.ts
│   └── ...
├── renderer/             # Vue 3 Frontend (UI)
│   ├── src/
│   │   └── components/
│   ├── App.vue
│   ├── main.ts
│   ├── api.ts
│   └── ...
├── preload/              # Electron Preload Scripts
└── shared/               # Shared code between Main and Renderer
    ├── CategoryTypes.ts 
	└── ...
```

--- 
*This project is for academic purposes only.*