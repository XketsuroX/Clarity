// 任務資料型別（根據你的 Task 結構調整）
export interface TaskJSON {
	id: number;
	title: string;
	description?: string;
	deadline?: string; // ISO 字串
	completed: boolean;
	completeness?: number;
	estimateDurationHour?: number;
	actualDurationHour?: number;
	priority?: number;
	categoryId?: number;
	tagIds?: number[];
	createdAt?: string;
	updatedAt?: string;
	childrenTaskIds: number[];
	parentTaskId?: number | null;
	state: string;
	isSplittable: boolean;
}

// 參數型別
export interface TaskAddParams {
	title: string;
	description?: string;
	deadline?: string;
	estimateDurationHour: number;
	priority?: number;
	categoryId?: number;
	tagIds?: number[];
	parentTaskId?: number;
}

export interface TaskUpdateParams {
	title?: string;
	description?: string;
	deadline?: string | null;
	estimateDurationHour?: number;
	priority?: number;
	categoryId?: number | null;
	tagIds?: number[];
	parentTaskId?: number | null;
}

// 查詢、刪除等常用參數
export interface TaskIdParam {
	taskId: number;
}

export interface TaskQueryParams {
	completed?: boolean;
	categoryId?: number;
	tagId?: number;
	search?: string;
}

// 平均工時差值回傳型別
export interface TaskAvgActualVsEstimated {
	avgDeltaHour: number | null;
	avgDeltaPercent: number | null;
	count: number;
}

// 單一任務工時差值回傳型別
export interface TaskActualVsEstimated {
	estimatedDurationHour: number | null;
	actualDurationHour: number | null;
	deltaHour: number | null;
	deltaPercent: number | null;
}
