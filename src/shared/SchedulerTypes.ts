// 排程產生的參數
export interface ScheduleGenerateParams {
	capacityHours: number;
	timeUnit?: number;
}

// 排程結果型別
export interface ScheduleItem {
	taskId: number;
	title: string;
	scheduledDuration: number;
	isPartial: boolean;
}

// 排程回傳型別
export type ScheduleResult = ScheduleItem[];
