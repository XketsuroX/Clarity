import { Task } from './Task';
import { TaskRepository } from './TaskRepository';
import { TaskDependencyManager } from './TaskDependencyManager';

/**
 * TaskCalculator handles time-based calculations and scheduling metrics.
 * Responsible for: deadline analysis, date range calculations, project timing.
 */
export class TaskCalculator {
	private taskRepository: TaskRepository;
	private dependencyManager: TaskDependencyManager;

	// Error type thrown when scheduling cannot proceed
	static SchedulingError = class SchedulingError extends Error {
		code: string;
		details?: any;
		constructor(code: string, message: string, details?: any) {
			super(message);
			this.code = code;
			this.details = details;
			Object.setPrototypeOf(this, TaskCalculator.SchedulingError.prototype);
		}
	};

	constructor(taskRepository: TaskRepository, dependencyManager?: TaskDependencyManager) {
		this.taskRepository = taskRepository;
		this.dependencyManager = dependencyManager!;
	}

	/**
	 * Get the earliest deadline from a list of task IDs
	 * @param taskIds - list of task IDs
	 * @returns earliest deadline Date or null if no tasks found
	 */
	async getEarliestDeadline(taskIds: string[]): Promise<Date | null> {
		const tasks = await Promise.all(taskIds.map((id) => this.taskRepository.getTaskById(id)));
		const validTasks = tasks.filter((t) => t !== null) as Task[];

		if (validTasks.length === 0) return null;

		const earliest = validTasks.reduce((earliest: Date, task) => {
			return task.deadline.getTime() < earliest.getTime() ? task.deadline : earliest;
		}, validTasks[0].deadline);

		return earliest;
	}

	/**
	 * Get the latest start date from a list of task IDs
	 * @param taskIds - list of task IDs
	 * @returns latest start date Date or null if no tasks found
	 */
	async getLatestStartDate(taskIds: string[]): Promise<Date | null> {
		const tasks = await Promise.all(taskIds.map((id) => this.taskRepository.getTaskById(id)));
		const validTasks = tasks.filter((t) => t !== null) as Task[];

		if (validTasks.length === 0) return null;

		const latest = validTasks.reduce((latest: Date, task) => {
			return task.startDate.getTime() > latest.getTime() ? task.startDate : latest;
		}, validTasks[0].startDate);

		return latest;
	}

	/**
	 * Get deadline info for a task group: earliest deadline and latest start date
	 * Useful for understanding temporal bounds of a project/group
	 */
	async getGroupTimespan(taskIds: string[]): Promise<{
		earliestDeadline: Date | null;
		latestStartDate: Date | null;
		taskCount: number;
	}> {
		const earliestDeadline = await this.getEarliestDeadline(taskIds);
		const latestStartDate = await this.getLatestStartDate(taskIds);

		return {
			earliestDeadline,
			latestStartDate,
			taskCount: taskIds.length,
		};
	}

	/**
	 * Get deadline info for a project given any task in the project.
	 * This finds the root ancestor(s) using `getRootTasksForTask`, then
	 * aggregates each root and its descendants to compute the project's timespan.
	 * @param anyTaskId - any task ID within the project (will locate root(s) automatically)
	 * @returns timespan info for the entire project (covers all roots found)
	 */
	async getProjectTimespan(anyTaskId: string): Promise<{
		earliestDeadline: Date | null;
		latestStartDate: Date | null;
		taskCount: number;
		rootTaskIds: string[];
	} | null> {
		const project = await this.dependencyManager.collectProjectTaskIds(anyTaskId);
		if (!project) return null;

		const timespan = await this.getGroupTimespan(project.allTaskIds);

		return {
			...timespan,
			rootTaskIds: project.rootIds,
		};
	}

	/**
	 * Project-level wrappers that accept any task within a project and
	 * compute group metrics for the entire project (root(s) + descendants).
	 */
	async getProjectTotalEstimatedDuration(anyTaskId: string): Promise<number | null> {
		const project = await this.dependencyManager.collectProjectTaskIds(anyTaskId);
		if (!project) return null;
		return this.getTotalEstimatedDuration(project.allTaskIds);
	}

	async getProjectAveragePriority(anyTaskId: string): Promise<number | null> {
		const project = await this.dependencyManager.collectProjectTaskIds(anyTaskId);
		if (!project) return null;
		return this.getAveragePriority(project.allTaskIds);
	}

	async getProjectCompletionRate(anyTaskId: string): Promise<number | null> {
		const project = await this.dependencyManager.collectProjectTaskIds(anyTaskId);
		if (!project) return null;
		return this.getCompletionRate(project.allTaskIds);
	}

