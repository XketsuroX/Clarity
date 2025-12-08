<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
	Plus,
	Calendar,
	Clock,
	Check,
	Refresh,
	Lightning,
	Folder,
	Delete,
	Edit,
	VideoPlay,
	ArrowRight,
	Back,
	DataAnalysis,
	Odometer,
} from '@element-plus/icons-vue';
import {
	fetchTasks,
	fetchCategories,
	fetchTags,
	createTask,
	updateTask,
	removeTask,
	toggleTaskComplete,
	toggleTaskStart,
	createCategory,
	updateCategory,
	deleteCategory,
	createTag,
	updateTag,
	deleteTag,
	generateSchedule,
	refreshOverdue,
	getAverageActualVsEstimated,
	getEstimatedDuration,
} from './api';
import { TaskAddParams, TaskJSON, TaskUpdateParams } from '../../shared/TaskTypes';
import {
	CategoryCreateParam,
	CategoryIdParam,
	CategoryJSON,
	CategoryUpdateParam,
} from '../../shared/CategoryTypes';
import { TagJSON, TagCreateParam, TagUpdateParam, TagIdParam } from '../../shared/TagTypes';
import { ScheduleGenerateParams, ScheduleItem } from 'src/shared/SchedulerTypes';

// --- State ---
const tasks = ref<TaskJSON[]>([]);
const categories = ref<CategoryJSON[]>([]);
const tags = ref<TagJSON[]>([]);
const loading = ref(false);
const showCreateModal = ref(false);
const showScheduleModal = ref(false);
const showManageModal = ref(false);
const showTaskDetailModal = ref(false);
const showStatsModal = ref(false);
const statsData = ref<{ avgDeltaHour: number; avgDeltaPercent: number; count: number } | null>(
	null
);
const urgencyScores = ref<Record<number, number>>({});
const estimatedDurations = ref<Record<number, number>>({});
const currentTask = ref<TaskJSON | null>(null);
const editingCategory = ref<{ id: number; title: string } | null>(null);
const editingTag = ref<TagUpdateParam | null>(null);
const newSubtaskTitle = ref('');
// Form Data
const newTask = ref<TaskAddParams>({
	title: '',
	estimateDurationHour: 1,
	priority: 0,
	categoryId: undefined,
	tagIds: [],
	deadline: undefined,
});

const manageActiveTab = ref('categories');
const newCategoryTitle = ref('');
const newTagForm = ref<TagCreateParam>({ name: '', color: '#409EFF' });

const activeCollapseItems = ref<(string | number)[]>(['uncategorized']);

const groupedTasks = computed(() => {
	const groups: { id: number | string; title: string; tasks: TaskJSON[] }[] = [];

	const rootTasks = tasks.value.filter((t) => !t.parentTaskId);

	categories.value.forEach((cat) => {
		const catTasks = rootTasks.filter((t) => t.categoryId === cat.id);
		groups.push({
			id: cat.id,
			title: cat.title,
			tasks: catTasks,
		});
	});

	const noCatTasks = rootTasks.filter((t) => !t.categoryId);
	if (noCatTasks.length > 0) {
		groups.push({
			id: 'uncategorized',
			title: 'Uncategorized',
			tasks: noCatTasks,
		});
	}

	return groups;
});

const currentSubtasks = computed(() => {
	if (!currentTask.value) return [];
	return tasks.value.filter((t) => t.parentTaskId === currentTask.value?.id);
});

const parentTask = computed(() => {
	if (!currentTask.value?.parentTaskId) return null;
	return tasks.value.find((t) => t.id === currentTask.value?.parentTaskId);
});

const scheduleConfig = ref({ hours: 4 });
const scheduleResult = ref<ScheduleItem[]>([]);

// --- Helpers ---
// Unused helper function - kept for reference
// const getCategoryName = (id?: number): string | null => {
// 	if (!id) return null;
// 	const cat = categories.value.find((c) => c.id === id);
// 	return cat ? cat.title : null;
// };

const getTaskTags = (tagIds?: number[]): TagJSON[] =>
	tags.value.filter((tag) => tagIds?.includes(tag.id));

const formatDate = (date: string | Date | undefined): string => {
	if (!date) return '';
	return new Date(date).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
};

const hasSubtasks = (taskId: number): boolean => {
	return tasks.value.some((t) => t.parentTaskId === taskId);
};

const getTaskProgress = (taskId: number): number => {
	const subtasks = tasks.value.filter((t) => t.parentTaskId === taskId);
	if (subtasks.length === 0) {
		// Leaf task: return persisted completeness value
		const task = tasks.value.find((t) => t.id === taskId);
		return task?.completeness ?? 0;
	}
	// Non-leaf task: backend calculates this based on descendants
	// Frontend displays the completeness value from backend
	const task = tasks.value.find((t) => t.id === taskId);
	return task?.completeness ?? 0;
};

