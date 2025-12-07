import { Scheduler } from '../Scheduler';
import { Task } from '../Task';

// Mock taskCalculator
jest.mock('../TaskCalculator', () => ({
	taskCalculator: {
		getTaskUrgency: jest.fn(),
	},
}));

import { taskCalculator } from '../TaskCalculator';

describe('Scheduler', () => {
	let scheduler: Scheduler;

	beforeEach(() => {
		scheduler = new Scheduler();
		jest.clearAllMocks();
	});

	it('should schedule non-splittable tasks within capacity', async () => {
		const tasks: Task[] = [
			{ id: 1, title: 'A', estimateDurationHour: 2, priority: 1, isSplittable: false } as any,
			{ id: 2, title: 'B', estimateDurationHour: 3, priority: 2, isSplittable: false } as any,
		];
		// Mock urgency
		(taskCalculator.getTaskUrgency as jest.Mock)
			.mockResolvedValueOnce(5)
			.mockResolvedValueOnce(10);

		const result = await scheduler.schedule(tasks, 4, 1);

		expect(result).toEqual([
			expect.objectContaining({
				taskId: 2,
				title: 'B',
				scheduledDuration: 3,
				isPartial: false,
			}),
		]);
	});

	it('should schedule splittable tasks and split them', async () => {
		const tasks: Task[] = [
			{ id: 1, title: 'A', estimateDurationHour: 2, priority: 1, isSplittable: true } as any,
			{ id: 2, title: 'B', estimateDurationHour: 1, priority: 2, isSplittable: false } as any,
		];
		(taskCalculator.getTaskUrgency as jest.Mock)
			.mockResolvedValueOnce(6)
			.mockResolvedValueOnce(12);

		const result = await scheduler.schedule(tasks, 1.5, 0.5);

		expect(result).toEqual([
			expect.objectContaining({
				taskId: 2,
				title: 'B',
				scheduledDuration: 1,
				isPartial: false,
			}),
			expect.objectContaining({
				taskId: 1,
				title: 'A',
				scheduledDuration: 0.5,
				isPartial: true,
			}),
		]);
	});

	it('should return empty array if no tasks', async () => {
		const result = await scheduler.schedule([], 8, 1);
		expect(result).toEqual([]);
	});

	it('should handle all tasks exceeding capacity', async () => {
		const tasks: Task[] = [
			{
				id: 1,
				title: 'A',
				estimateDurationHour: 10,
				priority: 1,
				isSplittable: false,
			} as any,
			{
				id: 2,
				title: 'B',
				estimateDurationHour: 12,
				priority: 2,
				isSplittable: false,
			} as any,
		];
		(taskCalculator.getTaskUrgency as jest.Mock)
			.mockResolvedValueOnce(5)
			.mockResolvedValueOnce(10);

		const result = await scheduler.schedule(tasks, 2, 1);
		expect(result.length).toBeLessThanOrEqual(1);
	});

	it('should mark isPartial true if scheduledDuration < estimateDurationHour', async () => {
		const tasks: Task[] = [
			{ id: 1, title: 'A', estimateDurationHour: 3, priority: 1, isSplittable: true } as any,
		];
		(taskCalculator.getTaskUrgency as jest.Mock).mockResolvedValue(9);

		const result = await scheduler.schedule(tasks, 1, 1);

		expect(result[0].isPartial).toBe(true);
		expect(result[0].scheduledDuration).toBe(1);
	});

	it('should mark isPartial false if scheduledDuration == estimateDurationHour', async () => {
		const tasks: Task[] = [
			{ id: 1, title: 'A', estimateDurationHour: 2, priority: 1, isSplittable: true } as any,
		];
		(taskCalculator.getTaskUrgency as jest.Mock).mockResolvedValue(8);

		const result = await scheduler.schedule(tasks, 2, 1);

		expect(result[0].isPartial).toBe(false);
		expect(result[0].scheduledDuration).toBe(2);
	});

	it('should use default timeUnit when omitted', async () => {
		const tasks: Task[] = [
			{ id: 1, title: 'A', estimateDurationHour: 1, priority: 1, isSplittable: false } as any,
		];
		(taskCalculator.getTaskUrgency as jest.Mock).mockResolvedValue(5);

		const result = await scheduler.schedule(tasks, 1); // omit timeUnit to use default 0.5

		expect(result[0].scheduledDuration).toBe(1); // 2 units * 0.5 default
		expect(result[0].isPartial).toBe(false);
	});

	it('should handle missing estimateDurationHour via fallback', async () => {
		const tasks: Task[] = [
			{ id: 3, title: 'Fallback', estimateDurationHour: undefined as any, priority: 2, isSplittable: false } as any,
		];
		(taskCalculator.getTaskUrgency as jest.Mock).mockResolvedValue(4);

		const result = await scheduler.schedule(tasks, 1, 0.5);

		expect(result[0].scheduledDuration).toBeCloseTo(1); // uses fallback estimate=1
		expect(result[0].isPartial).toBe(false);
	});

	it('should handle zero capacity by selecting nothing', async () => {
		const tasks: Task[] = [
			{
				id: 1,
				title: 'Big',
				estimateDurationHour: 2,
				priority: 1,
				isSplittable: false,
			} as any,
			{
				id: 2,
				title: 'Big2',
				estimateDurationHour: 3,
				priority: 1,
				isSplittable: true,
			} as any,
		];
		(taskCalculator.getTaskUrgency as jest.Mock).mockResolvedValue(1);

		const result = await scheduler.schedule(tasks, 0, 1);

		expect(result).toEqual([]);
	});
});
