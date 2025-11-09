import { Task, ITaskJSON } from './Task'

// Simple in-memory store for tasks. For persistence, replace with FS/DB logic.
export class TaskManager {
    private static instance: TaskManager
    private tasks: Map<string, Task>

    private constructor() {
        this.tasks = new Map()
    }

    static getInstance(): TaskManager {
        if (!TaskManager.instance) {
            TaskManager.instance = new TaskManager()
        }
        return TaskManager.instance
    }

    listTasks(): ITaskJSON[] {
        // Return JSON-serializable tasks
        return Array.from(this.tasks.values()).map((t) => t.toJSON())
    }

    addTask(id: string, title: string, deadlineISO: string): ITaskJSON {
        const deadline = new Date(deadlineISO)
        const task = new Task(id, title, deadline, false)
        this.tasks.set(id, task)
        return task.toJSON()
    }

    removeTask(id: string): boolean {
        return this.tasks.delete(id)
    }

    toggleComplete(id: string): ITaskJSON | null {
        const t = this.tasks.get(id)
        if (!t) return null
        t.completed = !t.completed
        return t.toJSON()
    }

    getTask(id: string): ITaskJSON | null {
        const t = this.tasks.get(id)
        return t ? t.toJSON() : null
    }
}

// Export a single instance (TaskManager singleton) to be used by main process
export const taskManager = TaskManager.getInstance()
