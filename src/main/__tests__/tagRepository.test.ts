import { TagRepository } from '../TagRepository';
import { Tag } from '../Tag';

describe('TagRepository', () => {
	let repo: TagRepository;
	let mockOrmRepo: any;

	beforeEach(() => {
		mockOrmRepo = {
			find: jest.fn(),
			findOneBy: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			merge: jest.fn(),
			delete: jest.fn(),
		};
		repo = new TagRepository();
		// @ts-ignore
		repo.ormRepository = mockOrmRepo;
	});

	it('should get all tags', async () => {
		const tags = [
			{ id: 1, name: 'A', color: '#000000' },
			{ id: 2, name: 'B', color: '#ffffff' },
		];
		mockOrmRepo.find.mockResolvedValue(tags);

		const result = await repo.getAllTags();
		expect(mockOrmRepo.find).toHaveBeenCalled();
		expect(result).toBe(tags);
	});

	it('should get tag by id', async () => {
		const tag = { id: 1, name: 'A', color: '#000000' };
		mockOrmRepo.findOneBy.mockResolvedValue(tag);

		const result = await repo.getTagById(1);
		expect(mockOrmRepo.findOneBy).toHaveBeenCalledWith({ id: 1 });
		expect(result).toBe(tag);
	});

	it('should add a tag', async () => {
		const tag = { id: 1, name: 'A', color: '#000000' };
		mockOrmRepo.create.mockReturnValue(tag);
		mockOrmRepo.save.mockResolvedValue(tag);

		const result = await repo.addTag('A', '#000000');
		expect(mockOrmRepo.create).toHaveBeenCalledWith({ name: 'A', color: '#000000' });
		expect(mockOrmRepo.save).toHaveBeenCalledWith(tag);
		expect(result).toBe(tag);
	});

	it('should update a tag', async () => {
		const tag = { id: 1, name: 'A', color: '#000000' };
		const updatedTag = { id: 1, name: 'B', color: '#ffffff' };
		jest.spyOn(repo, 'getTagById').mockResolvedValue(tag as Tag);
		mockOrmRepo.merge.mockImplementation((t, data) => Object.assign(t, data));
		mockOrmRepo.save.mockResolvedValue(updatedTag);

		const result = await repo.updateTag(1, { name: 'B', color: '#ffffff' });
		expect(repo.getTagById).toHaveBeenCalledWith(1);
		expect(mockOrmRepo.merge).toHaveBeenCalledWith(tag, { name: 'B', color: '#ffffff' });
		expect(mockOrmRepo.save).toHaveBeenCalledWith(tag);
		expect(result).toBe(updatedTag);
	});

	it('should return null if updateTag not found', async () => {
		jest.spyOn(repo, 'getTagById').mockResolvedValue(null);

		const result = await repo.updateTag(999, { name: 'X' });
		expect(result).toBeNull();
	});

	it('should remove a tag', async () => {
		mockOrmRepo.delete.mockResolvedValue({ affected: 1 });

		const result = await repo.removeTag(1);
		expect(mockOrmRepo.delete).toHaveBeenCalledWith(1);
		expect(result).toBe(true);
	});

	it('should return false if removeTag did not affect any row', async () => {
		mockOrmRepo.delete.mockResolvedValue({ affected: 0 });

		const result = await repo.removeTag(1);
		expect(result).toBe(false);
	});
});
