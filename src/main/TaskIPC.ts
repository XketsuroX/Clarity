import { ipcMain } from 'electron';
import { taskManager } from './TaskManager';
import { TaskAddParams, TaskUpdateParams, TaskIdParam } from '../shared/TaskTypes';
import { CreateTaskData } from './TaskRepository';

/**
 * TaskIPC - Electron IPC handlers for task management operations.
 * 
 * All handlers return Result<T> objects with the following structure:
 * - Success: { ok: true, value: T }
 * - Error: { ok: false, error: { code: string, message: string, details?: any } }
 * 
 * Renderer process usage:
 * ```typescript
 * const result = await window.electron.ipcRenderer.invoke('tasks:list');
 * if (result.ok) {
 *   console.log(result.value); // ITaskJSON[]
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export function registerTaskIpcHandlers(): void {
	/**
	 * Channel: tasks:list
	 * Description: Retrieves all tasks in the system
	 * Parameters: none
	 * Returns: Result<ITaskJSON[]> - Array of all tasks with their properties
	 * 
	 * Example:
	 * ```typescript
	 * const result = await invoke('tasks:list');
	 * // result.value: [{ id: 1, title: "Task 1", ... }, ...]
	 * ```
	 */
	ipcMain.handle('tasks:list', async () => {
		return await taskManager.listTasks();
	});

	/**
	 * Channel: tasks:get
	 * Description: Retrieves a single task by its ID
	 * Parameters: { taskId: number }
	 * Returns: Result<ITaskJSON> - Task object or null if not found
	 * 
	 * Example:
	 * ```typescript
	 * const result = await invoke('tasks:get', { taskId: 1 });
	 * // result.value: { id: 1, title: "My Task", completed: false, ... }
	 * ```
	 */
	ipcMain.handle('tasks:get', async (_, params: TaskIdParam) => {
		return await taskManager.getTask(params.taskId);
	});

	/**
	 * Channel: tasks:add
	 * Description: Creates a new task
	 * Parameters: TaskAddParams - { title, description?, deadline?, parentTaskId?, ... }
	 * Returns: Result<ITaskJSON> - Newly created task object
	 * 
	 * Example:
	 * ```typescript
	 * const result = await invoke('tasks:add', {
	 *   title: "New Task",
	 *   description: "Task description",
	 *   deadline: "2025-12-31T23:59:59Z",
	 *   estimatedDurationHour: 5
	 * });
	 * // result.value: { id: 2, title: "New Task", ... }
	 * ```
	 */
	ipcMain.handle('tasks:add', async (_, params: TaskAddParams) => {
		const createData: CreateTaskData = {
			...params,
			deadline: params.deadline ? new Date(params.deadline) : undefined,
		};
		return await taskManager.addTask(createData);
	});

	/**
	 * Channel: tasks:update
	 * Description: Updates an existing task's properties
	 * Parameters: { taskId: number, data: TaskUpdateParams }
	 * Returns: Result<ITaskJSON> - Updated task object
	 * 
	 * Example:
	 * ```typescript
	 * const result = await invoke('tasks:update', {
	 *   taskId: 1,
	 *   data: { title: "Updated Title", priority: 5 }
	 * });
	 * // result.value: { id: 1, title: "Updated Title", priority: 5, ... }
	 * ```
	 */
	ipcMain.handle('tasks:update', async (_, params: TaskIdParam & { data: TaskUpdateParams }) => {
		const updateData = {
			...params.data,
			deadline: params.data.deadline ? new Date(params.data.deadline) : undefined,
		};
		return await taskManager.updateTask(params.taskId, updateData);
	});

	/**
	 * Channel: tasks:toggleComplete
	 * Description: Toggles task completion status (complete ↔ incomplete)
	 * Parameters: { taskId: number }
	 * Returns: Result<ITaskJSON> - Updated task with new completion state
	 * 
	 * Note: All child tasks must be completed before a parent can be marked complete.
	 * Automatically calculates actual duration when marking complete.
	 * 
	 * Example:
	 * ```typescript
	 * const result = await invoke('tasks:toggleComplete', { taskId: 1 });
	 * // result.value: { id: 1, completed: true, state: "Completed", ... }
	 * ```
	 */
	ipcMain.handle('tasks:toggleComplete', async (_, params: TaskIdParam) => {
		return await taskManager.completeTask(params.taskId);
	});

	/**
	 * Channel: tasks:toggleStart
	 * Description: Starts a task (transitions from "Scheduled" to "In Progress")
	 * Parameters: { taskId: number }
	 * Returns: Result<ITaskJSON> - Updated task with actualStartDate set
	 * 
	 * Note: Only works for tasks in "Scheduled" state.
	 * 
	 * Example:
	 * ```typescript
	 * const result = await invoke('tasks:toggleStart', { taskId: 1 });
	 * // result.value: { id: 1, state: "In Progress", actualStartDate: "2025-12-02T...", ... }
	 * ```
	 */
	ipcMain.handle('tasks:toggleStart', async (_, params: TaskIdParam) => {
		return await taskManager.startTask(params.taskId);
	});

	/**
	 * Channel: tasks:setCompleteness
	 * Description: Manually sets the completeness percentage for a leaf task (0-100)
	 * Parameters: { taskId: number, completeness: number }
	 * Returns: Result<ITaskJSON> - Updated task with new completeness value
	 * 
	 * Note: Only allowed for leaf tasks (tasks without children).
	 * Parent tasks have auto-calculated completeness based on children.
	 * 
	 * Example:
	 * ```typescript
	 * const result = await invoke('tasks:setCompleteness', { 
	 *   taskId: 1, 
	 *   completeness: 75 
	 * });
	 * // result.value: { id: 1, completeness: 75, ... }
	 * ```
	 */
	ipcMain.handle('tasks:setCompleteness', async (_, params: TaskIdParam & { completeness: number }) => {
		return await taskManager.setTaskCompleteness(params.taskId, params.completeness);
	});

	/**
	 * Channel: tasks:remove
	 * Description: Deletes a task and cleans up all parent/child relationships
	 * Parameters: { taskId: number }
	 * Returns: Result<boolean> - true if successfully deleted
	 * 
	 * Note: Automatically updates completeness aggregates for parent tasks.
	 * 
	 * Example:
	 * ```typescript
	 * const result = await invoke('tasks:remove', { taskId: 1 });
	 * // result.value: true
	 * ```
	 */
	ipcMain.handle('tasks:remove', async (_, params: TaskIdParam) => {
		return await taskManager.removeTask(params.taskId);
	});

	/**
	 * Channel: tasks:getAllDescendants
	 * Description: Retrieves all child tasks recursively (subtasks, sub-subtasks, etc.)
	 * Parameters: { taskId: number }
	 * Returns: Result<ITaskJSON[]> - Array of all descendant tasks
	 * 
	 * Example:
	 * ```typescript
	 * const result = await invoke('tasks:getAllDescendants', { taskId: 1 });
	 * // result.value: [{ id: 2, ... }, { id: 3, ... }, ...]
	 * ```
	 */
	ipcMain.handle('tasks:getAllDescendants', async (_, params: TaskIdParam) => {
		return await taskManager.getTaskDescendants(params.taskId);
	});

	/**
	 * Channel: tasks:getAllAncestors
	 * Description: Retrieves all parent task IDs recursively up to root
	 * Parameters: { taskId: number }
	 * Returns: Result<number[]> - Array of ancestor task IDs
	 * 
	 * Example:
	 * ```typescript
	 * const result = await invoke('tasks:getAllAncestors', { taskId: 5 });
	 * // result.value: [3, 1] // parent ID 3, grandparent ID 1
	 * ```
	 */
	ipcMain.handle('tasks:getAllAncestors', async (_, params: TaskIdParam) => {
		return await taskManager.getTaskAncestors(params.taskId);
	});

	/**
	 * Channel: tasks:getCompleteness
	 * Description: Calculates task completeness percentage (0-100)
	 * Parameters: { taskId: number }
	 * Returns: Result<number> - Completeness percentage
	 * 
	 * Note: For leaf tasks, returns persisted user-set value.
	 * For parent tasks, aggregates children's completeness.
	 * 
	 * Example:
	 * ```typescript
	 * const result = await invoke('tasks:getCompleteness', { taskId: 1 });
	 * // result.value: 67.5
	 * ```
	 */
	ipcMain.handle('tasks:getCompleteness', async (_, params: TaskIdParam) => {
		return await taskManager.getTaskCompleteness(params.taskId);
	});

	/**
	 * Channel: tasks:getUrgency
	 * Description: Calculates task urgency score (0-100) based on deadline proximity and duration
	 * Parameters: { taskId: number }
	 * Returns: Result<number> - Urgency score (100 = most urgent)
	 * 
	 * Note: Considers deadline, estimated duration, and current date.
	 * Higher score = more urgent / closer to deadline.
	 * 
	 * Example:
	 * ```typescript
	 * const result = await invoke('tasks:getUrgency', { taskId: 1 });
	 * // result.value: 85
	 * ```
	 */
	ipcMain.handle('tasks:getUrgency', async (_, params: TaskIdParam) => {
		return await taskManager.getTaskUrgency(params.taskId);
	});

	/**
	 * Channel: tasks:refreshOverdue
	 * Description: Batch updates all tasks past their deadline to "Overdue" state
	 * Parameters: none
	 * Returns: Promise<void>
	 * 
	 * Note: Should be called periodically (e.g., on app start, daily).
	 * Makes overdue status queryable in database.
	 * 
	 * Example:
	 * ```typescript
	 * await invoke('tasks:refreshOverdue');
	 * ```
	 */
	ipcMain.handle('tasks:refreshOverdue', async () => {
		return await taskManager.refreshOverdue();
	});

	/**
	 * Channel: tasks:getActualVsEstimated
	 * Description: Compares actual vs estimated duration for a completed task
	 * Parameters: { taskId: number }
	 * Returns: Result<{ estimatedDurationHour, actualDurationHour, deltaHour, deltaPercent }>
	 * 
	 * Example:
	 * ```typescript
	 * const result = await invoke('tasks:getActualVsEstimated', { taskId: 1 });
	 * // result.value: {
	 * //   estimatedDurationHour: 5,
	 * //   actualDurationHour: 6.5,
	 * //   deltaHour: 1.5,
	 * //   deltaPercent: 30
	 * // }
	 * ```
	 */
	ipcMain.handle('tasks:getActualVsEstimated', async (_, params: TaskIdParam) => {
		return await taskManager.getActualVsEstimated(params.taskId);
	});

	/**
	 * Channel: tasks:getAverageActualVsEstimated
	 * Description: Calculates average estimation accuracy across all completed tasks
	 * Parameters: none
	 * Returns: Result<{ avgDeltaHour, avgDeltaPercent, count }>
	 * 
	 * Note: Useful for improving future estimations and tracking team performance.
	 * 
	 * Example:
	 * ```typescript
	 * const result = await invoke('tasks:getAverageActualVsEstimated');
	 * // result.value: {
	 * //   avgDeltaHour: 2.3,
	 * //   avgDeltaPercent: 15.5,
	 * //   count: 42
	 * // }
	 * ```
	 */
	ipcMain.handle('tasks:getAverageActualVsEstimated', async () => {
		return await taskManager.getAverageActualVsEstimated();
	});
  
	/**
	 * Channel: tasks:getEstimatedDuration
	 * Description: Calculates remaining estimated duration for a task (includes subtasks)
	 * Parameters: { taskId: number }
	 * Returns: Result<number> - Estimated remaining hours
	 * 
	 * Note: Aggregates estimated duration for task and all incomplete descendants.
	 * 
	 * Example:
	 * ```typescript
	 * const result = await invoke('tasks:getEstimatedDuration', { taskId: 1 });
	 * // result.value: 12.5
	 * ```
	 */
	ipcMain.handle('tasks:getEstimatedDuration', async (_, params: TaskIdParam) => {
		return await taskManager.getEstimatedTaskDuration(params.taskId);
	});
}
