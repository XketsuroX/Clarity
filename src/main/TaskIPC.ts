import { ipcMain } from 'electron';
import { taskManager } from './TaskManager';
import { taskDependencyManager } from './TaskDependencyManager';
import { taskCalculator } from './TaskCalculator';

export function registerTaskIpcHandlers(): void {
	// 獲取所有任務
	ipcMain.handle('tasks:list', async () => {
		return await taskManager.listTasks();
	});

	// 獲取單個任務
	ipcMain.handle('tasks:get', async (_, taskId: number) => {
		return await taskManager.getTask(taskId);
	});

	// 創建任務
	ipcMain.handle('tasks:add', async (_, taskData) => {
		return await taskManager.addTask(taskData);
	});

	// 更新任務
	ipcMain.handle('tasks:update', async (_, taskId: number, taskData) => {
		return await taskManager.updateTask(taskId, taskData);
	});

	// 刪除任務
	ipcMain.handle('tasks:remove', async (_, taskId: number) => {
		return await taskManager.removeTask(taskId);
	});

	// 獲取任務的所有後代
	ipcMain.handle('tasks:getAllDescendants', async (_, taskId: number) => {
		return await taskDependencyManager.getAllDescendants(taskId);
	});

	// 獲取任務的所有祖先
	ipcMain.handle('tasks:getAllAncestors', async (_, taskId: number) => {
		return await taskDependencyManager.getAllAncestors(taskId);
	});

	// 計算任務的完成度
	ipcMain.handle('tasks:getCompleteness', async (_, taskId: number) => {
		return await taskCalculator.getTaskCompleteness(taskId);
	});

	// 計算任務的緊急性
	ipcMain.handle('tasks:getUrgency', async (_, taskId: number) => {
		return await taskCalculator.getTaskUrgency(taskId);
	});

	// 刷新過期任務
	ipcMain.handle('tasks:refreshOverdue', async () => {
		return await taskManager.refreshOverdue();
	});

	// 取得單一任務的預估與實際工時差值
	ipcMain.handle('tasks:getActualVsEstimated', async (_, taskId: number) => {
		return await taskCalculator.getActualVsEstimated(taskId);
	});

	// 計算所有任務的平均預估與實際工時差值
	ipcMain.handle('tasks:getAverageActualVsEstimated', async () => {
		return await taskCalculator.getAverageActualVsEstimated();
	});
}
