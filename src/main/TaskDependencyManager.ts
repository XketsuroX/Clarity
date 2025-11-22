import { ITaskJSON, Task } from './Task';
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
	 * Detect if adding a parent-child relationship would create a cycle
	 * @param childTaskId - potential child (downstream)
	 * @param potentialParentId - potential parent (upstream)
	 * @returns true if a cycle would be created
	 */
	async wouldCreateCycle(childTaskId: number, potentialParentId: number): Promise<boolean> {
		if (childTaskId === potentialParentId) return true;

		let currentId: number | null = potentialParentId;

		while (currentId !== null) {
			if (currentId === childTaskId) return true;
			const currentTask = await this.taskRepository.findById(currentId);
			if (!currentTask || !currentTask.parentTask) break;
			currentId = currentTask.parentTask.id;
		}

		return false;
	}

	/**
	 * Get all root tasks (tasks with no parents) in the entire system
	 */
	async getRootTasks(): Promise<ITaskJSON[]> {
		const allTasks = await this.taskRepository.findAll();
		return allTasks.filter((t) => t.parentTask === null).map((t) => t.toJSON());
	}

	/**
	 * Get all root tasks that can reach the given task by traversing up through parents
	 * Returns all root ancestor nodes
	 */
	async getProjectRoot(taskId: number): Promise<Task | null> {
		let currentTask = await this.taskRepository.findById(taskId);
		if (!currentTask) return null;

		while (currentTask.parentTask) {
			const parent = await this.taskRepository.findById(currentTask.parentTask.id);
			if (!parent) break;
			currentTask = parent;
		}

		return currentTask;
	}

	/**
	 * Get all descendants (children and their children recursively) of a task
	 */
	async getAllDescendants(taskId: number): Promise<ITaskJSON[]> {
		const parent = await this.taskRepository.findById(taskId);
		if (!parent) return [];

		return (await this.taskRepository.findDescendants(parent)).map((t) => t.toJSON());
	}

	/**
	 * Collect all task IDs that belong to the project containing `anyTaskId`.
	 * Returns both the deduplicated list of task IDs and the root ancestor IDs.
	 */
	async collectProjectTaskIds(anyTaskId: number): Promise<number[] | null> {
		const root = await this.getProjectRoot(anyTaskId);
		if (!root) return null;

		const descendants = await this.getAllDescendants(root.id);

		const allTasks = [root, ...descendants];

		return allTasks.map((task) => task.id);
	}
}
