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

	/**
	 * Set a task's completeness value (0..100).
	 * Only allowed for leaf tasks (no children).
	 */
	async setTaskCompleteness(id: number, completeness: number): Promise<ITaskJSON | null> {
		if (completeness < 0 || completeness > 100)
			throw new Error('Completeness must be between 0 and 100');

		const task = await this.taskRepository.findById(id);
		if (!task) return null;

		const children = task.childrenTasks || [];
		if (children.length > 0) {
			throw new Error('Can only set completeness on leaf tasks (tasks without children)');
		}

		const updated = await this.taskRepository.setCompleteness(id, completeness);
		// Refresh aggregated completeness for parent tasks now that a leaf changed
		await this.refreshCompleteness(id);
		return updated?.toJSON() ?? null;
	}

	/**
	 * Refresh completeness values for tasks with children by storing their urgency.
	 * Leaf tasks keep their persisted completeness value which is user-editable.
	 */
	private async refreshCompleteness(affectedTaskId?: number): Promise<void> {
		if (affectedTaskId === undefined) {
			// full refresh
			const tasks = await this.taskRepository.findAll();
			for (const t of tasks) {
				const full = await this.taskRepository.findById(t.id);
				if (!full) continue;
				const hasChildren = (full.childrenTasks || []).length > 0;
				if (hasChildren) {
					try {
						const u = await this.calculator.getTaskUrgency(full.id);
						await this.taskRepository.setCompleteness(full.id, u);
					} catch (e) {
						// ignore urgency calculation failures here (e.g., missing duration) to avoid blocking listing
					}
				}
			}
			return;
		}

		// Partial refresh: only recompute for ancestors and affected non-leaf task
		const idsToUpdate = new Set<number>();

		// include affected task if it has children (non-leaf)
		const affected = await this.taskRepository.findById(affectedTaskId);
		if (affected && (affected.childrenTasks || []).length > 0) idsToUpdate.add(affected.id);

		// include ancestors
		const ancestorIds = await this.dependencyManager.getAllAncestors(affectedTaskId);
		for (const a of ancestorIds) idsToUpdate.add(a);

		for (const id of idsToUpdate) {
			const full = await this.taskRepository.findById(id);
			if (!full) continue;
			const hasChildren = (full.childrenTasks || []).length > 0;
			if (!hasChildren) continue; // skip leaves; they are user-editable
			try {
				const u = await this.calculator.getTaskUrgency(full.id);
				await this.taskRepository.setCompleteness(full.id, u);
			} catch (e) {
				// ignore urgency calculation failures for partial refresh
			}
		}
	}

	async addTask(data: CreateTaskData): Promise<ITaskJSON> {
		const newTask = await this.taskRepository.create(data);
		// If the new task has a parent and that parent is marked Completed,
		// reopen the parent (centralized in repository) and refresh completeness.
		const full = await this.taskRepository.findById(newTask.id);
		if (full?.parentTask) {
			await this.taskRepository.reopenIfCompleted(full.parentTask.id);
			// Refresh completeness aggregates for the parent's ancestor chain
			await this.refreshCompleteness(full.parentTask.id);
		}
		return newTask.toJSON();
	}

	// Change a task from Scheduled -> In Progress
	async startTask(id: number): Promise<ITaskJSON | null> {
		const task = await this.taskRepository.findById(id);
		if (!task) return null;
		// Only start if currently scheduled
		if (task.state !== 'Scheduled') return null;

		// set actualStartDate if not already set via repository helper
		const now = new Date();
		const updatedTask = await this.taskRepository.setActualStart(id, now);
		await this.refreshCompleteness(id);
		return updatedTask?.toJSON() ?? null;
	}

	async removeTask(id: number): Promise<boolean> {
		// read parent before deleting so we can refresh ancestors
		const before = await this.taskRepository.findById(id);
		const parentId = before?.parentTask?.id ?? null;
		const ok = await this.taskRepository.delete(id);
		// Update completeness aggregates after removing a task
		if (parentId) await this.refreshCompleteness(parentId);
		return ok;
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

		const now = new Date();
		if (newCompleted) {
			// compute actual duration from available start
			const start = task.actualStartDate ?? task.startDate ?? null;
			let durHours: number | null = null;
			if (start) {
				const durMs = now.getTime() - new Date(start).getTime();
				durHours = Math.round((durMs / (1000 * 60 * 60)) * 100) / 100; // two decimals
			}
			const updatedTask = await this.taskRepository.setCompletion(id, true, 'Completed', now, durHours);
			await this.refreshCompleteness(id);
			return updatedTask?.toJSON() ?? null;
		} else {
			const updatedTask = await this.taskRepository.setCompletion(id, false, newState, null, null);
			await this.refreshCompleteness(id);
			return updatedTask?.toJSON() ?? null;
		}
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

		// capture previous parent to refresh its ancestors as well
		const before = await this.taskRepository.findById(id);
		const beforeParentId = before?.parentTask?.id ?? null;
		const updatedTask = await this.taskRepository.update(id, data);
		// Refresh completeness aggregates after updating a task (parent, duration, etc.)
		if (beforeParentId) await this.refreshCompleteness(beforeParentId);
		await this.refreshCompleteness(id);
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
				await this.taskRepository.setCompletion(task.id, false, 'Overdue');
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
