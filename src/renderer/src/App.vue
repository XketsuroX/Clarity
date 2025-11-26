<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { ElMessage } from 'element-plus';
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
	VideoPause,
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
	generateSchedule,
} from './api';
import { TaskAddParams, TaskJSON } from '../../shared/TaskTypes';
import { CategoryJSON } from '../../shared/CategoryTypes';
import { TagJSON, TagCreateParam } from '../../shared/TagTypes';

// --- State ---
const tasks = ref<TaskJSON[]>([]);
const categories = ref<CategoryJSON[]>([]);
const tags = ref<TagJSON[]>([]);
const loading = ref(false);
const showCreateModal = ref(false);
const showScheduleModal = ref(false);
const showManageModal = ref(false);
const showTaskDetailModal = ref(false);
const currentTask = ref<Task | null>(null);
const editingCategory = ref<{ id: number; title: string } | null>(null); // 用於編輯分類

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
const newTagForm = ref<TagCreateParam>({ name: '', color: '#409EFF' }); // 預設藍色

const activeCollapseItems = ref<(string | number)[]>(['uncategorized']);

const groupedTasks = computed(() => {
	const groups: { id: number | string; title: string; tasks: TaskJSON[] }[] = [];

	// 1. 處理已分類的任務
	categories.value.forEach((cat) => {
		const catTasks = tasks.value.filter((t) => t.categoryId === cat.id);
		// 即使分類是空的也顯示，這樣才有「文件夾」的感覺
		groups.push({
			id: cat.id,
			title: cat.title,
			tasks: catTasks,
		});
	});

	// 2. 處理未分類 (Uncategorized)
	const noCatTasks = tasks.value.filter((t) => !t.categoryId);
	if (noCatTasks.length > 0) {
		groups.push({
			id: 'uncategorized',
			title: 'Uncategorized',
			tasks: noCatTasks,
		});
	}

	return groups;
});

const scheduleConfig = ref({ hours: 4 });
const scheduleResult = ref<any[]>([]);

// --- Helpers ---
const getCategoryName = (id?: number) => {
	if (!id) return null;
	const cat = categories.value.find((c) => c.id === id);
	return cat ? cat.title : null;
};

const getTaskTags = (tagIds?: number[]) => {
	if (!tagIds || tagIds.length === 0) return [];
	return tags.value.filter((t) => tagIds.includes(t.id));
};

const formatDate = (date: string | Date | undefined) => {
	if (!date) return '';
	return new Date(date).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
};

// --- Actions ---
const loadData = async () => {
	loading.value = true;
	try {
		const [tasksData, catsData, tagsData] = await Promise.all([
			fetchTasks(),
			fetchCategories(),
			fetchTags(),
		]);
		tasks.value = tasksData;
		categories.value = catsData;
		tags.value = tagsData;
	} catch (err) {
		ElMessage.error(`Failed to load data: ${err}`);
	} finally {
		loading.value = false;
	}
};

