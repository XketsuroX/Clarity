import { Tag } from '../Tag';

describe('Tag Entity', () => {
	it('should create a tag with default color', () => {
		const tag = new Tag('My Tag');

		expect(tag.id).toBe(1);
		expect(tag.name).toBe('My Tag');
		expect(tag.color).toBe('#000000');
	});

	it('should return correct JSON structure', () => {
		const tag = new Tag('JSON Tag', '#FF0000');
		const json = tag.toJSON();

		expect(json).toEqual({
			id: 1,
			name: 'JSON Tag',
			color: '#FF0000',
		});
	});
});
