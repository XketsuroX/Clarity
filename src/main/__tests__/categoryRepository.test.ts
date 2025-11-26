import { CategoryRepository } from '../CategoryRepository';
import { Category, ICategoryJSON } from '../Category';

describe('CategoryRepository', () => {
	let repo: CategoryRepository;
	let mockOrmRepo: any;

	beforeEach(() => {
		mockOrmRepo = {
			create: jest.fn(),
			save: jest.fn(),
			find: jest.fn(),
			findOneBy: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		};
		repo = new CategoryRepository();
		// 假設你的 CategoryRepository 有 ormRepository 屬性
		(repo as any).ormRepository = mockOrmRepo;
	});

	it('should create and save a category', async () => {
		const category = { id: 1, title: 'Test' } as Category;
		mockOrmRepo.create.mockReturnValue(category);
		mockOrmRepo.save.mockResolvedValue(category);

		const result = await repo.create('Test');
		expect(mockOrmRepo.create).toHaveBeenCalledWith({ title: 'Test' });
		expect(mockOrmRepo.save).toHaveBeenCalledWith(category);
		expect(result).toBe(category);
	});

	it('should find all categories', async () => {
		const categories: Category[] = [
			{
				id: 1,
				title: 'A',
				createdAt: new Date(),
				tasks: [],
				toJSON: function (): ICategoryJSON {
					throw new Error('Function not implemented.');
				},
			},
			{
				id: 2,
				title: 'B',
				createdAt: new Date(),
				tasks: [],
				toJSON: function (): ICategoryJSON {
					throw new Error('Function not implemented.');
				},
			},
		];
		mockOrmRepo.find.mockResolvedValue(categories);

		const result = await repo.findAll();
		expect(mockOrmRepo.find).toHaveBeenCalled();
		expect(result).toBe(categories);
	});

	it('should find category by id', async () => {
		const category = { id: 1, title: 'A' } as Category;
		mockOrmRepo.findOneBy.mockResolvedValue(category);

		const result = await repo.findById(1);
		expect(mockOrmRepo.findOneBy).toHaveBeenCalledWith({ id: 1 });
		expect(result).toBe(category);
	});

	it('should find category by name', async () => {
		const category = { id: 1, title: 'Test' } as Category;
		mockOrmRepo.findOneBy.mockResolvedValue(category);

		const result = await repo.findByName('Test');
		expect(mockOrmRepo.findOneBy).toHaveBeenCalledWith({ title: 'Test' });
		expect(result).toBe(category);
	});

	it('should update a category and return updated entity', async () => {
		const updatedCategory = { id: 1, title: 'Updated' } as Category;
		mockOrmRepo.update.mockResolvedValue({ affected: 1 });
		jest.spyOn(CategoryRepository.prototype, 'findById').mockResolvedValue(updatedCategory);

		const result = await repo.update(1, { title: 'Updated' });
		expect(mockOrmRepo.update).toHaveBeenCalledWith(1, { title: 'Updated' });
		expect(result).toBe(updatedCategory);
	});

	it('should return null if update did not affect any row', async () => {
		mockOrmRepo.update.mockResolvedValue({ affected: 0 });

		const result = await repo.update(1, { title: 'Updated' });
		expect(result).toBeNull();
	});

	it('should return true if delete affected rows', async () => {
		mockOrmRepo.delete.mockResolvedValue({ affected: 1 });

		const result = await repo.delete(1);
		expect(mockOrmRepo.delete).toHaveBeenCalledWith(1);
		expect(result).toBe(true);
	});

	it('should return false if delete did not affect any row', async () => {
		mockOrmRepo.delete.mockResolvedValue({ affected: 0 });

		const result = await repo.delete(1);
		expect(result).toBe(false);
	});
});
