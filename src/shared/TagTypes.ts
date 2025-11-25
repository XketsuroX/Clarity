// 標籤資料型別
export interface TagJSON {
	id: number;
	name: string;
	color?: string;
	createdAt?: string;
	updatedAt?: string;
}

// 參數型別
export interface TagIdParam {
	id: number;
}

export interface TagCreateParam {
	name: string;
	color?: string;
}

export interface TagUpdateParam {
	id: number;
	name?: string;
	color?: string;
}

// 回傳型別
export type TagListResult = TagJSON[];
export type TagResult = TagJSON | null;
