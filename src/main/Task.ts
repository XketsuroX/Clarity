import {
	Column,
	Entity,
	JoinTable,
	ManyToMany,
	ManyToOne,
	PrimaryGeneratedColumn,
	TreeChildren,
	TreeParent,
} from 'typeorm';
import { Tag } from './Tag';
import { Category } from './Category';

export type TaskState = 'Completed' | 'In Progress' | 'Overdue' | 'Scheduled';

export interface ITaskJSON {
	id: number;
	title: string;
	description: string;
	deadline: string | null; // ISO string
	startDate: string | null; // ISO string
	completed: boolean;
	categoryId?: number | null;
	priority: number;
	estimateDurationHour: number | null;
	tags: Tag[];
	childrenTaskIds: number[];
	parentTaskId?: number | null;
	state: TaskState;
}
@Entity()
export class Task {
	@PrimaryGeneratedColumn()
	id!: number;

	@Column({ type: 'varchar' })
	title!: string;

	@Column({ type: 'text', default: '' })
	description!: string;

	@Column({ type: 'datetime', nullable: true })
	deadline!: Date | null;

	@Column({ type: 'datetime', nullable: true })
	startDate!: Date | null;

	@Column({ type: 'boolean', default: false })
	completed!: boolean;

	@Column({ type: 'enum', enum: ['Completed', 'In Progress', 'Overdue', 'Scheduled'], default: 'Scheduled' })
	state!: TaskState;

	@ManyToOne(() => Category, (category) => category.tasks, {
		onDelete: 'SET NULL',
		nullable: true,
	})
	category?: Category | null;

	@Column({ type: 'int', default: 0 })
	priority!: number;

	@Column({ type: 'int', nullable: true })
	estimateDurationHour!: number | null;

	@ManyToMany(() => Tag, { cascade: true })
	@JoinTable()
	tags!: Tag[];

	@TreeChildren()
	childrenTasks!: Task[];

	@TreeParent()
	parentTask!: Task | null;

	// `state` is persisted on the entity. Time-based transitions (e.g. Overdue)
	// are applied by TaskManager.refreshOverdue().

	toJSON(): ITaskJSON {
		return {
			id: this.id,
			title: this.title,
			description: this.description,
			deadline: this.deadline?.toISOString() ?? null,
			startDate: this.startDate?.toISOString() ?? null,
			completed: this.completed,
			categoryId: this.category?.id ?? null,
			priority: this.priority,
			estimateDurationHour: this.estimateDurationHour,
			tags: this.tags,
			childrenTaskIds: this.childrenTasks?.map((task) => task.id) ?? [],
			parentTaskId: this.parentTask?.id ?? null,
			state: this.state,
		};
	}
}
