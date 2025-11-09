import { Tag, ITagJSON } from './Tag'

export class TagRepository {
    private tags: Map<number, Tag>

    constructor() {
        this.tags = new Map()
    }

    getAllTags(): Tag[] {
        return Array.from(this.tags.values())
    }

    getTagById(tagId: number): Tag | undefined {
        return this.tags.get(tagId)
    }

    addTag(tag: Tag): void {
        this.tags.set(tag.id, tag)
    }

    updateTag(tag: Tag): void {
        if (this.tags.has(tag.id)) {
            this.tags.set(tag.id, tag)
        }
    }

    deleteTag(tagId: number): void {
        this.tags.delete(tagId)
    }
}