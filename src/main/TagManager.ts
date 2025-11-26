import { ErrorHandler, Result } from './ErrorHandler';
import { ITagJSON, Tag } from './Tag';
import { TagRepository } from './TagRepository';

export class TagManager {
	private readonly errorHandler: ErrorHandler;
	private static instance: TagManager;
	private tagRepository: TagRepository;
	private availableTags: Tag[];

	private constructor() {
		this.tagRepository = new TagRepository();
		this.availableTags = [];
		this.errorHandler = new ErrorHandler();
	}

	static getInstance(): TagManager {
		if (!TagManager.instance) {
			TagManager.instance = new TagManager();
		}
		return TagManager.instance;
	}

	get availableTagsList(): Tag[] {
		return this.availableTags;
	}

	async getAllTags(): Promise<Tag[]> {
		return await this.tagRepository.getAllTags();
	}

	async getTagById(tagId: number): Promise<Tag | null> {
		return await this.tagRepository.getTagById(tagId);
	}

	async addTag(text: string, color: string): Promise<Result<ITagJSON>> {
		return this.errorHandler.wrapAsync(async () => {
			const newTag = await this.tagRepository.addTag(text, color);
			this.availableTags.push(newTag);
			return newTag.toJSON();
		}, 'Failed to create tag');
	}

	async updateTag(id: number, text?: string, color?: string): Promise<Result<ITagJSON | null>> {
		return this.errorHandler.wrapAsync(async () => {
			const updatedTag = await this.tagRepository.updateTag(id, { text, color });
			// Update in available tags if present
			const index = this.availableTags.findIndex((t) => t.id === id);
			if (index !== -1 && updatedTag) {
				this.availableTags[index] = updatedTag;
			}
			return updatedTag?.toJSON() ?? null;
		}, 'Tag not found');
	}

	deleteTag(tagId: number): void {
		this.tagRepository.removeTag(tagId);
		// Remove from available tags if present
		this.availableTags = this.availableTags.filter((tag) => tag.id !== tagId);
	}
}

// Export a singleton instance
export const tagManager = TagManager.getInstance();
