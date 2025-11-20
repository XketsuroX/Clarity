import { Task, ITaskJSON } from './Task';
import { Tag } from './Tag';
import { ICategoryJSON } from './Category';
import { CategoryManager, categoryManager } from './CategoryManager';
import { TaskRepository } from './TaskRepository';
import { TaskDependencyManager } from './TaskDependencyManager';
import { TaskCalculator } from './TaskCalculator';
import { ErrorHandler, Result } from './ErrorHandler';

export class TaskManager {
	private static instance: TaskManager;
	private taskRepository: TaskRepository;
	private categoryManager: CategoryManager;
	private dependencyManager: TaskDependencyManager;
	private calculator: TaskCalculator;
	private errorHandler: ErrorHandler;

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

	private constructor(injectedCategoryManager?: CategoryManager) {
		this.taskRepository = new TaskRepository();
		this.categoryManager = injectedCategoryManager ?? categoryManager;
		this.dependencyManager = new TaskDependencyManager(this.taskRepository);
		this.calculator = new TaskCalculator(this.taskRepository, this.dependencyManager);
		this.errorHandler = new ErrorHandler();
	}

	static getInstance(): TaskManager {
		if (!TaskManager.instance) {
			TaskManager.instance = new TaskManager();
		}
		return TaskManager.instance;
	}

	async listTasks(): Promise<ITaskJSON[]> {
		return await this.taskRepository.getAllTasks();
	}

	getCategories(): ICategoryJSON[] {
		return this.categoryManager.listCategories();
	}

	async addTask(
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
		childrenTaskIds: string[] = [],
		parentTaskIds: string[] = []
	): Promise<ITaskJSON> {
		const deadline = new Date(deadlineISO);
		const startDate = new Date(startDateISO);
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
			childrenTaskIds,
			parentTaskIds
		);
		// add task to repository (supports sync or async implementations)
		await Promise.resolve(this.taskRepository.addTask(task));

		// Wire up declared parent/child relationships.
		// Use Promise.all so we attempt all links, but don't fail the whole operation
		// if one link cannot be created. Individual failures are ignored here
		// because the task itself was already created; callers can validate
		// relationships separately if needed.
		const parentPromises = parentTaskIds.map((parentId) =>
			this.dependencyManager.addParent(parentId, id).catch(() => null)
		);
		const childPromises = childrenTaskIds.map((childId) =>
			this.dependencyManager.addParent(id, childId).catch(() => null)
		);

		await Promise.all([...parentPromises, ...childPromises]);

