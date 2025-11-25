import { ipcMain } from 'electron';
import { taskManager } from './TaskManager';
import { taskDependencyManager } from './TaskDependencyManager';
import { taskCalculator } from './TaskCalculator';
import { TaskAddParams, TaskUpdateParams, TaskIdParam } from '../shared/TaskTypes';
import { CreateTaskData } from './TaskRepository';

async function debugIPC<T>(channel: string, action: () => Promise<T>): Promise<T> {
	try {
		const result = await action();

		// 🧪 測試 1: 檢查是否能被 JSON 序列化 (最嚴格的檢查)
		try {
			JSON.stringify(result);
		} catch (jsonErr) {
			console.error(`[IPC DEBUG] ❌ JSON Stringify Failed on ${channel}:`, jsonErr);
		}

		// 🧪 測試 2: 檢查是否能被結構化複製 (模擬 Electron IPC 行為)
		try {
			// structuredClone 是 Node.js 17+ 原生支援的，Electron 30+ 都支援
			structuredClone(result);
		} catch (cloneErr) {
			console.error(`[IPC DEBUG] ☠️ Object Clone Failed on ${channel}!`);
			console.error('Error Details:', cloneErr);

			// 印出第一層屬性，幫你縮小範圍
			if (typeof result === 'object' && result !== null) {
				console.log('🔍 Inspecting properties:');
				for (const [key, value] of Object.entries(result as any)) {
					try {
						structuredClone(value);
					} catch (e) {
						console.error(`   👉 Property "${key}" caused the crash! Value:`, value);
					}
				}
			}
		}

		return result;
	} catch (error) {
		console.error(`[IPC DEBUG] Handler Error on ${channel}:`, error);
		throw error;
	}
}

export function registerTaskIpcHandlers(): void {
	// 獲取所有任務
	ipcMain.handle('tasks:list', async () => {
		return await debugIPC('tasks:list', () => taskManager.listTasks());
	});

	// 獲取單個任務
	ipcMain.handle('tasks:get', async (_, params: TaskIdParam) => {
		return await debugIPC('tasks:get', () => taskManager.getTask(params.taskId));
	});

	// 創建任務
	ipcMain.handle('tasks:add', async (_, params: TaskAddParams) => {
		const createData: CreateTaskData = {
			...params,
			deadline: params.deadline ? new Date(params.deadline) : undefined,
		};
		return await debugIPC('tasks:add', () => taskManager.addTask(createData));
	});

	// 更新任務
	ipcMain.handle('tasks:update', async (_, params: TaskIdParam & { data: TaskUpdateParams }) => {
		const updateData = {
			...params.data,
			deadline: params.data.deadline ? new Date(params.data.deadline) : undefined,
		};
		return await debugIPC('tasks:update', () => taskManager.updateTask(params.taskId, updateData));
	});

	// 刪除任務
	ipcMain.handle('tasks:remove', async (_, params: TaskIdParam) => {
		return await debugIPC('tasks:remove', () => taskManager.removeTask(params.taskId));
	});

	// 獲取任務的所有後代
	ipcMain.handle('tasks:getAllDescendants', async (_, params: TaskIdParam) => {
		return await debugIPC('tasks:getAllDescendants', () => taskDependencyManager.getAllDescendants(params.taskId));
	});

	// 獲取任務的所有祖先
	ipcMain.handle('tasks:getAllAncestors', async (_, params: TaskIdParam) => {
		return await debugIPC('tasks:getAllAncestors', () => taskDependencyManager.getAllAncestors(params.taskId));
	});

	// 計算任務的完成度
	ipcMain.handle('tasks:getCompleteness', async (_, params: TaskIdParam) => {
		return await debugIPC('tasks:getCompleteness', () => taskCalculator.getTaskCompleteness(params.taskId));
	});

	// 計算任務的緊急性
	ipcMain.handle('tasks:getUrgency', async (_, params: TaskIdParam) => {
		return await debugIPC('tasks:getUrgency', () => taskCalculator.getTaskUrgency(params.taskId));
	});

	// 刷新過期任務
	ipcMain.handle('tasks:refreshOverdue', async () => {
		return await debugIPC('tasks:refreshOverdue', () => taskManager.refreshOverdue());
	});

	// 取得單一任務的預估與實際工時差值
	ipcMain.handle('tasks:getActualVsEstimated', async (_, params: TaskIdParam) => {
		return await debugIPC('tasks:getActualVsEstimated', () => taskCalculator.getActualVsEstimated(params.taskId));
	});

	// 計算所有任務的平均預估與實際工時差值
	ipcMain.handle('tasks:getAverageActualVsEstimated', async () => {
		return await debugIPC('tasks:getAverageActualVsEstimated', () => taskCalculator.getAverageActualVsEstimated());
	});
}
