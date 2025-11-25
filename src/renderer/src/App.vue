<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { ElMessage } from 'element-plus';
import {
	fetchTasks,
	createTask,
	toggleTaskComplete,
	generateSchedule,
	type Task,
	type Tag,
} from './api';

import { TaskAddParams } from '../../shared/TaskTypes';

// --- State Management ---
const tasks = ref<Task[]>([]);
const loading = ref(false);
const showCreateModal = ref(false);
const showScheduleModal = ref(false);

// Form Data
const newTask = ref<TaskAddParams>({
	title: '',
	estimateDurationHour: 1,
	priority: 0,
});

const scheduleConfig = ref({
	hours: 4,
});
const scheduleResult = ref<any[]>([]);

// --- Actions ---

// Load Tasks
const loadTasks = async () => {
	loading.value = true;
	try {
		tasks.value = await fetchTasks();
	} catch (err) {
		ElMessage.error(`Failed to load tasks: ${err}`);
	} finally {
		loading.value = false;
	}
};

// Create Task
const handleCreate = async () => {
	if (!newTask.value.title) return;
	try {
		console.log('Creating task:' + JSON.stringify(newTask.value) + typeof newTask.value);
		await createTask(newTask.value as TaskAddParams);
		ElMessage.success('Task created successfully');
		showCreateModal.value = false;
		newTask.value.title = ''; // Reset
		await loadTasks();
	} catch (err) {
		ElMessage.error('Failed to create task: ' + err);
		console.error(err);
	}
};

// Toggle Complete
const handleToggleComplete = async (row: Task) => {
	try {
		await toggleTaskComplete(row.id, row.completed);
		ElMessage.success(row.completed ? 'Task completed' : 'Task reopened');
	} catch (err) {
		row.completed = !row.completed; // Revert on error
		ElMessage.error('Update failed');
	}
};

// Run Auto-Schedule
const runSchedule = async () => {
	try {
		scheduleResult.value = await generateSchedule(scheduleConfig.value.hours);
		ElMessage.success(`Found ${scheduleResult.value.length} tasks for you!`);
	} catch (err) {
		ElMessage.error('Scheduling failed');
	}
};

// Formatting Helper
const formatDuration = (hours: number | null) => {
	return hours ? `${hours}h` : '-';
};



onMounted(() => {
	loadTasks();
	const task: Task = {
		id: 1,
		title: 'Test Task',
		estimateDurationHour: 2,
		priority: 1,
		completed: false,
		createdAt: new Date(),
		updatedAt: new Date(),
		state: 'In Progress',
	};
	handleToggleComplete(task);
});
</script>

