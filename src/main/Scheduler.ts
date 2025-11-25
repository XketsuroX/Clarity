import { Task } from './Task';

interface IKnapsackItem {
	originalTask: Task;
	weight: number; // 佔用的時間單位數
	value: number; // 分數
	isFragment: boolean; // 標記這是否為拆分後的碎片
}

export class Scheduler {
	/**
	 * @param tasks 候選任務
	 * @param capacityHours 總工時 (e.g. 8)
	 * @param timeUnit 最小時間單位 (e.g. 0.5 小時)
	 */
	public schedule(
		tasks: Task[],
		capacityHours: number,
		timeUnit: number = 0.5
	): { taskId: number; title: string; scheduledDuration: number; isPartial: boolean }[] {
		// 1. 【關鍵步驟】物品轉換與拆分
		const items: IKnapsackItem[] = [];

		for (const task of tasks) {
			const duration = task.estimateDurationHour || 1;
			const totalUnits = Math.ceil(duration / timeUnit);
			const totalValue = this.calculateTaskValue(task);

			if (task.isSplittable) {
				// 【邏輯】如果是可拆分的，把它切成 totalUnits 個小物品
				const unitValue = totalValue / totalUnits;
				for (let i = 0; i < totalUnits; i++) {
					items.push({
						originalTask: task,
						weight: 1, // 每個碎片只佔 1 個單位
						value: unitValue,
						isFragment: true,
					});
				}
			} else {
				// 【邏輯】不可拆分，保持原樣
				items.push({
					originalTask: task,
					weight: totalUnits,
					value: totalValue,
					isFragment: false,
				});
			}
		}

		// 2. 執行標準 0/1 背包演算法 (DP)
		const capacity = Math.floor(capacityHours / timeUnit);
		const n = items.length;
		const dp: number[][] = Array.from({ length: n + 1 }, () => Array(capacity + 1).fill(0));

		for (let i = 1; i <= n; i++) {
			const item = items[i - 1];
			for (let w = 0; w <= capacity; w++) {
				if (item.weight <= w) {
					dp[i][w] = Math.max(dp[i - 1][w], dp[i - 1][w - item.weight] + item.value);
				} else {
					dp[i][w] = dp[i - 1][w];
				}
			}
		}

		// 3. 回溯找出被選中的物品
		const selectedItems: IKnapsackItem[] = [];
		let w = capacity;
		for (let i = n; i > 0; i--) {
			if (dp[i][w] !== dp[i - 1][w]) {
				const item = items[i - 1];
				selectedItems.push(item);
				w -= item.weight;
			}
		}

		// 4. 【後處理】整理輸出結果
		// 因為可拆分任務可能被選了多次 (例如選了 3 個碎片 = 1.5 小時)
		// 我們需要把碎片合併起來顯示
		return this.formatOutput(selectedItems, timeUnit);
	}

	private calculateTaskValue(task: Task): number {
		// 您的評分邏輯 (Priority, Deadline...)
		return task.priority * 100 + (task.deadline ? 50 : 0);
	}

	private formatOutput(
		items: IKnapsackItem[],
		timeUnit: number
	): { taskId: number; title: string; scheduledDuration: number; isPartial: boolean }[] {
		// 統計每個任務被選中了幾次
		const summary = new Map<number, { task: Task; count: number }>();

		for (const item of items) {
			const id = item.originalTask.id;
			if (!summary.has(id)) {
				summary.set(id, { task: item.originalTask, count: 0 });
			}
			summary.get(id)!.count += item.weight; // 加回權重單位
		}

		// 轉換為最終列表
		return Array.from(summary.values()).map((entry) => ({
			taskId: entry.task.id,
			title: entry.task.title,
			scheduledDuration: entry.count * timeUnit, // 算出實際排程時間
			isPartial: entry.count * timeUnit < (entry.task.estimateDurationHour || 0), // 標記是否只做了一部分
		}));
	}
}
