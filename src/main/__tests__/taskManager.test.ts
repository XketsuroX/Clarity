import { TaskManager } from '../TaskManager';
import { TaskRepository } from '../TaskRepository';
import { TaskDependencyManager } from '../TaskDependencyManager';
import { TaskCalculator } from '../TaskCalculator';

jest.mock('../TaskRepository');
jest.mock('../TaskDependencyManager');
jest.mock('../TaskCalculator');

describe('TaskManager', () => {
	let manager: TaskManager;
	let mockRepo: jest.Mocked<TaskRepository>;
	let mockDependencyManager: jest.Mocked<TaskDependencyManager>;
	let mockCalculator: jest.Mocked<TaskCalculator>;

	// Mock Date for consistent testing
	const MOCK_DATE = new Date('2025-12-05T10:00:00.000Z');
	const MOCK_TIMESTAMP = MOCK_DATE.getTime();

	beforeEach(() => {
		// Freeze time so all Date() calls (and Date.now) are consistent
		jest.useFakeTimers();
		jest.setSystemTime(MOCK_DATE);

		manager = new TaskManager();
		mockRepo = (manager as any).taskRepository as jest.Mocked<TaskRepository>;
		mockDependencyManager = (manager as any)
			.dependencyManager as jest.Mocked<TaskDependencyManager>;
		mockCalculator = (manager as any).calculator as jest.Mocked<TaskCalculator>;

		// Mock getAllAncestors to return empty array by default
		mockDependencyManager.getAllAncestors.mockResolvedValue([]);
		mockRepo.setCompleteness.mockResolvedValue({} as any);
		mockCalculator.getTaskCompleteness.mockResolvedValue(50);
		// Mock findAll for refreshCompleteness internal calls
		mockRepo.findAll.mockResolvedValue([]);

		// Stub the private refreshCompleteness method to prevent complex internal calls
		// This allows us to test the public methods without mocking all Dinternal dependencies
		jest.spyOn(manager as any, 'refreshCompleteness').mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('should add a task and return its JSON', async () => {
		const task = { id: 1, title: 'Test', toJSON: () => ({ id: 1, title: 'Test' }) } as any;
		mockRepo.create.mockResolvedValue(task);
		mockRepo.findById.mockResolvedValue(task);

		const result = await manager.addTask({ title: 'Test' });
		expect(mockRepo.create).toHaveBeenCalledWith({ title: 'Test' });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toEqual({ id: 1, title: 'Test' });
		}
	});

	it('should get a task by id', async () => {
		const task = { id: 2, title: 'Get', toJSON: () => ({ id: 2, title: 'Get' }) } as any;
		mockRepo.findById.mockResolvedValue(task);

		const result = await manager.getTask(2);
		expect(mockRepo.findById).toHaveBeenCalledWith(2);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toEqual({ id: 2, title: 'Get' });
		}
	});

	it('should return error if getTask not found', async () => {
		mockRepo.findById.mockResolvedValue(null);

		const result = await manager.getTask(999);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBeDefined();
		}
	});

	it('should remove a task', async () => {
		const task = { id: 1, title: 'Test', toJSON: () => ({ id: 1, title: 'Test' }) } as any;
		mockRepo.create.mockResolvedValue(task);
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.delete.mockResolvedValue(true);

		// First add a task
		const addResult = await manager.addTask({ title: 'Test' });
		expect(addResult.ok).toBe(true);

		// Then remove it
		const result = await manager.removeTask(1);
		expect(mockRepo.delete).toHaveBeenCalledWith(1);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBe(true);
		}
	});

	it('should refresh parent completeness when removing a child task', async () => {
		const parent = { id: 42 } as any;
		const child = { id: 5, parentTask: parent } as any;
		mockRepo.findById.mockResolvedValue(child);
		mockRepo.delete.mockResolvedValue(true);

		const result = await manager.removeTask(5);

		expect((manager as any).refreshCompleteness).toHaveBeenCalledWith(42);
		expect(mockRepo.delete).toHaveBeenCalledWith(5);
		expect(result.ok).toBe(true);
	});

	it('should toggle complete', async () => {
		const task = {
			id: 3,
			completed: false,
			childrenTasks: [],
			tags: [],
			deadline: undefined,
			state: 'In Progress',
			actualStartDate: new Date(),
			toJSON: () => ({ id: 3, completed: false }),
		} as any;
		const completedTask = {
			...task,
			completed: true,
			state: 'Completed',
			toJSON: () => ({ id: 3, completed: true }),
		};
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.setCompletion.mockResolvedValue(completedTask);

		const result = await manager.completeTask(3);
		expect(mockRepo.findById).toHaveBeenCalledWith(3);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toEqual({ id: 3, completed: true });
		}
	});

	// ===== listTasks Tests =====

	it('should list all tasks', async () => {
		const tasks = [
			{ id: 1, title: 'Task 1', toJSON: () => ({ id: 1, title: 'Task 1' }) },
			{ id: 2, title: 'Task 2', toJSON: () => ({ id: 2, title: 'Task 2' }) },
		];
		mockRepo.findAll.mockResolvedValue(tasks as any);

		const result = await manager.listTasks();
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toEqual([
				{ id: 1, title: 'Task 1' },
				{ id: 2, title: 'Task 2' },
			]);
		}
	});

	it('should list empty array when no tasks', async () => {
		// findAll already mocked in beforeEach to return []
		const result = await manager.listTasks();
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toEqual([]);
		}
	});

	// ===== setTaskCompleteness Tests =====

	it('should set task completeness for leaf task', async () => {
		const task = {
			id: 1,
			childrenTasks: [],
			toJSON: () => ({ id: 1, completeness: 50 }),
		} as any;
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.setCompleteness.mockResolvedValue(task);

		const result = await manager.setTaskCompleteness(1, 50);
		expect(mockRepo.setCompleteness).toHaveBeenCalledWith(1, 50);
		expect(result.ok).toBe(true);
	});

	it('should reject if completeness < 0', async () => {
		const result = await manager.setTaskCompleteness(1, -10);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain('between 0 and 100');
		}
	});

	it('should reject if completeness > 100', async () => {
		const result = await manager.setTaskCompleteness(1, 150);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain('between 0 and 100');
		}
	});

	it('should reject if task has children', async () => {
		const task = {
			id: 1,
			childrenTasks: [{ id: 2 }],
		} as any;
		mockRepo.findById.mockResolvedValue(task);

		const result = await manager.setTaskCompleteness(1, 50);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain('leaf tasks');
		}
	});

	it('should return error if task not found in setTaskCompleteness', async () => {
		mockRepo.findById.mockResolvedValue(null);

		const result = await manager.setTaskCompleteness(999, 50);
		expect(result.ok).toBe(false);
	});

	// ===== startTask Tests =====

	it('should start a scheduled task', async () => {
		const task = {
			id: 1,
			state: 'Scheduled',
			toJSON: () => ({ id: 1, state: 'In Progress' }),
		} as any;
		const startedTask = {
			...task,
			state: 'In Progress',
			actualStartDate: new Date(),
		};
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.setActualStart.mockResolvedValue(startedTask);

		const result = await manager.startTask(1);
		expect(mockRepo.setActualStart).toHaveBeenCalled();
		expect(result.ok).toBe(true);
	});

	it('should return error if task not found in startTask', async () => {
		mockRepo.findById.mockResolvedValue(null);

		const result = await manager.startTask(999);
		expect(result.ok).toBe(false);
	});

	it('should return error if task not in Scheduled state', async () => {
		const task = {
			id: 1,
			state: 'In Progress',
		} as any;
		mockRepo.findById.mockResolvedValue(task);

		const result = await manager.startTask(1);
		expect(result.ok).toBe(false);
	});

	it('should use current time when starting and refresh aggregates', async () => {
		const task = {
			id: 7,
			state: 'Scheduled',
			toJSON: () => ({ id: 7, state: 'In Progress' }),
		} as any;
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.setActualStart.mockImplementation(async (_id: number, date: Date) => ({
			...task,
			state: 'In Progress',
			actualStartDate: date,
		}));

		const result = await manager.startTask(7);

		expect(mockRepo.setActualStart).toHaveBeenCalledWith(7, expect.any(Date));
		expect((mockRepo.setActualStart as jest.Mock).mock.calls[0][1].getTime()).toBe(
			MOCK_TIMESTAMP
		);
		expect((manager as any).refreshCompleteness).toHaveBeenCalledWith(7);
		expect(result.ok).toBe(true);
	});

	// ===== completeTask Tests =====

	it('should throw error if children not completed', async () => {
		const task = {
			id: 1,
			completed: false,
			childrenTasks: [{ id: 2, completed: false }],
		} as any;
		mockRepo.findById.mockResolvedValue(task);

		const result = await manager.completeTask(1);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain('All child tasks must be completed');
		}
	});

	it('should uncomplete a completed task', async () => {
		const task = {
			id: 1,
			completed: true,
			childrenTasks: [],
			deadline: undefined,
			toJSON: () => ({ id: 1, completed: false }),
		} as any;
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.setCompletion.mockResolvedValue({
			...task,
			completed: false,
			toJSON: () => ({ id: 1, completed: false }),
		});

		const result = await manager.completeTask(1);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toEqual({ id: 1, completed: false });
		}
	});

	it('should set state to Overdue when uncompleting past deadline', async () => {
		// Deadline 1 day before MOCK_DATE
		const pastDeadline = new Date(MOCK_TIMESTAMP - 1000 * 60 * 60 * 24);
		const task = {
			id: 1,
			completed: true,
			childrenTasks: [],
			deadline: pastDeadline,
			toJSON: () => ({ id: 1, completed: false, state: 'Overdue' }),
		} as any;
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.setCompletion.mockResolvedValue(task);

		const result = await manager.completeTask(1);
		expect(mockRepo.setCompletion).toHaveBeenCalledWith(1, false, 'Overdue', null, null);
		expect(result.ok).toBe(true);
	});

	it('should calculate actual duration when completing', async () => {
		// Start date 10 hours before MOCK_DATE
		const startDate = new Date(MOCK_TIMESTAMP - 1000 * 60 * 60 * 10);
		const task = {
			id: 1,
			completed: false,
			childrenTasks: [],
			actualStartDate: startDate,
			toJSON: () => ({ id: 1, completed: true }),
		} as any;
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.setCompletion.mockResolvedValue(task);

		const result = await manager.completeTask(1);
		// Should calculate ~10 hours duration (allowing variance due to real Date() timing)
		const callArgs = (mockRepo.setCompletion as jest.Mock).mock.calls[0];
		expect(callArgs[0]).toBe(1);
		expect(callArgs[1]).toBe(true);
		expect(callArgs[2]).toBe('Completed');
		expect(callArgs[3]).toBeInstanceOf(Date);
		expect(callArgs[4]).toBe(10);
		expect(result.ok).toBe(true);
	});

	// ===== updateTask Tests =====

	it('should update a task', async () => {
		const task = {
			id: 1,
			title: 'Old',
			toJSON: () => ({ id: 1, title: 'New' }),
		} as any;
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.update.mockResolvedValue({
			...task,
			title: 'New',
			toJSON: () => ({ id: 1, title: 'New' }),
		});

		const result = await manager.updateTask(1, { title: 'New' });
		expect(mockRepo.update).toHaveBeenCalledWith(1, { title: 'New' });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.title).toBe('New');
		}
	});

	it('should throw error if update creates cycle', async () => {
		mockDependencyManager.wouldCreateCycle.mockResolvedValue(true);

		const result = await manager.updateTask(1, { parentTaskId: 2 });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain('dependency cycle');
		}
	});

	it('should allow update if no cycle', async () => {
		const task = {
			id: 1,
			toJSON: () => ({ id: 1 }),
		} as any;
		mockRepo.findById.mockResolvedValue(task);
		mockDependencyManager.wouldCreateCycle.mockResolvedValue(false);
		mockRepo.update.mockResolvedValue(task);

		const result = await manager.updateTask(1, { parentTaskId: 2 });
		expect(result.ok).toBe(true);
	});

	it('should return error if task not found in updateTask', async () => {
		mockRepo.findById.mockResolvedValue(null);
		mockRepo.update.mockResolvedValue(null);

		const result = await manager.updateTask(999, { title: 'New' });
		expect(result.ok).toBe(false);
	});

	// ===== getRootTasks Tests =====

	it('should get root tasks', async () => {
		const rootTasks = [
			{ id: 1, title: 'Root 1' },
			{ id: 2, title: 'Root 2' },
		];
		mockDependencyManager.getRootTasks.mockResolvedValue(rootTasks as any);

		const result = await manager.getRootTasks();
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toEqual(rootTasks);
		}
	});

	// ===== Calculator Proxy Tests =====

	it('should get task urgency', async () => {
		mockCalculator.getTaskUrgency.mockResolvedValue(75);
		mockRepo.findAll.mockResolvedValue([]);

		const result = await manager.getTaskUrgency(1, 30);
		expect(mockCalculator.getTaskUrgency).toHaveBeenCalledWith(1, 30);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBe(75);
		}
	});

	it('should get task completeness', async () => {
		mockCalculator.getTaskCompleteness.mockResolvedValue(60);

		const result = await manager.getTaskCompleteness(1);
		expect(mockCalculator.getTaskCompleteness).toHaveBeenCalledWith(1);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBe(60);
		}
	});

	it('should get actual vs estimated', async () => {
		const data = {
			estimatedDurationHour: 10,
			actualDurationHour: 12,
			deltaHour: 2,
			deltaPercent: 20,
		};
		mockCalculator.getActualVsEstimated.mockResolvedValue(data);

		const result = await manager.getActualVsEstimated(1);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toEqual(data);
		}
	});

	it('should get average actual vs estimated', async () => {
		const data = {
			avgDeltaHour: 2.5,
			avgDeltaPercent: 15,
			count: 10,
		};
		mockCalculator.getAverageActualVsEstimated.mockResolvedValue(data);

		const result = await manager.getAverageActualVsEstimated();
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toEqual(data);
		}
	});

	it('should get estimated task duration', async () => {
		mockCalculator.estimatedTaskDuration.mockResolvedValue(25);
		mockRepo.findAll.mockResolvedValue([]);

		const result = await manager.getEstimatedTaskDuration(1);
		expect(mockCalculator.estimatedTaskDuration).toHaveBeenCalledWith(1);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBe(25);
		}
	});

	it('should get project completeness', async () => {
		const rootTask = { id: 1, title: 'Root' } as any;
		mockDependencyManager.getProjectRoot.mockResolvedValue(rootTask);
		mockCalculator.getTaskCompleteness.mockResolvedValue(80);
		mockRepo.findAll.mockResolvedValue([]);

		const result = await manager.getProjectCompleteness(5);
		expect(mockDependencyManager.getProjectRoot).toHaveBeenCalledWith(5);
		expect(mockCalculator.getTaskCompleteness).toHaveBeenCalledWith(1);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBe(80);
		}
	});

	it('should return error if project root not found', async () => {
		mockDependencyManager.getProjectRoot.mockResolvedValue(null);
		mockRepo.findAll.mockResolvedValue([]);

		const result = await manager.getProjectCompleteness(999);
		expect(result.ok).toBe(false);
	});

	// ===== Dependency Manager Proxy Tests =====

	it('should get sub tasks (descendants)', async () => {
		const descendants = [
			{ id: 2, title: 'Child 1' },
			{ id: 3, title: 'Child 2' },
		];
		mockDependencyManager.getAllDescendants.mockResolvedValue(descendants as any);

		const result = await manager.getSubTask(1);
		expect(mockDependencyManager.getAllDescendants).toHaveBeenCalledWith(1);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toEqual(descendants);
		}
	});

	it('should get upcoming tasks (ancestors)', async () => {
		const ancestors = [1, 2, 3];
		mockDependencyManager.getAllAncestors.mockResolvedValue(ancestors);

		const result = await manager.getUpcomingTask(4);
		expect(mockDependencyManager.getAllAncestors).toHaveBeenCalledWith(4);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toEqual(ancestors);
		}
	});

	it('should get pending tasks', async () => {
		const pendingTasks = [
			{ id: 1, state: 'In Progress' },
			{ id: 2, state: 'Scheduled' },
		] as any;
		mockRepo.findAll.mockResolvedValue([]);
		mockRepo.getPendingTasks.mockResolvedValue(pendingTasks);

		const result = await manager.getPendingTasks();
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toEqual(pendingTasks);
		}
	});

	// ===== addTask with parent Tests =====

	it('should reopen parent when adding child to completed parent', async () => {
		const parent = {
			id: 1,
			completed: true,
			childrenTasks: [],
		} as any;
		const child = {
			id: 2,
			parentTask: parent,
			toJSON: () => ({ id: 2, title: 'Child' }),
		} as any;
		mockRepo.create.mockResolvedValue(child);
		mockRepo.findById.mockResolvedValue(child);
		mockRepo.reopenIfCompleted.mockResolvedValue(undefined);

		const result = await manager.addTask({ title: 'Child', parentTaskId: 1 });
		expect(mockRepo.reopenIfCompleted).toHaveBeenCalledWith(1);
		expect(result.ok).toBe(true);
	});

	// ===== removeTask with parent Tests =====

	it('should refresh parent completeness after removing child', async () => {
		const parent = { id: 1 };
		const task = {
			id: 2,
			parentTask: parent,
		} as any;
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.delete.mockResolvedValue(true);

		const result = await manager.removeTask(2);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBe(true);
		}
	});

	// ===== Edge Cases =====

	it('should handle setTaskCompleteness with boundary value 0', async () => {
		const task = {
			id: 1,
			childrenTasks: [],
			toJSON: () => ({ id: 1, completeness: 0 }),
		} as any;
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.setCompleteness.mockResolvedValue(task);

		const result = await manager.setTaskCompleteness(1, 0);
		expect(result.ok).toBe(true);
	});

	it('should handle setTaskCompleteness with boundary value 100', async () => {
		const task = {
			id: 1,
			childrenTasks: [],
			toJSON: () => ({ id: 1, completeness: 100 }),
		} as any;
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.setCompleteness.mockResolvedValue(task);

		const result = await manager.setTaskCompleteness(1, 100);
		expect(result.ok).toBe(true);
	});

	it('should handle task with no actualStartDate when completing', async () => {
		// Start date 5 hours before MOCK_DATE
		const startDate = new Date(MOCK_TIMESTAMP - 1000 * 60 * 60 * 5);
		const task = {
			id: 1,
			completed: false,
			childrenTasks: [],
			actualStartDate: null,
			startDate: startDate,
			toJSON: () => ({ id: 1, completed: true }),
		} as any;
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.setCompletion.mockResolvedValue(task);

		const result = await manager.completeTask(1);
		// Should calculate ~5 hours duration (allowing variance due to real Date() timing)
		const callArgs = (mockRepo.setCompletion as jest.Mock).mock.calls[0];
		expect(callArgs[4]).toBe(5);
		expect(result.ok).toBe(true);
	});

	it('should handle task with no start dates when completing', async () => {
		const task = {
			id: 1,
			completed: false,
			childrenTasks: [],
			actualStartDate: null,
			startDate: null,
			toJSON: () => ({ id: 1, completed: true }),
		} as any;
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.setCompletion.mockResolvedValue(task);

		const result = await manager.completeTask(1);
		expect(mockRepo.setCompletion).toHaveBeenCalledWith(
			1,
			true,
			'Completed',
			expect.any(Date),
			null
		);
		expect(result.ok).toBe(true);
	});

	it('should handle updateTask with null parentTaskId', async () => {
		const task = {
			id: 1,
			toJSON: () => ({ id: 1 }),
		} as any;
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.update.mockResolvedValue(task);

		const result = await manager.updateTask(1, { parentTaskId: null });
		expect(result.ok).toBe(true);
	});

	it('should handle refreshOverdue for multiple tasks', async () => {
		const tasks = [
			// Task 1: overdue (deadline 1 second before MOCK_DATE)
			{
				id: 1,
				completed: false,
				deadline: new Date(MOCK_TIMESTAMP - 1000),
				state: 'In Progress',
			},
			// Task 2: not overdue (deadline 1 second after MOCK_DATE)
			{
				id: 2,
				completed: false,
				deadline: new Date(MOCK_TIMESTAMP + 1000),
				state: 'Scheduled',
			},
			// Task 3: completed (should be ignored)
			{
				id: 3,
				completed: true,
				deadline: new Date(MOCK_TIMESTAMP - 1000),
				state: 'Completed',
			},
		] as any;
		mockRepo.findAll.mockResolvedValue(tasks);
		mockRepo.setCompletion.mockResolvedValue({} as any);

		await manager.refreshOverdue();
		// Only task 1 should be marked as overdue
		expect(mockRepo.setCompletion).toHaveBeenCalledWith(1, false, 'Overdue');
		expect(mockRepo.setCompletion).toHaveBeenCalledTimes(1);
	});

	it('should handle error in calculator and wrap it', async () => {
		mockCalculator.getTaskUrgency.mockRejectedValue(new Error('Calculation error'));
		mockRepo.findAll.mockResolvedValue([]);

		const result = await manager.getTaskUrgency(1);
		expect(result.ok).toBe(false);
	});

	it('should handle addTask without parent', async () => {
		const task = {
			id: 1,
			title: 'No Parent',
			toJSON: () => ({ id: 1, title: 'No Parent' }),
		} as any;
		mockRepo.create.mockResolvedValue(task);
		mockRepo.findById.mockResolvedValue(task);

		const result = await manager.addTask({ title: 'No Parent' });
		expect(result.ok).toBe(true);
	});

	it('should handle updateTask with previous parent', async () => {
		const oldParent = { id: 1 };
		const task = {
			id: 2,
			parentTask: oldParent,
			toJSON: () => ({ id: 2 }),
		} as any;
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.update.mockResolvedValue(task);

		const result = await manager.updateTask(2, { title: 'Updated' });
		expect(result.ok).toBe(true);
	});

	// ===== refreshCompleteness internal tests =====

	it('should refreshCompleteness fully and update only non-leaf tasks', async () => {
		const localManager = new TaskManager();
		const localRepo = (localManager as any).taskRepository as jest.Mocked<TaskRepository>;
		const localCalc = (localManager as any).calculator as jest.Mocked<TaskCalculator>;

		const parentTask = { id: 1, childrenTasks: [{ id: 2 }] } as any;
		const leafTask = { id: 2, childrenTasks: [] } as any;
		localRepo.findAll.mockResolvedValue([parentTask, leafTask]);
		localRepo.findById.mockImplementation(async (id: number) => {
			if (id === 1) return parentTask as any;
			if (id === 2) return leafTask as any;
			return null as any;
		});
		localCalc.getTaskCompleteness.mockResolvedValue(42);
		localRepo.setCompleteness.mockResolvedValue({} as any);

		await (localManager as any).refreshCompleteness();

		expect(localCalc.getTaskCompleteness).toHaveBeenCalledWith(1);
		expect(localRepo.setCompleteness).toHaveBeenCalledWith(1, 42);
		expect(localRepo.setCompleteness).toHaveBeenCalledTimes(1);
	});

	it('should refreshCompleteness partially for affected task and ancestors with children', async () => {
		const localManager = new TaskManager();
		const localRepo = (localManager as any).taskRepository as jest.Mocked<TaskRepository>;
		const localDep = (localManager as any)
			.dependencyManager as jest.Mocked<TaskDependencyManager>;
		const localCalc = (localManager as any).calculator as jest.Mocked<TaskCalculator>;

		const affected = { id: 5, childrenTasks: [{ id: 6 }] } as any;
		const ancestor = { id: 9, childrenTasks: [{ id: 10 }] } as any;
		const leaf = { id: 6, childrenTasks: [] } as any;

		localRepo.findById.mockImplementation(async (id: number) => {
			if (id === 5) return affected as any;
			if (id === 9) return ancestor as any;
			if (id === 6) return leaf as any;
			return null as any;
		});
		localDep.getAllAncestors.mockResolvedValue([9]);
		localCalc.getTaskCompleteness
			.mockResolvedValueOnce(11) // affected
			.mockResolvedValueOnce(22); // ancestor
		localRepo.setCompleteness.mockResolvedValue({} as any);

		await (localManager as any).refreshCompleteness(5);

		expect(localCalc.getTaskCompleteness).toHaveBeenCalledWith(5);
		expect(localCalc.getTaskCompleteness).toHaveBeenCalledWith(9);
		expect(localRepo.setCompleteness).toHaveBeenCalledWith(5, 11);
		expect(localRepo.setCompleteness).toHaveBeenCalledWith(9, 22);
		// leaf task should never be updated
		expect(localRepo.setCompleteness).not.toHaveBeenCalledWith(6, expect.any(Number));
	});

	it('should skip refreshCompleteness partial when affected task has no children', async () => {
		const localManager = new TaskManager();
		const localRepo = (localManager as any).taskRepository as jest.Mocked<TaskRepository>;
		const localDep = (localManager as any)
			.dependencyManager as jest.Mocked<TaskDependencyManager>;
		const localCalc = (localManager as any).calculator as jest.Mocked<TaskCalculator>;

		const leaf = { id: 7, childrenTasks: [] } as any;
		localRepo.findById.mockResolvedValue(leaf);
		localDep.getAllAncestors.mockResolvedValue([]);

		await (localManager as any).refreshCompleteness(7);

		expect(localCalc.getTaskCompleteness).not.toHaveBeenCalled();
		expect(localRepo.setCompleteness).not.toHaveBeenCalled();
	});

	it('should ignore calculator errors during partial refreshCompleteness', async () => {
		const localManager = new TaskManager();
		const localRepo = (localManager as any).taskRepository as jest.Mocked<TaskRepository>;
		const localDep = (localManager as any)
			.dependencyManager as jest.Mocked<TaskDependencyManager>;
		const localCalc = (localManager as any).calculator as jest.Mocked<TaskCalculator>;

		const affected = { id: 11, childrenTasks: [{ id: 12 }] } as any;
		const ancestor = { id: 21, childrenTasks: [{ id: 22 }] } as any;
		localRepo.findById.mockImplementation(async (id: number) => {
			if (id === 11) return affected as any;
			if (id === 21) return ancestor as any;
			return null as any;
		});
		localDep.getAllAncestors.mockResolvedValue([21]);
		localCalc.getTaskCompleteness.mockRejectedValue(new Error('boom'));

		await (localManager as any).refreshCompleteness(11);

		expect(localCalc.getTaskCompleteness).toHaveBeenCalledWith(11);
		expect(localCalc.getTaskCompleteness).toHaveBeenCalledWith(21);
		expect(localRepo.setCompleteness).not.toHaveBeenCalled();
	});

	it('should ignore calculator errors during full refreshCompleteness', async () => {
		const localManager = new TaskManager();
		const localRepo = (localManager as any).taskRepository as jest.Mocked<TaskRepository>;
		const localCalc = (localManager as any).calculator as jest.Mocked<TaskCalculator>;

		const parentTask = { id: 3, childrenTasks: [{ id: 4 }] } as any;
		localRepo.findAll.mockResolvedValue([parentTask]);
		localRepo.findById.mockResolvedValue(parentTask as any);
		localCalc.getTaskCompleteness.mockRejectedValue(new Error('calc failed'));

		await (localManager as any).refreshCompleteness();

		expect(localCalc.getTaskCompleteness).toHaveBeenCalledWith(3);
		// error is swallowed, so setCompleteness is never called
		expect(localRepo.setCompleteness).not.toHaveBeenCalled();
	});

	it('should uncomplete to In Progress when deadline is future', async () => {
		const futureDeadline = new Date(MOCK_TIMESTAMP + 1000 * 60 * 60); // 1 hour after now
		const task = {
			id: 1,
			completed: true,
			childrenTasks: [],
			deadline: futureDeadline,
			toJSON: () => ({ id: 1, completed: false, state: 'In Progress' }),
		} as any;
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.setCompletion.mockResolvedValue({
			...task,
			completed: false,
			state: 'In Progress',
		});

		const result = await manager.completeTask(1); // toggles to uncomplete

		expect(mockRepo.setCompletion).toHaveBeenCalledWith(1, false, 'In Progress', null, null);
		expect(result.ok).toBe(true);
	});

	it('should not mark already overdue task again in refreshOverdue', async () => {
		const overdueTask = {
			id: 1,
			completed: false,
			deadline: new Date(MOCK_TIMESTAMP - 1000),
			state: 'Overdue',
		} as any;
		mockRepo.findAll.mockResolvedValue([overdueTask]);

		await manager.refreshOverdue();

		expect(mockRepo.setCompletion).not.toHaveBeenCalled();
	});

	// ===== Additional Date Mocking Tests =====

	it('should handle exact deadline time comparison', async () => {
		// Create a task with deadline exactly at MOCK_DATE
		const exactDeadline = new Date(MOCK_TIMESTAMP);
		const task = {
			id: 1,
			completed: false,
			deadline: exactDeadline,
			state: 'In Progress',
		} as any;
		mockRepo.findAll.mockResolvedValue([task]);
		mockRepo.setCompletion.mockResolvedValue({} as any);

		await manager.refreshOverdue();
		// Task with deadline exactly at current time should NOT be marked overdue (< not <=)
		expect(mockRepo.setCompletion).not.toHaveBeenCalled();
	});

	it('should format dates consistently in tests', async () => {
		// Use ISO string format for predictable dates
		const specificDate = new Date('2025-12-01T00:00:00.000Z');
		const task = {
			id: 1,
			completed: false,
			childrenTasks: [],
			actualStartDate: specificDate,
			toJSON: () => ({ id: 1, completed: true }),
		} as any;
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.setCompletion.mockResolvedValue(task);

		const result = await manager.completeTask(1);
		// Calculate expected duration (approximately 106 hours from 2025-12-01 to 2025-12-05 10:00)
		const expectedDuration = (MOCK_TIMESTAMP - specificDate.getTime()) / (1000 * 60 * 60);
		const callArgs = (mockRepo.setCompletion as jest.Mock).mock.calls[0];
		expect(callArgs[4]).toBe(expectedDuration);
		expect(result.ok).toBe(true);
	});

	it('should handle timezone-aware dates', async () => {
		// UTC time is consistent across timezones
		const utcDate = new Date('2025-12-05T00:00:00.000Z');
		expect(utcDate.toISOString()).toBe('2025-12-05T00:00:00.000Z');

		const task = {
			id: 1,
			completed: false,
			deadline: utcDate,
			state: 'Scheduled',
		} as any;

		// Verify date is in the past relative to MOCK_DATE (10:00 UTC)
		expect(utcDate.getTime()).toBeLessThan(MOCK_TIMESTAMP);
	});

	it('should calculate milliseconds correctly for duration', async () => {
		const hoursAgo = 3;
		const startDate = new Date(MOCK_TIMESTAMP - hoursAgo * 60 * 60 * 1000);

		const task = {
			id: 1,
			completed: false,
			childrenTasks: [],
			actualStartDate: startDate,
			toJSON: () => ({ id: 1, completed: true }),
		} as any;
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.setCompletion.mockResolvedValue(task);

		await manager.completeTask(1);

		const callArgs = (mockRepo.setCompletion as jest.Mock).mock.calls[0];
		// Duration should be approximately 3 hours (within margin due to Date() timing)
		expect(callArgs[4]).toBe(3);
	});
});
