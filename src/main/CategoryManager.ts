import { CategoryRepository } from './CategoryRepository';
import { type Category, type ICategoryJSON } from './Category';

export class CategoryManager {
	private readonly categoryRepository: CategoryRepository;

	constructor() {
		this.categoryRepository = new CategoryRepository();
	}

	private toJSON(category: Category): ICategoryJSON {
		return {
			id: category.id,
			title: category.title,
		};
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
		return categories.map((c) => this.toJSON(c));
	}

	async addCategory(title: string): Promise<ICategoryJSON> {
		const validatedTitle = await this.validateTitle(title);
		const newCategory = await this.categoryRepository.create(validatedTitle);
		return this.toJSON(newCategory);
	}

	async removeCategory(id: number): Promise<boolean> {
		return this.categoryRepository.delete(id);
	}

	async getCategory(id: number): Promise<ICategoryJSON | null> {
		const category = await this.categoryRepository.findById(id);
		return category ? this.toJSON(category) : null;
	}

	async renameCategory(id: number, newTitle: string): Promise<ICategoryJSON | null> {
		const validatedTitle = await this.validateTitle(newTitle, id);
		const updatedCategory = await this.categoryRepository.update(id, { title: validatedTitle });
		return updatedCategory ? this.toJSON(updatedCategory) : null;
	}
}

export const categoryManager = new CategoryManager();
