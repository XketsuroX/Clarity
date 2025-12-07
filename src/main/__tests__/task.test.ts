import { Task } from '../Task';
import { Category } from '../Category';
import { Tag } from '../Tag';

const iso = (d: Date) => d.toISOString();

describe('Task entity', () => {
	it('should serialize all fields with relationships', () => {
		const task = new Task();
		task.id = 1;
		task.title = 'T1';
		task.description = 'desc';
		const deadline = new Date('2025-12-31T12:00:00Z');
		const startDate = new Date('2025-12-01T08:00:00Z');
		const actualStartDate = new Date('2025-12-02T09:00:00Z');
		const actualEndDate = new Date('2025-12-03T10:00:00Z');
		task.deadline = deadline;
		task.startDate = startDate;
		task.actualStartDate = actualStartDate;
		task.actualEndDate = actualEndDate;
		task.completed = true;
		task.state = 'Completed';
		task.category = { id: 10 } as Category;
		task.priority = 3;
		task.estimateDurationHour = 12;
		task.completeness = 80;
		task.actualDurationHour = 11;
		task.tags = [{ id: 7 } as Tag, { id: 8 } as Tag];
		task.childrenTasks = [{ id: 2 } as Task, { id: 3 } as Task];
		task.parentTask = { id: 9 } as Task;
		task.isSplittable = true;

		const json = task.toJSON();

		expect(json).toEqual({
			id: 1,
			title: 'T1',
			description: 'desc',
			deadline: iso(deadline),
			startDate: iso(startDate),
			actualStartDate: iso(actualStartDate),
			actualEndDate: iso(actualEndDate),
			completed: true,
			categoryId: 10,
			priority: 3,
			estimateDurationHour: 12,
			completeness: 80,
			actualDurationHour: 11,
			tagIds: [7, 8],
			childrenTaskIds: [2, 3],
			parentTaskId: 9,
			state: 'Completed',
			isSplittable: true,
		});
	});

	it('should default nullables and arrays in toJSON', () => {
		const task = new Task();
		task.id = 2;
		task.title = 'Empty';
		task.description = '';
		task.deadline = null;
		task.startDate = null;
		task.actualStartDate = null;
		task.actualEndDate = null;
		task.completed = false;
		task.state = 'Scheduled';
		task.category = null;
		task.priority = 0;
		task.estimateDurationHour = 0 as any; // test still serializes
		task.completeness = 0;
		task.actualDurationHour = null;
		task.tags = undefined as any;
		task.childrenTasks = undefined as any;
		task.parentTask = null;
		task.isSplittable = false;

		const json = task.toJSON();

		expect(json.deadline).toBeNull();
		expect(json.startDate).toBeNull();
		expect(json.actualStartDate).toBeNull();
		expect(json.actualEndDate).toBeNull();
		expect(json.categoryId).toBeNull();
		expect(json.tagIds).toEqual([]);
		expect(json.childrenTaskIds).toEqual([]);
		expect(json.parentTaskId).toBeNull();
	});

	it('should serialize when tags/children are empty arrays', () => {
		const task = new Task();
		task.id = 3;
		task.title = 'Empty collections';
		task.description = '';
		task.deadline = null;
		task.startDate = null;
		task.actualStartDate = null;
		task.actualEndDate = null;
		task.completed = false;
		task.state = 'Scheduled';
		task.category = null;
		task.priority = 0;
		task.estimateDurationHour = 1;
		task.completeness = 0;
		task.actualDurationHour = null;
		task.tags = [];
		task.childrenTasks = [];
		task.parentTask = null;
		task.isSplittable = false;

		const json = task.toJSON();

		expect(json.tagIds).toEqual([]);
		expect(json.childrenTaskIds).toEqual([]);
		expect(json.parentTaskId).toBeNull();
	});
});
