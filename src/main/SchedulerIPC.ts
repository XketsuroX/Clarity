import { ipcMain } from 'electron';
import { Scheduler } from './Scheduler';
import { taskManager } from './TaskManager';
import { ScheduleGenerateParams } from '../shared/SchedulerTypes';

const scheduler = new Scheduler();

export function registerSchedulerIpcHandlers(): void {
	ipcMain.handle('schedule:generate', async (_, params: ScheduleGenerateParams) => {
		const tasks = await taskManager.getPendingTasks();
		if (!tasks.ok) {
			throw new Error('Failed to fetch tasks for scheduling');
		}
		return scheduler.schedule(tasks.value, params.capacityHours, params.timeUnit);
	});
}
