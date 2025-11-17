import { Repository } from 'typeorm'
import { AppDataSource } from './Database'
import { Task, ITaskJSON } from './Task'

/**
 * TaskRepository handles all task storage and retrieval operations.
 * This is a simple in-memory repository. Can be replaced with FS/DB logic later.
 */
export class TaskRepository {
    private ormRepository: Repository<Task>

    constructor() {
        this.ormRepository = AppDataSource.getRepository(Task)
    }

    /**
     * Get all tasks as JSON
     */
    async getAllTasks(): Promise<ITaskJSON[]> {
        const tasks = await this.ormRepository.find()
        return tasks.map((t) => t.toJSON())
    }

    /**
     * Get a single task by ID
     */
    async getTaskById(id: string): Promise<Task | null> {
        return this.ormRepository.findOneBy({ id })
    }

    /**
     * Get a single task as JSON by ID
     */
    async getTaskByIdJSON(id: string): Promise<ITaskJSON | null> {
        const task = await this.ormRepository.findOneBy({ id })
        return task ? task.toJSON() : null
    }

    /**
     * Add a new task
     */
    async addTask(task: Task): Promise<Task> {
        return this.ormRepository.save(task)
    }

    /**
     * Update an existing task
     */
    async updateTask(id: string, taskData: Partial<Task>): Promise<boolean> {
        const result = await this.ormRepository.update(id, taskData)
        return result.affected !== 0
    }

    /**
     * Remove a task by ID
     */
    async removeTask(id: string): Promise<boolean> {
        const result = await this.ormRepository.delete(id)
        return result.affected !== 0
    }

    /**
     * Check if a task exists
     */
    async existsTask(id: string): Promise<boolean> {
        return this.ormRepository.existsBy({ id })
    }

    /**
     * Get count of all tasks
     */
    async countTasks(): Promise<number> {
        return this.ormRepository.count()
    }

    /**
     * Clear all tasks
     */
    async clearTasks(): Promise<void> {
        await this.ormRepository.clear()
    }
}
