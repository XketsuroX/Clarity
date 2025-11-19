import { DeepPartial, Repository } from 'typeorm';
import { AppDataSource } from './Database';
import { Task } from './Task';

export interface CreateTaskData {
	title: string;
	description?: string;
	deadline?: Date;
	startDate?: Date;
	categoryId?: number;
	tagIds?: number[];
	priority?: number;
	estimateDurationHour?: number;
	parentTaskId?: number;
}

export interface UpdateTaskData {
	title?: string;
	description?: string;
	deadline?: Date | null;
	startDate?: Date | null;
	completed?: boolean;
	categoryId?: number | null;
	tagIds?: number[];
	priority?: number;
	estimateDurationHour?: number | null;
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
			relations: ['category', 'tags'],
			order: { title: 'ASC' },
		});
	}

	/**
	 * Get a single task by ID
	 */
	async findById(id: number): Promise<Task | null> {
		return this.ormRepository.findOne({
			where: { id },
			relations: ['category', 'tags', 'parentTask', 'childrenTasks'],
		});
	}

	/**
	 * Add a new task
	 */
	async create(data: CreateTaskData): Promise<Task> {
		const { categoryId, tagIds, parentTaskId, ...taskData } = data;
		const taskToCreate: DeepPartial<Task> = { ...taskData };

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
		const { categoryId, tagIds, parentTaskId, ...taskUpdates } = data;

		const taskToUpdate = await this.findById(id);
		if (!taskToUpdate) {
			return null;
		}

		const payload: DeepPartial<Task> = { ...taskUpdates };

		if (categoryId !== undefined) {
			payload.category = categoryId === null ? null : { id: categoryId };
		}

		if (parentTaskId !== undefined) {
			payload.parentTask = parentTaskId === null ? null : { id: parentTaskId };
		}

		if (tagIds !== undefined) {
			payload.tags = tagIds.map((tagId) => ({ id: tagId }));
		}

		this.ormRepository.merge(taskToUpdate, payload);
		return this.ormRepository.save(taskToUpdate);
	}

	/**
	 * Remove a task by ID
	 */
	async delete(id: number): Promise<boolean> {
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

	/**
	 * Delete all tasks
	 */
	async deleteAll(): Promise<void> {
		await this.ormRepository.clear();
	}

	async findDescendants(task: Task): Promise<Task[]> {
		return this.ormRepository.manager.getTreeRepository(Task).findDescendants(task);
	}
}
