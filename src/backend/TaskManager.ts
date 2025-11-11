import { Task, ITaskJSON } from './Task'
import { Tag } from './Tag'
import { ICategoryJSON } from './Category'
import { CategoryManager, categoryManager } from './CategoryManager'
import { TaskRepository } from './TaskRepository'

/**
 * TaskManager orchestrates task operations and delegates storage to TaskRepository.
 * It also manages the relationship between tasks and categories via CategoryManager.
 */
export class TaskManager {
    private static instance: TaskManager
    private taskRepository: TaskRepository
    private categoryManager: CategoryManager

    private constructor(injectedCategoryManager?: CategoryManager) {
        this.taskRepository = new TaskRepository()
        // allow injection for tests; default to the exported singleton
        this.categoryManager = injectedCategoryManager ?? categoryManager
    }

    static getInstance(): TaskManager {
        if (!TaskManager.instance) {
            TaskManager.instance = new TaskManager()
        }
        return TaskManager.instance
    }

    listTasks(): ITaskJSON[] {
        return this.taskRepository.getAllTasks()
    }

    getCategories(): ICategoryJSON[] {
        return this.categoryManager.listCategories()
    }

    /**
     * Add a new task with full details
     */
    addTask(
        id: string,
        title: string,
        description: string,
        deadlineISO: string,
        startDateISO: string,
        categoryId: number | null = null,
        priority: number = 0,
        estimateDurationHour: number = 0,
        isRoot: boolean = false,
        tags: Tag[] = [],
        childrenTaskIds: string[] = []
    ): ITaskJSON {
        const deadline = new Date(deadlineISO)
        const startDate = new Date(startDateISO)
        const task = new Task(
            id,
            title,
            description,
            deadline,
            startDate,
            false,
            categoryId,
            priority,
            estimateDurationHour,
            isRoot,
            tags,
            childrenTaskIds
        )
        this.taskRepository.addTask(task)
        return task.toJSON()
    }

    /**
     * Remove a task by ID
     */
    removeTask(id: string): boolean {
        return this.taskRepository.removeTask(id)
    }

    /**
     * Toggle task completion status
     */
    toggleComplete(id: string): ITaskJSON | null {
        const t = this.taskRepository.getTaskById(id)
        if (!t) return null
        t.completed = !t.completed
        this.taskRepository.updateTask(id, t)
        return t.toJSON()
    }

    /**
     * Get a single task by ID
     */
    getTask(id: string): ITaskJSON | null {
        return this.taskRepository.getTaskByIdJSON(id)
    }

    /**
     * Update task properties
     */
    updateTask(id: string, updates: Partial<ITaskJSON>): ITaskJSON | null {
        const task = this.taskRepository.getTaskById(id)
        if (!task) return null

        // Apply updates
        if (updates.title) task.title = updates.title
        if (updates.description) task.description = updates.description
        if (updates.deadline) task.deadline = new Date(updates.deadline)
        if (updates.startDate) task.startDate = new Date(updates.startDate)
        if (updates.completed !== undefined) task.completed = updates.completed
        if (updates.categoryId !== undefined) task.categoryId = updates.categoryId
        if (updates.priority !== undefined) task.priority = updates.priority
        if (updates.estimateDurationHour !== undefined) task.estimateDurationHour = updates.estimateDurationHour
        if (updates.isRoot !== undefined) task.isRoot = updates.isRoot
        if (updates.tags) task.tags = updates.tags
        if (updates.childrenTaskIds) task.childrenTaskIds = updates.childrenTaskIds

        this.taskRepository.updateTask(id, task)
        return task.toJSON()
    }

    /**
     * Add a child task to a parent task
     */
    addSubTask(parentTaskId: string, childTaskId: string): ITaskJSON | null {
        const parent = this.taskRepository.getTaskById(parentTaskId)
        if (!parent) return null

        if (!parent.childrenTaskIds.includes(childTaskId)) {
            parent.childrenTaskIds.push(childTaskId)
            this.taskRepository.updateTask(parentTaskId, parent)
        }

        return parent.toJSON()
    }

    /**
     * Remove a child task from a parent task
     */
    removeSubTask(parentTaskId: string, childTaskId: string): ITaskJSON | null {
        const parent = this.taskRepository.getTaskById(parentTaskId)
        if (!parent) return null

        parent.childrenTaskIds = parent.childrenTaskIds.filter((id) => id !== childTaskId)
        this.taskRepository.updateTask(parentTaskId, parent)

        return parent.toJSON()
    }

    /**
     * Get all child tasks of a parent task
     */
    getSubTasks(parentTaskId: string): ITaskJSON[] {
        const parent = this.taskRepository.getTaskById(parentTaskId)
        if (!parent) return []

        return parent.childrenTaskIds
            .map((id) => this.taskRepository.getTaskByIdJSON(id))
            .filter((t) => t !== null) as ITaskJSON[]
    }
}

// Export a single instance (TaskManager singleton) to be used by main process
export const taskManager = TaskManager.getInstance()
