import { registerTaskIpcHandlers } from './TaskIPC';
import { registerCategoryIpcHandlers } from './CategoryIPC';
import { registerTagIpcHandlers } from './TagIPC';
import { registerSchedulerIpcHandlers } from './SchedulerIPC';

export function registerAllIpcHandlers(): void {
	console.log('Registering all IPC handlers...');

	registerTaskIpcHandlers();
	registerCategoryIpcHandlers();
	registerTagIpcHandlers();
	registerSchedulerIpcHandlers();

	console.log('All IPC handlers registered.');
}
