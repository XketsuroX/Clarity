import { TaskJSON, TaskAddParams, TaskUpdateParams, TaskIdParam } from '../../shared/TaskTypes';
import { CategoryJSON, CategoryCreateParam } from '../../shared/CategoryTypes';
import { TagCreateParam, TagJSON } from '../../shared/TagTypes';

export function unwrapResult<T>(res: unknown): T {
	// If preload provided an unwrap helper, delegate to it
	// @ts	-ignore
	if (
		typeof window !== 'undefined' &&
		(window as any).api &&
		typeof (window as any).api.unwrapResult === 'function'
	) {
		// @ts-ignore ignore
		return (window as any).api.unwrapResult(res) as T;
	}

	// Fallback runtime unwrap
	if (res && typeof res === 'object' && 'ok' in (res as any)) {
		const r = res as any;
		if (r.ok) return r.value as T;
		const err = r.error ?? {};
		const msg = err.message ?? err.code ?? 'Unknown error';
		throw new Error(msg);
	}

	// If it's not a Result shape, just return as-is (best-effort)
	return res as T;
}

// API functions, wrapping IPC calls
export async function fetchTasks(): Promise<TaskJSON[]> {
	const result = await window.electron.ipcRenderer.invoke('tasks:list');
	return unwrapResult(result);
}

export async function createTask(task: Partial<TaskAddParams>): Promise<TaskJSON> {
	const params: TaskAddParams = {
		title: task.title ?? '',
		description: task.description,
		categoryId: task.categoryId ?? undefined,
		deadline: task.deadline ?? undefined,
		estimateDurationHour: task.estimateDurationHour ?? 0,
		priority: task.priority ?? undefined,
		//tagIds: task.tagIds ?? [1],
		// parentTaskId: task.parentTaskId ?? undefined,
	};
	console.log('type: ' + typeof params);
	const result = await window.electron.ipcRenderer.invoke('tasks:add', params);
	return unwrapResult(result);
}

export async function updateTask(id: TaskIdParam, data: Partial<TaskUpdateParams>): Promise<TaskJSON> {
	const params = JSON.parse(JSON.stringify(data));
	return await window.electron.ipcRenderer.invoke('tasks:update', id, params);
}

export async function removeTask(id: TaskIdParam): Promise<void> {
	return await window.electron.ipcRenderer.invoke('tasks:remove', id);
}

export async function toggleTaskStart(id: TaskIdParam): Promise<TaskJSON> {
	return await window.electron.ipcRenderer.invoke('tasks:toggleStart', id);
}

export async function toggleTaskComplete(id: TaskIdParam): Promise<TaskJSON> {
	// Here we assume the backend update supports partial fields
	const result = await window.electron.ipcRenderer.invoke('tasks:toggleComplete', id);
	return unwrapResult(result);
}

export async function generateSchedule(hours: number): Promise<any[]> {
	const result = await window.electron.ipcRenderer.invoke('schedule:generate', hours);
	return unwrapResult(result);
}

// Categories
export async function fetchCategories(): Promise<CategoryJSON[]> {
	return unwrapResult(await window.electron.ipcRenderer.invoke('categories:getAll'));
}
export async function createCategory(title: string): Promise<CategoryJSON> {
	return unwrapResult(await window.electron.ipcRenderer.invoke('categories:create', title));
}

export async function updateCategory(id: number, title: string): Promise<CategoryJSON> {
	return await window.electron.ipcRenderer.invoke('categories:update', { id, title });
}

export async function deleteCategory(id: number): Promise<void> {
	return await window.electron.ipcRenderer.invoke('categories:delete', id);
}
// Tags
export async function fetchTags(): Promise<TagJSON[]> {
	return await window.electron.ipcRenderer.invoke('tags:getAll');
}

export async function createTag(tag: TagCreateParam): Promise<TagJSON> {
	console.log('createTag in api.ts called' + JSON.stringify(tag));
	return await window.electron.ipcRenderer.invoke('tags:add', tag);
}

// Helper function: unwrap the Result structure returned by the backend (if any)
// function unwrapResult(res: any) {
// 	if (res && res.error) throw new Error(res.error.message);
// 	return res.ok ? res.value : res;
// }
