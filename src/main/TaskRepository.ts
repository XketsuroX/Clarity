import { DeepPartial, Repository } from 'typeorm';
import { AppDataSource } from './Database';
import { Task } from './Task';
import { Category } from './Category';
import { Tag } from './Tag';

export interface CreateTaskData {
	title: string;
	description?: string;
	deadline?: Date;
	startDate?: Date;
	state?: string;
	categoryId?: number;
	tagIds?: number[];
	priority?: number;
	estimateDurationHour?: number;
	actualStartDate?: Date | null;
	actualEndDate?: Date | null;
	actualDurationHour?: number | null;
	completeness?: number;
	parentTaskId?: number | null;
}

export interface UpdateTaskData {
	title?: string;
	description?: string;
	deadline?: Date | null;
	startDate?: Date | null;
	state?: string;
	completed?: boolean;
	categoryId?: number | null;
	tagIds?: number[];
	priority?: number;
	estimateDurationHour?: number;
	actualStartDate?: Date | null;
	actualEndDate?: Date | null;
	actualDurationHour?: number | null;
	completeness?: number;
	parentTaskId?: number | null;
}

/**
 * TaskRepository handles all task storage and retrieval operations.
 * This is a simple in-memory repository. Can be replaced with FS/DB logic later.
 */
export class TaskRepository {
	private ormRepository: Repository<Task>;

	constructor() {
		this.ormRepository = AppDataSource.getRepository(Task);
	}

	/**
	 * Get all tasks
	 */
	async findAll(): Promise<Task[]> {
		return this.ormRepository.find({
			relations: ['category', 'tags', 'parentTask'],
			order: { title: 'ASC' },
		});
	}

	/**
	 * Get a single task by ID
	 */
	async findById(id: number): Promise<Task | null> {
		// istanbul ignore next
		return this.ormRepository.findOne({
			// istanbul ignore next
			where: { id },
			// istanbul ignore next
			relations: ['category', 'tags', 'parentTask', 'childrenTasks'],
		});
	}

	/**
	 * Add a new task
	 */
	async create(data: CreateTaskData): Promise<Task> {
		const { categoryId, tagIds, parentTaskId, state, ...taskData } = data;
		const taskToCreate: DeepPartial<Task> = { ...taskData };

		if (state && !this.validateState(state)) {
			throw new Error('Invalid task state');
		}

		if (categoryId) {
			taskToCreate.category = { id: categoryId };
		}

		if (parentTaskId) {
			taskToCreate.parentTask = { id: parentTaskId };
		}

		if (tagIds && tagIds.length > 0) {
			taskToCreate.tags = tagIds.map((id) => ({ id }));
		}

		const task = this.ormRepository.create(taskToCreate);
		return this.ormRepository.save(task);
	}

	/**
	 * Update an existing task
	 */
	async update(id: number, data: UpdateTaskData): Promise<Task | null> {
		const { categoryId, tagIds, parentTaskId, state, ...taskUpdates } = data;

		const taskToUpdate = await this.findById(id);
		if (!taskToUpdate) {
			return null;
		}

		if (state && !this.validateState(state)) {
			throw new Error('Invalid task state');
		}

		const payload: DeepPartial<Task> = { ...taskUpdates };

		if (categoryId !== undefined) {
			taskToUpdate.category =
				categoryId === null ? null : ({ id: categoryId } as unknown as Category);
		}

		if (parentTaskId !== undefined) {
			payload.parentTask = parentTaskId === null ? null : { id: parentTaskId };
		}

		if (tagIds !== undefined) {
			taskToUpdate.tags = tagIds.map((tagId) => ({ id: tagId })) as unknown as Tag[];
		}

		this.ormRepository.merge(taskToUpdate, payload);
		return this.ormRepository.save(taskToUpdate);
	}

	/**
	 * Remove a task by ID
	 * If the task has children, they will be reassigned to the task's parent (moving up one level)
	 */
	async delete(id: number): Promise<boolean> {
		const task = await this.findById(id);
		if (!task) return false;

		// Get the parent ID before deletion (null if root task)
		const newParentId = task.parentTask?.id ?? null;

		// Reassign all children to the deleted task's parent
		if (task.childrenTasks && task.childrenTasks.length > 0) {
			for (const child of task.childrenTasks) {
				await this.update(child.id, { parentTaskId: newParentId });
			}
		}

		// Now delete the task
		const result = await this.ormRepository.delete(id);
		return !!result.affected;
	}

	/**
	 * Check if a task exists
	 */
	async exists(id: number): Promise<boolean> {
		return this.ormRepository.existsBy({ id });
	}

	/**
	 * Get count of all tasks
	 */
	async count(): Promise<number> {
		return this.ormRepository.count();
	}

	async getState(id: number): Promise<string | null> {
		const task = await this.findById(id);
		return task ? task.state : null;
	}

	/**
	 * Delete all tasks
	 */
	async deleteAll(): Promise<void> {
		await this.ormRepository.clear();
	}

	async findDescendants(task: Task): Promise<Task[]> {
		return this.ormRepository.manager.getTreeRepository(Task).findDescendants(task);
	}

	/**
	 * Return the ancestors (parent, grandparent, ...) for a task (includes the task itself)
	 */
	async findAncestors(task: Task): Promise<Task[]> {
		return this.ormRepository.manager.getTreeRepository(Task).findAncestors(task);
	}

	/**
	 * Set actual start date and mark In Progress (only sets actualStartDate if not already set)
	 */
	async setActualStart(id: number, date: Date): Promise<Task | null> {
		const task = await this.findById(id);
		if (!task) return null;
		const payload: DeepPartial<Task> = { state: 'In Progress' };
		if (!task.actualStartDate) payload.actualStartDate = date;
		this.ormRepository.merge(task, payload);
		return this.ormRepository.save(task);
	}

	/**
	 * Set completion state and optionally actual end/date/duration
	 */
	async setCompletion(
		id: number,
		completed: boolean,
		state: string,
		actualEndDate?: Date | null,
		actualDurationHour?: number | null
	): Promise<Task | null> {
		const task = await this.findById(id);
		if (!task) return null;
		const payload: DeepPartial<Task> = { completed, state };
		// When marking completed, persist completeness as 100
		if (completed) payload.completeness = 100;
		if (actualEndDate !== undefined) payload.actualEndDate = actualEndDate;
		if (actualDurationHour !== undefined) payload.actualDurationHour = actualDurationHour;
		this.ormRepository.merge(task, payload);
		return this.ormRepository.save(task);
	}

	/**
	 * Persist completeness value for a task
	 */
	async setCompleteness(id: number, completeness: number): Promise<Task | null> {
		const task = await this.findById(id);
		if (!task) return null;
		this.ormRepository.merge(task, { completeness });
		return this.ormRepository.save(task);
	}

	/**
	 * If a task is completed, mark it In Progress and not completed.
	 * Returns updated task or null.
	 */
	async reopenIfCompleted(id: number): Promise<Task | null> {
		const task = await this.findById(id);
		if (!task) return null;
		if (!task.completed) return task;
		this.ormRepository.merge(task, { completed: false, state: 'In Progress' });
		return this.ormRepository.save(task);
	}

	async getPendingTasks(): Promise<Task[]> {
		const allTasks = await this.findAll();
		return allTasks.filter((task) => !task.completed);
	}

	private validateState(state: string): boolean {
		return ['Scheduled', 'In Progress', 'Completed', 'Overdue'].includes(state);
	}
}
