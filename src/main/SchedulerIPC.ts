import { ipcMain } from 'electron';
import { Scheduler } from './Scheduler';
import { taskManager } from './TaskManager';

const scheduler = new Scheduler();

export function registerSchedulerIpcHandlers(): void {
	ipcMain.handle(
		'schedule:generate',
		async (_, capacityHours: number, timeUnit: number = 0.5) => {
			const tasks = await taskManager.getPendingTasks();
			return scheduler.schedule(tasks, capacityHours, timeUnit);
		}
	);
}