<template>
	<div class="app-layout">
		<header class="app-header">
			<div class="brand">
				<h1>CLARITY</h1>
				<span class="subtitle">Task Intelligence</span>
			</div>
			<div class="controls">
				<el-button circle size="large" @click="loadTasks"> 🔄 </el-button>
				<el-button type="success" circle size="large" @click="showScheduleModal = true">
					⚡
				</el-button>
				<el-button type="primary" circle size="large" @click="showCreateModal = true">
					➕
				</el-button>
			</div>
		</header>

		<main class="app-content">
			<el-card class="task-card" shadow="never">
				<template #header>
					<div class="card-header">
						<span>My Tasks</span>
						<el-tag type="info" effect="dark">{{ tasks.length }} items</el-tag>
					</div>
				</template>

				<el-table
					:data="tasks"
					row-key="id"
					default-expand-all
					style="width: 100%; background-color: transparent"
					:header-cell-style="{ background: '#1d1e1f', color: '#a0a0a0' }"
					v-loading="loading"
				>
					<el-table-column width="50">
						<template #default="{ row }">
							<el-checkbox
								v-model="row.completed"
								@change="handleToggleComplete(row)"
							/>
						</template>
					</el-table-column>

					<el-table-column label="Task" min-width="300">
						<template #default="{ row }">
							<span
								:class="{
									'text-completed': row.completed,
									'text-overdue': row.state === 'Overdue',
								}"
							>
								{{ row.title }}
							</span>
							<small
								v-if="row.state === 'Overdue'"
								style="color: #f56c6c; display: block; font-size: 0.8em"
							>
								⚠️ Overdue
							</small>
						</template>
					</el-table-column>

					<el-table-column label="Status" width="120" align="center">
						<template #default="{ row }">
							<el-tag v-if="row.completed" type="success" effect="dark" size="small"
								>Done</el-tag
							>
							<el-tag
								v-else-if="row.state === 'Overdue'"
								type="danger"
								effect="dark"
								size="small"
								>Overdue</el-tag
							>
							<el-tag
								v-else-if="row.state === 'In Progress'"
								type="warning"
								effect="dark"
								size="small"
								>Active</el-tag
							>
							<el-tag v-else type="info" effect="plain" size="small">Todo</el-tag>
						</template>
					</el-table-column>

					<el-table-column label="Est." width="80" align="right">
						<template #default="{ row }">
							<span class="mono-text">{{
								formatDuration(row.estimateDurationHour)
							}}</span>
						</template>
					</el-table-column>
				</el-table>
			</el-card>
		</main>

		<el-dialog v-model="showCreateModal" title="New Task" width="400px" align-center>
			<el-form :model="newTask" label-position="top">
				<el-form-item label="What needs to be done?">
					<el-input
						v-model="newTask.title"
						placeholder="e.g. Finish report"
						size="large"
					/>
				</el-form-item>
				<el-form-item label="Estimated Hours">
					<el-input-number
						v-model="newTask.estimateDurationHour"
						:min="0.5"
						:step="0.5"
						style="width: 100%"
					/>
				</el-form-item>
				<el-form-item label="Priority">
					<el-rate
						v-model="newTask.priority"
						:max="3"
						:colors="['#99A9BF', '#F7BA2A', '#FF9900']"
					/>
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="showCreateModal = false">Cancel</el-button>
				<el-button type="primary" @click="handleCreate">Create Task</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="showScheduleModal" title="Auto-Schedule" width="500px" align-center>
			<div class="schedule-box">
				<p>How much free time do you have now?</p>
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
				<h4>Recommended Plan</h4>
				<div v-for="(item, idx) in scheduleResult" :key="idx" class="schedule-item">
					<div class="time-badge">{{ item.scheduledDuration }}h</div>
					<div class="task-info">
						<div class="task-title">{{ item.title }}</div>
						<div v-if="item.isPartial" class="task-note">
							🔸 Partial work recommended
						</div>
					</div>
				</div>
			</div>
		</el-dialog>
	</div>
</template>

<style>
/* Global Dark Mode Overrides */
:root {
	--bg-color: #141414;
	--card-bg: #1d1e1f;
	--text-primary: #e5eaf3;
	--text-secondary: #a3a6ad;
	--accent-color: #409eff;
}

body {
	background-color: var(--bg-color);
	color: var(--text-primary);
	margin: 0;
	font-family: 'Roboto', 'Helvetica Neue', Arial, sans-serif;
}
</style>

<style scoped>
.app-layout {
	max-width: 900px;
	margin: 0 auto;
	padding: 40px 20px;
}

/* Header Styling */
.app-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 30px;
}

.brand h1 {
	margin: 0;
	font-size: 2rem;
	font-weight: 900;
	letter-spacing: 2px;
	background: linear-gradient(45deg, #409eff, #36d1dc);
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
}

.subtitle {
	color: var(--text-secondary);
	font-size: 0.9rem;
	text-transform: uppercase;
	letter-spacing: 1px;
}

/* Material Card Styling */
.task-card {
	border: none;
	background-color: var(--card-bg);
	border-radius: 12px;
}

.card-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	font-weight: 600;
}

/* Typography Helpers */
.text-completed {
	text-decoration: line-through;
	color: var(--text-secondary);
}

.text-overdue {
	color: #f56c6c;
	font-weight: bold;
}

.mono-text {
	font-family: 'Consolas', monospace;
	color: var(--text-secondary);
}

/* Schedule Modal Styles */
.schedule-box {
	background: #2b2b2b;
	padding: 20px;
	border-radius: 8px;
	margin-bottom: 20px;
	text-align: center;
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
	background: #2b2b2b;
	margin-bottom: 8px;
	padding: 10px;
	border-radius: 6px;
	border-left: 4px solid #67c23a; /* Green accent */
}

.time-badge {
	background: #67c23a;
	color: black;
	font-weight: bold;
	padding: 4px 8px;
	border-radius: 4px;
	margin-right: 12px;
	min-width: 50px;
	text-align: center;
}

.task-title {
	font-weight: 500;
}

.task-note {
	font-size: 0.8rem;
	color: #e6a23c;
}
</style>