const getUrgencyColor = (score: number): string => {
	if (score >= 80) return '#F56C6C'; // Red
	if (score >= 50) return '#E6A23C'; // Orange
	if (score >= 20) return '#409EFF'; // Blue
	return '#909399'; // Grey
};

// --- Actions ---
const loadData = async (): Promise<void> => {
	loading.value = true;
	try {
		const [tasksData, catsData, tagsData] = await Promise.all([
			fetchTasks(),
			fetchCategories(),
			fetchTags(),
		]);
		tasks.value = tasksData as TaskJSON[];
		categories.value = catsData;
		tags.value = tagsData;

		// Fetch urgency for active tasks
		const taskDataPrefetch = tasks.value
			.filter((t) => !t.completed)
			.map(async (t) => {
				try {
					// skipped logging into api.ts due to time, use direct ipcRenderer call
					const urgencies = await (window as any).electron.ipcRenderer.invoke(
						'tasks:getUrgency',
						{ taskId: t.id }
					);
					if (urgencies && urgencies.ok) {
						urgencyScores.value[t.id] = urgencies.value;
					}

					// handling estimated hours
					const estimatedDuration = await getEstimatedDuration({ taskId: t.id });

					console.log('ID:', t.id, 'Estimated Duration:', estimatedDuration);
					if (typeof estimatedDuration === 'number') {
						estimatedDurations.value[t.id] = estimatedDuration;
					}
				} catch (e: any) {
					// If task is overdue, treat result as undefined (ignore error)
					if (e?.toString().includes('overdue') || e?.message?.includes('overdue')) {
						return;
					}
					console.error(`Failed to fetch datas for task ${t.id}`, e);
				}
			});
		await Promise.all(taskDataPrefetch);
	} catch (err) {
		ElMessage.error(`Failed to load data: ${err}`);
	} finally {
		loading.value = false;
	}
};

const handleCreate = async (): Promise<void> => {
	if (!newTask.value.title) return;
	try {
		const payload = { ...newTask.value };
		if (payload.deadline) {
			payload.deadline = new Date(payload.deadline).toISOString();
		}

		await createTask(payload);
		ElMessage.success('Task created');
		showCreateModal.value = false;
		newTask.value = {
			title: '',
			estimateDurationHour: 1,
			priority: 0,
			categoryId: undefined,
			tagIds: [],
			deadline: undefined,
		};
		await loadData();
	} catch (err) {
		ElMessage.error('Failed to create: ' + err);
	}
};

const handleCreateTag = async (): Promise<void> => {
	if (!newTagForm.value.name.trim()) return;
	const payload: TagCreateParam = {
		name: newTagForm.value.name.trim(),
		color: newTagForm.value.color,
	};
	const created = await createTag(payload);
	tags.value = [...tags.value, created];
	newTagForm.value = { name: '', color: '#409EFF' };
	ElMessage.success('Tag added');
};

const startTagEdit = (tag: TagJSON): void => {
	editingTag.value = {
		id: tag.id,
		name: tag.name,
		color: tag.color ?? '#409EFF',
	};
};

const handleUpdateTagEntry = async (): Promise<void> => {
	if (!editingTag.value || !editingTag.value.name?.trim()) {
		ElMessage.warning('Tag name cannot be empty');
		return;
	}
	const updated = await updateTag({
		id: editingTag.value.id,
		name: editingTag.value.name.trim(),
		color: editingTag.value.color,
	});
	tags.value = tags.value.map((t) => (t.id === updated.id ? updated : t));
	editingTag.value = null;
	ElMessage.success('Tag updated');
};

const handleDeleteTagEntry = async (id: number): Promise<void> => {
	const payload: TagIdParam = { id };
	await ElMessageBox.confirm('Delete this tag? It will be removed from all tasks.', 'Warning', {
		type: 'warning',
	});
	await deleteTag(payload);
	tags.value = tags.value.filter((t) => t.id !== id);
	tasks.value = tasks.value.map((task) => ({
		...task,
		tagIds: task.tagIds?.filter((tagId) => tagId !== id) ?? [],
	}));
	ElMessage.success('Tag deleted');
};

const handleToggleComplete = async (task: TaskJSON): Promise<void> => {
	try {
		const updated = await toggleTaskComplete({ taskId: task.id });
		tasks.value = tasks.value.map((t) => (t.id === updated.id ? updated : t));
		await loadData();
		ElMessage.success(updated.completed ? 'Task completed' : 'Task reopened');
	} catch (err) {
		ElMessage.error('Update failed: ' + err);
	}
};

// --- Actions: Category Management ---
const handleCreateCategory = async (): Promise<void> => {
	if (!newCategoryTitle.value.trim()) return;
	const payload: CategoryCreateParam = { title: newCategoryTitle.value.trim() };
	const created = await createCategory(payload);
	categories.value = [...categories.value, created];
	newCategoryTitle.value = '';
	ElMessage.success('Category added');
};

