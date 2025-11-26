import { ipcMain } from 'electron';
import { tagManager } from './TagManager';

export function registerTagIpcHandlers(): void {
	// 獲取所有標籤
	ipcMain.handle('tags:getAll', async () => {
		return await tagManager.getAllTags();
	});

	// 獲取單個標籤
	ipcMain.handle('tags:getById', async (_, tagId: number) => {
		return await tagManager.getTagById(tagId);
	});

	// 添加標籤
	ipcMain.handle('tags:add', async (_, tagData: { text: string; color: string }) => {
		const result = await tagManager.addTag(tagData.text, tagData.color);
		return result;
	});

	// 更新標籤
	ipcMain.handle(
		'tags:update',
		async (_, tagData: { id: number; text?: string; color?: string }) => {
			return tagManager.updateTag(tagData.id, tagData.text, tagData.color);
		}
	);

	// 刪除標籤
	ipcMain.handle('tags:delete', async (_, tagId: number) => {
		tagManager.deleteTag(tagId);
		return { success: true };
	});
}
