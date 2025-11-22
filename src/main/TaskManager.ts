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

	async removeTask(id: number): Promise<boolean> {
		return await this.taskRepository.delete(id);
	}

	async toggleComplete(id: number): Promise<ITaskJSON | null> {
		const task = await this.taskRepository.findById(id);
		if (!task) return null;
		const updatedTask = await this.taskRepository.update(id, {
			completed: !task.completed,
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

	async getEarliestDeadline(taskIds: number[]): Promise<Date | null> {
		return await this.calculator.getEarliestDeadline(taskIds);
	}

	async getLatestStartDate(taskIds: number[]): Promise<Date | null> {
		return await this.calculator.getLatestStartDate(taskIds);
	}

	async getGroupTimespan(
		taskIds: number[]
	): Promise<{ earliestDeadline: Date | null; latestStartDate: Date | null; taskCount: number }> {
		return await this.calculator.getGroupTimespan(taskIds);
	}

	async getTotalEstimatedDuration(taskIds: number[]): Promise<number> {
		return await this.calculator.getTotalEstimatedDuration(taskIds);
	}

	async getAveragePriority(taskIds: number[]): Promise<number> {
		return await this.calculator.getAveragePriority(taskIds);
	}

	async getCompletionRate(taskIds: number[]): Promise<number> {
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
			const task = await this.taskRepository.findById(taskJSON.id);
			if (!task) continue;

			// Recalculate state based on current status
			if (task.completed) {
				// State stays 'Completed'
			} else if (task.deadline && task.deadline.getTime() < now.getTime()) {
				// Mark as overdue if deadline passed
				task.toJSON(); // state will be 'Overdue'
			} else {
				// In Progress
			}

			// Task states are computed via toJSON(), no need to update DB
		}
	}

	async getProjectTimespan(anyTaskId: number): Promise<
		Result<{
			earliestDeadline: Date | null;
			latestStartDate: Date | null;
			taskCount: number;
			rootTaskIds: number[];
		}>
	> {
		await this.refreshTaskStates();
		return this.wrapProjectCalc(() => this.calculator.getProjectTimespan(anyTaskId));
	}

	async getProjectTotalEstimatedDuration(anyTaskId: number): Promise<Result<number>> {
		await this.refreshTaskStates();
		return this.wrapProjectCalc(() =>
			this.calculator.getProjectTotalEstimatedDuration(anyTaskId)
		);
	}

	async getProjectAveragePriority(anyTaskId: number): Promise<Result<number>> {
		await this.refreshTaskStates();
		return this.wrapProjectCalc(() => this.calculator.getProjectAveragePriority(anyTaskId));
	}

	async getProjectCompletionRate(anyTaskId: number): Promise<Result<number>> {
		await this.refreshTaskStates();
		return this.wrapProjectCalc(() => this.calculator.getProjectCompletionRate(anyTaskId));
	}

	/**
	 * Get the critical path for a project (chain of tasks with zero slack)
	 * Automatically refreshes task states before calculation
	 */
	async getProjectCriticalPath(anyTaskId: number): Promise<Result<number[]>> {
		await this.refreshTaskStates();
		return this.wrapProjectCalc(() => this.calculator.getProjectCriticalPath(anyTaskId));
	}
}

export const taskManager = new TaskManager();