const handleUpdateCategory = async (id: number, title: string): Promise<void> => {
	if (!title.trim()) {
		ElMessage.warning('Category title cannot be empty');
		return;
	}
	const payload: CategoryUpdateParam & { newTitle: string } = { id, newTitle: title.trim() };
	const updated = await updateCategory(payload);
	categories.value = categories.value.map((c) => (c.id === updated.id ? updated : c));
	editingCategory.value = null;
	ElMessage.success('Category updated');
};

const handleDeleteCategory = async (id: number): Promise<void> => {
	const payload: CategoryIdParam = { id };
	await ElMessageBox.confirm(
		'Delete this category? Tasks will become uncategorized.',
		'Warning',
		{
			type: 'warning',
		}
	);
	await deleteCategory(payload);
	categories.value = categories.value.filter((c) => c.id !== id);
	tasks.value = tasks.value.map((t) =>
		t.categoryId === id ? { ...t, categoryId: undefined } : t
	);
	ElMessage.success('Category deleted');
};

// --- Actions: Task Detail & Operations ---
const openTaskDetail = (task: TaskJSON): void => {
	currentTask.value = JSON.parse(JSON.stringify(task));
	showTaskDetailModal.value = true;
};

const handleSaveTaskDetail = async (): Promise<void> => {
	if (!currentTask.value) return;
	try {
		const updatePayload: TaskUpdateParams = {
			title: currentTask.value.title,
			description: currentTask.value.description,
			deadline: currentTask.value.deadline
				? new Date(currentTask.value.deadline).toISOString()
				: null,
			estimateDurationHour: currentTask.value.estimateDurationHour,
			priority: currentTask.value.priority,
			categoryId: currentTask.value.categoryId ?? null,
			tagIds: currentTask.value.tagIds ?? [],

			parentTaskId: currentTask.value.parentTaskId ?? null,
		};

		const updated = await updateTask({ taskId: currentTask.value.id }, updatePayload);
		console.log('Updated task:', updated);

		if (currentSubtasks.value.length === 0) {
			const newCompleteness = currentTask.value.completeness ?? 0;
			await (window as any).electron.ipcRenderer.invoke('tasks:setCompleteness', {
				taskId: currentTask.value.id,
				completeness: newCompleteness,
			});
			(updated as TaskJSON).completeness = newCompleteness;
		}

		tasks.value = tasks.value.map((t) => (t.id === updated.id ? updated : t));

		showTaskDetailModal.value = false;
		await loadData();
		ElMessage.success('Task updated');
	} catch (err) {
		ElMessage.error('Failed to update task: ' + err);
	}
};

const handleTaskDelete = async (): Promise<void> => {
	if (!currentTask.value) return;
	try {
		await ElMessageBox.confirm('Are you sure to delete this task?', 'Warning', {
			confirmButtonText: 'Delete',
			cancelButtonText: 'Cancel',
			type: 'warning',
		});
		await removeTask({ taskId: currentTask.value.id });
		await loadData();
		showTaskDetailModal.value = false;
		ElMessage.success('Task deleted');
	} catch (err) {
		if (err !== 'cancel') ElMessage.error('Failed to delete task');
	}
};

const handleStartTask = async (): Promise<void> => {
	if (!currentTask.value) return;
	try {
		const updated = await toggleTaskStart({ taskId: currentTask.value.id });
		console.log('Task started:', updated);
		currentTask.value.state = updated.state;
		tasks.value = tasks.value.map((t) => (t.id === updated.id ? updated : t));
		ElMessage.success('Task started');
	} catch (err) {
		ElMessage.error('Failed to start task: ' + err);
	}
};

const runSchedule = async (): Promise<void> => {
	try {
		const params: ScheduleGenerateParams = {
			capacityHours: scheduleConfig.value.hours,
			timeUnit: 0.5,
		};
		scheduleResult.value = await generateSchedule(params);
		ElMessage.success(`Found ${scheduleResult.value.length} tasks`);
	} catch (err) {
		ElMessage.error('Scheduling failed: ' + err);
	}
};

const handleAddSubtask = async (): Promise<void> => {
	if (!newSubtaskTitle.value.trim() || !currentTask.value) return;

	try {
		const payload: TaskAddParams = {
			title: newSubtaskTitle.value.trim(),
			estimateDurationHour: 0.5,
			priority: 0,
			categoryId: currentTask.value.categoryId ?? undefined,
			tagIds: [],
			parentTaskId: currentTask.value.id,
		};

		const created = await createTask(payload);
		tasks.value = [...tasks.value, created];
		newSubtaskTitle.value = '';
		ElMessage.success('Subtask added');
	} catch (err) {
		ElMessage.error('Failed to add subtask: ' + err);
	}
};

const openSubtaskDetail = (subtask: TaskJSON): void => {
	currentTask.value = JSON.parse(JSON.stringify(subtask));
};

