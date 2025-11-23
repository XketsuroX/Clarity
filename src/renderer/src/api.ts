export function unwrapResult<T>(res: unknown): T {
	// If preload provided an unwrap helper, delegate to it
	// @ts-ignore
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
