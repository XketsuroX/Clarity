import { ipcMain } from 'electron';
import { tagManager } from './TagManager';
import { TagIdParam, TagUpdateParam, TagCreateParam } from '../shared/TagTypes';

export function registerTagIpcHandlers(): void {
	// 獲取所有標籤
	ipcMain.handle('tags:getAll', async () => {
		return await tagManager.getAllTags();
	});

	// 獲取單個標籤
	ipcMain.handle('tags:getById', async (_, params: TagIdParam) => {
		return await tagManager.getTagById(params.id);
	});

	// 添加標籤
	ipcMain.handle('tags:add', async (_, params: TagCreateParam) => {
		const result = await tagManager.addTag(params.name, params.color);
		return result;
	});

	// 更新標籤
	ipcMain.handle('tags:update', async (_, params: TagIdParam & { data: TagUpdateParam }) => {
		return tagManager.updateTag(params.id, params.data.name, params.data.color);
	});

	// 刪除標籤
	ipcMain.handle('tags:delete', async (_, params: TagIdParam) => {
		tagManager.deleteTag(params.id);
		return { success: true };
	});
}