const backToParentTask = (): void => {
	if (parentTask.value) {
		currentTask.value = JSON.parse(JSON.stringify(parentTask.value));
	}
};

const handleRefreshOverdue = async (): Promise<void> => {
	try {
		await refreshOverdue();
		await loadData();
		ElMessage.success('Tasks refreshed');
	} catch (err) {
		ElMessage.error('Failed to refresh overdue tasks: ' + err);
	}
};

const handleShowStats = async (): Promise<void> => {
	try {
		const stats = await getAverageActualVsEstimated();
		statsData.value = stats;
		showStatsModal.value = true;
	} catch (err) {
		ElMessage.error('Failed to fetch stats: ' + err);
	}
};

const handleTaskDeleteWrapper = async (taskToDelete: TaskJSON): Promise<void> => {
	try {
		await removeTask({ taskId: taskToDelete.id });
		await loadData();
		ElMessage.success('Subtask deleted');
	} catch (err) {
		ElMessage.error('Failed to delete subtask: ' + err);
	}
};

onMounted(() => {
	loadData();
});
</script>

<template>
	<div class="app-container">
		<!-- Header -->
		<header class="minimal-header">
			<div class="title-group">
				<h1>Clarity</h1>
				<span class="subtitle">Focus on what matters</span>
			</div>
			<div class="header-actions">
				<el-button circle :icon="Refresh" @click="handleRefreshOverdue" />
				<el-button circle :icon="DataAnalysis" @click="handleShowStats" />
				<el-button circle :icon="Folder" @click="showManageModal = true" />
				<el-button circle :icon="Lightning" @click="showScheduleModal = true" />
				<el-button circle type="primary" :icon="Plus" @click="showCreateModal = true" />
			</div>
		</header>

		<!-- Content -->
		<main v-loading="loading" class="task-list-container">
			<div v-if="tasks.length === 0" class="empty-state">No tasks yet. Stay clear.</div>

			<!-- 使用 Element Plus Collapse 模擬文件夾效果 -->
			<el-collapse
				v-else
				v-model="activeCollapseItems"
				style="border: none; --el-collapse-header-bg-color: transparent"
			>
				<el-collapse-item v-for="group in groupedTasks" :key="group.id" :name="group.id">
					<template #title>
						<div class="group-header">
							<el-icon class="group-icon"><Folder /></el-icon>
							<span class="group-title">{{ group.title }}</span>
							<span class="group-count">{{ group.tasks.length }}</span>
						</div>
					</template>

					<div v-if="group.tasks.length === 0" class="empty-group">No tasks</div>

					<div
						v-for="task in group.tasks"
						:key="task.id"
						class="task-item"
						:class="{ 'is-completed': task.completed }"
						@click="openTaskDetail(task)"
					>
						<div class="task-check" @click.stop="handleToggleComplete(task)">
							<div class="custom-checkbox">
								<el-icon v-if="task.completed"><Check /></el-icon>
							</div>
						</div>

						<div class="task-content">
							<div class="task-title">{{ task.title }}</div>
							<div
								v-if="hasSubtasks(task.id) || getTaskProgress(task.id) >= 0"
								class="task-progress-row"
							>
								<el-progress
									:percentage="getTaskProgress(task.id)"
									:stroke-width="5"
									:show-text="false"
									:status="getTaskProgress(task.id) === 100 ? 'success' : ''"
									style="width: 60px"
								/>
								<span class="progress-text">{{ getTaskProgress(task.id) }}%</span>
							</div>
							<div class="task-meta">
								<el-tag
									v-for="tag in getTaskTags(task.tagIds)"
									:key="tag.id"
									size="small"
									effect="plain"
									:color="tag.color + '20'"
									:style="{ borderColor: tag.color, color: tag.color }"
									class="meta-tag"
								>
									{{ tag.name }}
								</el-tag>

								<el-tag
									v-if="!task.completed && urgencyScores[task.id] !== undefined"
									size="small"
									effect="dark"
									class="meta-tag"
									:style="{
										backgroundColor: getUrgencyColor(urgencyScores[task.id]),
										borderColor: getUrgencyColor(urgencyScores[task.id]),
										color: '#ffffff',
										fontWeight: 'bold',
									}"
								>
									<el-icon style="margin-right: 3px"><Odometer /></el-icon>
									{{ Math.round(urgencyScores[task.id]) }}
								</el-tag>

								<span v-if="task.deadline" class="meta-info">
									<el-icon><Calendar /></el-icon>
									{{ formatDate(task.deadline) }}
								</span>

								<span v-if="task.estimateDurationHour" class="meta-info">
									<el-icon><Clock /></el-icon>
									{{ task.estimateDurationHour }}h
								</span>

								<span
									v-if="estimatedDurations[task.id] !== undefined"
									class="meta-info"
								>
									Est.<el-icon><Clock /></el-icon>
									{{ estimatedDurations[task.id].toFixed(1) }}h
								</span>
							</div>
						</div>
					</div>
				</el-collapse-item>
			</el-collapse>
		</main>

		<!-- Create Modal: 簡潔表單 -->
		<el-dialog
			v-model="showCreateModal"
			title="New Task"
			width="400px"
			class="minimal-dialog"
			align-center
		>
			<el-form :model="newTask" label-position="top" class="minimal-form">
				<el-form-item label="What needs to be done?">
					<el-input v-model="newTask.title" placeholder="Task title" size="large" />
				</el-form-item>

				<div class="form-row">
					<el-form-item label="Category">
						<el-select
							v-model="newTask.categoryId"
							placeholder="None"
							style="width: 100%"
							clearable
						>
							<el-option
								v-for="c in categories"
								:key="c.id"
								:label="c.title"
								:value="c.id"
							/>
						</el-select>
					</el-form-item>

					<el-form-item label="Priority">
						<el-select v-model="newTask.priority" style="width: 100%">
							<el-option label="Low" :value="0" />
							<el-option label="Medium" :value="1" />
							<el-option label="High" :value="2" />
							<el-option label="Urgent" :value="3" />
						</el-select>
					</el-form-item>

					<el-form-item label="Duration (h)">
						<el-input-number
							v-model="newTask.estimateDurationHour"
							:min="0.5"
							:step="0.5"
							style="width: 100%"
						/>
					</el-form-item>
				</div>

				<el-form-item label="Tags">
					<el-select
						v-model="newTask.tagIds"
						multiple
						placeholder="Select tags"
						style="width: 100%"
					>
						<el-option v-for="t in tags" :key="t.id" :label="t.name" :value="t.id">
							<span :style="{ color: t.color, marginRight: '8px' }">●</span>
							{{ t.name }}
						</el-option>
					</el-select>
				</el-form-item>

				<el-form-item label="Deadline">
					<el-date-picker
						v-model="newTask.deadline"
						type="datetime"
						placeholder="Pick a date"
						style="width: 100%"
					/>
				</el-form-item>
			</el-form>
			<template #footer>
				<span class="dialog-footer">
					<el-button @click="showCreateModal = false">Cancel</el-button>
					<el-button type="primary" @click="handleCreate">Create</el-button>
				</span>
			</template>
		</el-dialog>

		<!-- Manage Modal -->
		<el-dialog v-model="showManageModal" title="Manage" width="400px" align-center>
			<el-tabs v-model="manageActiveTab" class="manage-tabs">
				<!-- Categories Tab -->
				<el-tab-pane label="Categories" name="categories">
					<div class="manage-input-row">
						<el-input v-model="newCategoryTitle" placeholder="New Category Name" />
						<el-button type="primary" :icon="Plus" @click="handleCreateCategory" />
					</div>
					<div class="manage-list">
						<div v-for="c in categories" :key="c.id" class="manage-item">
							<!-- 編輯模式 -->
							<template v-if="editingCategory && editingCategory.id === c.id">
								<el-input
									v-model="editingCategory.title"
									size="small"
									@keyup.enter="handleUpdateCategory(c.id, editingCategory.title)"
								/>
								<el-button
									size="small"
									type="success"
									:icon="Check"
									@click="handleUpdateCategory(c.id, editingCategory.title)"
								/>
								<el-button size="small" @click="editingCategory = null"
									>X</el-button
								>
							</template>
							<!-- 顯示模式 -->
							<template v-else>
								<span class="manage-text">{{ c.title }}</span>
								<div class="manage-actions">
									<el-button
										link
										:icon="Edit"
										@click="editingCategory = { id: c.id, title: c.title }"
									/>
									<el-button
										link
										type="danger"
										:icon="Delete"
										@click="handleDeleteCategory(c.id)"
									/>
								</div>
							</template>
						</div>
					</div>
				</el-tab-pane>

				<!-- Tags Tab -->
				<el-tab-pane label="Tags" name="tags">
					<div class="manage-input-row">
						<el-input
							v-model="newTagForm.name"
							placeholder="New Tag Name"
							style="flex: 1"
						/>
						<el-color-picker v-model="newTagForm.color" size="default" />
						<el-button type="primary" :icon="Plus" @click="handleCreateTag" />
					</div>
					<div class="manage-list">
						<div v-for="t in tags" :key="t.id" class="manage-item">
							<template v-if="editingTag && editingTag.id === t.id">
								<el-input
									v-model="editingTag.name"
									size="small"
									style="flex: 1"
									@keyup.enter="handleUpdateTagEntry"
								/>
								<el-color-picker v-model="editingTag.color" size="small" />
								<el-button
									size="small"
									type="success"
									:icon="Check"
									@click="handleUpdateTagEntry"
								/>
								<el-button size="small" @click="editingTag = null">X</el-button>
							</template>
							<template v-else>
								<span
									class="tag-dot"
									:style="{ backgroundColor: t.color || '#909399' }"
								></span>
								<span class="manage-text">{{ t.name }}</span>
								<div class="manage-actions">
									<el-button link :icon="Edit" @click="startTagEdit(t)" />
									<el-button
										link
										type="danger"
										:icon="Delete"
										@click="handleDeleteTagEntry(t.id)"
									/>
								</div>
							</template>
						</div>
					</div>
				</el-tab-pane>
			</el-tabs>
		</el-dialog>

		<!-- Task Detail Modal (新增) -->
		<el-dialog
			v-model="showTaskDetailModal"
			title="Task Details"
			width="500px"
			align-center
			destroy-on-close
		>
			<div v-if="currentTask" class="detail-container">
				<div v-if="parentTask" class="parent-nav" @click="backToParentTask">
					<el-icon><Back /></el-icon>
					<span>Parent: {{ parentTask.title }}</span>
				</div>

				<el-form label-position="top">
					<el-form-item label="Title">
						<el-input v-model="currentTask.title" size="large" />
					</el-form-item>

					<el-form-item label="Description">
						<el-input
							v-model="currentTask.description"
							type="textarea"
							:rows="3"
							placeholder="Add notes..."
						/>
					</el-form-item>

					<div class="subtasks-section">
						<div class="subtasks-header">Subtasks</div>

						<div v-if="currentSubtasks.length > 0" class="subtask-list">
							<div v-for="sub in currentSubtasks" :key="sub.id" class="subtask-item">
								<div class="task-check" @click.stop="handleToggleComplete(sub)">
									<div
										class="custom-checkbox"
										:class="{ checked: sub.completed }"
									>
										<el-icon v-if="sub.completed"><Check /></el-icon>
									</div>
								</div>

								<!-- 點擊標題進入子任務詳情 -->
								<span
									class="subtask-title clickable"
									:class="{ 'is-completed': sub.completed }"
									@click="openSubtaskDetail(sub)"
								>
									{{ sub.title }}
									<el-icon class="arrow-icon"><ArrowRight /></el-icon>
								</span>

								<el-button
									link
									type="danger"
									size="small"
									:icon="Delete"
									@click="handleTaskDeleteWrapper(sub)"
								/>
							</div>
						</div>

						<div class="subtask-input-row">
							<el-input
								v-model="newSubtaskTitle"
								placeholder="Add a subtask..."
								size="small"
								@keyup.enter="handleAddSubtask"
							>
								<template #append>
									<el-button :icon="Plus" @click="handleAddSubtask" />
								</template>
							</el-input>
						</div>
					</div>

					<div class="form-row">
						<el-form-item label="Category">
							<el-select
								v-model="currentTask.categoryId"
								placeholder="None"
								clearable
								:disabled="!!currentTask.parentTaskId"
							>
								<el-option
									v-for="c in categories"
									:key="c.id"
									:label="c.title"
									:value="c.id"
								/>
							</el-select>
						</el-form-item>

						<el-form-item label="Priority">
							<el-select v-model="currentTask.priority">
								<el-option label="Low" :value="0" />
								<el-option label="Medium" :value="1" />
								<el-option label="High" :value="2" />
								<el-option label="Urgent" :value="3" />
							</el-select>
						</el-form-item>

						<!-- Manual Progress Slider (Only if no subtasks) -->
						<el-form-item v-if="currentSubtasks.length === 0" label="Progress">
							<el-slider v-model="currentTask.completeness" :step="10" show-stops />
						</el-form-item>

						<el-form-item label="Duration (h)">
							<el-input-number
								v-model="currentTask.estimateDurationHour"
								:min="0.5"
								:step="0.5"
							/>
						</el-form-item>
					</div>

					<el-form-item v-if="currentTask" label="Tags">
						<el-select
							v-model="currentTask.tagIds"
							multiple
							placeholder="Select tags"
							clearable
						>
							<el-option v-for="t in tags" :key="t.id" :label="t.name" :value="t.id">
								<span :style="{ color: t.color ?? '#909399', marginRight: '6px' }"
									>●</span
								>{{ t.name }}
							</el-option>
						</el-select>
					</el-form-item>

					<el-form-item label="Deadline">
						<el-date-picker
							v-model="currentTask.deadline"
							type="datetime"
							style="width: 100%"
						/>
					</el-form-item>

					<!-- Actions Bar -->
					<div class="detail-actions">
						<el-button
							:type="currentTask.state === 'In Progress' ? 'info' : 'success'"
							:icon="VideoPlay"
							:disabled="currentTask.state === 'In Progress' || currentTask.completed"
							@click="handleStartTask"
						>
							{{ currentTask.state === 'In Progress' ? 'In Progress' : 'Start Task' }}
						</el-button>

						<el-button type="danger" plain :icon="Delete" @click="handleTaskDelete">
							Delete
						</el-button>
					</div>
				</el-form>
			</div>
			<template #footer>
				<span class="dialog-footer">
					<el-button @click="showTaskDetailModal = false">Cancel</el-button>
					<el-button type="primary" @click="handleSaveTaskDetail">Save Changes</el-button>
				</span>
			</template>
		</el-dialog>

		<!-- Schedule Modal -->
		<el-dialog v-model="showScheduleModal" title="Auto-Schedule" width="450px" align-center>
			<div class="schedule-box">
				<p>Available time (hours)</p>
				<div class="input-row">
					<el-input-number
						v-model="scheduleConfig.hours"
						:min="0.5"
						:step="0.5"
						size="large"
					/>
					<el-button type="success" size="large" @click="runSchedule">Generate</el-button>
				</div>
			</div>

			<div v-if="scheduleResult.length > 0" class="schedule-list">
				<div v-for="(item, idx) in scheduleResult" :key="idx" class="schedule-item">
					<div class="time-badge">{{ item.scheduledDuration }}h</div>
					<div class="task-info">
						<div class="task-title">{{ item.title }}</div>
						<div v-if="item.isPartial" class="task-note">Partial</div>
					</div>
				</div>
			</div>
		</el-dialog>

		<!-- Stats Modal -->
		<el-dialog v-model="showStatsModal" title="Estimation Accuracy" width="400px" align-center>
			<div v-if="statsData" class="stats-container">
				<div class="stats-item">
					<span class="stats-label">Completed Tasks</span>
					<span class="stats-value">{{ statsData.count }}</span>
				</div>
				<div class="stats-item">
					<span class="stats-label">Avg Delta Time</span>
					<span class="stats-value">{{ statsData.avgDeltaHour.toFixed(2) }}h</span>
				</div>
				<div class="stats-item">
					<span class="stats-label">Avg Delta %</span>
					<span class="stats-value">{{ statsData.avgDeltaPercent.toFixed(1) }}%</span>
				</div>
			</div>
			<template #footer>
				<span class="dialog-footer">
					<el-button type="primary" @click="showStatsModal = false">Close</el-button>
				</span>
			</template>
		</el-dialog>
	</div>
