import { Repository } from 'typeorm';
import { Category } from './Category';
import { AppDataSource } from './Database';

export class CategoryRepository {
	private readonly ormRepository: Repository<Category>;

	constructor() {
		this.ormRepository = AppDataSource.getRepository(Category);
	}

	async create(title: string): Promise<Category> {
		const category = this.ormRepository.create({ title });
		return this.ormRepository.save(category);
	}

	async findById(id: number): Promise<Category | null> {
		return this.ormRepository.findOneBy({ id });
	}

	async findByName(title: string): Promise<Category | null> {
		return this.ormRepository.findOneBy({ title });
	}

	async findAll(): Promise<Category[]> {
		return this.ormRepository.find({
			order: {
				title: 'ASC',
			},
		});
	}

	async update(id: number, updates: Partial<Category>): Promise<Category | null> {
		const result = await this.ormRepository.update(id, updates);
		if (result.affected === 0 || result.affected === undefined) {
			return null;
		}
		return this.findById(id);
	}

	async delete(id: number): Promise<boolean> {
		const result = await this.ormRepository.delete(id);
		return result.affected !== null && result.affected !== undefined && result.affected > 0;
	}
}
