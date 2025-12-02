import { TaskCalculator } from '../TaskCalculator';

describe('TaskCalculator', () => {
	let calculator: TaskCalculator;
	let mockRepo: any;
	let mockDepMgr: any;

	beforeEach(() => {
		mockRepo = {
			findById: jest.fn(),
			findDescendants: jest.fn(),
			findAll: jest.fn(),
		};
		mockDepMgr = {};
		calculator = new TaskCalculator(mockRepo, mockDepMgr);
	});

	it('should throw NOT_FOUND if task not found (getTaskCompleteness)', async () => {
		mockRepo.findById.mockResolvedValue(null);
		await expect(calculator.getTaskCompleteness(1)).rejects.toThrow('Task not found');
	});

	it('should compute completeness for a completed leaf task', async () => {
		const task = { id: 1, completed: true, actualDurationHour: 2, estimateDurationHour: 2 };
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.findDescendants.mockResolvedValue([task]);
		const result = await calculator.getTaskCompleteness(1);
		expect(result).toBe(0);
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
});