</template>

<style>
body {
	margin: 0;
	font-family:
		'Inter',
		-apple-system,
		BlinkMacSystemFont,
		'Segoe UI',
		Roboto,
		sans-serif;
	/* 關鍵：使用 Element Plus 的背景色變數 */
	background-color: var(--el-bg-color);
	color: var(--el-text-color-primary);
	transition:
		background-color 0.3s,
		color 0.3s;
}

.group-header {
	display: flex;
	align-items: center;
	font-size: 1rem;
	font-weight: 600;
	color: var(--el-text-color-primary);
	width: 100%;
}
.group-icon {
	margin-right: 8px;
	color: var(--el-text-color-secondary);
}
.group-count {
	margin-left: auto;
	margin-right: 10px;
	font-size: 0.8rem;
	color: var(--el-text-color-secondary);
	background: var(--el-fill-color);
	padding: 2px 8px;
	border-radius: 10px;
}
.empty-group {
	padding: 10px 0 10px 36px;
	color: var(--el-text-color-placeholder);
	font-size: 0.9rem;
	font-style: italic;
}
/* 讓捲軸在暗黑模式下更好看 (Chrome/Edge) */
::-webkit-scrollbar {
	width: 8px;
	height: 8px;
}
::-webkit-scrollbar-track {
	background: var(--el-bg-color);
}
::-webkit-scrollbar-thumb {
	background: var(--el-border-color-darker);
	border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
	background: var(--el-text-color-secondary);
}
</style>