	async getProjectCriticalPath(anyTaskId: string): Promise<string[] | null> {
		const project = await this.dependencyManager.collectProjectTaskIds(anyTaskId);
		if (!project) return null;
		// Compute schedules for the whole project in one pass
		const schedules = await this.calculateProjectSchedules(project.allTaskIds);
		if (!schedules) return null;

		const criticalTasks: string[] = [];
		const visited = new Set<string>();

		const traverse = async (taskId: string): Promise<void> => {
			if (visited.has(taskId)) return;
			visited.add(taskId);
			const info = schedules.get(taskId);
			if (!info) return;
			if (info.isCritical) {
				criticalTasks.push(taskId);
				// descend to children that are critical
				const task = await this.taskRepository.getTaskById(taskId);
				if (task) {
					for (const childId of task.childrenTaskIds) {
						await traverse(childId);
					}
				}
			}
		};

		for (const rootId of project.rootIds) {
			await traverse(rootId);
		}

		return criticalTasks;
	}

	/**
	 * Calculate schedules (earliest start, latest finish, slack) for all tasks in a project.
	 * Uses a forward/backward pass on a topological order to avoid repeated recursion.
	 * Returns a Map<taskId, { earliestStart, latestFinish, durationMs, earlyFinish, slack, isCritical }>
	 * or null if scheduling cannot proceed due to constraints (overdue/missing duration).
	 */
	async calculateProjectSchedules(taskIds: string[]): Promise<Map<
		string,
		{
			earliestStart: Date;
			latestFinish: Date;
			durationMs: number;
			earlyFinish: Date;
			slack: number;
			isCritical: boolean;
		}
	> | null> {
		// Load all tasks
		const tasks = await Promise.all(taskIds.map((id) => this.taskRepository.getTaskById(id)));
		const validTasks = tasks.filter((t) => t !== null) as Task[];
		const taskMap = new Map<string, Task>();
		for (const t of validTasks) taskMap.set(t.id, t);

		// Basic validation: ensure no overdue or missing duration (per requirements)
		const now = new Date();
		for (const t of validTasks) {
			if (!t.completed && t.estimateDurationHour === 0)
				throw new TaskCalculator.SchedulingError(
					'MISSING_DURATION',
					`Task ${t.id} has no estimated duration`,
					{ taskId: t.id }
				);
			if (!t.completed && t.deadline.getTime() < now.getTime())
				throw new TaskCalculator.SchedulingError(
					'OVERDUE_TASK',
					`Task ${t.id} is overdue (deadline ${t.deadline.toISOString()})`,
					{ taskId: t.id }
				);
		}

		// Build parent/child adjacency limited to project
		const parents = new Map<string, string[]>();
		const children = new Map<string, string[]>();
		for (const id of taskIds) {
			parents.set(id, []);
			children.set(id, []);
		}
		for (const t of validTasks) {
			for (const p of t.parentTaskIds) {
				if (parents.has(t.id) && parents.has(p)) {
					parents.get(t.id)!.push(p);
					children.get(p)!.push(t.id);
				}
			}
		}

		// Kahn's algorithm for topological order
		const indegree = new Map<string, number>();
		for (const id of taskIds) indegree.set(id, parents.get(id)!.length);
		const queue: string[] = [];
		for (const [id, deg] of indegree) if (deg === 0) queue.push(id);
		const topo: string[] = [];
		while (queue.length > 0) {
			const id = queue.shift()!;
			topo.push(id);
			for (const c of children.get(id) || []) {
				indegree.set(c, (indegree.get(c) || 0) - 1);
				if ((indegree.get(c) || 0) === 0) queue.push(c);
			}
		}
		if (topo.length !== taskIds.length) {
			// Not a DAG within the provided set
			throw new TaskCalculator.SchedulingError(
				'NOT_A_DAG',
				'The project graph is not a DAG or contains missing tasks',
				{ expected: taskIds.length, found: topo.length }
			);
		}

		// Forward pass: earliest starts
		const earliestStart = new Map<string, Date>();
		for (const id of topo) {
			const t = taskMap.get(id)!;
			if (t.parentTaskIds.length === 0 || (parents.get(id) || []).length === 0) {
				// root within project
				if (t.completed) earliestStart.set(id, t.startDate);
				else {
					const nowOrStart = now.getTime() > t.startDate.getTime() ? now : t.startDate;
					earliestStart.set(id, nowOrStart);
				}
			} else {
				let maxFinish = new Date(0);
				for (const p of parents.get(id) || []) {
					const parent = taskMap.get(p)!;
					const pEarliest = earliestStart.get(p);
					if (!pEarliest)
						throw new TaskCalculator.SchedulingError(
							'PARENT_UNRESOLVED',
							`Parent ${p} has no computed earliest start when processing ${id}`,
							{ parentId: p, taskId: id }
						);
					let pFinish: Date;
					if (parent.completed) {
						pFinish = parent.deadline; // ignore duration for completed parents
					} else {
						const dur = parent.estimateDurationHour * 60 * 60 * 1000;
						pFinish = new Date(pEarliest.getTime() + dur);
					}
					if (pFinish.getTime() > maxFinish.getTime()) maxFinish = pFinish;
				}
				// earliest start is max of parent finishes, also respect own startDate
				const candidate =
					maxFinish.getTime() > t.startDate.getTime() ? maxFinish : t.startDate;
				earliestStart.set(id, candidate);
			}
		}

		// Compute early finishes
		const earlyFinish = new Map<string, Date>();
		for (const id of topo) {
			const t = taskMap.get(id)!;
			const es = earliestStart.get(id)!;
			if (t.completed) {
				earlyFinish.set(id, t.deadline);
			} else {
				const dur = t.estimateDurationHour * 60 * 60 * 1000;
				earlyFinish.set(id, new Date(es.getTime() + dur));
			}
		}

		// Backward pass: latest finishes
		const latestFinish = new Map<string, Date>();
		// initialize leaves to their deadlines
		const reverseTopo = topo.slice().reverse();
		for (const id of reverseTopo) {
			const t = taskMap.get(id)!;
			const childs = children.get(id) || [];
			if (childs.length === 0) {
				// leaf
				latestFinish.set(id, t.deadline);
			} else {
				let minChildConstraint: Date | null = null;
				for (const c of childs) {
					const cLatest = latestFinish.get(c);
					if (!cLatest) return null; // unresolved child
					const childTask = taskMap.get(c)!;
					let candidate: Date;
					if (childTask.completed) {
						// child completed: ignore child's duration
						candidate = cLatest;
					} else {
						const dur = childTask.estimateDurationHour * 60 * 60 * 1000;
						candidate = new Date(cLatest.getTime() - dur);
					}
					if (
						minChildConstraint === null ||
						candidate.getTime() < minChildConstraint.getTime()
					) {
						minChildConstraint = candidate;
					}
				}
				if (minChildConstraint === null)
					throw new TaskCalculator.SchedulingError(
						'CHILD_UNRESOLVED',
						`Unable to determine child constraints for ${id}`,
						{ taskId: id }
					);
				latestFinish.set(id, minChildConstraint);
			}
		}

		// Build schedule map
		const scheduleMap = new Map();
		for (const id of topo) {
			const t = taskMap.get(id)!;
			const es = earliestStart.get(id)!;
			const ef = earlyFinish.get(id)!;
			const lf = latestFinish.get(id)!;
			const dur = t.estimateDurationHour * 60 * 60 * 1000;
			const slack = lf.getTime() - ef.getTime();
			scheduleMap.set(id, {
				earliestStart: es,
				latestFinish: lf,
				durationMs: dur,
				earlyFinish: ef,
				slack,
				isCritical: slack === 0,
			});
		}

		return scheduleMap;
	}

