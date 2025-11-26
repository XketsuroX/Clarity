import { Tag } from '../Tag';

describe('Tag Entity', () => {
	it('should create a tag with default color', () => {
		const tag = new Tag('My Tag');

		expect(tag.id).toBe(1);
		expect(tag.text).toBe('My Tag');
		expect(tag.color).toBe('#000000');
	});

	it('should rename the tag', () => {
		const tag = new Tag('Old Name');
		tag.rename('New Name');

		expect(tag.text).toBe('New Name');
	});

	it('should change color', () => {
		const tag = new Tag('Tag');
		tag.changeColor('#FFFFFF');

		expect(tag.color).toBe('#FFFFFF');
	});

	it('should return correct JSON structure', () => {
		const tag = new Tag('JSON Tag', '#FF0000');
		const json = tag.toJSON();

		expect(json).toEqual({
			id: 1,
			text: 'JSON Tag',
			color: '#FF0000',
		});
	});
});
