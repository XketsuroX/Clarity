export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: any };

export * from './TaskTypes';
export * from './CategoryTypes';
export * from './SchedulerTypes';
