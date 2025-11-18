import { Tag } from './Tag';
import { TagRepository } from './TagRepository';

export class TagManager {
	private static instance: TagManager;
	private tagRepository: TagRepository;
	private availableTags: Tag[];

	private constructor() {
		this.tagRepository = new TagRepository();
		this.availableTags = [];
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

	getAllTags(): Tag[] {
		return this.tagRepository.getAllTags();
	}

	getTagById(tagId: number): Tag | undefined {
		return this.tagRepository.getTagById(tagId);
	}

	addTag(tag: Tag): void {
		this.tagRepository.addTag(tag);
		this.availableTags.push(tag);
	}

	updateTag(tag: Tag): void {
		this.tagRepository.updateTag(tag);
		// Update in available tags if present
		const index = this.availableTags.findIndex((t) => t.id === tag.id);
		if (index !== -1) {
			this.availableTags[index] = tag;
		}
	}

	deleteTag(tagId: number): void {
		this.tagRepository.deleteTag(tagId);
		// Remove from available tags if present
		this.availableTags = this.availableTags.filter((tag) => tag.id !== tagId);
	}
}

// Export a singleton instance
export const tagManager = TagManager.getInstance();
