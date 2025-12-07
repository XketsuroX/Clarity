import { Tag } from '../Tag';

describe('Tag Entity', () => {
	it('should create a tag with default color', () => {
		const tag = new Tag('Defaulted');
		tag.id = 11;

		expect(tag.color).toBe('#000000');
		expect(tag.toJSON()).toEqual({ id: 11, name: 'Defaulted', color: '#000000' });
	});

	it('should return correct JSON structure', () => {
		const tag = new Tag('JSON Tag', '#FF0000');
		tag.id = 1;
		const json = tag.toJSON();
		expect(json).toEqual({
			id: 1,
			name: 'JSON Tag',
			color: '#FF0000',
		});
	});
});
