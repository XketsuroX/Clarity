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
		mockRepo.findByName.mockResolvedValue(undefined);
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
		// currentId 與查到的 id 相同，應該不拋錯
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
		mockRepo.findByName.mockResolvedValue(undefined);
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
});
