import { Repository } from 'typeorm';
import { AppDataSource } from './Database';
import { Tag } from './Tag';

export class TagRepository {
	private ormRepository: Repository<Tag>;

	constructor() {
		this.ormRepository = AppDataSource.getRepository(Tag);
	}

	async getAllTags(): Promise<Tag[]> {
		return this.ormRepository.find();
	}

	async getTagById(id: number): Promise<Tag | null> {
		return this.ormRepository.findOneBy({ id });
	}
	async addTag(name: string, color: string): Promise<Tag> {
		const tag = this.ormRepository.create({ name: name, color });
		return this.ormRepository.save(tag);
	}

	async updateTag(id: number, data: { name?: string; color?: string }): Promise<Tag | null> {
		const tagToUpdate = await this.getTagById(id);
		if (!tagToUpdate) {
			return null;
		}
		this.ormRepository.merge(tagToUpdate, data);
		return this.ormRepository.save(tagToUpdate);
	}

	async removeTag(id: number): Promise<boolean> {
		const result = await this.ormRepository.delete(id);
		return result.affected !== 0;
	}
}