<style scoped>
.app-container {
	max-width: 100%;
	margin: 0 auto;
	padding: 40px 20px;
	height: 100vh;
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
}

/* Header */
.minimal-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 40px;
	flex-shrink: 0;
}

.title-group h1 {
	font-size: 1.5rem;
	font-weight: 600;
	margin: 0;
	letter-spacing: -0.5px;
	color: var(--el-text-color-primary);
}

.task-progress-row {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 6px;
}

.progress-text {
	font-size: 0.75rem;
	color: var(--el-text-color-secondary);
}
.subtitle {
	font-size: 0.85rem;
	color: var(--el-text-color-secondary);
}

.header-actions {
	display: flex;
	gap: 8px;
}

/* Task List */
.task-list-container {
	display: flex;
	flex-direction: column;
	flex: 1; /* 佔據剩餘空間 */
	overflow-y: auto; /* 內容過多時顯示垂直捲軸 */
	min-height: 0;
}

.empty-state {
	text-align: center;
	color: var(--el-text-color-placeholder);
	padding: 40px;
	font-style: italic;
}

.task-item {
	display: flex;
	align-items: flex-start;
	padding: 16px 0;
	/* 使用 Element Plus 邊框變數 */
	border-bottom: 1px solid var(--el-border-color-lighter);
	transition: opacity 0.2s;
}

