import { Task, ITaskJSON } from './Task'

/**
 * TaskRepository handles all task storage and retrieval operations.
 * This is a simple in-memory repository. Can be replaced with FS/DB logic later.
 */
export class TaskRepository {
    private tasks: Map<string, Task>

    constructor() {
        this.tasks = new Map()
    }

    /**
     * Get all tasks as JSON
     */
    getAllTasks(): ITaskJSON[] {
        return Array.from(this.tasks.values()).map((t) => t.toJSON())
    }

    /**
     * Get a single task by ID
     */
    getTaskById(id: string): Task | null {
        return this.tasks.get(id) || null
    }

    /**
     * Get a single task as JSON by ID
     */
    getTaskByIdJSON(id: string): ITaskJSON | null {
        const task = this.tasks.get(id)
        return task ? task.toJSON() : null
    }

    /**
     * Add a new task
     */
    addTask(task: Task): void {
        this.tasks.set(task.id, task)
    }

    /**
     * Update an existing task
     */
    updateTask(id: string, task: Task): boolean {
        if (!this.tasks.has(id)) {
            return false
        }
        this.tasks.set(id, task)
        return true
    }

    /**
     * Remove a task by ID
     */
    removeTask(id: string): boolean {
        return this.tasks.delete(id)
    }

    /**
     * Check if a task exists
     */
    existsTask(id: string): boolean {
        return this.tasks.has(id)
    }

    /**
     * Get count of all tasks
     */
    countTasks(): number {
        return this.tasks.size
    }

    /**
     * Clear all tasks
     */
    clearTasks(): void {
        this.tasks.clear()
    }
}
