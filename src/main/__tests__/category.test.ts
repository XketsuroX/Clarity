import { Category } from '../Category';

describe('Category Entity', () => {
	it('should create a category instance', () => {
		const category = new Category();
		category.id = 1;
		category.title = 'Work';
		category.createdAt = new Date('2023-01-01');

		expect(category.id).toBe(1);
		expect(category.title).toBe('Work');
		expect(category.createdAt).toBeInstanceOf(Date);
	});

	it('should return correct JSON structure', () => {
		const category = new Category();
		category.id = 10;
		category.title = 'Hobby';

		const json = category.toJSON();

		expect(json).toEqual({
			id: 10,
			title: 'Hobby',
		});
	});

	it('should allow empty title and still serialize', () => {
		const category = new Category();
		category.id = 11;
		category.title = '';

		expect(category.toJSON()).toEqual({ id: 11, title: '' });
	});
});
