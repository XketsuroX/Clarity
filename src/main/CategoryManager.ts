import { Category, ICategoryJSON } from './Category';

export class CategoryManager {
	private static instance: CategoryManager;
	private categories: Map<number, Category>;
	private nextId: number;

	private constructor() {
		this.categories = new Map();
		this.nextId = 1;
	}

	static getInstance(): CategoryManager {
		if (!CategoryManager.instance) {
			CategoryManager.instance = new CategoryManager();
		}
		return CategoryManager.instance;
	}

	listCategories(): ICategoryJSON[] {
		return Array.from(this.categories.values()).map((c) => c.toJSON());
	}

	addCategory(title: string): ICategoryJSON {
		const id = this.nextId++;
		const category = new Category(id, title);
		this.categories.set(id, category);
		return category.toJSON();
	}

	removeCategory(id: number): boolean {
		return this.categories.delete(id);
	}

	getCategory(id: number): ICategoryJSON | null {
		const category = this.categories.get(id);
		return category ? category.toJSON() : null;
	}

	renameCategory(id: number, newTitle: string): ICategoryJSON | null {
		const category = this.categories.get(id);
		if (!category) return null;

		category.rename(newTitle);
		return category.toJSON();
	}
}

// Export a single instance (CategoryManager singleton) to be used by main process
export const categoryManager = CategoryManager.getInstance();
