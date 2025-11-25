import { ipcMain } from 'electron';
import { categoryManager } from './CategoryManager';

export function registerCategoryIpcHandlers(): void {
	// 獲取所有分類
	ipcMain.handle('categories:getAll', async () => {
		return await categoryManager.listCategories();
	});

	// 創建分類
	ipcMain.handle('categories:create', async (_, title: string) => {
		return await categoryManager.addCategory(title);
	});

	// 更新分類名稱
	ipcMain.handle('categories:update', async (_, id: number, newTitle: string) => {
		return await categoryManager.renameCategory(id, newTitle);
	});

	// 刪除分類
	ipcMain.handle('categories:delete', async (_, id: number) => {
		return await categoryManager.removeCategory(id);
	});

	// 獲取單個分類
	ipcMain.handle('categories:get', async (_, id: number) => {
		return await categoryManager.getCategory(id);
	});
}
