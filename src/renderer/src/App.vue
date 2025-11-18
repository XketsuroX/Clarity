<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';

interface Task {
	id: number;
	text: string;
	completed: boolean;
}

const tasks = ref<Task[]>([
	{ id: 1, text: '學習 Vue 基礎', completed: true },
	{ id: 2, text: '整合 Element Plus', completed: false },
	{ id: 3, text: '休息一下', completed: false },
]);

const newTaskText = ref('');

function addTask() {
	if (newTaskText.value.trim() === '') {
		ElMessage.warning('任務內容不能為空！');
		return;
	}
	tasks.value.push({
		id: Date.now(),
		text: newTaskText.value,
		completed: false,
	});
	newTaskText.value = '';
}

function removeTask(id: number): void {
	tasks.value = tasks.value.filter((t) => t.id !== id);
}
</script>

<template>
	<div class="main-container">
		<el-card class="box-card">
			<template #header>
				<div class="card-header">
					<span>我的待辦事項</span>
				</div>
			</template>

			<!-- 新增任務 -->
			<el-row :gutter="10" class="add-task-row">
				<el-col :span="18">
					<el-input
						v-model="newTaskText"
						placeholder="新增一個任務..."
						@keyup.enter="addTask"
						clearable
					/>
				</el-col>
				<el-col :span="6">
					<el-button type="primary" @click="addTask" style="width: 100%">新增</el-button>
				</el-col>
			</el-row>

			<!-- 任務列表 -->
			<div v-for="task in tasks" :key="task.id" class="task-item">
				<el-checkbox v-model="task.completed" :label="task.text" size="large" />
				<el-button type="danger" @click="removeTask(task.id)" circle plain>X</el-button>
			</div>
		</el-card>
	</div>
</template>

<style scoped>
.main-container {
	padding: 20px;
	max-width: 600px;
	margin: 40px auto;
}
.add-task-row {
	margin-bottom: 20px;
}
.task-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 10px 0;
	border-bottom: 1px solid #ebeef5;
}
.task-item:last-child {
	border-bottom: none;
}
/* 讓已完成的任務有刪除線 */
:deep(.el-checkbox__label) {
	transition: color 0.2s;
}
:deep(.is-checked .el-checkbox__label) {
	text-decoration: line-through;
	color: #a8abb2;
}
</style>
