import { contextBridge } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

// Custom APIs for renderer
const api: Record<string, unknown> = {};

// Helper to unwrap Result<T> objects from main process
// Expected runtime shape: { ok: true, value } | { ok: false, error: { message, code } }
api.unwrapResult = function (res: unknown) {
	try {
		if (res && typeof res === 'object' && 'ok' in (res as any)) {
			const r = res as any;
			if (r.ok) return r.value;
			const err = r.error ?? {};
			const msg = err.message ?? err.code ?? 'Unknown error';
			throw new Error(msg);
		}
		return res;
	} catch (e) {
		// Surface as string for renderer
		throw e instanceof Error ? e : new Error(String(e));
	}
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
	try {
		contextBridge.exposeInMainWorld('electron', electronAPI);
		contextBridge.exposeInMainWorld('api', api);
	} catch (error) {
		console.error(error);
	}
} else {
	// @ts-ignore (define in dts)
	window.electron = electronAPI;
	// @ts-ignore (define in dts)
	window.api = api;
}
