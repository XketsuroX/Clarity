import { ipcMain } from 'electron';
import { categoryManager } from './CategoryManager';
import { CategoryCreateParam, CategoryIdParam, CategoryUpdateParam } from '../shared/CategoryTypes';

export function registerCategoryIpcHandlers(): void {
	// 獲取所有分類
	ipcMain.handle('categories:getAll', async () => {
		return await categoryManager.listCategories();
	});

	// 創建分類
	ipcMain.handle('categories:create', async (_, params: CategoryCreateParam) => {
		return await categoryManager.addCategory(params.title);
	});

	// 更新分類名稱
	ipcMain.handle('categories:update', async (_, params: CategoryUpdateParam) => {
		return await categoryManager.renameCategory(params.id, params.newTitle);
	});

	// 刪除分類
	ipcMain.handle('categories:delete', async (_, params: CategoryIdParam) => {
		return await categoryManager.removeCategory(params.id);
	});

	// 獲取單個分類
	ipcMain.handle('categories:get', async (_, params: CategoryIdParam) => {
		return await categoryManager.getCategory(params.id);
	});
}