		return task.toJSON();
	}

	async removeTask(id: string): Promise<boolean> {
		// Fetch the task so we can remove its relationships first
		const task = await this.taskRepository.getTaskById(id);
		if (!task) return false;

		// Attempt to remove parent links (parent -> this)
		const parentPromises = (task.parentTaskIds || []).map((parentId) =>
			this.dependencyManager.removeParent(parentId, id).catch(() => null)
		);

		// Attempt to remove child links (this -> child)
		const childPromises = (task.childrenTaskIds || []).map((childId) =>
			this.dependencyManager.removeParent(id, childId).catch(() => null)
		);

		// Wait for all unlink operations to complete (ignore individual failures)
		await Promise.all([...parentPromises, ...childPromises]);

		// Finally remove the task from repository
		return await this.taskRepository.removeTask(id);
	}

	async toggleComplete(id: string): Promise<ITaskJSON | null> {
		const t = await this.taskRepository.getTaskById(id);
		if (!t) return null;
		t.completed = !t.completed;
		this.taskRepository.updateTask(id, t);
		return t.toJSON();
	}

	async getTask(id: string): Promise<ITaskJSON | null> {
		return await this.taskRepository.getTaskByIdJSON(id);
	}

	async updateTask(id: string, updates: Partial<ITaskJSON>): Promise<ITaskJSON | null> {
		const task = await this.taskRepository.getTaskById(id);
		if (!task) return null;

		const handlers: Record<string, (value: any) => void> = {
			title: (v) => (task.title = String(v)),
			description: (v) => (task.description = String(v)),
			deadline: (v) => (task.deadline = v instanceof Date ? v : new Date(String(v))),
			startDate: (v) => (task.startDate = v instanceof Date ? v : new Date(String(v))),
			completed: (v) => (task.completed = Boolean(v)),
			categoryId: (v) => (task.categoryId = v === null ? null : Number(v)),
			priority: (v) => (task.priority = Number(v)),
			estimateDurationHour: (v) => (task.estimateDurationHour = Number(v)),
			isRoot: (v) => (task.isRoot = Boolean(v)),
			tags: (v) => {
				if (Array.isArray(v)) task.tags = v as Tag[];
			},
			childrenTaskIds: (v) => {
				if (Array.isArray(v)) task.childrenTaskIds = v as string[];
			},
			parentTaskIds: (v) => {
				if (Array.isArray(v)) task.parentTaskIds = v as string[];
			},
		};

		for (const key of Object.keys(updates)) {
			const value = (updates as any)[key];
			const handler = handlers[key];
			if (handler) {
				handler(value);
			} else {
				// optional: log unexpected keys
				// console.warn(`updateTask: unknown field '${key}'`);
			}
		}

		this.taskRepository.updateTask(id, task);
		return task.toJSON();
	}

	async addParent(parentTaskId: string, childTaskId: string): Promise<ITaskJSON | null> {
		return await this.dependencyManager.addParent(parentTaskId, childTaskId);
	}

	async removeParent(parentTaskId: string, childTaskId: string): Promise<ITaskJSON | null> {
		return await this.dependencyManager.removeParent(parentTaskId, childTaskId);
	}

	async getParentTasks(taskId: string): Promise<ITaskJSON[]> {
		return await this.dependencyManager.getParentTasks(taskId);
	}

	async getSubTasks(parentTaskId: string): Promise<ITaskJSON[]> {
		return await this.dependencyManager.getSubTasks(parentTaskId);
	}

	async getRootTasks(): Promise<ITaskJSON[]> {
		return await this.dependencyManager.getRootTasks();
	}

	async getRootTasksForTask(taskId: string): Promise<ITaskJSON[]> {
		return await this.dependencyManager.getRootTasksForTask(taskId);
	}

	async getAllDescendants(taskId: string): Promise<ITaskJSON[]> {
		return await this.dependencyManager.getAllDescendants(taskId);
	}

	async getEarliestDeadline(taskIds: string[]): Promise<Date | null> {
		return await this.calculator.getEarliestDeadline(taskIds);
	}

	async getLatestStartDate(taskIds: string[]): Promise<Date | null> {
		return await this.calculator.getLatestStartDate(taskIds);
	}

	async getGroupTimespan(
		taskIds: string[]
	): Promise<{ earliestDeadline: Date | null; latestStartDate: Date | null; taskCount: number }> {
		return await this.calculator.getGroupTimespan(taskIds);
	}

	async getTotalEstimatedDuration(taskIds: string[]): Promise<number> {
		return await this.calculator.getTotalEstimatedDuration(taskIds);
	}

	async getAveragePriority(taskIds: string[]): Promise<number> {
		return await this.calculator.getAveragePriority(taskIds);
	}

	async getCompletionRate(taskIds: string[]): Promise<number> {
		return await this.calculator.getCompletionRate(taskIds);
	}

	/**
	 * Refresh task states for all tasks (recalculate state based on current date and deadline)
	 * Useful to call before scheduling calculations to ensure accurate state
	 */
	async refreshTaskStates(): Promise<void> {
		const allTasks = await this.listTasks();
		const now = new Date();

		for (const taskJSON of allTasks) {
			const task = await this.taskRepository.getTaskById(taskJSON.id);
			if (!task) continue;

			// Recalculate state based on current status
			if (task.completed) {
				// State stays 'Completed'
			} else if (task.deadline.getTime() < now.getTime()) {
				// Mark as overdue if deadline passed
				task.toJSON(); // state will be 'Overdue'
			} else {
				// In Progress
			}

			// Task states are computed via toJSON(), no need to update DB
		}
	}

	async getProjectTimespan(anyTaskId: string): Promise<
		Result<{
			earliestDeadline: Date | null;
			latestStartDate: Date | null;
			taskCount: number;
			rootTaskIds: string[];
		}>
	> {
		await this.refreshTaskStates();
		return this.wrapProjectCalc(() => this.calculator.getProjectTimespan(anyTaskId));
	}

	async getProjectTotalEstimatedDuration(anyTaskId: string): Promise<Result<number>> {
		await this.refreshTaskStates();
		return this.wrapProjectCalc(() =>
			this.calculator.getProjectTotalEstimatedDuration(anyTaskId)
		);
	}

	async getProjectAveragePriority(anyTaskId: string): Promise<Result<number>> {
		await this.refreshTaskStates();
		return this.wrapProjectCalc(() => this.calculator.getProjectAveragePriority(anyTaskId));
	}

	async getProjectCompletionRate(anyTaskId: string): Promise<Result<number>> {
		await this.refreshTaskStates();
		return this.wrapProjectCalc(() => this.calculator.getProjectCompletionRate(anyTaskId));
	}

	/**
	 * Get the critical path for a project (chain of tasks with zero slack)
	 * Automatically refreshes task states before calculation
	 */
	async getProjectCriticalPath(anyTaskId: string): Promise<Result<string[]>> {
		await this.refreshTaskStates();
		return this.wrapProjectCalc(() => this.calculator.getProjectCriticalPath(anyTaskId));
	}
}

export const taskManager = TaskManager.getInstance();
