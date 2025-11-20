import { Repository, In } from 'typeorm';
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

			// Bulk fetch parents and children to avoid N+1 queries
			if (parentIds.length > 0) {
				const parents = await repo.find({ where: { id: In(parentIds) } });
				// detect missing parents
				const foundParentIds = new Set(parents.map((p) => p.id));
				const missingParents = parentIds.filter((id) => !foundParentIds.has(id));
				if (missingParents.length > 0) throw new Error(`PARENT_NOT_FOUND:${missingParents.join(',')}`);

				// update parents' children lists in-memory
				for (const parent of parents) {
					if (!parent.childrenTaskIds) parent.childrenTaskIds = [];
					if (!parent.childrenTaskIds.includes(saved.id)) {
						parent.childrenTaskIds = Array.from(new Set([...parent.childrenTaskIds, saved.id]));
					}
				}

				// persist parents in bulk
				await repo.save(parents);

				// update saved.parentTaskIds and mark not root
				saved.parentTaskIds = Array.from(new Set([...(saved.parentTaskIds || []), ...parentIds]));
				saved.isRoot = false;
				await repo.save(saved);
			}

			if (childIds.length > 0) {
				const children = await repo.find({ where: { id: In(childIds) } });
				// detect missing children
				const foundChildIds = new Set(children.map((c) => c.id));
				const missingChildren = childIds.filter((id) => !foundChildIds.has(id));
				if (missingChildren.length > 0) throw new Error(`CHILD_NOT_FOUND:${missingChildren.join(',')}`);

				// update children parent lists in-memory
				for (const child of children) {
					if (!child.parentTaskIds) child.parentTaskIds = [];
					if (!child.parentTaskIds.includes(saved.id)) {
						child.parentTaskIds = Array.from(new Set([...child.parentTaskIds, saved.id]));
						child.isRoot = false;
					}
				}

				// persist children in bulk
				await repo.save(children);
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

			// Bulk update parents and children to remove this id from their lists
			const parentIds = task.parentTaskIds || [];
			if (parentIds.length > 0) {
				const parents = await repo.find({ where: { id: In(parentIds) } });
				for (const parent of parents) {
					parent.childrenTaskIds = (parent.childrenTaskIds || []).filter((c) => c !== id);
				}
				await repo.save(parents);
			}

			const childIds = task.childrenTaskIds || [];
			if (childIds.length > 0) {
				const children = await repo.find({ where: { id: In(childIds) } });
				for (const child of children) {
					child.parentTaskIds = (child.parentTaskIds || []).filter((p) => p !== id);
					if ((child.parentTaskIds || []).length === 0) child.isRoot = true;
				}
				await repo.save(children);
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

			if (!(parent.childrenTaskIds || []).includes(childId)) {
				parent.childrenTaskIds = Array.from(new Set([...(parent.childrenTaskIds || []), childId]));
				await repo.save(parent);
			}

			if (!(child.parentTaskIds || []).includes(parentId)) {
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
