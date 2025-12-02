import { TaskDependencyManager } from '../TaskDependencyManager';

describe('TaskDependencyManager', () => {
	let manager: TaskDependencyManager;
	let mockRepo: any;

	beforeEach(() => {
		mockRepo = {
			findById: jest.fn(),
			findAll: jest.fn(),
			findDescendants: jest.fn(),
			findAncestors: jest.fn(),
		};
		manager = new TaskDependencyManager(mockRepo);
	});

	it('should detect cycle when child and parent are the same', async () => {
		const result = await manager.wouldCreateCycle(1, 1);
		expect(result).toBe(true);
	});

	it('should detect cycle in parent chain', async () => {
		mockRepo.findById
			.mockResolvedValueOnce({ parentTask: { id: 2 } }) // currentId=2
			.mockResolvedValueOnce({ parentTask: { id: 3 } }) // currentId=3
			.mockResolvedValueOnce({ parentTask: { id: 1 } }); // currentId=1 (cycle)
		const result = await manager.wouldCreateCycle(1, 2);
		expect(result).toBe(true);
	});

	it('should return false if no cycle', async () => {
		mockRepo.findById
			.mockResolvedValueOnce({ parentTask: { id: 2 } })
			.mockResolvedValueOnce({ parentTask: null });
		const result = await manager.wouldCreateCycle(1, 2);
		expect(result).toBe(false);
	});

	it('should get all root tasks', async () => {
		const tasks = [
			{ id: 1, parentTask: null, toJSON: () => ({ id: 1 }) },
			{ id: 2, parentTask: { id: 1 }, toJSON: () => ({ id: 2 }) },
			{ id: 3, parentTask: null, toJSON: () => ({ id: 3 }) },
		];
		mockRepo.findAll.mockResolvedValue(tasks);
		const result = await manager.getRootTasks();
		expect(result).toEqual([{ id: 1 }, { id: 3 }]);
	});

	it('should get project root', async () => {
		mockRepo.findById
			.mockResolvedValueOnce({ id: 3, parentTask: { id: 2 } }) // currentTask
			.mockResolvedValueOnce({ id: 2, parentTask: { id: 1 } }) // parent
			.mockResolvedValueOnce({ id: 1, parentTask: null }); // root
		const result = await manager.getProjectRoot(3);
		expect(result).toEqual({ id: 1, parentTask: null });
	});

	it('should return null if project root not found', async () => {
		mockRepo.findById.mockResolvedValue(null);
		const result = await manager.getProjectRoot(99);
		expect(result).toBeNull();
	});

	it('should get all descendants', async () => {
		const parent = { id: 1 };
		const descendants = [
			{ id: 2, toJSON: () => ({ id: 2 }) },
			{ id: 3, toJSON: () => ({ id: 3 }) },
		];
		mockRepo.findById.mockResolvedValue(parent);
		mockRepo.findDescendants.mockResolvedValue(descendants);
		const result = await manager.getAllDescendants(1);
		expect(result).toEqual([{ id: 2 }, { id: 3 }]);
	});

	it('should return [] if parent not found in getAllDescendants', async () => {
		mockRepo.findById.mockResolvedValue(null);
		const result = await manager.getAllDescendants(1);
		expect(result).toEqual([]);
	});

	it('should collect project task ids', async () => {
		const root = { id: 1, parentTask: null, toJSON: () => ({ id: 1 }) };
		const descendants = [
			{ id: 2, toJSON: () => ({ id: 2 }) },
			{ id: 3, toJSON: () => ({ id: 3 }) },
		];
		jest.spyOn(manager, 'getProjectRoot').mockResolvedValue(root as any);
		jest.spyOn(manager, 'getAllDescendants').mockResolvedValue(
			descendants.map((d) => d.toJSON()) as any
		);
		const result = await manager.collectProjectTaskIds(2);
		expect(result).toEqual([1, 2, 3]);
	});

	it('should return null if project root not found in collectProjectTaskIds', async () => {
		jest.spyOn(manager, 'getProjectRoot').mockResolvedValue(null);
		const result = await manager.collectProjectTaskIds(99);
		expect(result).toBeNull();
	});

	it('should get all ancestor ids', async () => {
		const task = { id: 3 };
		const ancestors = [{ id: 3 }, { id: 2 }, { id: 1 }];
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findAncestors.mockResolvedValue(ancestors);
		const result = await manager.getAllAncestors(3);
		expect(result).toEqual([2, 1]);
	});

	it('should return [] if task not found in getAllAncestors', async () => {
		mockRepo.findById.mockResolvedValue(null);
		const result = await manager.getAllAncestors(99);
		expect(result).toEqual([]);
	});
});
