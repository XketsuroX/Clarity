import { Repository } from 'typeorm';
import { AppDataSource } from './Database';
import { Task, ITaskJSON } from './Task';

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
	 * Add a task and wire parent/child relations in a single transaction.
	 * Throws if any referenced parent/child does not exist.
	 */
	async addTaskWithRelations(task: Task, parentIds: string[], childIds: string[]): Promise<Task> {
		return AppDataSource.manager.transaction(async (manager) => {
			const repo = manager.getRepository(Task);
			const saved = await repo.save(task);

			// link parents -> this
			for (const pid of parentIds) {
				const parent = await repo.findOneBy({ id: pid });
				if (!parent) throw new Error(`PARENT_NOT_FOUND:${pid}`);
				if (!parent.childrenTaskIds.includes(saved.id)) {
					parent.childrenTaskIds = Array.from(new Set([...(parent.childrenTaskIds || []), saved.id]));
					await repo.save(parent);
				}
				// ensure child's parent list will include pid
			}

			// set saved.parentTaskIds if provided
			if (parentIds.length > 0) {
				saved.parentTaskIds = Array.from(new Set([...(saved.parentTaskIds || []), ...parentIds]));
				saved.isRoot = false;
				await repo.save(saved);
			}

			// link this -> children
			for (const cid of childIds) {
				const child = await repo.findOneBy({ id: cid });
				if (!child) throw new Error(`CHILD_NOT_FOUND:${cid}`);
				if (!child.parentTaskIds.includes(saved.id)) {
					child.parentTaskIds = Array.from(new Set([...(child.parentTaskIds || []), saved.id]));
					child.isRoot = false;
					await repo.save(child);
				}
			}

			return saved;
		});
	}

	/**
	 * Remove a task and clean up parent/child relations in a single transaction.
	 */
	async removeTaskWithRelations(id: string): Promise<boolean> {
		return AppDataSource.manager.transaction(async (manager) => {
			const repo = manager.getRepository(Task);
			const task = await repo.findOneBy({ id });
			if (!task) return false;

			// remove this id from parents' children arrays
			for (const pid of task.parentTaskIds || []) {
				const parent = await repo.findOneBy({ id: pid });
				if (parent) {
					parent.childrenTaskIds = (parent.childrenTaskIds || []).filter((c) => c !== id);
					await repo.save(parent);
				}
			}

			// remove this id from children's parent arrays
			for (const cid of task.childrenTaskIds || []) {
				const child = await repo.findOneBy({ id: cid });
				if (child) {
					child.parentTaskIds = (child.parentTaskIds || []).filter((p) => p !== id);
					if ((child.parentTaskIds || []).length === 0) child.isRoot = true;
					await repo.save(child);
				}
			}

			await repo.delete(id);
			return true;
		});
	}

	/**
	 * Transactionally add a parent-child relationship. Throws on missing tasks.
	 */
	async addParentRelation(parentId: string, childId: string): Promise<ITaskJSON> {
		return AppDataSource.manager.transaction(async (manager) => {
			const repo = manager.getRepository(Task);
			const parent = await repo.findOneBy({ id: parentId });
			const child = await repo.findOneBy({ id: childId });
			if (!parent) throw new Error(`PARENT_NOT_FOUND:${parentId}`);
			if (!child) throw new Error(`CHILD_NOT_FOUND:${childId}`);

			if (!parent.childrenTaskIds.includes(childId)) {
				parent.childrenTaskIds = Array.from(new Set([...(parent.childrenTaskIds || []), childId]));
				await repo.save(parent);
			}

			if (!child.parentTaskIds.includes(parentId)) {
				child.parentTaskIds = Array.from(new Set([...(child.parentTaskIds || []), parentId]));
				child.isRoot = false;
				await repo.save(child);
			}

			return parent.toJSON();
		});
	}

	/**
	 * Transactionally remove a parent-child relationship. Throws on missing tasks.
	 */
	async removeParentRelation(parentId: string, childId: string): Promise<ITaskJSON> {
		return AppDataSource.manager.transaction(async (manager) => {
			const repo = manager.getRepository(Task);
			const parent = await repo.findOneBy({ id: parentId });
			const child = await repo.findOneBy({ id: childId });
			if (!parent) throw new Error(`PARENT_NOT_FOUND:${parentId}`);
			if (!child) throw new Error(`CHILD_NOT_FOUND:${childId}`);

			parent.childrenTaskIds = (parent.childrenTaskIds || []).filter((id) => id !== childId);
			await repo.save(parent);

			child.parentTaskIds = (child.parentTaskIds || []).filter((id) => id !== parentId);
			if ((child.parentTaskIds || []).length === 0) child.isRoot = true;
			await repo.save(child);

			return parent.toJSON();
		});
	}

	/**
	 * Get all tasks as JSON
	 */
	async getAllTasks(): Promise<ITaskJSON[]> {
		const tasks = await this.ormRepository.find();
		return tasks.map((t) => t.toJSON());
	}

	/**
	 * Get a single task by ID
	 */
	async getTaskById(id: string): Promise<Task | null> {
		return this.ormRepository.findOneBy({ id });
	}

	/**
	 * Get a single task as JSON by ID
	 */
	async getTaskByIdJSON(id: string): Promise<ITaskJSON | null> {
		const task = await this.ormRepository.findOneBy({ id });
		return task ? task.toJSON() : null;
	}

	/**
	 * Add a new task
	 */
	async addTask(task: Task): Promise<Task> {
		return this.ormRepository.save(task);
	}

	/**
	 * Update an existing task
	 */
	async updateTask(id: string, taskData: Partial<Task>): Promise<boolean> {
		const result = await this.ormRepository.update(id, taskData);
		return result.affected !== 0;
	}

	/**
	 * Remove a task by ID
	 */
	async removeTask(id: string): Promise<boolean> {
		const result = await this.ormRepository.delete(id);
		return result.affected !== 0;
	}

	/**
	 * Check if a task exists
	 */
	async existsTask(id: string): Promise<boolean> {
		return this.ormRepository.existsBy({ id });
	}

	/**
	 * Get count of all tasks
	 */
	async countTasks(): Promise<number> {
		return this.ormRepository.count();
	}

	/**
	 * Clear all tasks
	 */
	async clearTasks(): Promise<void> {
		await this.ormRepository.clear();
	}
}
