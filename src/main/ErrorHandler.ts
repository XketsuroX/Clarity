export type Result<T> =
	| { ok: true; value: T }
	| { ok: false; error: { code: string; message: string; details?: any } };

export class ErrorHandler {
	formatError(err: unknown): { code: string; message: string; details?: any } {
		if (!err) return { code: 'UNKNOWN', message: 'Unknown error' };

		const anyErr: any = err as any;
		// If error has code/message structured like SchedulingError
		if (typeof anyErr === 'object' && anyErr !== null && 'code' in anyErr) {
			return {
				code: anyErr.code || 'ERROR',
				message: anyErr.message || String(anyErr),
				details: anyErr.details,
			};
		}

		// For plain Error
		if (anyErr instanceof Error) {
			return { code: 'ERROR', message: anyErr.message, details: { name: anyErr.name } };
		}

		// Fallback
		return { code: 'ERROR', message: String(anyErr) };
	}
}
