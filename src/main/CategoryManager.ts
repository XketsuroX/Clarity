import { CategoryRepository } from './CategoryRepository';
import { type ICategoryJSON } from './Category';

export class CategoryManager {
	private readonly categoryRepository: CategoryRepository;

	constructor() {
		this.categoryRepository = new CategoryRepository();
	}

	private async validateTitle(title: string, currentId?: number): Promise<string> {
		const trimmedTitle = title.trim();

		if (trimmedTitle === '') {
			throw new Error('Category title cannot be empty.');
		}

		const existingCategory = await this.categoryRepository.findByName(trimmedTitle);

		if (existingCategory && existingCategory.id !== currentId) {
			throw new Error(`Category "${trimmedTitle}" already exists.`);
		}

		return trimmedTitle;
	}

	async listCategories(): Promise<ICategoryJSON[]> {
		const categories = await this.categoryRepository.findAll();
		return categories.map((c) => c.toJSON());
	}

	async addCategory(title: string): Promise<ICategoryJSON> {
		const validatedTitle = await this.validateTitle(title);
		const newCategory = await this.categoryRepository.create(validatedTitle);
		return newCategory.toJSON();
	}

	async removeCategory(id: number): Promise<boolean> {
		return this.categoryRepository.delete(id);
	}

	async getCategory(id: number): Promise<ICategoryJSON | null> {
		const category = await this.categoryRepository.findById(id);
		return category?.toJSON() ?? null;
	}

	async renameCategory(id: number, newTitle: string): Promise<ICategoryJSON | null> {
		const validatedTitle = await this.validateTitle(newTitle, id);
		const updatedCategory = await this.categoryRepository.update(id, { title: validatedTitle });
		return updatedCategory?.toJSON() ?? null;
	}
}

export const categoryManager = new CategoryManager();
