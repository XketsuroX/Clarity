import { TaskCalculator } from '../TaskCalculator';

describe('TaskCalculator', () => {
	let calculator: TaskCalculator;
	let mockRepo: any;

	beforeEach(() => {
		mockRepo = {
			findById: jest.fn(),
			findDescendants: jest.fn(),
			findAll: jest.fn(),
		};
		calculator = new TaskCalculator(mockRepo);
	});

	// ===== getTaskCompleteness Tests =====

	it('should throw NOT_FOUND if task not found (getTaskCompleteness)', async () => {
		mockRepo.findById.mockResolvedValue(null);
		await expect(calculator.getTaskCompleteness(1)).rejects.toThrow('Task not found');
	});

	it('should compute completeness for a completed leaf task', async () => {
		const task = { id: 1, completed: true, actualDurationHour: 2, estimateDurationHour: 2 };
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		const result = await calculator.getTaskCompleteness(1);
		expect(result).toBe(100);
	});

	it('should throw MISSING_DURATION if descendant missing estimate', async () => {
		const task = { id: 1, completed: false, estimateDurationHour: 2 };
		const desc = { id: 2, completed: false };
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task, desc]);
		await expect(calculator.getTaskCompleteness(1)).rejects.toMatchObject({
			code: 'MISSING_DURATION',
		});
	});

	it('should compute completeness with in-progress state', async () => {
		const task = {
			id: 1,
			completed: false,
			estimateDurationHour: 10,
			completeness: 50,
			state: 'In Progress',
		};
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		const result = await calculator.getTaskCompleteness(1);
		expect(result).toBe(50);
	});

	it('should compute completeness with scheduled state', async () => {
		const task = {
			id: 1,
			completed: false,
			estimateDurationHour: 10,
			completeness: 30,
			state: 'Scheduled',
		};
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		const result = await calculator.getTaskCompleteness(1);
		expect(result).toBe(30);
	});

	it('should compute completeness with overdue state (non-leaf)', async () => {
		const parent = {
			id: 1,
			completed: false,
			estimateDurationHour: 10,
			state: 'Overdue',
			childrenTasks: [{ id: 2 }],
		};
		const child = {
			id: 2,
			parentTask: { id: 1 },
			completed: false,
			estimateDurationHour: 5,
			completeness: 0,
			state: 'In Progress',
		};
		mockRepo.findById.mockResolvedValue(parent);
		mockRepo.findDescendants.mockResolvedValue([parent, child]);
		const result = await calculator.getTaskCompleteness(1);
		expect(typeof result).toBe('number');
		expect(result).toBeGreaterThanOrEqual(0);
		expect(result).toBeLessThanOrEqual(100);
	});

	it('should handle multiple descendants with different states', async () => {
		const parent = {
			id: 1,
			completed: false,
			estimateDurationHour: 10,
			state: 'In Progress',
			childrenTasks: [{ id: 2 }, { id: 3 }],
		};
		const child1 = {
			id: 2,
			parentTask: { id: 1 },
			completed: false,
			estimateDurationHour: 5,
			completeness: 50,
			state: 'In Progress',
		};
		const child2 = {
			id: 3,
			parentTask: { id: 1 },
			completed: false,
			estimateDurationHour: 5,
			completeness: 75,
			state: 'Scheduled',
		};
		mockRepo.findById.mockResolvedValue(parent);
		mockRepo.findDescendants.mockResolvedValue([parent, child1, child2]);
		const result = await calculator.getTaskCompleteness(1);
		expect(typeof result).toBe('number');
		expect(result).toBeGreaterThanOrEqual(0);
		expect(result).toBeLessThanOrEqual(100);
	});

	it('should use actual duration for completed parent and aggregate descendants', async () => {
		const parent = {
			id: 1,
			completed: true,
			actualDurationHour: 4,
			estimateDurationHour: 10,
			state: 'Completed',
			childrenTasks: [{ id: 2 }],
		};
		const child = {
			id: 2,
			parentTask: { id: 1 },
			completed: false,
			estimateDurationHour: 6,
			completeness: 50,
			state: 'In Progress',
		};
		mockRepo.findById.mockResolvedValue(parent);
		mockRepo.findDescendants.mockResolvedValue([parent, child]);

		const result = await calculator.getTaskCompleteness(1);

		expect(result).toBe(70); // 4 completed hours from parent + 3 from child (50% of 6) over total 10
	});

	it('should compute completeness using actual duration for completed tasks', async () => {
		const task = {
			id: 1,
			completed: true,
			estimateDurationHour: 5,
			actualDurationHour: 7,
		};
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		const result = await calculator.getTaskCompleteness(1);
		expect(result).toBe(100);
	});

	it('should return 0 completeness when denominator is 0', async () => {
		const task = {
			id: 1,
			completed: true,
		};
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		const result = await calculator.getTaskCompleteness(1);
		expect(result).toBe(0);
	});

	it('should clamp completeness value between 0 and 100', async () => {
		const task = {
			id: 1,
			completed: false,
			estimateDurationHour: 10,
			completeness: 150,
			state: 'In Progress',
		};
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		const result = await calculator.getTaskCompleteness(1);
		expect(result).toBeGreaterThanOrEqual(0);
		expect(result).toBeLessThanOrEqual(100);
	});

	// ===== getTaskUrgency Tests =====

	it('should throw NOT_FOUND if task not found (getTaskUrgency)', async () => {
		mockRepo.findById.mockResolvedValue(null);
		await expect(calculator.getTaskUrgency(1)).rejects.toThrow('Task not found');
	});

	it('should return 0 urgency for completed task', async () => {
		const task = { id: 1, completed: true };
		mockRepo.findById.mockResolvedValue(task);
		const result = await calculator.getTaskUrgency(1);
		expect(result).toBe(0);
	});

	it('should return 0 urgency for task with no deadline', async () => {
		const task = { id: 1, completed: false, deadline: undefined, estimateDurationHour: 2 };
		mockRepo.findById.mockResolvedValue(task);
		const result = await calculator.getTaskUrgency(1);
		expect(result).toBe(0);
	});

	it('should return 100 urgency for overdue task', async () => {
		const now = new Date();
		const task = {
			id: 1,
			completed: false,
			deadline: new Date(now.getTime() - 1000),
			estimateDurationHour: 2,
		};
		mockRepo.findById.mockResolvedValue(task);
		const result = await calculator.getTaskUrgency(1);
		expect(result).toBe(100);
	});

	it('should throw MISSING_DURATION if task has no estimate (getTaskUrgency)', async () => {
		const task = { id: 1, completed: false, deadline: new Date() };
		mockRepo.findById.mockResolvedValue(task);
		await expect(calculator.getTaskUrgency(1)).rejects.toMatchObject({
			code: 'MISSING_DURATION',
		});
	});

	it('should compute urgency for task within window', async () => {
		const now = new Date();
		const deadline = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days from now
		const task = {
			id: 1,
			completed: false,
			deadline,
			estimateDurationHour: 2,
		};
		mockRepo.findById.mockResolvedValue(task);
		const result = await calculator.getTaskUrgency(1, 30);
		expect(result).toBeGreaterThan(0);
		expect(result).toBeLessThan(100);
	});

	it('should return 0 urgency for task deadline far in future', async () => {
		const now = new Date();
		const deadline = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days from now
		const task = {
			id: 1,
			completed: false,
			deadline,
			estimateDurationHour: 2,
		};
		mockRepo.findById.mockResolvedValue(task);
		const result = await calculator.getTaskUrgency(1, 30);
		expect(result).toBe(0);
	});

	it('should compute urgency considering task duration (start-by)', async () => {
		const now = new Date();
		const deadline = new Date(now.getTime() + 10 * 60 * 60 * 1000); // 10 hours from now
		const task = {
			id: 1,
			completed: false,
			deadline,
			estimateDurationHour: 5, // 5 hours duration
		};
		mockRepo.findById.mockResolvedValue(task);
		const result = await calculator.getTaskUrgency(1, 1); // 1 day window
		expect(result).toBeGreaterThan(0);
		expect(result).toBeLessThanOrEqual(100);
	});

	it('should return 100 urgency when start-by time has passed', async () => {
		const now = new Date();
		const deadline = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
		const task = {
			id: 1,
			completed: false,
			deadline,
			estimateDurationHour: 5, // needs 5 hours, only 2 hours available
		};
		mockRepo.findById.mockResolvedValue(task);
		const result = await calculator.getTaskUrgency(1, 1);
		expect(result).toBe(100);
	});

	it('should return correct actual vs estimated', async () => {
		const task = { id: 1, estimateDurationHour: 2, actualDurationHour: 3 };
		mockRepo.findById.mockResolvedValue(task);
		const result = await calculator.getActualVsEstimated(1);
		expect(result).toEqual({
			estimatedDurationHour: 2,
			actualDurationHour: 3,
			deltaHour: 1,
			deltaPercent: 50,
		});
	});

	it('should return nulls if no actual duration', async () => {
		const task = { id: 1, estimateDurationHour: 2, actualDurationHour: null };
		mockRepo.findById.mockResolvedValue(task);
		const result = await calculator.getActualVsEstimated(1);
		expect(result).toEqual({
			estimatedDurationHour: 2,
			actualDurationHour: null,
			deltaHour: null,
			deltaPercent: null,
		});
	});

	it('should compute average actual vs estimated', async () => {
		const tasks = [
			{ id: 1, estimateDurationHour: 2, actualDurationHour: 3 },
			{ id: 2, estimateDurationHour: 4, actualDurationHour: 6 },
		];
		mockRepo.findAll.mockResolvedValue(tasks);
		calculator.getActualVsEstimated = jest
			.fn()
			.mockResolvedValueOnce({
				estimatedDurationHour: 2,
				actualDurationHour: 3,
				deltaHour: 1,
				deltaPercent: 50,
			})
			.mockResolvedValueOnce({
				estimatedDurationHour: 4,
				actualDurationHour: 6,
				deltaHour: 2,
				deltaPercent: 50,
			});
		const result = await calculator.getAverageActualVsEstimated();
		expect(result).toEqual({
			avgDeltaHour: 1.5,
			avgDeltaPercent: 50,
			count: 2,
		});
	});

	it('should throw NOT_FOUND if task not found (estimatedTaskDuration)', async () => {
		mockRepo.findById.mockResolvedValue(null);
		await expect(calculator.estimatedTaskDuration(1)).rejects.toThrow('Task not found');
	});

	it('should throw OVERDUE_TASK if root is overdue and not completed', async () => {
		const task = { id: 1, state: 'Overdue', completed: false };
		mockRepo.findById.mockResolvedValue(task);
		await expect(calculator.estimatedTaskDuration(1)).rejects.toMatchObject({
			code: 'OVERDUE_TASK',
		});
	});

	it('should compute estimatedTaskDuration for a simple leaf', async () => {
		const task = {
			id: 1,
			state: 'In Progress',
			completed: false,
			estimateDurationHour: 5,
			completeness: 0,
		};
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		const result = await calculator.estimatedTaskDuration(1);
		expect(result).toBe(5);
	});

	it('should throw MISSING_DURATION if leaf has no estimate', async () => {
		const task = { id: 1, state: 'In Progress', completed: false };
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		await expect(calculator.estimatedTaskDuration(1)).rejects.toMatchObject({
			code: 'MISSING_DURATION',
		});
	});

	it('should skip completed descendant with no duration in completeness', async () => {
		const task = { id: 1, completed: false, estimateDurationHour: 2 };
		const desc = { id: 2, completed: true }; // no duration
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task, desc]);
		const result = await calculator.getTaskCompleteness(1);
		expect(typeof result).toBe('number');
	});

	it('should return 0 completeness for completed leaf with no duration', async () => {
		const task = { id: 1, completed: true };
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		const result = await calculator.getTaskCompleteness(1);
		expect(result).toBe(0);
	});

	it('should return null deltaPercent if estimatedDurationHour is 0', async () => {
		const task = { id: 1, estimateDurationHour: 0, actualDurationHour: 3 };
		mockRepo.findById.mockResolvedValue(task);
		const result = await calculator.getActualVsEstimated(1);
		expect(result.deltaPercent).toBeNull();
	});

	it('should return nulls if no tasks have actual/estimated duration', async () => {
		mockRepo.findAll.mockResolvedValue([]);
		const result = await calculator.getAverageActualVsEstimated();
		expect(result).toEqual({ avgDeltaHour: null, avgDeltaPercent: null, count: 0 });
	});

	it('should aggregate children durations for non-leaf', async () => {
		const task = {
			id: 1,
			state: 'In Progress',
			completed: false,
			estimateDurationHour: 5,
			completeness: 0,
		};
		const child = {
			id: 2,
			parentTask: { id: 1 },
			state: 'In Progress',
			completed: false,
			estimateDurationHour: 3,
			completeness: 0,
		};
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task, child]);
		const result = await calculator.estimatedTaskDuration(1);
		expect(result).toBe(8);
	});

	it('should compute remaining duration for leaf with completeness', async () => {
		const task = {
			id: 1,
			state: 'In Progress',
			completed: false,
			estimateDurationHour: 10,
			completeness: 60,
		};
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		const result = await calculator.estimatedTaskDuration(1);
		expect(result).toBeCloseTo(4); // 10 * (1 - 0.6)
	});

	// ===== Additional Coverage Tests =====

	it('should handle skip completed descendant with no duration in completeness', async () => {
		const task = { id: 1, completed: false, estimateDurationHour: 2 };
		const desc = { id: 2, completed: true }; // no duration
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task, desc]);
		const result = await calculator.getTaskCompleteness(1);
		expect(typeof result).toBe('number');
	});

	it('should return 0 completeness for completed leaf with no duration', async () => {
		const task = { id: 1, completed: true };
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		const result = await calculator.getTaskCompleteness(1);
		expect(result).toBe(0);
	});

	it('should compute average actual vs estimated', async () => {
		const tasks = [
			{ id: 1, estimateDurationHour: 2, actualDurationHour: 3 },
			{ id: 2, estimateDurationHour: 4, actualDurationHour: 6 },
		];
		mockRepo.findAll.mockResolvedValue(tasks);
		calculator.getActualVsEstimated = jest
			.fn()
			.mockResolvedValueOnce({
				estimatedDurationHour: 2,
				actualDurationHour: 3,
				deltaHour: 1,
				deltaPercent: 50,
			})
			.mockResolvedValueOnce({
				estimatedDurationHour: 4,
				actualDurationHour: 6,
				deltaHour: 2,
				deltaPercent: 50,
			});
		const result = await calculator.getAverageActualVsEstimated();
		expect(result).toEqual({
			avgDeltaHour: 1.5,
			avgDeltaPercent: 50,
			count: 2,
		});
	});

	it('should return nulls if no tasks have actual/estimated duration', async () => {
		mockRepo.findAll.mockResolvedValue([]);
		const result = await calculator.getAverageActualVsEstimated();
		expect(result).toEqual({ avgDeltaHour: null, avgDeltaPercent: null, count: 0 });
	});

	it('should skip tasks with missing data in average calculation', async () => {
		const tasks = [
			{ id: 1, estimateDurationHour: 2, actualDurationHour: 3 },
			{ id: 2, estimateDurationHour: null, actualDurationHour: null },
			{ id: 3, estimateDurationHour: 4, actualDurationHour: 5 },
		];
		mockRepo.findAll.mockResolvedValue(tasks);
		calculator.getActualVsEstimated = jest
			.fn()
			.mockResolvedValueOnce({
				estimatedDurationHour: 2,
				actualDurationHour: 3,
				deltaHour: 1,
				deltaPercent: 50,
			})
			.mockResolvedValueOnce({
				estimatedDurationHour: null,
				actualDurationHour: null,
				deltaHour: null,
				deltaPercent: null,
			})
			.mockResolvedValueOnce({
				estimatedDurationHour: 4,
				actualDurationHour: 5,
				deltaHour: 1,
				deltaPercent: 25,
			});
		const result = await calculator.getAverageActualVsEstimated();
		expect(result.count).toBe(2);
		expect(result.avgDeltaHour).toBe(1);
		expect(result.avgDeltaPercent).toBeCloseTo(37.5);
	});

	it('should handle mixed positive and negative deltas in average', async () => {
		const tasks = [{ id: 1 }, { id: 2 }];
		mockRepo.findAll.mockResolvedValue(tasks);
		calculator.getActualVsEstimated = jest
			.fn()
			.mockResolvedValueOnce({
				estimatedDurationHour: 2,
				actualDurationHour: 4,
				deltaHour: 2,
				deltaPercent: 100,
			})
			.mockResolvedValueOnce({
				estimatedDurationHour: 4,
				actualDurationHour: 2,
				deltaHour: -2,
				deltaPercent: -50,
			});
		const result = await calculator.getAverageActualVsEstimated();
		expect(result.count).toBe(2);
		expect(result.avgDeltaHour).toBe(0);
		expect(result.avgDeltaPercent).toBe(25);
	});

	it('should return 0 for completed task (estimatedTaskDuration)', async () => {
		const task = {
			id: 1,
			state: 'Completed',
			completed: true,
			estimateDurationHour: 5,
		};
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		const result = await calculator.estimatedTaskDuration(1);
		expect(result).toBe(0);
	});

	it('should skip non-in-progress parent task duration', async () => {
		const parent = {
			id: 1,
			state: 'Scheduled',
			completed: false,
			estimateDurationHour: 5,
		};
		const child = {
			id: 2,
			parentTask: { id: 1 },
			state: 'In Progress',
			completed: false,
			estimateDurationHour: 3,
			completeness: 0,
		};
		mockRepo.findById.mockResolvedValue(parent);
		mockRepo.findDescendants.mockResolvedValue([parent, child]);
		const result = await calculator.estimatedTaskDuration(1);
		expect(result).toBe(3); // Only child duration, not parent
	});

	it('should throw MISSING_DURATION if non-leaf missing estimate', async () => {
		const parent = {
			id: 1,
			state: 'In Progress',
			completed: false,
		};
		const child = {
			id: 2,
			parentTask: { id: 1 },
			state: 'In Progress',
			completed: false,
			estimateDurationHour: 3,
			completeness: 0,
		};
		mockRepo.findById.mockResolvedValue(parent);
		mockRepo.findDescendants.mockResolvedValue([parent, child]);
		await expect(calculator.estimatedTaskDuration(1)).rejects.toMatchObject({
			code: 'MISSING_DURATION',
		});
	});

	it('should handle overdue descendants without aborting', async () => {
		const parent = {
			id: 1,
			state: 'In Progress',
			completed: false,
			estimateDurationHour: 5,
			completeness: 0,
		};
		const child = {
			id: 2,
			parentTask: { id: 1 },
			state: 'Overdue',
			completed: false,
			estimateDurationHour: 3,
			completeness: 0,
		};
		mockRepo.findById.mockResolvedValue(parent);
		mockRepo.findDescendants.mockResolvedValue([parent, child]);
		const result = await calculator.estimatedTaskDuration(1);
		expect(result).toBe(8); // Should include overdue child
	});

	it('should handle deep task hierarchies', async () => {
		const root = {
			id: 1,
			state: 'In Progress',
			completed: false,
			estimateDurationHour: 2,
			completeness: 0,
		};
		const level1 = {
			id: 2,
			parentTask: { id: 1 },
			state: 'In Progress',
			completed: false,
			estimateDurationHour: 3,
			completeness: 0,
		};
		const level2 = {
			id: 3,
			parentTask: { id: 2 },
			state: 'In Progress',
			completed: false,
			estimateDurationHour: 4,
			completeness: 0,
		};
		mockRepo.findById.mockResolvedValue(root);
		mockRepo.findDescendants.mockResolvedValue([root, level1, level2]);
		const result = await calculator.estimatedTaskDuration(1);
		expect(result).toBe(9); // 2 + 3 + 4
	});

	it('should handle mixed completed and incomplete tasks', async () => {
		const parent = {
			id: 1,
			state: 'In Progress',
			completed: false,
			estimateDurationHour: 5,
			completeness: 0,
		};
		const child1 = {
			id: 2,
			parentTask: { id: 1 },
			state: 'Completed',
			completed: true,
			estimateDurationHour: 2,
		};
		const child2 = {
			id: 3,
			parentTask: { id: 1 },
			state: 'In Progress',
			completed: false,
			estimateDurationHour: 3,
			completeness: 0,
		};
		mockRepo.findById.mockResolvedValue(parent);
		mockRepo.findDescendants.mockResolvedValue([parent, child1, child2]);
		const result = await calculator.estimatedTaskDuration(1);
		expect(result).toBe(8); // 5 (parent) + 0 (completed child) + 3 (incomplete child)
	});

	it('should compute remaining for leaf with 100% completeness', async () => {
		const task = {
			id: 1,
			state: 'In Progress',
			completed: false,
			estimateDurationHour: 10,
			completeness: 100,
		};
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		const result = await calculator.estimatedTaskDuration(1);
		expect(result).toBeCloseTo(0);
	});

	it('should handle leaf with no completeness value', async () => {
		const task = {
			id: 1,
			state: 'In Progress',
			completed: false,
			estimateDurationHour: 10,
		};
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		const result = await calculator.estimatedTaskDuration(1);
		expect(result).toBe(10);
	});

	it('should allow completed root task without error', async () => {
		const task = {
			id: 1,
			state: 'Completed',
			completed: true,
			estimateDurationHour: 5,
		};
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		const result = await calculator.estimatedTaskDuration(1);
		expect(result).toBe(0);
	});

	it('should handle negative delta with correct percentage', async () => {
		const task = { id: 1, estimateDurationHour: 10, actualDurationHour: 8 };
		mockRepo.findById.mockResolvedValue(task);
		const result = await calculator.getActualVsEstimated(1);
		expect(result.deltaHour).toBe(-2);
		expect(result.deltaPercent).toBe(-20);
	});

	it('should compute urgency at deadline boundary', async () => {
		const now = new Date();
		const deadline = new Date(now.getTime()); // exactly now
		const task = {
			id: 1,
			completed: false,
			deadline,
			estimateDurationHour: 2,
		};
		mockRepo.findById.mockResolvedValue(task);
		const result = await calculator.getTaskUrgency(1);
		expect(result).toBe(100);
	});

	it('should handle urgency with minimal duration', async () => {
		const now = new Date();
		const deadline = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now
		const task = {
			id: 1,
			completed: false,
			deadline,
			estimateDurationHour: 0.1, // 6 minutes
		};
		mockRepo.findById.mockResolvedValue(task);
		const result = await calculator.getTaskUrgency(1, 1);
		expect(result).toBeGreaterThan(0);
	});

	it('should compute completeness for multi-level tree with mixed states', async () => {
		const root = {
			id: 1,
			completed: false,
			estimateDurationHour: 10,
			state: 'In Progress',
			childrenTasks: [{ id: 2 }],
		};
		const level1 = {
			id: 2,
			parentTask: { id: 1 },
			completed: false,
			estimateDurationHour: 8,
			completeness: 50,
			state: 'In Progress',
			childrenTasks: [{ id: 3 }, { id: 4 }],
		};
		const level2a = {
			id: 3,
			parentTask: { id: 2 },
			completed: false,
			estimateDurationHour: 3,
			completeness: 75,
			state: 'In Progress',
		};
		const level2b = {
			id: 4,
			parentTask: { id: 2 },
			completed: true,
			actualDurationHour: 2,
		};
		mockRepo.findById.mockResolvedValue(root);
		mockRepo.findDescendants.mockResolvedValue([root, level1, level2a, level2b]);
		const result = await calculator.getTaskCompleteness(1);
		expect(typeof result).toBe('number');
		expect(result).toBeGreaterThanOrEqual(0);
		expect(result).toBeLessThanOrEqual(100);
	});

	it('should handle completed non-leaf descendant in completeness calculation', async () => {
		const parent = {
			id: 1,
			completed: false,
			estimateDurationHour: 10,
			state: 'In Progress',
			childrenTasks: [{ id: 2 }],
		};
		const child = {
			id: 2,
			parentTask: { id: 1 },
			completed: true,
			actualDurationHour: 5,
			childrenTasks: [{ id: 3 }],
		};
		const grandchild = {
			id: 3,
			parentTask: { id: 2 },
			completed: true,
			actualDurationHour: 3,
		};
		mockRepo.findById.mockResolvedValue(parent);
		mockRepo.findDescendants.mockResolvedValue([parent, child, grandchild]);
		const result = await calculator.getTaskCompleteness(1);
		expect(typeof result).toBe('number');
		expect(result).toBeGreaterThanOrEqual(0);
		expect(result).toBeLessThanOrEqual(100);
	});

	it('should handle non-completed non-leaf parent task', async () => {
		const parent = {
			id: 1,
			completed: false,
			estimateDurationHour: 10,
			state: 'In Progress',
			childrenTasks: [{ id: 2 }],
		};
		const child = {
			id: 2,
			parentTask: { id: 1 },
			completed: false,
			estimateDurationHour: 5,
			completeness: 0,
			state: 'In Progress',
		};
		mockRepo.findById.mockResolvedValue(parent);
		mockRepo.findDescendants.mockResolvedValue([parent, child]);
		const result = await calculator.getTaskCompleteness(1);
		expect(typeof result).toBe('number');
		expect(result).toBeGreaterThanOrEqual(0);
		expect(result).toBeLessThanOrEqual(100);
	});

	it('should throw NOT_FOUND if task not found (getActualVsEstimated)', async () => {
		mockRepo.findById.mockResolvedValue(null);
		await expect(calculator.getActualVsEstimated(99)).rejects.toThrow('Task not found');
	});

	it('should handle task with no estimated or actual duration in getActualVsEstimated', async () => {
		const task = { id: 1 };
		mockRepo.findById.mockResolvedValue(task);
		const result = await calculator.getActualVsEstimated(1);
		expect(result).toEqual({
			estimatedDurationHour: undefined,
			actualDurationHour: null,
			deltaHour: null,
			deltaPercent: null,
		});
	});

	it('should handle zero or negative estimate duration in urgency', async () => {
		const task = {
			id: 1,
			completed: false,
			deadline: new Date(),
			estimateDurationHour: 0,
		};
		mockRepo.findById.mockResolvedValue(task);
		await expect(calculator.getTaskUrgency(1)).rejects.toMatchObject({
			code: 'MISSING_DURATION',
		});
	});

	// ===== Additional Edge Cases =====

	it('should handle task with negative completeness value', async () => {
		const task = {
			id: 1,
			completed: false,
			estimateDurationHour: 10,
			completeness: -50,
			state: 'In Progress',
		};
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		const result = await calculator.getTaskCompleteness(1);
		expect(result).toBe(0); // Should clamp to 0
	});

	it('should handle task with completeness over 100', async () => {
		const task = {
			id: 1,
			completed: false,
			estimateDurationHour: 10,
			completeness: 250,
			state: 'In Progress',
		};
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		const result = await calculator.getTaskCompleteness(1);
		expect(result).toBe(100); // Should clamp to 100
	});

	it('should handle empty descendants array', async () => {
		const task = {
			id: 1,
			completed: false,
			estimateDurationHour: 10,
			completeness: 50,
			state: 'In Progress',
		};
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]); // Only self, no descendants
		const result = await calculator.getTaskCompleteness(1);
		expect(result).toBe(50);
	});

	it('should handle task with very small estimateDurationHour', async () => {
		const task = {
			id: 1,
			completed: false,
			estimateDurationHour: 0.01,
			completeness: 50,
			state: 'In Progress',
		};
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		const result = await calculator.getTaskCompleteness(1);
		expect(result).toBe(50);
	});

	it('should handle task with very large estimateDurationHour', async () => {
		const task = {
			id: 1,
			completed: false,
			estimateDurationHour: 10000,
			completeness: 25,
			state: 'In Progress',
		};
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		const result = await calculator.getTaskCompleteness(1);
		expect(result).toBe(25);
	});

	it('should handle all descendants completed', async () => {
		const parent = {
			id: 1,
			completed: false,
			estimateDurationHour: 10,
			state: 'In Progress',
			completeness: 0,
		};
		const child1 = {
			id: 2,
			parentTask: { id: 1 },
			completed: true,
			actualDurationHour: 5,
		};
		const child2 = {
			id: 3,
			parentTask: { id: 1 },
			completed: true,
			actualDurationHour: 3,
		};
		mockRepo.findById.mockResolvedValue(parent);
		mockRepo.findDescendants.mockResolvedValue([parent, child1, child2]);
		const result = await calculator.getTaskCompleteness(1);
		expect(result).toBeGreaterThan(0);
		expect(result).toBeLessThanOrEqual(100);
	});

	it('should handle all descendants incomplete with 0% completeness', async () => {
		const parent = {
			id: 1,
			completed: false,
			estimateDurationHour: 10,
			state: 'In Progress',
			completeness: 0,
		};
		const child1 = {
			id: 2,
			parentTask: { id: 1 },
			completed: false,
			estimateDurationHour: 5,
			completeness: 0,
			state: 'In Progress',
		};
		const child2 = {
			id: 3,
			parentTask: { id: 1 },
			completed: false,
			estimateDurationHour: 3,
			completeness: 0,
			state: 'Scheduled',
		};
		mockRepo.findById.mockResolvedValue(parent);
		mockRepo.findDescendants.mockResolvedValue([parent, child1, child2]);
		const result = await calculator.getTaskCompleteness(1);
		expect(result).toBe(0);
	});

	it('should handle urgency with negative windowDays (should use minimum 1)', async () => {
		const now = new Date();
		const deadline = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 hours from now
		const task = {
			id: 1,
			completed: false,
			deadline,
			estimateDurationHour: 2,
		};
		mockRepo.findById.mockResolvedValue(task);
		const result = await calculator.getTaskUrgency(1, -5); // negative window
		expect(typeof result).toBe('number');
		expect(result).toBeGreaterThanOrEqual(0);
		expect(result).toBeLessThanOrEqual(100);
	});

	it('should handle urgency with windowDays = 0 (should use minimum 1)', async () => {
		const now = new Date();
		const deadline = new Date(now.getTime() + 12 * 60 * 60 * 1000);
		const task = {
			id: 1,
			completed: false,
			deadline,
			estimateDurationHour: 2,
		};
		mockRepo.findById.mockResolvedValue(task);
		const result = await calculator.getTaskUrgency(1, 0);
		expect(typeof result).toBe('number');
		expect(result).toBeGreaterThanOrEqual(0);
		expect(result).toBeLessThanOrEqual(100);
	});

	it('should handle getActualVsEstimated with negative actual duration', async () => {
		const task = { id: 1, estimateDurationHour: 5, actualDurationHour: -2 };
		mockRepo.findById.mockResolvedValue(task);
		const result = await calculator.getActualVsEstimated(1);
		expect(result.actualDurationHour).toBe(-2);
		expect(result.deltaHour).toBe(-7);
	});

	it('should handle getActualVsEstimated with zero estimate', async () => {
		const task = { id: 1, estimateDurationHour: 0, actualDurationHour: 5 };
		mockRepo.findById.mockResolvedValue(task);
		const result = await calculator.getActualVsEstimated(1);
		expect(result.deltaPercent).toBeNull(); // Cannot compute percent with 0 estimate
		expect(result.deltaHour).toBe(5);
	});

	it('should handle getActualVsEstimated with matching actual and estimate', async () => {
		const task = { id: 1, estimateDurationHour: 5, actualDurationHour: 5 };
		mockRepo.findById.mockResolvedValue(task);
		const result = await calculator.getActualVsEstimated(1);
		expect(result.deltaHour).toBe(0);
		expect(result.deltaPercent).toBe(0);
	});

	it('should handle average calculation with only one valid task', async () => {
		const tasks = [{ id: 1, estimateDurationHour: 2, actualDurationHour: 3 }];
		mockRepo.findAll.mockResolvedValue(tasks);
		calculator.getActualVsEstimated = jest.fn().mockResolvedValueOnce({
			estimatedDurationHour: 2,
			actualDurationHour: 3,
			deltaHour: 1,
			deltaPercent: 50,
		});
		const result = await calculator.getAverageActualVsEstimated();
		expect(result.count).toBe(1);
		expect(result.avgDeltaHour).toBe(1);
		expect(result.avgDeltaPercent).toBe(50);
	});

	it('should handle estimatedTaskDuration with negative completeness', async () => {
		const task = {
			id: 1,
			state: 'In Progress',
			completed: false,
			estimateDurationHour: 10,
			completeness: -20,
		};
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		const result = await calculator.estimatedTaskDuration(1);
		// Formula: 10 * (1 - (-20/100)) = 10 * 1.2 = 12
		expect(result).toBe(12);
	});

	it('should handle estimatedTaskDuration with completeness over 100', async () => {
		const task = {
			id: 1,
			state: 'In Progress',
			completed: false,
			estimateDurationHour: 10,
			completeness: 150,
		};
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		const result = await calculator.estimatedTaskDuration(1);
		// Formula: 10 * (1 - (150/100)) = 10 * (-0.5) = -5
		expect(result).toBe(-5);
	});

	it('should handle deeply nested hierarchy (5 levels)', async () => {
		const level0 = {
			id: 1,
			state: 'In Progress',
			completed: false,
			estimateDurationHour: 1,
			completeness: 0,
		};
		const level1 = {
			id: 2,
			parentTask: { id: 1 },
			state: 'In Progress',
			completed: false,
			estimateDurationHour: 2,
			completeness: 0,
		};
		const level2 = {
			id: 3,
			parentTask: { id: 2 },
			state: 'In Progress',
			completed: false,
			estimateDurationHour: 3,
			completeness: 0,
		};
		const level3 = {
			id: 4,
			parentTask: { id: 3 },
			state: 'In Progress',
			completed: false,
			estimateDurationHour: 4,
			completeness: 0,
		};
		const level4 = {
			id: 5,
			parentTask: { id: 4 },
			state: 'In Progress',
			completed: false,
			estimateDurationHour: 5,
			completeness: 0,
		};
		mockRepo.findById.mockResolvedValue(level0);
		mockRepo.findDescendants.mockResolvedValue([level0, level1, level2, level3, level4]);
		const result = await calculator.estimatedTaskDuration(1);
		expect(result).toBe(15); // 1+2+3+4+5
	});

	it('should handle task with undefined completeness field', async () => {
		const task = {
			id: 1,
			completed: false,
			estimateDurationHour: 10,
			state: 'In Progress',
			// completeness is undefined
		};
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		const result = await calculator.getTaskCompleteness(1);
		expect(result).toBe(0); // Should default to 0
	});

	it('should handle task with null completeness field', async () => {
		const task = {
			id: 1,
			completed: false,
			estimateDurationHour: 10,
			completeness: null,
			state: 'In Progress',
		};
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		const result = await calculator.getTaskCompleteness(1);
		expect(result).toBe(0); // Should default to 0
	});

	it('should handle parent with no children array', async () => {
		const parent = {
			id: 1,
			completed: false,
			estimateDurationHour: 10,
			state: 'In Progress',
			completeness: 50,
			// no childrenTasks field
		};
		mockRepo.findById.mockResolvedValue(parent);
		mockRepo.findDescendants.mockResolvedValue([parent]);
		const result = await calculator.getTaskCompleteness(1);
		expect(result).toBe(50); // Should treat as leaf
	});

	it('should handle very precise decimal completeness values', async () => {
		const task = {
			id: 1,
			completed: false,
			estimateDurationHour: 10,
			completeness: 33.333333,
			state: 'In Progress',
		};
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		const result = await calculator.getTaskCompleteness(1);
		expect(result).toBe(33); // Should round properly
	});

	it('should handle urgency with deadline exactly at window boundary', async () => {
		const now = new Date();
		const deadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // exactly 30 days
		const task = {
			id: 1,
			completed: false,
			deadline,
			estimateDurationHour: 2,
		};
		mockRepo.findById.mockResolvedValue(task);
		const result = await calculator.getTaskUrgency(1, 30);
		expect(result).toBeGreaterThanOrEqual(0);
		expect(result).toBeLessThanOrEqual(100);
	});

	it('should handle multiple levels with all overdue descendants', async () => {
		const parent = {
			id: 1,
			completed: false,
			estimateDurationHour: 10,
			state: 'In Progress',
			completeness: 0,
		};
		const child1 = {
			id: 2,
			parentTask: { id: 1 },
			completed: false,
			estimateDurationHour: 5,
			completeness: 30,
			state: 'Overdue',
		};
		const child2 = {
			id: 3,
			parentTask: { id: 1 },
			completed: false,
			estimateDurationHour: 3,
			completeness: 20,
			state: 'Overdue',
		};
		mockRepo.findById.mockResolvedValue(parent);
		mockRepo.findDescendants.mockResolvedValue([parent, child1, child2]);
		const result = await calculator.getTaskCompleteness(1);
		expect(typeof result).toBe('number');
		expect(result).toBeGreaterThanOrEqual(0);
		expect(result).toBeLessThanOrEqual(100);
	});

	it('should handle non-leaf parent with scheduled state', async () => {
		const parent = {
			id: 1,
			completed: false,
			estimateDurationHour: 10,
			state: 'Scheduled',
			childrenTasks: [{ id: 2 }],
		};
		const child = {
			id: 2,
			parentTask: { id: 1 },
			completed: false,
			estimateDurationHour: 5,
			completeness: 50,
			state: 'In Progress',
		};
		mockRepo.findById.mockResolvedValue(parent);
		mockRepo.findDescendants.mockResolvedValue([parent, child]);
		const result = await calculator.estimatedTaskDuration(1);
		expect(result).toBe(2.5); // Only child: 5 * (1 - 0.5) = 2.5
	});

	it('should handle completeness rounding edge case (49.5%)', async () => {
		const task = {
			id: 1,
			completed: false,
			estimateDurationHour: 10,
			completeness: 49.5,
			state: 'In Progress',
		};
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		const result = await calculator.getTaskCompleteness(1);
		expect([49, 50]).toContain(result); // Should round to nearest integer
	});

	it('should handle getActualVsEstimated with very large numbers', async () => {
		const task = { id: 1, estimateDurationHour: 10000, actualDurationHour: 15000 };
		mockRepo.findById.mockResolvedValue(task);
		const result = await calculator.getActualVsEstimated(1);
		expect(result.deltaHour).toBe(5000);
		expect(result.deltaPercent).toBe(50);
	});

	it('should handle mixed leaf and non-leaf siblings', async () => {
		const parent = {
			id: 1,
			completed: false,
			estimateDurationHour: 10,
			state: 'In Progress',
			childrenTasks: [{ id: 2 }, { id: 3 }],
		};
		const leafChild = {
			id: 2,
			parentTask: { id: 1 },
			completed: false,
			estimateDurationHour: 5,
			completeness: 50,
			state: 'In Progress',
		};
		const nonLeafChild = {
			id: 3,
			parentTask: { id: 1 },
			completed: false,
			estimateDurationHour: 3,
			state: 'In Progress',
			childrenTasks: [{ id: 4 }],
		};
		const grandchild = {
			id: 4,
			parentTask: { id: 3 },
			completed: false,
			estimateDurationHour: 2,
			completeness: 75,
			state: 'In Progress',
		};
		mockRepo.findById.mockResolvedValue(parent);
		mockRepo.findDescendants.mockResolvedValue([parent, leafChild, nonLeafChild, grandchild]);
		const result = await calculator.getTaskCompleteness(1);
		expect(typeof result).toBe('number');
		expect(result).toBeGreaterThanOrEqual(0);
		expect(result).toBeLessThanOrEqual(100);
	});
});
