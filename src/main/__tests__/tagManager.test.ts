import { Tag } from '../Tag';
import { TagManager } from '../TagManager';
import { TagRepository } from '../TagRepository';

describe('TagManager', () => {
	let manager: TagManager;
	let mockOrmRepo: any;
	let repo: TagRepository;

	beforeEach(() => {
		jest.clearAllMocks();

		mockOrmRepo = {
			find: jest.fn(),
			findOneBy: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			delete: jest.fn(),
			merge: jest.fn((entity, data) => Object.assign(entity, data)),
		};

		repo = new TagRepository(mockOrmRepo);
		manager = new TagManager(repo);
		(manager as any).availableTags = [];
	});

	it('should add a tag and update availableTags', async () => {
		const newTagData = { name: 'TestTag', color: '#123456' };
		const createdTag = {
			id: 1,
			name: 'TestTag',
			color: '#123456',
			toJSON: () => ({ id: 1, name: 'TestTag', color: '#123456' }),
		};
		mockOrmRepo.create.mockReturnValue(createdTag);
		mockOrmRepo.save.mockResolvedValue(createdTag);

		const result = await manager.addTag(newTagData.name, newTagData.color);

		expect(mockOrmRepo.create).toHaveBeenCalledWith({ name: 'TestTag', color: '#123456' });
		expect(mockOrmRepo.save).toHaveBeenCalledWith(createdTag);
		expect((manager as any).availableTags[0]).toBe(createdTag);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toEqual({ id: 1, name: 'TestTag', color: '#123456' });
		}
	});

	it('should update a tag and update availableTags', async () => {
		const oldTag = {
			id: 2,
			name: 'Old',
			color: '#111111',
			toJSON: () => ({ id: 2, name: 'Old', color: '#111111' }),
		};
		(manager as any).availableTags = [oldTag];

		const updatedTag = {
			id: 2,
			name: 'New',
			color: '#222222',
			toJSON: () => ({ id: 2, name: 'New', color: '#222222' }),
		};

		mockOrmRepo.findOneBy.mockResolvedValue(oldTag);
		mockOrmRepo.save.mockResolvedValue(updatedTag);

		const result = await manager.updateTag(2, 'New', '#222222');

		expect(mockOrmRepo.findOneBy).toHaveBeenCalledWith({ id: 2 });
		expect(mockOrmRepo.merge).toHaveBeenCalled();
		expect(mockOrmRepo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'New' }));

		expect((manager as any).availableTags[0]).toEqual(updatedTag);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toEqual({ id: 2, name: 'New', color: '#222222' });
		}
	});

	it('should return error if updateTag not found', async () => {
		mockOrmRepo.findOneBy.mockResolvedValue(null);

		const result = await manager.updateTag(999, 'X', '#fff');

		expect(mockOrmRepo.findOneBy).toHaveBeenCalledWith({ id: 999 });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error?.message).toContain('Tag not found');
		}
	});

	it('should return availableTags via availableTagsList getter', () => {
		(manager as any).availableTags = [{ id: 1, name: 'A', color: '#000' }];
		expect(manager.availableTagsList).toEqual([{ id: 1, name: 'A', color: '#000' }]);
	});

	it('should return the same instance from getInstance', () => {
		const instance1 = TagManager.getInstance();
		const instance2 = TagManager.getInstance();
		expect(instance1).toBe(instance2);
	});

	it('should remove a tag and update availableTags', async () => {
		(manager as any).availableTags = [
			{ id: 1, name: 'A', color: '#000' },
			{ id: 2, name: 'B', color: '#111' },
		];

		mockOrmRepo.delete.mockResolvedValue({ affected: 1 });
		await manager.deleteTag(1);

		expect(mockOrmRepo.delete).toHaveBeenCalledWith(1);
		expect((manager as any).availableTags).toEqual([{ id: 2, name: 'B', color: '#111' }]);
	});

	it('should get a tag by id', async () => {
		const tag = {
			id: 5,
			name: 'Tag5',
			color: '#555',
			toJSON: () => ({ id: 5, name: 'Tag5', color: '#555' }),
		} as any;
		mockOrmRepo.findOneBy.mockResolvedValue(tag);

		const result = await manager.getTagById(5);
		expect(mockOrmRepo.findOneBy).toHaveBeenCalledWith({ id: 5 });
		expect(result).toBe(tag);
	});

	it('should get all tags', async () => {
		const tags: Tag[] = [
			{
				id: 1,
				name: 'A',
				color: '#000',
				toJSON: () => ({ id: 1, name: 'A', color: '#000' }),
			},
			{
				id: 2,
				name: 'B',
				color: '#111',
				toJSON: () => ({ id: 2, name: 'B', color: '#111' }),
			},
		];
		mockOrmRepo.find.mockResolvedValue(tags);

		const result = await manager.getAllTags();
		expect(mockOrmRepo.find).toHaveBeenCalled();
		expect(result).toBe(tags);
	});
});
