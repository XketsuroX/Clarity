import { ITaskJSON } from './Task';
import { TaskRepository } from './TaskRepository';

/**
 * TaskDependencyManager handles parent-child relationships in the task DAG.
 * Responsible for: adding/removing relationships, cycle detection, traversal.
 */
export class TaskDependencyManager {
	private taskRepository: TaskRepository;

	constructor(taskRepository: TaskRepository) {
		this.taskRepository = taskRepository;
	}

	/**
	 * Add a parent-child relationship (multi-parent support)
	 * @param parentTaskId - parent task ID
	 * @param childTaskId - child task ID
	 * @returns Updated parent task or null if not found/cycle detected
	 */
	async addParent(parentTaskId: string, childTaskId: string): Promise<ITaskJSON | null> {
		const parent = await this.taskRepository.getTaskById(parentTaskId);
		const child = await this.taskRepository.getTaskById(childTaskId);
		if (!parent || !child) return null;

		// Check for cycles before adding
		if (await this.wouldCreateCycle(childTaskId, parentTaskId)) {
			console.warn(
				`Adding parent ${parentTaskId} to child ${childTaskId} would create a cycle`
			);
			return null;
		}

		// Add child to parent's children list
		if (!parent.childrenTaskIds.includes(childTaskId)) {
			parent.childrenTaskIds.push(childTaskId);
			this.taskRepository.updateTask(parentTaskId, parent);
		}

		// Add parent to child's parents list
		if (!child.parentTaskIds.includes(parentTaskId)) {
			child.parentTaskIds.push(parentTaskId);
			child.isRoot = false;
			this.taskRepository.updateTask(childTaskId, child);
		}

		return parent.toJSON();
	}

	/**
	 * Remove a parent-child relationship
	 * @param parentTaskId - parent task ID
	 * @param childTaskId - child task ID
	 * @returns Updated parent task or null if not found
	 */
	async removeParent(parentTaskId: string, childTaskId: string): Promise<ITaskJSON | null> {
		const parent = await this.taskRepository.getTaskById(parentTaskId);
		const child = await this.taskRepository.getTaskById(childTaskId);
		if (!parent || !child) return null;

		// Remove child from parent's children list
		parent.childrenTaskIds = parent.childrenTaskIds.filter((id) => id !== childTaskId);
		this.taskRepository.updateTask(parentTaskId, parent);

		// Remove parent from child's parents list
		child.parentTaskIds = child.parentTaskIds.filter((id) => id !== parentTaskId);

		// Set isRoot to true only if child has no other parents
		if (child.parentTaskIds.length === 0) {
			child.isRoot = true;
		}
		this.taskRepository.updateTask(childTaskId, child);

		return parent.toJSON();
	}

	/**
	 * Get all parent tasks of a given task
	 */
	async getParentTasks(taskId: string): Promise<ITaskJSON[]> {
		const task = await this.taskRepository.getTaskById(taskId);
		if (!task || task.parentTaskIds.length === 0) return [];

		const parentPromises = task.parentTaskIds.map((id) =>
			this.taskRepository.getTaskByIdJSON(id)
		);
		const parents = await Promise.all(parentPromises);
		return parents.filter((p) => p !== null) as ITaskJSON[];
	}

	/**
	 * Get all child tasks of a parent task
	 */
	async getSubTasks(parentTaskId: string): Promise<ITaskJSON[]> {
		const parent = await this.taskRepository.getTaskById(parentTaskId);
		if (!parent) return [];

		const subTaskPromises = parent.childrenTaskIds.map((id) =>
			this.taskRepository.getTaskByIdJSON(id)
		);
		const resolvedSubTasks = await Promise.all(subTaskPromises);
		return resolvedSubTasks.filter((t) => t !== null) as ITaskJSON[];
	}

	/**
	 * Detect if adding a parent-child relationship would create a cycle
	 * @param childTaskId - potential child (downstream)
	 * @param potentialParentId - potential parent (upstream)
	 * @returns true if a cycle would be created
	 */
	async wouldCreateCycle(childTaskId: string, potentialParentId: string): Promise<boolean> {
		const visited = new Set<string>();

		const traverse = async (currentId: string): Promise<boolean> => {
			if (visited.has(currentId)) return false; // Already visited in this path
			if (currentId === childTaskId) return true; // Cycle detected!
			visited.add(currentId);

			const task = await this.taskRepository.getTaskById(currentId);
			if (!task) return false;

			// Check all parents of current task
			for (const parentId of task.parentTaskIds) {
				if (await traverse(parentId)) return true;
			}
			return false;
		};

		// Traverse from potentialParentId upwards through its parents
		return traverse(potentialParentId);
	}

	/**
	 * Get all root tasks (tasks with no parents) in the entire system
	 */
	async getRootTasks(): Promise<ITaskJSON[]> {
		const allTasks = await this.taskRepository.getAllTasks();
		return allTasks.filter((t) => t.isRoot || t.parentTaskIds.length === 0);
	}

	/**
	 * Get all root tasks that can reach the given task by traversing up through parents
	 * Returns all root ancestor nodes
	 */
	async getRootTasksForTask(taskId: string): Promise<ITaskJSON[]> {
		const visited = new Set<string>();
		const roots: ITaskJSON[] = [];

		const traverse = async (currentId: string): Promise<void> => {
			if (visited.has(currentId)) return; // Prevent revisiting
			visited.add(currentId);

			const task = await this.taskRepository.getTaskById(currentId);
			if (!task) return;

			if (task.parentTaskIds.length === 0) {
				// This is a root
				roots.push(task.toJSON());
			} else {
				// Traverse up to all parents
				for (const parentId of task.parentTaskIds) {
					await traverse(parentId);
				}
			}
		};

		await traverse(taskId);
		return roots;
	}

	/**
	 * Get all descendants (children and their children recursively) of a task
	 */
	async getAllDescendants(taskId: string): Promise<ITaskJSON[]> {
		const visited = new Set<string>();
		const descendants: ITaskJSON[] = [];

		const traverse = async (currentId: string): Promise<void> => {
			if (visited.has(currentId)) return; // Prevent cycles
			visited.add(currentId);

			const task = await this.taskRepository.getTaskById(currentId);
			if (!task) return;

			for (const childId of task.childrenTaskIds) {
				const child = await this.taskRepository.getTaskByIdJSON(childId);
				if (child) {
					descendants.push(child);
					await traverse(childId);
				}
			}
		};

		await traverse(taskId);
		return descendants;
	}

	/**
	 * Collect all task IDs that belong to the project containing `anyTaskId`.
	 * Returns both the deduplicated list of task IDs and the root ancestor IDs.
	 */
	async collectProjectTaskIds(
		anyTaskId: string
	): Promise<{ allTaskIds: string[]; rootIds: string[] } | null> {
		const task = await this.taskRepository.getTaskById(anyTaskId);
		if (!task) return null;

		const rootTasks = await this.getRootTasksForTask(anyTaskId);
		const rootIds = rootTasks.length > 0 ? rootTasks.map((r) => r.id) : [anyTaskId];

		const allTaskIdSet = new Set<string>();
		for (const rootId of rootIds) {
			allTaskIdSet.add(rootId);
			const descendantsJSON = await this.getAllDescendants(rootId);
			for (const desc of descendantsJSON) allTaskIdSet.add(desc.id);
		}

		return { allTaskIds: Array.from(allTaskIdSet), rootIds };
	}
}