const handleCreate = async () => {
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
const handleCreateCategory = async () => {
	if (!newCategoryTitle.value.trim()) return;
	try {
		await createCategory(newCategoryTitle.value);
		ElMessage.success('Category added');
		newCategoryTitle.value = '';
		categories.value = await fetchCategories();
	} catch (err) {
		ElMessage.error('Failed to add category');
	}
};

const handleCreateTag = async () => {
	if (!newTagForm.value.name.trim()) return;
	try {
		await createTag(newTagForm.value);
		ElMessage.success('Tag added');
		newTagForm.value.name = '';
		// 隨機換個顏色，方便下次新增
		const colors = ['#67C23A', '#E6A23C', '#F56C6C', '#909399', '#409EFF'];
		newTagForm.value.color = colors[Math.floor(Math.random() * colors.length)];
		tags.value = await fetchTags();
	} catch (err) {
		ElMessage.error('Failed to add tag');
	}
};

const handleToggleComplete = async (task: TaskJSON) => {
	try {
		await toggleTaskComplete(task.id);
		task.completed = !task.completed; // Optimistic update

		// 如果是完成任務，給一點視覺反饋
		if (task.completed) {
			ElMessage.success({ message: 'Task completed', duration: 1500 });
		}
	} catch (err) {
		ElMessage.error('Update failed');
	}
};
// --- Actions: Category Management ---
const handleUpdateCategory = async (id: number, title: string) => {
	try {
		await updateCategory(id, title);
		ElMessage.success('Category updated');
		editingCategory.value = null;
		categories.value = await fetchCategories();
	} catch (err) {
		ElMessage.error('Failed to update category');
	}
};

const handleDeleteCategory = async (id: number) => {
	try {
		await ElMessageBox.confirm(
			'Delete this category? Tasks will be uncategorized.',
			'Warning',
			{
				confirmButtonText: 'Delete',
				cancelButtonText: 'Cancel',
				type: 'warning',
			}
		);
		await deleteCategory(id);
		ElMessage.success('Category deleted');
		categories.value = await fetchCategories();
		loadData(); // 重新載入任務以更新分類狀態
	} catch (err) {
		if (err !== 'cancel') ElMessage.error('Failed to delete category');
	}
};

// --- Actions: Task Detail & Operations ---
const openTaskDetail = (task: Task) => {
	// 深拷貝一份資料，避免直接修改列表中的顯示
	currentTask.value = JSON.parse(JSON.stringify(task));
	showTaskDetailModal.value = true;
};

const handleSaveTaskDetail = async () => {
	if (!currentTask.value) return;
	try {
		const { id, ...updates } = currentTask.value;
		// 轉換 deadline 為 ISO string
		if (updates.deadline) {
			updates.deadline = new Date(updates.deadline).toISOString();
		}

		await updateTask(id, updates);
		ElMessage.success('Task updated');
		showTaskDetailModal.value = false;
		loadData(); // 重新載入列表
	} catch (err) {
		ElMessage.error('Failed to update task: ' + err);
	}
};

const handleTaskDelete = async () => {
	if (!currentTask.value) return;
	try {
		await ElMessageBox.confirm('Are you sure to delete this task?', 'Warning', {
			confirmButtonText: 'Delete',
			cancelButtonText: 'Cancel',
			type: 'warning',
		});
		await removeTask(currentTask.value.id);
		ElMessage.success('Task deleted');
		showTaskDetailModal.value = false;
		loadData();
	} catch (err) {
		if (err !== 'cancel') ElMessage.error('Failed to delete task');
	}
};

const handleToggleStart = async () => {
	if (!currentTask.value) return;
	try {
		const updated = await toggleTaskStart(currentTask.value.id);
		currentTask.value.state = updated.state; // 更新本地狀態顯示
		ElMessage.success(updated.state === 'In Progress' ? 'Task Started' : 'Task Paused');
		loadData(); // 同步列表狀態
	} catch (err) {
		ElMessage.error('Failed to toggle start');
	}
};
const runSchedule = async () => {
	try {
		scheduleResult.value = await generateSchedule(scheduleConfig.value.hours);
		ElMessage.success(`Found ${scheduleResult.value.length} tasks`);
	} catch (err) {
		ElMessage.error('Scheduling failed: ' + err);
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
				<el-button circle :icon="Refresh" @click="loadData" />
				<el-button circle :icon="Folder" @click="showManageModal = true" />
				<el-button circle :icon="Lightning" @click="showScheduleModal = true" />
				<el-button circle type="primary" :icon="Plus" @click="showCreateModal = true" />
			</div>
		</header>

		<!-- Content -->
		<main class="task-list-container" v-loading="loading">
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
						<div
							class="task-check"
							@click.stop="handleToggleComplete(task)"
							@click="handleToggleComplete(task)"
						>
							<div class="custom-checkbox">
								<el-icon v-if="task.completed"><Check /></el-icon>
							</div>
						</div>

						<div class="task-content">
							<div class="task-title">{{ task.title }}</div>
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

								<span v-if="task.deadline" class="meta-info">
									<el-icon><Calendar /></el-icon>
									{{ formatDate(task.deadline) }}
								</span>

								<span v-if="task.estimateDurationHour" class="meta-info">
									<el-icon><Clock /></el-icon>
									{{ task.estimateDurationHour }}h
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
						>
							<el-option
								v-for="c in categories"
								:key="c.id"
								:label="c.title"
								:value="c.id"
							/>
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
						<el-option v-for="t in tags" :key="t.id" :label="t.title" :value="t.id">
							<span :style="{ color: t.color, marginRight: '8px' }">●</span>
							{{ t.title }}
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
							v-model="newTagForm.title"
							placeholder="New Tag Name"
							style="flex: 1"
						/>
						<el-color-picker v-model="newTagForm.color" size="default" />
						<el-button type="primary" :icon="Plus" @click="handleCreateTag" />
					</div>
					<div class="manage-list">
						<div v-for="t in tags" :key="t.id" class="manage-item">
							<span class="tag-dot" :style="{ backgroundColor: t.color }"></span>
							{{ t.name }}
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

					<div class="form-row">
						<el-form-item label="Category">
							<el-select v-model="currentTask.categoryId" placeholder="None">
								<el-option
									v-for="c in categories"
									:key="c.id"
									:label="c.title"
									:value="c.id"
								/>
							</el-select>
						</el-form-item>
						<el-form-item label="Duration (h)">
							<el-input-number
								v-model="currentTask.estimateDurationHour"
								:min="0.5"
								:step="0.5"
							/>
						</el-form-item>
					</div>

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
							:type="currentTask.state === 'In Progress' ? 'warning' : 'success'"
							:icon="currentTask.state === 'In Progress' ? VideoPause : VideoPlay"
							@click="handleToggleStart"
						>
							{{ currentTask.state === 'In Progress' ? 'Pause' : 'Start Timer' }}
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
</style>
