import { Category } from '../Category';
import { CategoryManager } from '../CategoryManager';
import { CategoryRepository } from '../CategoryRepository';

describe('CategoryManager', () => {
	let manager: CategoryManager;
	let repo: CategoryRepository;
	let mockOrmRepo: any;

	beforeEach(() => {
		jest.clearAllMocks();

		mockOrmRepo = {
			find: jest.fn(),
			findOne: jest.fn(),
			findOneBy: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			delete: jest.fn(),
			update: jest.fn().mockResolvedValue({ affected: 0 }),
			merge: jest.fn((entity, data) => Object.assign(entity, data)),
		};

		repo = new CategoryRepository(mockOrmRepo);
		manager = new CategoryManager(repo);
	});

	it('should add a category after validating title', async () => {
		const catData = { title: 'Work' };
		const createdCat = { id: 1, ...catData, toJSON: () => ({ id: 1, ...catData }) };

		mockOrmRepo.findOneBy.mockResolvedValue(null);
		mockOrmRepo.create.mockReturnValue(createdCat);
		mockOrmRepo.save.mockResolvedValue(createdCat);

		const result = await manager.addCategory('Work');

		expect(mockOrmRepo.findOneBy).toHaveBeenCalledWith({ title: 'Work' });
		expect(mockOrmRepo.create).toHaveBeenCalledWith({ title: 'Work' });
		expect(mockOrmRepo.save).toHaveBeenCalledWith(createdCat);
		expect(result).toEqual(expect.objectContaining({ id: 1, title: 'Work' }));
	});

	it('should throw if title is empty', async () => {
		await expect(manager.addCategory('   ')).rejects.toThrow('Category title cannot be empty.');
		expect(mockOrmRepo.save).not.toHaveBeenCalled();
	});

	it('should throw if category already exists', async () => {
		mockOrmRepo.findOneBy.mockResolvedValue(new Category(2, 'Work'));

		await expect(manager.addCategory('Work')).rejects.toThrow(
			'Category "Work" already exists.'
		);
		expect(mockOrmRepo.save).not.toHaveBeenCalled();
	});

	it('should trim title before adding', async () => {
		const createdCat = new Category(3, 'Work');
		mockOrmRepo.findOneBy.mockResolvedValue(null);
		mockOrmRepo.create.mockReturnValue(createdCat);
		mockOrmRepo.save.mockResolvedValue(createdCat);

		const result = await manager.addCategory('  Work  ');

		expect(mockOrmRepo.findOneBy).toHaveBeenCalledWith({ title: 'Work' });
		expect(mockOrmRepo.create).toHaveBeenCalledWith({ title: 'Work' });
		expect(result).toEqual(expect.objectContaining({ title: 'Work' }));
	});

	it('should remove a category by id', async () => {
		mockOrmRepo.delete.mockResolvedValue({ affected: 1 });

		const result = await manager.removeCategory(1);

		expect(mockOrmRepo.delete).toHaveBeenCalledWith(1);
		expect(result).toBe(true);
	});

	it('should return false if removeCategory fails', async () => {
		mockOrmRepo.delete.mockResolvedValue({ affected: 0 });

		const result = await manager.removeCategory(999);

		expect(mockOrmRepo.delete).toHaveBeenCalledWith(999);
		expect(result).toBe(false);
	});

	it('should list all categories', async () => {
		const categories = [new Category(1, 'Work'), new Category(2, 'Personal')];
		mockOrmRepo.find.mockResolvedValue(categories);

		const result = await manager.listCategories();

		expect(mockOrmRepo.find).toHaveBeenCalled();
		expect(result).toEqual(categories);
	});

	it('should list empty array when no categories exist', async () => {
		mockOrmRepo.find.mockResolvedValue([]);
		const result = await manager.listCategories();
		expect(result).toEqual([]);
	});

	it('should get a category by id', async () => {
		const cat = new Category(1, 'Work');
		mockOrmRepo.findOneBy.mockResolvedValue(cat);

		const result = await manager.getCategory(1);

		expect(mockOrmRepo.findOneBy).toHaveBeenCalledWith({ id: 1 });
		expect(result).toEqual(cat);
	});

	it('should return null if category not found', async () => {
		mockOrmRepo.findOneBy.mockResolvedValue(null);
		const result = await manager.getCategory(999);
		expect(result).toBeNull();
	});

	it('should rename a category', async () => {
		const oldCat = new Category(1, 'Old');
		const updatedCat = new Category(1, 'Updated Work');

		mockOrmRepo.findOneBy.mockResolvedValueOnce(null);
		mockOrmRepo.findOneBy.mockResolvedValueOnce(oldCat);
		mockOrmRepo.update.mockImplementation(async (id: number, data: any) => {
			if (oldCat.id === id) {
				oldCat.title = data.title;
			}
			return { affected: 1 };
		});
		mockOrmRepo.save.mockResolvedValue(updatedCat);

		const result = await manager.renameCategory(1, 'Updated Work');

		expect(mockOrmRepo.findOneBy).toHaveBeenCalledWith({ title: 'Updated Work' });
		expect(result).toMatchObject({ id: 1, title: 'Updated Work' });
	});

	it('should return null if renameCategory fails to find category', async () => {
		mockOrmRepo.findOneBy.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

		const result = await manager.renameCategory(999, 'New Name');
		expect(result).toBeNull();
	});

	it('should throw if renaming to existing category name', async () => {
		mockOrmRepo.findOneBy.mockResolvedValue(new Category(2, 'Work'));

		await expect(manager.renameCategory(1, 'Work')).rejects.toThrow(
			'Category "Work" already exists.'
		);
	});

	it('should allow renaming category to same title (same id)', async () => {
		const self = new Category(1, 'Work');

		mockOrmRepo.findOneBy.mockResolvedValue(self);
		mockOrmRepo.findOne.mockResolvedValue(self);
		mockOrmRepo.update.mockResolvedValue({ affected: 1 });
		mockOrmRepo.save.mockResolvedValue(self);

		const result = await manager.renameCategory(1, 'Work');

		expect(result).toEqual({ id: 1, title: 'Work' });
	});

	it('should handle category with special characters in title', async () => {
		const title = 'Work/Home & Family!';
		mockOrmRepo.findOneBy.mockResolvedValue(null);
		mockOrmRepo.create.mockReturnValue(new Category(1, title));
		mockOrmRepo.save.mockResolvedValue(new Category(1, title));

		const result = await manager.addCategory(title);
		expect(result.title).toBe(title);
	});

	it('should handle very long category title', async () => {
		const longTitle = 'A'.repeat(200);
		mockOrmRepo.findOneBy.mockResolvedValue(null);
		mockOrmRepo.create.mockReturnValue(new Category(1, longTitle));
		mockOrmRepo.save.mockResolvedValue(new Category(1, longTitle));

		const result = await manager.addCategory(longTitle);
		expect(result.title).toBe(longTitle);
	});

	it('should handle unicode characters in category title', async () => {
		const title = '工作 📁';
		mockOrmRepo.findOneBy.mockResolvedValue(null);
		mockOrmRepo.create.mockReturnValue(new Category(1, title));
		mockOrmRepo.save.mockResolvedValue(new Category(1, title));

		const result = await manager.addCategory(title);
		expect(result.title).toBe(title);
	});

	it('should handle case-sensitive duplicate detection', async () => {
		mockOrmRepo.findOneBy.mockResolvedValue(new Category(2, 'work'));

		await expect(manager.addCategory('work')).rejects.toThrow(
			'Category "work" already exists.'
		);
	});

	it('should handle getCategory returning undefined (using optional chaining)', async () => {
		mockOrmRepo.findOneBy.mockResolvedValue(undefined);
		const result = await manager.getCategory(999);
		expect(result).toBeNull();
	});
});