	/**
	 * Calculate total estimated duration for a group of tasks (in hours)
	 */
	async getTotalEstimatedDuration(taskIds: string[]): Promise<number> {
		const tasks = await Promise.all(taskIds.map((id) => this.taskRepository.getTaskById(id)));
		const validTasks = tasks.filter((t) => t !== null) as Task[];
		return validTasks.reduce((total, task) => total + task.estimateDurationHour, 0);
	}

	/**
	 * Get average priority for a task group
	 */
	async getAveragePriority(taskIds: string[]): Promise<number> {
		const tasks = await Promise.all(taskIds.map((id) => this.taskRepository.getTaskById(id)));
		const validTasks = tasks.filter((t) => t !== null) as Task[];
		if (validTasks.length === 0) return 0;
		const total = validTasks.reduce((sum, task) => sum + task.priority, 0);
		return total / validTasks.length;
	}

	/**
	 * Get completion rate for a task group (0 to 1)
	 */
	async getCompletionRate(taskIds: string[]): Promise<number> {
		const tasks = await Promise.all(taskIds.map((id) => this.taskRepository.getTaskById(id)));
		const validTasks = tasks.filter((t) => t !== null) as Task[];
		if (validTasks.length === 0) return 0;
		const completed = validTasks.filter((t) => t.completed).length;
		return completed / validTasks.length;
	}
}
