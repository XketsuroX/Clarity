import { Category } from '../Category';

describe('Category Entity', () => {
	it('should create a category instance', () => {
		const category = new Category(1, 'Work');
		category.createdAt = new Date('2025-01-01');

		expect(category.id).toBe(1);
		expect(category.title).toBe('Work');
		expect(category.createdAt).toBeInstanceOf(Date);
	});

	it('should return correct JSON structure', () => {
		const category = new Category(10, 'Hobby');

		const json = category.toJSON();

		expect(json).toEqual({
			id: 10,
			title: 'Hobby',
		});
	});

	it('should allow empty title and still serialize', () => {
		const category = new Category(11, '');
		expect(category.toJSON()).toEqual({ id: 11, title: '' });
	});
});
