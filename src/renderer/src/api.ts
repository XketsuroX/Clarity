import { TaskJSON, TaskAddParams, TaskUpdateParams, TaskIdParam } from '../../shared/TaskTypes';
import {
	CategoryJSON,
	CategoryCreateParam,
	CategoryUpdateParam,
	CategoryIdParam,
} from '../../shared/CategoryTypes';
import { TagCreateParam, TagIdParam, TagJSON, TagUpdateParam } from '../../shared/TagTypes';
import { ScheduleGenerateParams, ScheduleItem } from 'src/shared/SchedulerTypes';

export function unwrapResult<T>(res: unknown): T {
	// If preload provided an unwrap helper, delegate to it
	// @ts-ignore preload api unwrap helper
	if (
		typeof window !== 'undefined' &&
		(window as unknown as { api?: { unwrapResult?: (r: unknown) => T } }).api &&
		typeof (window as unknown as { api: { unwrapResult?: (r: unknown) => T } }).api
			.unwrapResult === 'function'
	) {
		// @ts-ignore preload api unwrap helper
		return (window as unknown as { api: { unwrapResult: (r: unknown) => T } }).api.unwrapResult(
			res
		);
	}

	// Fallback runtime unwrap
	if (res && typeof res === 'object' && 'ok' in (res as Record<string, unknown>)) {
		const r = res as Record<string, unknown>;
		if (r.ok) return r.value as T;
		const err = (r.error as Record<string, string>) || {};
		const msg = (err.message as string) || (err.code as string) || 'Unknown error';
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
	// const params: TaskAddParams = {
	// 	title: task.title ?? '',
	// 	description: task.description,
	// 	categoryId: task.categoryId ?? undefined,
	// 	deadline: task.deadline ?? undefined,
	// 	estimateDurationHour: task.estimateDurationHour ?? 0,
	// 	priority: task.priority ?? undefined,
	// 	tagIds: task.tagIds ?? [1],
	// 	parentTaskId: task.parentTaskId ?? undefined,
	// };

	const defaults: Partial<TaskAddParams> = {
		title: '',
		estimateDurationHour: 0,
		tagIds: [], // 建議預設為空陣列，除非你確定要預設 tagId 1
		priority: 0,
	};

	const cleanInput = JSON.parse(JSON.stringify(task));

	// 3. 合併：預設值 < 輸入值
	const params: TaskAddParams = {
		...defaults,
		...cleanInput,
	};
	console.log('param: ' + JSON.stringify(params));
	const result = await window.electron.ipcRenderer.invoke('tasks:add', params);
	return unwrapResult(result);
}

export async function updateTask(
	id: TaskIdParam,
	data: Partial<TaskUpdateParams>
): Promise<TaskJSON> {
	const params = JSON.parse(JSON.stringify(data));
	console.log('Updating task with params:', params);
	const result = await window.electron.ipcRenderer.invoke('tasks:update', {
		...id,
		data: params,
	});
	return unwrapResult(result);
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

export async function generateSchedule(params: ScheduleGenerateParams): Promise<ScheduleItem[]> {
	const result = await window.electron.ipcRenderer.invoke('schedule:generate', params);
	return unwrapResult(result);
}

export async function refreshOverdue(): Promise<void> {
	return await window.electron.ipcRenderer.invoke('tasks:refreshOverdue');
}

// Categories
export async function fetchCategories(): Promise<CategoryJSON[]> {
	return unwrapResult(await window.electron.ipcRenderer.invoke('categories:getAll'));
}
export async function createCategory(params: CategoryCreateParam): Promise<CategoryJSON> {
	return unwrapResult(await window.electron.ipcRenderer.invoke('categories:create', params));
}

export async function updateCategory(params: CategoryUpdateParam): Promise<CategoryJSON> {
	return await window.electron.ipcRenderer.invoke('categories:update', params);
}

export async function deleteCategory(params: CategoryIdParam): Promise<void> {
	return await window.electron.ipcRenderer.invoke('categories:delete', params);
}
// Tags
export async function fetchTags(): Promise<TagJSON[]> {
	return await window.electron.ipcRenderer.invoke('tags:getAll');
}

export async function createTag(params: TagCreateParam): Promise<TagJSON> {
	const result = await window.electron.ipcRenderer.invoke('tags:add', params);
	return unwrapResult(result);
}

export async function updateTag(params: TagUpdateParam): Promise<TagJSON> {
	const { id, ...data } = params;
	const result = await window.electron.ipcRenderer.invoke('tags:update', { id, data });
	return unwrapResult(result);
}

export async function deleteTag(params: TagIdParam): Promise<void> {
	return await window.electron.ipcRenderer.invoke('tags:delete', params);
}
// Helper function: unwrap the Result structure returned by the backend (if any)
// function unwrapResult(res: any) {
// 	if (res && res.error) throw new Error(res.error.message);
// 	return res.ok ? res.value : res;
// }
