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
	 * Compute completeness for a single task using the formula:
	 * (sum(children durations where state is In Progress or Scheduled) + task duration) /
	 * (sum(children durations where state != Overdue) + task duration)
	 * Throws SchedulingError('OVERDUE_TASK') if any involved task is Overdue.
	 */
	async getTaskCompleteness(taskId: number): Promise<number> {
		const task = await this.taskRepository.findById(taskId);
		if (!task) throw new TaskCalculator.SchedulingError('NOT_FOUND', 'Task not found', { taskId });

		// If the task itself is overdue and not completed, abort
		if (task.state === 'Overdue')
			throw new TaskCalculator.SchedulingError(
				'OVERDUE_TASK',
				`Task ${task.id} is overdue`,
				{ taskId: task.id }
			);

		// Fetch all descendants (children, grandchildren, ...). Use repository tree helper.
		const descendants = (await this.taskRepository.findDescendants(task)).filter(
			(t) => t.id !== task.id
		);

		// If any descendant is overdue and not completed, abort
		for (const d of descendants) {
			if (d.state === 'Overdue')
				throw new TaskCalculator.SchedulingError(
					'OVERDUE_TASK',
					`Descendant task ${d.id} is overdue`,
					{ descendantId: d.id }
				);
		}

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
			// denominator includes descendants in any state except Overdue
			if (d.state !== 'Overdue') denomDescendantsDur += dur;
			// numerator includes descendants In Progress or Scheduled
			if (d.state === 'In Progress' || d.state === 'Scheduled') activeDescendantsDur += dur;
		}

		const numerator = activeDescendantsDur + (parentDur || 0);
		const denominator = denomDescendantsDur + (parentDur || 0);
		if (denominator === 0) return 0;
		return numerator / denominator;
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
}