.task-item:last-child {
	border-bottom: none;
}

.task-item.is-completed .task-title {
	text-decoration: line-through;
	color: var(--el-text-color-disabled);
}

.task-item.is-completed {
	opacity: 0.6;
}

/* Custom Checkbox */
.task-check {
	margin-right: 16px;
	margin-top: 2px;
	cursor: pointer;
}

.custom-checkbox {
	width: 20px;
	height: 20px;
	border: 2px solid var(--el-text-color-secondary);
	border-radius: 6px;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 0.2s;
}

.task-item.is-completed .custom-checkbox {
	background-color: var(--el-color-primary);
	border-color: var(--el-color-primary);
	color: white;
}

/* Task Content */
.task-content {
	flex: 1;
}

.task-title {
	font-size: 1rem;
	font-weight: 500;
	margin-bottom: 6px;
	line-height: 1.4;
	color: var(--el-text-color-primary);
}

.task-meta {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 12px;
	font-size: 0.75rem;
	color: var(--el-text-color-secondary);
}

.meta-info {
	display: flex;
	align-items: center;
	gap: 4px;
}

.meta-tag {
	font-weight: 500;
	border: 1px solid transparent;
	display: inline-flex;
	align-items: center;
	flex-shrink: 0;
	white-space: nowrap;
}

