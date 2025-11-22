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
	 * Compute completeness for a single task and return a percentage 0..100 using the formula:
	 * percent = ((sum(children durations where state is In Progress or Scheduled) + task duration) /
	 * (sum(children durations where state != Overdue) + task duration)) * 100
	 * Throws SchedulingError('OVERDUE_TASK') if any involved task is Overdue.
	 */
	async getTaskCompleteness(taskId: number): Promise<number> {
		const task = await this.taskRepository.findById(taskId);
		if (!task) throw new TaskCalculator.SchedulingError('NOT_FOUND', 'Task not found', { taskId });

		// Treat Overdue as an incomplete state (similar to In Progress).
		// Do not abort when task or descendants are Overdue; include them in completeness.

		// Fetch all descendants (children, grandchildren, ...). Use repository tree helper.
		const descendants = (await this.taskRepository.findDescendants(task)).filter(
			(t) => t.id !== task.id
		);

		// Do not abort on Overdue descendants; they are treated as incomplete.

		// Validate durations (must be > 0 for tasks that participate)
		const parentDur = task.estimateDurationHour;
		if ((!parentDur || parentDur <= 0) && !task.completed) {
			throw new TaskCalculator.SchedulingError(
				'MISSING_DURATION',
				`Task ${task.id} has no estimated duration`,
				{ taskId: task.id }
			);
		}

		let activeDescendantsDur = 0;
		let denomDescendantsDur = 0;
		for (const d of descendants) {
			const dur = d.estimateDurationHour;
			if (!dur || dur <= 0) {
				if (!d.completed)
					throw new TaskCalculator.SchedulingError(
						'MISSING_DURATION',
						`Descendant task ${d.id} has no estimated duration`,
						{ descendantId: d.id }
					);
				else continue; // completed descendant with no duration contributes 0
			}
			// denominator includes all descendants with durations (including Overdue)
			denomDescendantsDur += dur;
			// numerator includes descendants that are incomplete: In Progress, Scheduled, or Overdue
			if (d.state === 'In Progress' || d.state === 'Scheduled' || d.state === 'Overdue')
				activeDescendantsDur += dur;
		}

		const numerator = activeDescendantsDur + (parentDur || 0);
		const denominator = denomDescendantsDur + (parentDur || 0);
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
		if (!task) throw new TaskCalculator.SchedulingError('NOT_FOUND', 'Task not found', { taskId });

		if (task.completed) return 0;
		if (!task.deadline) return 0;

		// Require duration for non-completed tasks (stricter rule)
		const durHours = task.estimateDurationHour;
		if ((!durHours || durHours <= 0) && !task.completed) {
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
	}>
	{
		const task = await this.taskRepository.findById(taskId);
		if (!task) throw new TaskCalculator.SchedulingError('NOT_FOUND', 'Task not found', { taskId });

		const estimated = task.estimateDurationHour ?? null;
		const actual = task.actualDurationHour ?? null;
		if (actual === null) {
			return { estimatedDurationHour: estimated, actualDurationHour: null, deltaHour: null, deltaPercent: null };
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
		return { estimatedDurationHour: estimated, actualDurationHour: actual, deltaHour, deltaPercent };
	}
}