// 分類資料型別
export interface CategoryJSON {
	id: number;
	title: string;
	createdAt?: string;
	updatedAt?: string;
}

// 參數型別
export interface CategoryIdParam {
	id: number;
}

export interface CategoryCreateParam {
	title: string;
}

export interface CategoryUpdateParam {
	id: number;
	newTitle: string;
}

// 回傳型別
export type CategoryListResult = CategoryJSON[];
export type CategoryResult = CategoryJSON | null;