.meta-tag :deep(.el-tag__content) {
	display: inline-flex;
	align-items: center;
}

/* Form Layout */
.form-row {
	display: flex;
	gap: 16px;
}
.form-row .el-form-item {
	flex: 1;
}

/* Management Modal Styles */
.manage-input-row {
	display: flex;
	gap: 10px;
	margin-bottom: 20px;
	align-items: center;
}
.manage-list {
	max-height: 300px;
	overflow-y: auto;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 4px;
}
.manage-item {
	padding: 10px 15px;
	border-bottom: 1px solid var(--el-border-color-lighter);
	display: flex;
	align-items: center;
	gap: 10px;
}
.manage-item:last-child {
	border-bottom: none;
}
.tag-dot {
	width: 12px;
	height: 12px;
	border-radius: 50%;
	display: inline-block;
}

/* Schedule Styles */
.schedule-box {
	text-align: center;
	margin-bottom: 20px;
}
.input-row {
	display: flex;
	justify-content: center;
	gap: 10px;
	margin-top: 10px;
}
.schedule-item {
	display: flex;
	align-items: center;
	padding: 10px;
	border-bottom: 1px solid var(--el-border-color-lighter);
}
.time-badge {
	background: var(--el-fill-color-light);
	color: var(--el-text-color-regular);
	padding: 4px 8px;
	border-radius: 4px;
	font-weight: bold;
	margin-right: 12px;
	font-size: 0.8rem;
}
.task-note {
	font-size: 0.75rem;
	color: var(--el-color-warning);
}
.parent-nav {
	display: flex;
	align-items: center;
	gap: 5px;
	font-size: 0.9rem;
	color: var(--el-color-primary);
	cursor: pointer;
	margin-bottom: 15px;
	padding-bottom: 10px;
	border-bottom: 1px solid var(--el-border-color-lighter);
}

.parent-nav:hover {
	text-decoration: underline;
}

.subtasks-section {
	margin-bottom: 20px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 4px;
	padding: 10px;
	background-color: var(--el-fill-color-lighter);
}

.subtasks-header {
	font-size: 0.85rem;
	font-weight: 600;
	color: var(--el-text-color-secondary);
	margin-bottom: 8px;
}

.subtask-list {
	margin-bottom: 8px;
}

.subtask-item {
	display: flex;
	align-items: center;
	padding: 4px 0;
	font-size: 0.9rem;
}

.subtask-title {
	flex: 1;
	margin-left: 8px;
	color: var(--el-text-color-primary);
}

.subtask-title.clickable {
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding-right: 5px;
}

.subtask-title.clickable:hover {
	color: var(--el-color-primary);
}

.subtask-title.is-completed {
	text-decoration: line-through;
	color: var(--el-text-color-disabled);
}

.arrow-icon {
	font-size: 0.8em;
	opacity: 0.5;
}

.subtask-input-row {
	margin-top: 5px;
}

.custom-checkbox.checked {
	background-color: var(--el-color-primary);
	border-color: var(--el-color-primary);
	color: white;
}

.stats-container {
	display: flex;
	flex-direction: column;
	gap: 20px;
	padding: 20px 0;
}

.stats-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 12px;
	background-color: var(--el-fill-color-lighter);
	border-radius: 4px;
	border-left: 4px solid var(--el-color-primary);
}

.stats-label {
	font-size: 0.9rem;
	color: var(--el-text-color-secondary);
	font-weight: 500;
}

.stats-value {
	font-size: 1.3rem;
	font-weight: 600;
	color: var(--el-color-primary);
}
</style>
