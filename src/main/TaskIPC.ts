import { ipcMain } from 'electron';
import { taskManager } from './TaskManager';
import { TaskAddParams, TaskUpdateParams, TaskIdParam } from '../shared/TaskTypes';
import { CreateTaskData } from './TaskRepository';

export function registerTaskIpcHandlers(): void {
	// 獲取所有任務
	ipcMain.handle('tasks:list', async () => {
		return await taskManager.listTasks();
	});

	// 獲取單個任務
	ipcMain.handle('tasks:get', async (_, params: TaskIdParam) => {
		return await taskManager.getTask(params.taskId);
	});

	// 創建任務
	ipcMain.handle('tasks:add', async (_, params: TaskAddParams) => {
		const createData: CreateTaskData = {
			...params,
			deadline: params.deadline ? new Date(params.deadline) : undefined,
		};
		return await taskManager.addTask(createData);
	});

	// 更新任務
	ipcMain.handle('tasks:update', async (_, params: TaskIdParam & { data: TaskUpdateParams }) => {
		const updateData = {
			...params.data,
			deadline: params.data.deadline ? new Date(params.data.deadline) : undefined,
		};
		return await taskManager.updateTask(params.taskId, updateData);
	});

	ipcMain.handle('tasks:toggleComplete', async (_, params: TaskIdParam) => {
		return await taskManager.completeTask(params.taskId);
	});

	ipcMain.handle('tasks:toggleStart', async (_, params: TaskIdParam) => {
		return await taskManager.startTask(params.taskId);
	});

	ipcMain.handle(
		'tasks:setCompleteness',
		async (_, params: TaskIdParam & { completeness: number }) => {
			return await taskManager.setTaskCompleteness(params.taskId, params.completeness);
		}
	);
	// 刪除任務
	ipcMain.handle('tasks:remove', async (_, params: TaskIdParam) => {
		return await taskManager.removeTask(params.taskId);
	});

	// 獲取任務的所有後代
	ipcMain.handle('tasks:getAllDescendants', async (_, params: TaskIdParam) => {
		return await taskManager.getTaskDescendants(params.taskId);
	});

	// 獲取任務的所有祖先
	ipcMain.handle('tasks:getAllAncestors', async (_, params: TaskIdParam) => {
		return await taskManager.getTaskAncestors(params.taskId);
	});

	// 計算任務的完成度
	ipcMain.handle('tasks:getCompleteness', async (_, params: TaskIdParam) => {
		return await taskManager.getTaskCompleteness(params.taskId);
	});

	// 計算任務的緊急性
	ipcMain.handle('tasks:getUrgency', async (_, params: TaskIdParam) => {
		return await taskManager.getTaskUrgency(params.taskId);
	});

	// 刷新過期任務
	ipcMain.handle('tasks:refreshOverdue', async () => {
		return await taskManager.refreshOverdue();
	});

	// 取得單一任務的預估與實際工時差值
	ipcMain.handle('tasks:getActualVsEstimated', async (_, params: TaskIdParam) => {
		return await taskManager.getActualVsEstimated(params.taskId);
	});

	// 計算所有任務的平均預估與實際工時差值
	ipcMain.handle('tasks:getAverageActualVsEstimated', async () => {
		return await taskManager.getAverageActualVsEstimated();
	});

	// 取得任務的預估剩餘工時
	ipcMain.handle('tasks:getEstimatedDuration', async (_, params: TaskIdParam) => {
		return await taskManager.getEstimatedTaskDuration(params.taskId);
	});
}
