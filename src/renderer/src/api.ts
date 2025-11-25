export function unwrapResult<T>(res: unknown): T {
	// If preload provided an unwrap helper, delegate to it
	// @ts	-ignore
	if (
		typeof window !== 'undefined' &&
		(window as any).api &&
		typeof (window as any).api.unwrapResult === 'function'
	) {
		// @ts-ignore
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

export interface Tag {
	id: number;
	text: string;
	color: string;
}

export interface Task {
	id: number;
	title: string;
	description: string;
	deadline: string | null;
	completed: boolean;
	priority: number;
	estimateDurationHour: number | null;
	actualDurationHour: number | null;
	tags: Tag[];
	childrenTasks?: Task[];
	state: number;
}

// API functions, wrapping IPC calls
export async function fetchTasks(): Promise<Task[]> {
	const result = await window.electron.ipcRenderer.invoke('tasks:list');
	return unwrapResult(result);
}

export async function createTask(task: Partial<Task>): Promise<Task> {
	const result = await window.electron.ipcRenderer.invoke('tasks:add', task);
	return unwrapResult(result);
}

export async function toggleTaskComplete(id: number, completed: boolean): Promise<Task> {
	// Here we assume the backend update supports partial fields
	const result = await window.electron.ipcRenderer.invoke('tasks:update', id, { completed });
	return unwrapResult(result);
}

export async function generateSchedule(hours: number): Promise<any[]> {
	const result = await window.electron.ipcRenderer.invoke('schedule:generate', hours);
	return unwrapResult(result);
}

// Helper function: unwrap the Result structure returned by the backend (if any)
// function unwrapResult(res: any) {
// 	if (res && res.error) throw new Error(res.error.message);
// 	return res.ok ? res.value : res;
// }
