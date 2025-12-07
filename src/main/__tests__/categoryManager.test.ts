import { CategoryManager } from '../CategoryManager';
import { CategoryRepository } from '../CategoryRepository';

jest.mock('../CategoryRepository');

describe('CategoryManager', () => {
	let manager: CategoryManager;
	let mockRepo: jest.Mocked<CategoryRepository>;

	beforeEach(() => {
		manager = new CategoryManager();
		mockRepo = (manager as any).categoryRepository as jest.Mocked<CategoryRepository>;
	});

	it('should add a category after validating title', async () => {
		mockRepo.findByName.mockResolvedValue(null);
		mockRepo.create.mockResolvedValue({
			id: 1,
			title: 'Work',
			toJSON: () => ({ id: 1, title: 'Work' }),
		} as any);

		const result = await manager.addCategory('Work');
		expect(mockRepo.findByName).toHaveBeenCalledWith('Work');
		expect(mockRepo.create).toHaveBeenCalledWith('Work');
		expect(result).toEqual({ id: 1, title: 'Work' });
	});

	it('should throw if title is empty', async () => {
		await expect(manager.addCategory('   ')).rejects.toThrow('Category title cannot be empty.');
	});

	it('should allow same title if editing the same category', async () => {
		mockRepo.findByName.mockResolvedValue({ id: 5, title: 'Work' } as any);
		// currentId ?‡æŸ¥?°ç? id ?¸å?ï¼Œæ?è©²ä??‹éŒ¯
		const managerAny = manager as any;
		await expect(managerAny.validateTitle('Work', 5)).resolves.toBe('Work');
	});

	it('should throw if category already exists', async () => {
		mockRepo.findByName.mockResolvedValue({ id: 2, title: 'Work' } as any);
		await expect(manager.addCategory('Work')).rejects.toThrow(
			'Category "Work" already exists.'
		);
	});

	it('should throw if another category with same title exists', async () => {
		mockRepo.findByName.mockResolvedValue({ id: 6, title: 'Work' } as any);
		const managerAny = manager as any;
		await expect(managerAny.validateTitle('Work', 7)).rejects.toThrow(
			'Category "Work" already exists.'
		);
	});

	it('should throw if title is only whitespace', async () => {
		const managerAny = manager as any;
		await expect(managerAny.validateTitle('   ')).rejects.toThrow(
			'Category title cannot be empty.'
		);
	});

	it('should trim title before adding', async () => {
		mockRepo.findByName.mockResolvedValue(null);
		mockRepo.create.mockResolvedValue({
			id: 3,
			title: 'Work',
			toJSON: () => ({ id: 3, title: 'Work' }),
		} as any);

		const result = await manager.addCategory('  Work  ');
		expect(mockRepo.findByName).toHaveBeenCalledWith('Work');
		expect(mockRepo.create).toHaveBeenCalledWith('Work');
		expect(result).toEqual({ id: 3, title: 'Work' });
	});

	it('should remove a category by id', async () => {
		mockRepo.delete.mockResolvedValue(true);

		const result = await manager.removeCategory(1);
		expect(mockRepo.delete).toHaveBeenCalledWith(1);
		expect(result).toBe(true);
	});

	it('should return false if removeCategory fails', async () => {
		mockRepo.delete.mockResolvedValue(false);

		const result = await manager.removeCategory(999);
		expect(mockRepo.delete).toHaveBeenCalledWith(999);
		expect(result).toBe(false);
	});

	it('should list all categories', async () => {
		const categories = [
			{ id: 1, title: 'Work', toJSON: () => ({ id: 1, title: 'Work' }) },
			{ id: 2, title: 'Personal', toJSON: () => ({ id: 2, title: 'Personal' }) },
		];
		mockRepo.findAll.mockResolvedValue(categories as any);

		const result = await manager.listCategories();
		expect(mockRepo.findAll).toHaveBeenCalled();
		expect(result).toEqual([
			{ id: 1, title: 'Work' },
			{ id: 2, title: 'Personal' },
		]);
	});

	it('should list empty array when no categories exist', async () => {
		mockRepo.findAll.mockResolvedValue([]);

		const result = await manager.listCategories();
		expect(mockRepo.findAll).toHaveBeenCalled();
		expect(result).toEqual([]);
	});

	it('should get a category by id', async () => {
		mockRepo.findById.mockResolvedValue({
			id: 1,
			title: 'Work',
			toJSON: () => ({ id: 1, title: 'Work' }),
		} as any);

		const result = await manager.getCategory(1);
		expect(mockRepo.findById).toHaveBeenCalledWith(1);
		expect(result).toEqual({ id: 1, title: 'Work' });
	});

	it('should return null if category not found', async () => {
		mockRepo.findById.mockResolvedValue(null);

		const result = await manager.getCategory(999);
		expect(mockRepo.findById).toHaveBeenCalledWith(999);
		expect(result).toBeNull();
	});

	it('should rename a category', async () => {
		mockRepo.findByName.mockResolvedValue(null);
		mockRepo.update.mockResolvedValue({
			id: 1,
			title: 'Updated Work',
			toJSON: () => ({ id: 1, title: 'Updated Work' }),
		} as any);

		const result = await manager.renameCategory(1, 'Updated Work');
		expect(mockRepo.findByName).toHaveBeenCalledWith('Updated Work');
		expect(mockRepo.update).toHaveBeenCalledWith(1, { title: 'Updated Work' });
		expect(result).toEqual({ id: 1, title: 'Updated Work' });
	});

	it('should return null if renameCategory fails to find category', async () => {
		mockRepo.findByName.mockResolvedValue(null);
		mockRepo.update.mockResolvedValue(null);

		const result = await manager.renameCategory(999, 'New Name');
		expect(mockRepo.update).toHaveBeenCalledWith(999, { title: 'New Name' });
		expect(result).toBeNull();
	});

	it('should trim title before renaming', async () => {
		mockRepo.findByName.mockResolvedValue(null);
		mockRepo.update.mockResolvedValue({
			id: 1,
			title: 'Trimmed',
			toJSON: () => ({ id: 1, title: 'Trimmed' }),
		} as any);

		const result = await manager.renameCategory(1, '  Trimmed  ');
		expect(mockRepo.findByName).toHaveBeenCalledWith('Trimmed');
		expect(mockRepo.update).toHaveBeenCalledWith(1, { title: 'Trimmed' });
		expect(result).toEqual({ id: 1, title: 'Trimmed' });
	});

	it('should throw if renaming to empty title', async () => {
		await expect(manager.renameCategory(1, '   ')).rejects.toThrow(
			'Category title cannot be empty.'
		);
	});

	it('should throw if renaming to existing category name', async () => {
		mockRepo.findByName.mockResolvedValue({ id: 2, title: 'Work' } as any);

		await expect(manager.renameCategory(1, 'Work')).rejects.toThrow(
			'Category "Work" already exists.'
		);
	});

	it('should allow renaming category to same title (same id)', async () => {
		mockRepo.findByName.mockResolvedValue({ id: 1, title: 'Work' } as any);
		mockRepo.update.mockResolvedValue({
			id: 1,
			title: 'Work',
			toJSON: () => ({ id: 1, title: 'Work' }),
		} as any);

		const result = await manager.renameCategory(1, 'Work');
		expect(result).toEqual({ id: 1, title: 'Work' });
	});

	// ===== Edge Cases =====

	it('should handle category with special characters in title', async () => {
		mockRepo.findByName.mockResolvedValue(null);
		mockRepo.create.mockResolvedValue({
			id: 1,
			title: 'Work/Home & Family!',
			toJSON: () => ({ id: 1, title: 'Work/Home & Family!' }),
		} as any);

		const result = await manager.addCategory('Work/Home & Family!');
		expect(result).toEqual({ id: 1, title: 'Work/Home & Family!' });
	});

	it('should handle very long category title', async () => {
		const longTitle = 'A'.repeat(200);
		mockRepo.findByName.mockResolvedValue(null);
		mockRepo.create.mockResolvedValue({
			id: 1,
			title: longTitle,
			toJSON: () => ({ id: 1, title: longTitle }),
		} as any);

		const result = await manager.addCategory(longTitle);
		expect(result.title).toBe(longTitle);
	});

	it('should handle category title with only spaces inside', async () => {
		mockRepo.findByName.mockResolvedValue(null);
		mockRepo.create.mockResolvedValue({
			id: 1,
			title: 'A B C',
			toJSON: () => ({ id: 1, title: 'A B C' }),
		} as any);

		const result = await manager.addCategory('A B C');
		expect(result.title).toBe('A B C');
	});

	it('should handle unicode characters in category title', async () => {
		mockRepo.findByName.mockResolvedValue(null);
		mockRepo.create.mockResolvedValue({
			id: 1,
			title: 'å·¥ä? ??',
			toJSON: () => ({ id: 1, title: 'å·¥ä? ??' }),
		} as any);

		const result = await manager.addCategory('å·¥ä? ??');
		expect(result.title).toBe('å·¥ä? ??');
	});

	it('should handle category title with leading/trailing newlines', async () => {
		mockRepo.findByName.mockResolvedValue(null);
		mockRepo.create.mockResolvedValue({
			id: 1,
			title: 'Work',
			toJSON: () => ({ id: 1, title: 'Work' }),
		} as any);

		const result = await manager.addCategory('\n\nWork\n\n');
		expect(mockRepo.findByName).toHaveBeenCalledWith('Work');
		expect(result.title).toBe('Work');
	});

	it('should handle category title with tabs', async () => {
		mockRepo.findByName.mockResolvedValue(null);
		mockRepo.create.mockResolvedValue({
			id: 1,
			title: 'Work',
			toJSON: () => ({ id: 1, title: 'Work' }),
		} as any);

		const result = await manager.addCategory('\t\tWork\t\t');
		expect(mockRepo.findByName).toHaveBeenCalledWith('Work');
		expect(result.title).toBe('Work');
	});

	it('should handle removeCategory with id = 0', async () => {
		mockRepo.delete.mockResolvedValue(true);

		const result = await manager.removeCategory(0);
		expect(mockRepo.delete).toHaveBeenCalledWith(0);
		expect(result).toBe(true);
	});

	it('should handle negative id in removeCategory', async () => {
		mockRepo.delete.mockResolvedValue(false);

		const result = await manager.removeCategory(-1);
		expect(mockRepo.delete).toHaveBeenCalledWith(-1);
		expect(result).toBe(false);
	});

	it('should handle getCategory with id = 0', async () => {
		mockRepo.findById.mockResolvedValue({
			id: 0,
			title: 'Default',
			toJSON: () => ({ id: 0, title: 'Default' }),
		} as any);

		const result = await manager.getCategory(0);
		expect(result).toEqual({ id: 0, title: 'Default' });
	});

	it('should handle renameCategory with id = 0', async () => {
		mockRepo.findByName.mockResolvedValue(null);
		mockRepo.update.mockResolvedValue({
			id: 0,
			title: 'Renamed',
			toJSON: () => ({ id: 0, title: 'Renamed' }),
		} as any);

		const result = await manager.renameCategory(0, 'Renamed');
		expect(result).toEqual({ id: 0, title: 'Renamed' });
	});

	it('should handle case-sensitive duplicate detection', async () => {
		mockRepo.findByName.mockResolvedValue({ id: 2, title: 'work' } as any);

		await expect(manager.addCategory('work')).rejects.toThrow(
			'Category "work" already exists.'
		);
	});

	it('should handle title with mixed whitespace types', async () => {
		mockRepo.findByName.mockResolvedValue(null);
		mockRepo.create.mockResolvedValue({
			id: 1,
			title: 'Work',
			toJSON: () => ({ id: 1, title: 'Work' }),
		} as any);

		const result = await manager.addCategory(' \t\n Work \n\t ');
		expect(mockRepo.findByName).toHaveBeenCalledWith('Work');
		expect(result.title).toBe('Work');
	});

	it('should handle single character category title', async () => {
		mockRepo.findByName.mockResolvedValue(null);
		mockRepo.create.mockResolvedValue({
			id: 1,
			title: 'A',
			toJSON: () => ({ id: 1, title: 'A' }),
		} as any);

		const result = await manager.addCategory('A');
		expect(result.title).toBe('A');
	});

	it('should handle empty string after trim', async () => {
		await expect(manager.addCategory('\n\t  \t\n')).rejects.toThrow(
			'Category title cannot be empty.'
		);
	});

	it('should handle getCategory returning undefined (using optional chaining)', async () => {
		mockRepo.findById.mockResolvedValue(undefined as any);

		const result = await manager.getCategory(999);
		expect(result).toBeNull();
	});
});
