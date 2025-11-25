import { TaskManager } from '../TaskManager';
import { TaskRepository } from '../TaskRepository';
import { CreateTaskData } from '../TaskRepository';
import { jest } from '@jest/globals';

// Mock dependencies. This will replace the class with a mock constructor.
jest.mock('../TaskRepository');
jest.mock('../CategoryManager');

describe('TaskManager', () => {
	let taskManager: TaskManager;
	let mockTaskRepository: jest.Mocked<TaskRepository>;

	beforeEach(() => {
		// Clear all mock history and implementations before each test
		jest.clearAllMocks();

		// Instantiate TaskManager. The TaskRepository will be a mock due to jest.mock().
		taskManager = new TaskManager();

		// The TaskManager constructor news up its own dependencies. We can get the mock instance
		// that was created inside the TaskManager.
		mockTaskRepository = (TaskRepository as jest.Mock<typeof TaskRepository>).mock
			.instances[0] as jest.Mocked<TaskRepository>;

		// We also need to provide mock implementations for the methods we expect to be called.
		mockTaskRepository.create = jest.fn();
		mockTaskRepository.findById = jest.fn();
		mockTaskRepository.reopenIfCompleted = jest.fn();

		// Spy on the private refreshCompleteness method to check if it's called.
		// This is generally not best practice, but necessary here without refactoring.
		jest.spyOn(taskManager as any, 'refreshCompleteness').mockResolvedValue(undefined);
	});

	describe('addTask', () => {
		it('should create a task without a parent', async () => {
			const taskData: CreateTaskData = { title: 'Test Task' };
			const createdTask = {
				id: 1,
				title: 'Test Task',
				toJSON: () => ({ id: 1, title: 'Test Task' }),
			} as any;

			mockTaskRepository.create.mockResolvedValue(createdTask);
			// Mock findById to return the newly created task without a parent
			mockTaskRepository.findById.mockResolvedValue({ ...createdTask, parentTask: null });

			const result = await taskManager.addTask(taskData);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toEqual({ id: 1, title: 'Test Task' });
			}
			expect(mockTaskRepository.create).toHaveBeenCalledWith(taskData);
			expect(mockTaskRepository.findById).toHaveBeenCalledWith(createdTask.id);
			// Should not attempt to reopen or refresh parent if there is no parent
			expect(mockTaskRepository.reopenIfCompleted).not.toHaveBeenCalled();
			expect((taskManager as any).refreshCompleteness).not.toHaveBeenCalled();
		});

		it('should create a sub-task and trigger parent refresh logic', async () => {
			const parentTask = { id: 1, title: 'Parent Task', completed: true };
			const subTaskData: CreateTaskData = { title: 'Sub Task', parentId: parentTask.id };
			const newSubTask = {
				id: 2,
				title: 'Sub Task',
				toJSON: () => ({ id: 2, title: 'Sub Task' }),
			} as any;

			mockTaskRepository.create.mockResolvedValue(newSubTask);
			// Mock findById to return the task with its parent
			mockTaskRepository.findById.mockResolvedValue({
				...newSubTask,
				parentTask: parentTask,
			});

			const result = await taskManager.addTask(subTaskData);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toEqual({ id: 2, title: 'Sub Task' });
			}
			expect(mockTaskRepository.create).toHaveBeenCalledWith(subTaskData);
			expect(mockTaskRepository.findById).toHaveBeenCalledWith(newSubTask.id);
			// Should call these methods for the parent
			expect(mockTaskRepository.reopenIfCompleted).toHaveBeenCalledWith(parentTask.id);
			expect((taskManager as any).refreshCompleteness).toHaveBeenCalledWith(parentTask.id);
		});

		it('should handle errors during task creation', async () => {
			const taskData: CreateTaskData = { title: 'Test Task' };
			const error = new Error('DB write failed');

			mockTaskRepository.create.mockRejectedValue(error);

			const result = await taskManager.addTask(taskData);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				// The error message comes from the ErrorHandler wrapper
				expect(result.error.message).toBe('DB write failed');
			}
		});
	});
});
