<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import 'element-plus/theme-chalk/dark/css-vars.css';

interface Task {
	id: number;
	text: string;
	completed: boolean;
}

interface Category {
	id: number;
	name: string;
	tasks: Task[];
}

const categories = ref<Category[]>([
	{
		id: 1,
		name: '個人事務',
		tasks: [
			{ id: 1, text: '學習 Vue 資料結構', completed: true },
			{ id: 2, text: '休息一下', completed: false },
		],
	},
	{
		id: 2,
		name: '工作項目',
		tasks: [{ id: 3, text: '規劃後端連接', completed: false }],
	},
]);

const newTaskText = ref('');

function addTask(): void {
	if (newTaskText.value.trim() === '') {
		ElMessage.warning('任務內容不能為空！');
		return;
	}
	// 3. 預設將新任務加入第一個分類
	if (categories.value.length > 0) {
		categories.value[0].tasks.push({
			id: Date.now(),
			text: newTaskText.value,
			completed: false,
		});
		newTaskText.value = '';
	} else {
		ElMessage.error('沒有可用的分類！');
	}
	newTaskText.value = '';
}

function removeTask(categoryId: number, taskId: number): void {
	const category = categories.value.find((c) => c.id === categoryId);
	if (category) {
		category.tasks = category.tasks.filter((t) => t.id !== taskId);
	}
}
</script>

<template>
	<div class="main-container">
		<el-card class="box-card" shadow="always">
			<!-- Title -->
			<!-- Add Task Input -->
			<template #header>
				<div class="card-header">
					<span>To-Do List</span>
					<el-input
						v-model="newTaskText"
						placeholder="Add a new task..."
						clearable
						class="input-with-button"
						@keyup.enter="addTask"
					>
						<template #append>
							<el-button type="primary" @click="addTask">Add</el-button>
						</template>
					</el-input>
				</div>
			</template>

			<template #default>
				<!-- 2. 更新模板渲染，使用巢狀 v-for -->
				<div v-for="category in categories" :key="category.id" class="category-section">
					<h3 class="category-title">{{ category.name }}</h3>
					<div v-for="task in category.tasks" :key="task.id" class="task-item">
						<el-checkbox v-model="task.completed" :label="task.text" size="large" />
						<el-button
							type="danger"
							plain
							circle
							@click="removeTask(category.id, task.id)"
							>X</el-button
						>
					</div>
				</div>
			</template>
		</el-card>
	</div>
</template>

<style scoped>
.main-container {
	width: 100%;
	margin: auto;
	margin-top: 5%;
	padding: 0px;
}
.box-card {
	transition:
		all 0.3s ease-in-out,
		background-color 0.3s;
	background-color: var(--el-bg-color-overlay);
	/* border: 1px solid var(--el-border-color); */
	border: none;
	border-radius: 20px;
	width: 100%;
}
.box-card:hover {
	transform: translateY(-5px);
}
.card-header {
	display: flex;
	flex-wrap: nowrap;
	align-items: center;
	gap: 15px;
}
.card-header span {
	color: var(--el-text-color-primary);
	white-space: nowrap;
	flex-shrink: 0;
}
.input-with-button {
	width: 100%;
}
.category-section {
	margin-bottom: 20px;
}
.category-title {
	color: var(--el-text-color-primary);
	font-size: 1.1rem;
	margin-bottom: 10px;
	padding-left: 5px;
	border-left: 3px solid var(--el-color-primary);
}
.task-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 10px 0;
	border-bottom: 1px solid var(--el-border-color-lighter);
}
.task-item:last-child {
	border-bottom: none;
}

/* :deep(.el-card__header) {
	border-bottom: none;
	padding-bottom: 10px;
 } */

/* :deep(.el-card__body) {
	padding-top: 0px;
} */

:deep(.el-checkbox__label) {
	transition: color 0.2s;
	color: var(--el-text-color-primary);
	font-size: 1rem;
}
:deep(.is-checked .el-checkbox__label) {
	text-decoration: line-through;
	color: var(--el-text-color-secondary);
}
</style>
