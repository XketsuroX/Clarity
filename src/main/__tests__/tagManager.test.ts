import { ITagJSON, ITagJSON, Tag } from '../Tag';
import { TagManager } from '../TagManager';
import { TagRepository } from '../TagRepository';

jest.mock('../TagRepository');

describe('TagManager', () => {
	let manager: TagManager;
	let mockRepo: jest.Mocked<TagRepository>;

	beforeEach(() => {
		manager = new TagManager();
		mockRepo = (manager as any).tagRepository as jest.Mocked<TagRepository>;
		(manager as any).availableTags = [];
	});

	it('should add a tag and update availableTags', async () => {
		const tag = {
			id: 1,
			name: 'Test',
			color: '#000000',
			toJSON: () => ({ id: 1, name: 'Test', color: '#000000' }),
		} as any;
		mockRepo.addTag.mockResolvedValue(tag);

		const result = await manager.addTag('Test', '#000000');
		expect(mockRepo.addTag).toHaveBeenCalledWith('Test', '#000000');
		expect((manager as any).availableTags).toContain(tag);
		expect(result.ok).toBe(true);
		expect(result.value).toEqual({ id: 1, name: 'Test', color: '#000000' });
	});

	it('should update a tag and update availableTags', async () => {
		const tag = {
			id: 2,
			name: 'Old',
			color: '#111111',
			toJSON: () => ({ id: 2, text: 'New', color: '#222222' }),
		} as any;
		(manager as any).availableTags = [tag];
		const updatedTag = {
			id: 2,
			name: 'New',
			color: '#222222',
			toJSON: () => ({ id: 2, name: 'New', color: '#222222' }),
		} as any;
		mockRepo.updateTag.mockResolvedValue(updatedTag);

		const result = await manager.updateTag(2, 'New', '#222222');
		expect(mockRepo.updateTag).toHaveBeenCalledWith(2, { name: 'New', color: '#222222' });
		expect((manager as any).availableTags[0]).toBe(updatedTag);
		expect(result.ok).toBe(true);
		expect(result.value).toEqual({ id: 2, name: 'New', color: '#222222' });
	});

	it('should return error if updateTag not found', async () => {
		mockRepo.updateTag.mockResolvedValue(null);

		const result = await manager.updateTag(999, 'X', '#fff');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toEqual({ code: 'NOT_FOUND', message: 'Tag not found' });
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

	it('should remove a tag and update availableTags', () => {
		(manager as any).availableTags = [
			{ id: 1, name: 'A', color: '#000' },
			{ id: 2, name: 'B', color: '#111' },
		];
		manager.deleteTag(1);
		expect(mockRepo.removeTag).toHaveBeenCalledWith(1);
		expect((manager as any).availableTags).toEqual([{ id: 2, name: 'B', color: '#111' }]);
	});

	it('should get a tag by id', async () => {
		const tag = { id: 5, name: 'Tag5', color: '#555' };
		mockRepo.getTagById.mockResolvedValue(tag);

		const result = await manager.getTagById(5);
		expect(mockRepo.getTagById).toHaveBeenCalledWith(5);
		expect(result).toBe(tag);
	});

	it('should get all tags', async () => {
		const tags: Tag[] = [
			{
				id: 1,
				name: 'A',
				color: '#000',
				toJSON: function (): ITagJSON {
					throw new Error('Function not implemented.');
				},
			},
			{
				id: 2,
				name: 'B',
				color: '#111',
				toJSON: function (): ITagJSON {
					throw new Error('Function not implemented.');
				},
			},
		];
		mockRepo.getAllTags.mockResolvedValue(tags);

		const result = await manager.getAllTags();
		expect(mockRepo.getAllTags).toHaveBeenCalled();
		expect(result).toBe(tags);
	});
});
