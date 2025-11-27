import { TaskManager } from '../TaskManager';
import { TaskRepository } from '../TaskRepository';

jest.mock('../TaskRepository');

describe('TaskManager', () => {
	let manager: TaskManager;
	let mockRepo: jest.Mocked<TaskRepository>;

	beforeEach(() => {
		manager = new TaskManager();
		mockRepo = (manager as any).taskRepository as jest.Mocked<TaskRepository>;
	});

	it('should add a task and return its JSON', async () => {
		const task = { id: 1, title: 'Test', toJSON: () => ({ id: 1, title: 'Test' }) } as any;
		mockRepo.create.mockResolvedValue(task);
		mockRepo.findById.mockResolvedValue(task);

		const result = await manager.addTask({ title: 'Test' });
		expect(mockRepo.create).toHaveBeenCalledWith({ title: 'Test' });
		expect(result.ok).toBe(true);
		expect(result.value).toEqual({ id: 1, title: 'Test' });
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
		mockRepo.delete.mockResolvedValue(true);

		const result = await manager.removeTask(1);
		expect(mockRepo.delete).toHaveBeenCalledWith(1);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBe(true);
		}
	});

	it('should toggle complete', async () => {
		const task = {
			id: 3,
			completed: false,
			childrenTasks: [],
			tags: [],
			deadline: undefined,
			toJSON: () => ({ id: 3, completed: false }),
		} as any;
		mockRepo.findById.mockResolvedValue(task);
		mockRepo.setCompletion.mockResolvedValue({ ...task, completed: true });

		const result = await manager.completeTask(3);
		expect(mockRepo.findById).toHaveBeenCalledWith(3);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toEqual({ id: 3, completed: true });
		}
	});
});
