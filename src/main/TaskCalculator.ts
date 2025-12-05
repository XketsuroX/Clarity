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
		constructor(code: string, message: string, details?: unknown) {
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
	 * Compute completeness for a single task and return a percentage 0..100.
	 * Completeness represents the percentage of work that has been completed.
	 * For leaf tasks, uses the completeness field directly (scaled by duration).
	 * For non-leaf tasks, aggregates completeness of all descendants.
	 */
	async getTaskCompleteness(taskId: number): Promise<number> {
		const task = await this.taskRepository.findById(taskId);
		if (!task)
			throw new TaskCalculator.SchedulingError('NOT_FOUND', 'Task not found', { taskId });

		// Treat Overdue as an incomplete state (similar to In Progress).
		// Do not abort when task or descendants are Overdue; include them in completeness.

		// Fetch all descendants (children, grandchildren, ...). Use repository tree helper.
		const descendants = (await this.taskRepository.findDescendants(task)).filter(
			(t) => t.id !== task.id
		);

		// Build a quick parent id set to determine leaf vs non-leaf among the descendants
		const parentIdSet = new Set<number>();
		for (const d of descendants) {
			if (d.parentTask && typeof d.parentTask.id === 'number')
				parentIdSet.add(d.parentTask.id);
		}

		// Do not abort on Overdue descendants; they are treated as incomplete.

		// Validate and compute durations taking into account completed tasks (prefer actualDurationHour)
		let completedDescendantsDur = 0;
		let denomDescendantsDur = 0;

		for (const d of descendants) {
			// Determine the canonical duration value for this task: prefer actual when completed
			let durValue: number | null = null;
			if (d.completed) {
				// Completed tasks should always have actualDurationHour assigned by completeTask()
				durValue = d.actualDurationHour!;
			} else {
				// not completed: must have an estimate
				if (typeof d.estimateDurationHour !== 'number' || d.estimateDurationHour <= 0) {
					throw new TaskCalculator.SchedulingError(
						'MISSING_DURATION',
						`Descendant task ${d.id} has no estimated duration`,
						{ descendantId: d.id }
					);
				}
				durValue = d.estimateDurationHour!;
			}

			// Add to denominator (total effort)
			denomDescendantsDur += durValue;

			// Compute numerator (completed work). If this descendant is a leaf, use completeness to calculate completed portion
			const isLeaf = !parentIdSet.has(d.id);
			if (isLeaf) {
				if (d.completed) {
					completedDescendantsDur += durValue;
				} else {
					// Non-completed tasks are always in valid states: 'In Progress', 'Scheduled', or 'Overdue'
					const completeness = typeof d.completeness === 'number' ? d.completeness : 0;
					const completed =
						durValue * (Math.max(0, Math.min(100, completeness)) / 100);
					completedDescendantsDur += completed;
				}
			} else {
				// non-leaf: include 0 duration if task is active (children determine completion)
				// If all children complete, parent would be marked complete
				if (d.completed) {
					completedDescendantsDur += durValue;
				}
				// Active non-leaf contributes 0 to completed (completion comes from children)
			}
		}

		// Compute parent (task itself) duration contributions. Prefer actual when completed.
		let parentDurValue: number | null = null;
		if (task.completed) {
			// Completed tasks should always have actualDurationHour assigned by completeTask()
			parentDurValue = task.actualDurationHour!;
		} else {
			if (typeof task.estimateDurationHour !== 'number' || task.estimateDurationHour <= 0) {
				throw new TaskCalculator.SchedulingError(
					'MISSING_DURATION',
					`Task ${task.id} has no estimated duration`,
					{ taskId: task.id }
				);
			}
			parentDurValue = task.estimateDurationHour!;
		}

		// Denominator always includes the task's canonical duration
		const denominator = denomDescendantsDur + (parentDurValue || 0);

		// Numerator: if the task is a leaf, apply completeness to calculate completed portion; otherwise completed if marked complete
		let parentNumerator = 0;
		const taskIsLeaf = !descendants.some((x) => x.parentTask && x.parentTask.id === task.id);
		if (taskIsLeaf) {
			if (task.completed) {
				parentNumerator = parentDurValue || 0;
			} else {
				const completeness = typeof task.completeness === 'number' ? task.completeness : 0;
				parentNumerator =
					(parentDurValue || 0) * (Math.max(0, Math.min(100, completeness)) / 100);
			}
		} else {
			if (task.completed) {
				parentNumerator = parentDurValue || 0;
			}
			// Active non-leaf contributes 0 to completed (completion comes from children)
		}

		const numerator = completedDescendantsDur + parentNumerator;
		if (denominator === 0) return 0;
		const fraction = numerator / denominator;
		const percent = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
		return percent;
	}

	/**
	 * Compute urgency for a single task as an integer 0..100.
	 * - Completed tasks => 0
	 * - Overdue tasks => 100
	 * - Tasks with no deadline => 0
	 * - For tasks with a deadline within `windowDays`, urgency scales linearly
	 *   so a deadline today => 100, deadline at windowDays => 0.
	 */
	async getTaskUrgency(taskId: number, windowDays = 30): Promise<number> {
		const task = await this.taskRepository.findById(taskId);
		if (!task)
			throw new TaskCalculator.SchedulingError('NOT_FOUND', 'Task not found', { taskId });

		if (task.completed) return 0;
		if (!task.deadline) return 0;

		// Require duration for non-completed tasks (stricter rule)
		const durHours = task.estimateDurationHour;
		if (!durHours || durHours <= 0) {
			throw new TaskCalculator.SchedulingError(
				'MISSING_DURATION',
				`Task ${task.id} has no estimated duration`,
				{ taskId: task.id }
			);
		}

		const now = new Date();
		const msPerDay = 24 * 60 * 60 * 1000;
		const windowMs = Math.max(1, windowDays) * msPerDay;
		const durationMs = (durHours || 0) * 60 * 60 * 1000;

		// Compute the latest start time required to finish before the deadline
		const startBy = task.deadline.getTime() - durationMs;
		const timeToStart = startBy - now.getTime();

		// If deadline already passed, treat as maximum urgency
		if (task.deadline.getTime() - now.getTime() <= 0) return 100;

		if (timeToStart <= 0) return 100;
		if (timeToStart >= windowMs) return 0;

		const ratio = (windowMs - timeToStart) / windowMs; // 0..1 relative to start-by
		const urgency = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
		return urgency;
	}

	/**
	 * Compare actual duration vs estimated duration for a task.
	 * Returns an object with estimatedDurationHour, actualDurationHour, deltaHour, deltaPercent
	 * If actual duration is not available, actualDurationHour will be null.
	 */
	async getActualVsEstimated(taskId: number): Promise<{
		estimatedDurationHour: number | null;
		actualDurationHour: number | null;
		deltaHour: number | null;
		deltaPercent: number | null;
	}> {
		const task = await this.taskRepository.findById(taskId);
		if (!task)
			throw new TaskCalculator.SchedulingError('NOT_FOUND', 'Task not found', { taskId });

		const estimated = task.estimateDurationHour ?? null;
		const actual = task.actualDurationHour ?? null;
		if (actual === null) {
			return {
				estimatedDurationHour: estimated,
				actualDurationHour: null,
				deltaHour: null,
				deltaPercent: null,
			};
		}
		let deltaHour: number | null = null;
		let deltaPercent: number | null = null;
		if (estimated !== null) {
			deltaHour = Math.round((actual - estimated) * 100) / 100;
			if (estimated !== 0) {
				deltaPercent = Math.round(((actual - estimated) / estimated) * 10000) / 100; // two decimals percent
			} else {
				deltaPercent = null;
			}
		}
		return {
			estimatedDurationHour: estimated,
			actualDurationHour: actual,
			deltaHour,
			deltaPercent,
		};
	}

	async getAverageActualVsEstimated(): Promise<{
		avgDeltaHour: number | null;
		avgDeltaPercent: number | null;
		count: number;
	}> {
		const tasks = await this.taskRepository.findAll();
		let sumDeltaHour = 0;
		let sumDeltaPercent = 0;
		let count = 0;

		for (const task of tasks) {
			const result = await this.getActualVsEstimated(task.id);
			if (
				result.actualDurationHour !== null &&
				result.estimatedDurationHour !== null &&
				result.estimatedDurationHour !== 0
			) {
				sumDeltaHour += result.deltaHour ?? 0;
				sumDeltaPercent += result.deltaPercent ?? 0;
				count++;
			}
		}

		if (count === 0) {
			return { avgDeltaHour: null, avgDeltaPercent: null, count: 0 };
		}

		return {
			avgDeltaHour: Math.round((sumDeltaHour / count) * 100) / 100,
			avgDeltaPercent: Math.round((sumDeltaPercent / count) * 100) / 100,
			count,
		};
	}

	/**
	 * Estimate remaining duration (in hours) for a task by aggregating descendants and
	 * using leaf completeness where available. Includes the task's own remaining duration
	 * only when the task is `In Progress`.
	 *
	 * Aborts with SchedulingError('OVERDUE_TASK') if the root task is Overdue and not completed.
	 * Aborts with SchedulingError('MISSING_DURATION') if a non-completed task lacks an estimate.
	 */
	async estimatedTaskDuration(taskId: number): Promise<number> {
		const root = await this.taskRepository.findById(taskId);
		if (!root)
			throw new TaskCalculator.SchedulingError('NOT_FOUND', 'Task not found', { taskId });

		if (root.state === 'Overdue' && !root.completed)
			throw new TaskCalculator.SchedulingError('OVERDUE_TASK', `Task ${root.id} is overdue`, {
				taskId: root.id,
			});

		// load full subtree (includes the root)
		const all = await this.taskRepository.findDescendants(root);
		// build maps
		const taskMap = new Map<number, Task>();
		const children = new Map<number, number[]>();
		for (const t of all) {
			taskMap.set(t.id, t);
			children.set(t.id, []);
		}
		for (const t of all) {
			if (t.parentTask && taskMap.has(t.parentTask.id)) {
				children.get(t.parentTask.id)!.push(t.id);
			}
		}

		const computeRemaining = (id: number): number => {
			const t = taskMap.get(id)!;
			if (t.completed) return 0;

			// If a descendant (not root) is overdue, treat as incomplete (do not abort)
			// Requirement: only abort when the calculated (root) task is overdue.

			const childIds = children.get(id) || [];
			let total = 0;
			if (childIds.length === 0) {
				// leaf
				const est = t.estimateDurationHour;
				if (!est || est <= 0)
					throw new TaskCalculator.SchedulingError(
						'MISSING_DURATION',
						`Task ${t.id} has no estimated duration`,
						{ taskId: t.id }
					);
				const completeness = typeof t.completeness === 'number' ? t.completeness : 0;
				return (est || 0) * (1 - completeness / 100);
			} else {
				// aggregate children
				for (const c of childIds) {
					total += computeRemaining(c);
				}
				// include this task's own remaining duration only if it's In Progress
				if (t.state === 'In Progress') {
					const est = t.estimateDurationHour;
					if (!est || est <= 0)
						throw new TaskCalculator.SchedulingError(
							'MISSING_DURATION',
							`Task ${t.id} has no estimated duration`,
							{ taskId: t.id }
						);
					const completeness = typeof t.completeness === 'number' ? t.completeness : 0;
					total += (est || 0) * (1 - completeness / 100);
				}
				return total;
			}
		};

		return computeRemaining(root.id);
	}
}

export const taskCalculator = new TaskCalculator(new TaskRepository());
