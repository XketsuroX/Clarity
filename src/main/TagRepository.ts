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

	async addTag(tag: Tag): Promise<Tag> {
		return this.ormRepository.save(tag);
	}

	async updateTag(tag: Tag): Promise<boolean> {
		const result = await this.ormRepository.update(tag.id, tag);
		return result.affected !== 0;
	}

	async removeTag(id: number): Promise<boolean> {
		const result = await this.ormRepository.delete(id);
		return result.affected !== 0;
	}
}
