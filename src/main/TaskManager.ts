import { Task, ITaskJSON } from './Task';
import { Tag } from './Tag';
import { ICategoryJSON } from './Category';
import { CategoryManager, categoryManager } from './CategoryManager';
import { TaskRepository } from './TaskRepository';
import { TaskDependencyManager } from './TaskDependencyManager';
import { TaskCalculator } from './TaskCalculator';

export class TaskManager {
	private static instance: TaskManager;
	private taskRepository: TaskRepository;
	private categoryManager: CategoryManager;
	private dependencyManager: TaskDependencyManager;
	private calculator: TaskCalculator;

	private constructor(injectedCategoryManager?: CategoryManager) {
		this.taskRepository = new TaskRepository();
		this.categoryManager = injectedCategoryManager ?? categoryManager;
		this.dependencyManager = new TaskDependencyManager(this.taskRepository);
		this.calculator = new TaskCalculator(this.taskRepository);
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
		childrenTaskIds: string[] = [],
		parentTaskIds: string[] = []
	): ITaskJSON {
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
		this.taskRepository.addTask(task);
		return task.toJSON();
	}

	async removeTask(id: string): Promise<boolean> {
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
		if (updates.title) task.title = updates.title;
		if (updates.description) task.description = updates.description;
		if (updates.deadline) task.deadline = new Date(updates.deadline);
		if (updates.startDate) task.startDate = new Date(updates.startDate);
		if (updates.completed !== undefined) task.completed = updates.completed;
		if (updates.categoryId !== undefined) task.categoryId = updates.categoryId;
		if (updates.priority !== undefined) task.priority = updates.priority;
		if (updates.estimateDurationHour !== undefined)
			task.estimateDurationHour = updates.estimateDurationHour;
		if (updates.isRoot !== undefined) task.isRoot = updates.isRoot;
		if (updates.tags) task.tags = updates.tags;
		if (updates.childrenTaskIds) task.childrenTaskIds = updates.childrenTaskIds;
		if (updates.parentTaskIds) task.parentTaskIds = updates.parentTaskIds;
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

	/**
	 * Get scheduling information for a task (earliest start, latest finish, slack, criticality)
	 * Automatically refreshes task states before calculation
	 */
	async getTaskSchedule(taskId: string): ReturnType<TaskCalculator['getTaskSchedule']> {
		await this.refreshTaskStates();
		return this.calculator.getTaskSchedule(taskId);
	}

	/**
	 * Get the critical path for a project (chain of tasks with zero slack)
	 * Automatically refreshes task states before calculation
	 */
	async getProjectCriticalPath(rootTaskIds: string[]): Promise<string[]> {
		await this.refreshTaskStates();
		return this.calculator.getCriticalPath(rootTaskIds);
	}

	/**
	 * Get earliest start time for a task
	 * Automatically refreshes task states before calculation
	 */
	async getTaskEarliestStart(taskId: string): Promise<Date | null> {
		await this.refreshTaskStates();
		return this.calculator.calculateEarliestStartTime(taskId);
	}

	/**
	 * Get latest finish time for a task
	 * Automatically refreshes task states before calculation
	 */
	async getTaskLatestFinish(taskId: string): Promise<Date | null> {
		await this.refreshTaskStates();
		return this.calculator.calculateLatestFinishTime(taskId);
	}
}

export const taskManager = TaskManager.getInstance();
