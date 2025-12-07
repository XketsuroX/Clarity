import { TaskRepository } from '../TaskRepository';

describe('TaskRepository', () => {
	let repo: TaskRepository;
	let mockOrmRepo: any;
	let mockTreeRepo: any;

	beforeEach(() => {
		mockTreeRepo = {
			findDescendants: jest.fn(),
			findAncestors: jest.fn(),
		};
		mockOrmRepo = {
			find: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			delete: jest.fn(),
			count: jest.fn(),
			existsBy: jest.fn(),
			clear: jest.fn(),
			manager: {
				getTreeRepository: jest.fn(() => mockTreeRepo),
			},
		};
		repo = new TaskRepository();
		// @ts-ignore ormRepository is private property
		repo.ormRepository = mockOrmRepo;
	});

	it('should find all tasks', async () => {
		const tasks = [{ id: 1 }, { id: 2 }];
		mockOrmRepo.find.mockResolvedValue(tasks);
		const result = await repo.findAll();
		expect(mockOrmRepo.find).toHaveBeenCalledWith({
			relations: ['category', 'tags', 'parentTask'],
			order: { title: 'ASC' },
		});
		expect(result).toBe(tasks);
	});

	it('should find task by id', async () => {
		const task = { id: 1 };
		mockOrmRepo.findOne.mockResolvedValue(task);
		const result = await repo.findById(1);
		expect(mockOrmRepo.findOne).toHaveBeenCalledWith({
			where: { id: 1 },
			relations: ['category', 'tags', 'parentTask', 'childrenTasks'],
		});
		expect(result).toBe(task);
	});

	it('should return null when findById misses', async () => {
		mockOrmRepo.findOne.mockResolvedValue(null);
		const result = await repo.findById(123);
		expect(mockOrmRepo.findOne).toHaveBeenCalled();
		expect(result).toBeNull();
	});

	it('should create task without optional relations', async () => {
		const created = { id: 50 };
		mockOrmRepo.create.mockReturnValue(created);
		mockOrmRepo.save.mockResolvedValue(created);

		const result = await repo.create({ title: 'No relations' } as any);

		expect(mockOrmRepo.create).toHaveBeenCalledWith({ title: 'No relations' });
		expect(result).toBe(created);
	});

	it('should create a task', async () => {
		const data = {
			title: 'A',
			categoryId: 2,
			tagIds: [3, 4],
			parentTaskId: 5,
			state: 'Scheduled',
		};
		const created = { id: 1 };
		mockOrmRepo.create.mockReturnValue(created);
		mockOrmRepo.save.mockResolvedValue(created);

		const result = await repo.create(data as any);
		expect(mockOrmRepo.create).toHaveBeenCalled();
		expect(mockOrmRepo.save).toHaveBeenCalledWith(created);
		expect(result).toBe(created);
	});

	it('should throw if invalid state in create', async () => {
		await expect(repo.create({ title: 'A', state: 'BAD' } as any)).rejects.toThrow(
			'Invalid task state'
		);
	});

	it('should update a task', async () => {
		const task = { id: 1, tags: [] };
		mockOrmRepo.findOne.mockResolvedValue(task);
		mockOrmRepo.save.mockResolvedValue({ ...task, title: 'B', tags: [{ id: 2 }, { id: 3 }] });
		mockOrmRepo.merge = jest.fn();

		const result = await repo.update(1, { title: 'B', tagIds: [2, 3] });
		expect(mockOrmRepo.save).toHaveBeenCalled();
		expect(result).toEqual({ id: 1, tags: [{ id: 2 }, { id: 3 }], title: 'B' });
	});

	it('should return null if update task not found', async () => {
		mockOrmRepo.findOne.mockResolvedValue(null);
		const result = await repo.update(999, { title: 'X' });
		expect(result).toBeNull();
	});

	it('should throw if invalid state in update', async () => {
		const task = { id: 1, tags: [] };
		mockOrmRepo.findOne.mockResolvedValue(task);
		await expect(repo.update(1, { state: 'BAD' })).rejects.toThrow('Invalid task state');
	});

	it('should delete a task', async () => {
		mockOrmRepo.delete.mockResolvedValue({ affected: 1 });
		const result = await repo.delete(1);
		expect(mockOrmRepo.delete).toHaveBeenCalledWith(1);
		expect(result).toBe(true);
	});

	it('should return false if delete not affected', async () => {
		mockOrmRepo.delete.mockResolvedValue({ affected: 0 });
		const result = await repo.delete(1);
		expect(result).toBe(false);
	});

	it('should check if task exists', async () => {
		mockOrmRepo.existsBy.mockResolvedValue(true);
		const result = await repo.exists(1);
		expect(mockOrmRepo.existsBy).toHaveBeenCalledWith({ id: 1 });
		expect(result).toBe(true);
	});

	it('should count tasks', async () => {
		mockOrmRepo.count.mockResolvedValue(5);
		const result = await repo.count();
		expect(mockOrmRepo.count).toHaveBeenCalled();
		expect(result).toBe(5);
	});

	it('should get state', async () => {
		const task = { id: 1, state: 'Completed' };
		mockOrmRepo.findOne.mockResolvedValue(task);
		const result = await repo.getState(1);
		expect(result).toBe('Completed');
	});

	it('should return null for getState if not found', async () => {
		mockOrmRepo.findOne.mockResolvedValue(null);
		const result = await repo.getState(999);
		expect(result).toBeNull();
	});

	it('should delete all tasks', async () => {
		await repo.deleteAll();
		expect(mockOrmRepo.clear).toHaveBeenCalled();
	});

	it('should find descendants', async () => {
		const task = { id: 1 };
		const descendants = [{ id: 2 }];
		mockTreeRepo.findDescendants.mockResolvedValue(descendants);
		const result = await repo.findDescendants(task as any);
		expect(result).toBe(descendants);
	});

	it('should find ancestors', async () => {
		const task = { id: 1 };
		const ancestors = [{ id: 0 }];
		mockTreeRepo.findAncestors.mockResolvedValue(ancestors);
		const result = await repo.findAncestors(task as any);
		expect(result).toBe(ancestors);
	});

	it('should set actual start', async () => {
		const task = { id: 1, actualStartDate: null };
		mockOrmRepo.findOne.mockResolvedValue(task);
		mockOrmRepo.save.mockResolvedValue({ ...task, actualStartDate: new Date() });
		mockOrmRepo.merge = jest.fn();

		const date = new Date();
		const result = await repo.setActualStart(1, date);
		expect(mockOrmRepo.save).toHaveBeenCalled();
		if (!result) throw new Error('result should not be null');
		expect(result.actualStartDate).toBeDefined();
	});

	it('should not overwrite existing actual start date', async () => {
		const existingDate = new Date('2023-01-01T00:00:00Z');
		const task = { id: 1, actualStartDate: existingDate } as any;
		mockOrmRepo.findOne.mockResolvedValue(task);
		mockOrmRepo.merge = jest.fn((target: any, payload: any) => Object.assign(target, payload));
		mockOrmRepo.save.mockImplementation(async (merged: any) => merged);

		const newDate = new Date('2023-02-02T00:00:00Z');
		const result = await repo.setActualStart(1, newDate);

		expect(mockOrmRepo.merge).toHaveBeenCalledWith(task, { state: 'In Progress' });
		expect(result?.actualStartDate).toBe(existingDate);
	});

	it('should return null if setActualStart not found', async () => {
		mockOrmRepo.findOne.mockResolvedValue(null);
		const result = await repo.setActualStart(999, new Date());
		expect(result).toBeNull();
	});

	it('should set completion', async () => {
		const task = { id: 1 };
		mockOrmRepo.findOne.mockResolvedValue(task);
		mockOrmRepo.save.mockResolvedValue({ ...task, completed: true, state: 'Completed' });
		mockOrmRepo.merge = jest.fn();

		const result = await repo.setCompletion(1, true, 'Completed', new Date(), 2);
		expect(mockOrmRepo.save).toHaveBeenCalled();
		if (!result) throw new Error('result should not be null');
		expect(result.completed).toBe(true);
	});

	it('should return null if setCompletion not found', async () => {
		mockOrmRepo.findOne.mockResolvedValue(null);
		const result = await repo.setCompletion(999, true, 'Completed');
		expect(result).toBeNull();
	});

	it('should set completeness', async () => {
		const task = { id: 1 };
		mockOrmRepo.findOne.mockResolvedValue(task);
		mockOrmRepo.save.mockResolvedValue({ ...task, completeness: 80 });
		mockOrmRepo.merge = jest.fn();

		const result = await repo.setCompleteness(1, 80);
		expect(mockOrmRepo.save).toHaveBeenCalled();
		if (!result) throw new Error('result should not be null');
		expect(result.completeness).toBe(80);
	});

	it('should return null if setCompleteness not found', async () => {
		mockOrmRepo.findOne.mockResolvedValue(null);
		const result = await repo.setCompleteness(999, 80);
		expect(result).toBeNull();
	});

	it('should reopen if completed', async () => {
		const task = { id: 1, completed: true };
		mockOrmRepo.findOne.mockResolvedValue(task);
		mockOrmRepo.save.mockResolvedValue({ ...task, completed: false, state: 'In Progress' });
		mockOrmRepo.merge = jest.fn();

		const result = await repo.reopenIfCompleted(1);
		expect(mockOrmRepo.save).toHaveBeenCalled();
		if (!result) throw new Error('result should not be null');
		expect(result.completed).toBe(false);
		expect(result.state).toBe('In Progress');
	});

	it('should return task if not completed in reopenIfCompleted', async () => {
		const task = { id: 1, completed: false };
		mockOrmRepo.findOne.mockResolvedValue(task);
		const result = await repo.reopenIfCompleted(1);
		expect(result).toBe(task);
	});

	it('should return null if reopenIfCompleted not found', async () => {
		mockOrmRepo.findOne.mockResolvedValue(null);
		const result = await repo.reopenIfCompleted(999);
		expect(result).toBeNull();
	});

	it('should get pending tasks', async () => {
		const tasks = [
			{ id: 1, completed: false },
			{ id: 2, completed: true },
			{ id: 3, completed: false },
		];
		mockOrmRepo.find.mockResolvedValue(tasks);
		const result = await repo.getPendingTasks();
		expect(result).toEqual([
			{ id: 1, completed: false },
			{ id: 3, completed: false },
		]);
	});
});
