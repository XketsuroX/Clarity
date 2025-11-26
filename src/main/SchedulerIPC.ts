import { ipcMain } from 'electron';
import { Scheduler } from './Scheduler';
import { taskManager } from './TaskManager';
import { ScheduleGenerateParams } from '../shared/SchedulerTypes';

const scheduler = new Scheduler();

export function registerSchedulerIpcHandlers(): void {
	ipcMain.handle('schedule:generate', async (_, params: ScheduleGenerateParams) => {
		const tasks = await taskManager.getPendingTasks();
		return scheduler.schedule(tasks, params.capacityHours, params.timeUnit);
	});
}
