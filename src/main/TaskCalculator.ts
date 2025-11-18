import { Task } from './Task';
import { TaskRepository } from './TaskRepository';

/**
 * TaskCalculator handles time-based calculations and scheduling metrics.
 * Responsible for: deadline analysis, date range calculations, project timing.
 */
export class TaskCalculator {
	private taskRepository: TaskRepository;

	constructor(taskRepository: TaskRepository) {
		this.taskRepository = taskRepository;
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

	/**
	 * Calculate earliest start time for a task using Critical Path Method (CPM)
	 * Traverses from root tasks downward, accumulating duration from parent completion time
	 * @param taskId - task ID to calculate earliest start for
	 * @returns earliest start Date or null if calculation fails (overdue/missing duration/no path to root)
	 */
	async calculateEarliestStartTime(taskId: string): Promise<Date | null> {
		const task = await this.taskRepository.getTaskById(taskId);
		if (!task) return null;

		// If task is completed, return its start date
		if (task.completed) {
			return task.startDate;
		}

		// If no parents (root task), earliest start is now or task's start date (whichever is later)
		if (task.parentTaskIds.length === 0) {
			const now = new Date();
			return task.startDate.getTime() > now.getTime() ? task.startDate : now;
		}

		// Get all parent tasks
		const parentTasks = await Promise.all(
			task.parentTaskIds.map((id) => this.taskRepository.getTaskById(id))
		);
		const validParents = parentTasks.filter((p) => p !== null) as Task[];

		if (validParents.length === 0) return null;

		// For each parent, calculate their finish time (earliest start + duration, or actual finish if completed)
		const parentFinishTimes: Date[] = [];

		for (const parent of validParents) {
			// If parent is completed, use its actual deadline (or assume it finished on time)
			if (parent.completed) {
				parentFinishTimes.push(parent.deadline);
			} else {
				// If parent is in progress, calculate its earliest start + duration
				const parentEarliestStart = await this.calculateEarliestStartTime(parent.id);
				if (!parentEarliestStart) return null; // Can't determine parent path

				// Parent finish = start + duration
				const durationMs = parent.estimateDurationHour * 60 * 60 * 1000;
				const parentFinishTime = new Date(parentEarliestStart.getTime() + durationMs);
				parentFinishTimes.push(parentFinishTime);
			}
		}

		// Earliest start for this task is max of all parent finish times
		if (parentFinishTimes.length === 0) return null;

		const maxParentFinishTime = parentFinishTimes.reduce((max, time) => {
			return time.getTime() > max.getTime() ? time : max;
		});

		// Check if task would be overdue
		if (maxParentFinishTime.getTime() > task.deadline.getTime()) {
			console.warn(`Task ${taskId} would start after its deadline (overdue constraint)`);
			return null;
		}

		// Check for missing duration (non-root, non-completed tasks should have duration)
		if (task.estimateDurationHour === 0 && !task.completed) {
			console.warn(`Task ${taskId} has no estimated duration; cannot calculate schedule`);
			return null;
		}

		return maxParentFinishTime;
	}

	/**
	 * Calculate latest finish time for a task using backward pass (CPM)
	 * Traverses from leaf tasks upward, subtracting duration from child start time
	 * @param taskId - task ID to calculate latest finish for
	 * @returns latest finish Date or null if calculation fails
	 */
	async calculateLatestFinishTime(taskId: string): Promise<Date | null> {
		const task = await this.taskRepository.getTaskById(taskId);
		if (!task) return null;

		// If task is completed, return its deadline (assume it must finish by then)
		if (task.completed) {
			return task.deadline;
		}

		// If no children (leaf task), latest finish is task's deadline
		if (task.childrenTaskIds.length === 0) {
			return task.deadline;
		}

		// Get all child tasks
		const childTasks = await Promise.all(
			task.childrenTaskIds.map((id) => this.taskRepository.getTaskById(id))
		);
		const validChildren = childTasks.filter((c) => c !== null) as Task[];

		if (validChildren.length === 0) return null;

		// For each child, calculate their latest start (latest finish - duration)
		const childLatestStartTimes: Date[] = [];

		for (const child of validChildren) {
			// Get child's latest finish time
			const childLatestFinish = await this.calculateLatestFinishTime(child.id);
			if (!childLatestFinish) return null;

			// Child latest start = latest finish - child's duration
			const durationMs = child.estimateDurationHour * 60 * 60 * 1000;
			const childLatestStart = new Date(childLatestFinish.getTime() - durationMs);
			childLatestStartTimes.push(childLatestStart);
		}

		// Latest finish for this task is min of all child latest start times
		if (childLatestStartTimes.length === 0) return null;

		const minChildLatestStart = childLatestStartTimes.reduce((min, time) => {
			return time.getTime() < min.getTime() ? time : min;
		});

		// Task latest finish = min of children's latest start times
		return minChildLatestStart;
	}

	/**
	 * Get scheduling info for a task including earliest start and latest finish (CPM analysis)
	 * @param taskId - task ID
	 * @returns scheduling info or null if calculation fails
	 */
	async getTaskSchedule(taskId: string): Promise<{
		taskId: string;
		earliestStart: Date | null;
		latestFinish: Date | null;
		slack: number | null; // in milliseconds
		isCritical: boolean; // slack == 0
	} | null> {
		const task = await this.taskRepository.getTaskById(taskId);
		if (!task) return null;

		const earliestStart = await this.calculateEarliestStartTime(taskId);
		const latestFinish = await this.calculateLatestFinishTime(taskId);

		if (!earliestStart || !latestFinish) {
			return null;
		}

		const durationMs = task.estimateDurationHour * 60 * 60 * 1000;
		const earlyFinish = new Date(earliestStart.getTime() + durationMs);
		const slack = latestFinish.getTime() - earlyFinish.getTime();
		const isCritical = slack === 0;

		return {
			taskId,
			earliestStart,
			latestFinish,
			slack,
			isCritical,
		};
	}

	/**
	 * Get critical path (chain of tasks with zero slack) for a project
	 * @param rootTaskIds - list of root task IDs to start analysis
	 * @returns list of critical tasks (chain with zero slack)
	 */
	async getCriticalPath(rootTaskIds: string[]): Promise<string[]> {
		const criticalTasks: string[] = [];

		const traverse = async (taskId: string): Promise<void> => {
			const schedule = await this.getTaskSchedule(taskId);
			if (!schedule) return;

			if (schedule.isCritical) {
				criticalTasks.push(taskId);

				// Follow critical path to children
				const task = await this.taskRepository.getTaskById(taskId);
				if (task) {
					for (const childId of task.childrenTaskIds) {
						await traverse(childId);
					}
				}
			}
		};

		for (const rootId of rootTaskIds) {
			await traverse(rootId);
		}

		return criticalTasks;
	}
}
