export type Result<T> =
	| { ok: true; value: T }
	| { ok: false; error: { code: string; message: string; details?: unknown } };

export class ErrorHandler {
	formatError(err: unknown): { code: string; message: string; details?: unknown } {
		if (!err) return { code: 'UNKNOWN', message: 'Unknown error' };

		// If it's a plain Error instance
		if (err instanceof Error) {
			return { code: 'ERROR', message: err.message, details: { name: err.name } };
		}

		// Fallback - coerce to string
		return { code: 'ERROR', message: String(err) };
	}

	async wrapAsync<T>(fn: () => Promise<T | null>, notFoundMsg = 'Not found'): Promise<Result<T>> {
		try {
			const v = await fn();
			if (v === null)
				return { ok: false, error: { code: 'NOT_FOUND', message: notFoundMsg } };
			return { ok: true, value: v };
		} catch (err) {
			return { ok: false, error: this.formatError(err) };
		}
	}
}
