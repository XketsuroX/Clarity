import { ITaskJSON } from './Task';
import { CategoryManager, categoryManager } from './CategoryManager';
import { CreateTaskData, TaskRepository, UpdateTaskData } from './TaskRepository';
import { TaskDependencyManager } from './TaskDependencyManager';
import { TaskCalculator } from './TaskCalculator';
import { ErrorHandler, Result } from './ErrorHandler';

export class TaskManager {
	private readonly taskRepository: TaskRepository;
	private readonly categoryManager: CategoryManager;
	private readonly dependencyManager: TaskDependencyManager;
	private readonly calculator: TaskCalculator;
	private readonly errorHandler: ErrorHandler;

	/**
	 * Helper to wrap project-level calculator calls with error handling
	 */
	private async wrapProjectCalc<T>(
		fn: () => Promise<T | null>,
		notFoundMsg = 'Project not found'
	): Promise<Result<T>> {
		try {
			const v = await fn();
			if (v === null)
				return { ok: false, error: { code: 'NOT_FOUND', message: notFoundMsg } };
			return { ok: true, value: v };
		} catch (e) {
			return { ok: false, error: this.errorHandler.formatError(e) };
		}
	}

	constructor(injectedCategoryManager?: CategoryManager) {
		this.taskRepository = new TaskRepository();
		this.categoryManager = injectedCategoryManager ?? categoryManager;
		this.dependencyManager = new TaskDependencyManager(this.taskRepository);
		this.calculator = new TaskCalculator(this.taskRepository, this.dependencyManager);
		this.errorHandler = new ErrorHandler();
	}

	async listTasks(): Promise<ITaskJSON[]> {
		const tasks = await this.taskRepository.findAll();
		return tasks.map((task) => task.toJSON());
	}

	async addTask(data: CreateTaskData): Promise<ITaskJSON> {
		const newTask = await this.taskRepository.create(data);
		return newTask.toJSON();
	}

	// Change a task from Scheduled -> In Progress
	async startTask(id: number): Promise<ITaskJSON | null> {
		const task = await this.taskRepository.findById(id);
		if (!task) return null;
		// Only start if currently scheduled
		if (task.state !== 'Scheduled') return null;

		const updatedTask = await this.taskRepository.update(id, {
			state: 'In Progress',
			startDate: new Date(),
		});
		return updatedTask?.toJSON() ?? null;
	}

	async removeTask(id: number): Promise<boolean> {
		return await this.taskRepository.delete(id);
	}

	async toggleComplete(id: number): Promise<ITaskJSON | null> {
		const task = await this.taskRepository.findById(id);
		if (!task) return null;

		const newCompleted = !task.completed;

		// If attempting to mark completed, ensure all immediate children are completed
		if (newCompleted) {
			const children = task.childrenTasks || [];
			const incomplete = children.find((c) => !c.completed);
			if (incomplete) {
				throw new Error('All child tasks must be completed before marking this task as completed');
			}
		}
		const newState = newCompleted ? 'Completed' : (task.deadline && task.deadline.getTime() < Date.now() ? 'Overdue' : 'In Progress');

		const updatedTask = await this.taskRepository.update(id, {
			completed: newCompleted,
			state: newState,
		});
		return updatedTask?.toJSON() ?? null;
	}

	async getTask(id: number): Promise<ITaskJSON | null> {
		const task = await this.taskRepository.findById(id);
		return task?.toJSON() ?? null;
	}

	async updateTask(id: number, data: UpdateTaskData): Promise<ITaskJSON | null> {
		if (data.parentTaskId !== undefined && data.parentTaskId !== null) {
			const wouldCreateCycle = await this.dependencyManager.wouldCreateCycle(
				id,
				data.parentTaskId
			);
			if (wouldCreateCycle) {
				throw new Error('This operation would create a dependency cycle.');
			}
		}

		const updatedTask = await this.taskRepository.update(id, data);
		return updatedTask?.toJSON() ?? null;
	}

	async getRootTasks(): Promise<ITaskJSON[]> {
		return await this.dependencyManager.getRootTasks();
	}

	async getAllDescendants(taskId: number): Promise<ITaskJSON[]> {
		return await this.dependencyManager.getAllDescendants(taskId);
	}

	/**
	 * Refresh task states for all tasks (recalculate state based on current date and deadline)
	 * Useful to call before scheduling calculations to ensure accurate state
	 */
	/**
	 * Refresh persisted overdue states: find tasks where deadline passed and state is not Completed/Overdue
	 * and set their state to 'Overdue'. This makes overdue queryable in DB.
	 */
	async refreshOverdue(): Promise<void> {
		const tasks = await this.taskRepository.findAll();
		const now = Date.now();
		for (const task of tasks) {
			if (task.completed) continue;
			if (task.deadline && task.deadline.getTime() < now && task.state !== 'Overdue') {
				await this.taskRepository.update(task.id, { state: 'Overdue' });
			}
		}
	}

	/**
	 * Get project completeness by delegating to getTaskCompleteness on the project root.
	 * Refreshes overdue states first and returns a Result<number>.
	 */
	async getProjectCompleteness(anyTaskId: number): Promise<Result<number>> {
		await this.refreshOverdue();
		return this.wrapProjectCalc(async () => {
			const root = await this.dependencyManager.getProjectRoot(anyTaskId);
			if (!root) return null;
			return await this.calculator.getTaskCompleteness(root.id);
		}, 'Project not found');
	}

	/**
	 * Get urgency for a single task (0..100). Proxy to TaskCalculator.
	 */
	async getTaskUrgency(taskId: number, windowDays = 30): Promise<number> {
		return await this.calculator.getTaskUrgency(taskId, windowDays);
	}
}

export const taskManager = new TaskManager();
