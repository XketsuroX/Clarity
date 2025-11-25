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

export interface ITaskJSON {
	id: number;
	title: string;
	description: string;
	deadline: string | null; // ISO string
	startDate: string | null; // ISO string
	actualStartDate: string | null;
	actualEndDate: string | null;
	completed: boolean;
	categoryId?: number | null;
	priority: number;
	estimateDurationHour: number;
	completeness: number;
	actualDurationHour?: number | null;
	tags: Tag[];
	childrenTaskIds: number[];
	parentTaskId?: number | null;
	state: string;
	isSplittable: boolean;
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

	@Column({ type: 'datetime', nullable: true })
	actualStartDate!: Date | null;

	@Column({ type: 'datetime', nullable: true })
	actualEndDate!: Date | null;

	@Column({ type: 'boolean', default: false })
	completed!: boolean;

	@Column({ type: 'varchar', default: 'Scheduled' })
	state!: string;

	@ManyToOne(() => Category, (category) => category.tasks, {
		onDelete: 'SET NULL',
		nullable: true,
	})
	category?: Category | null;

	@Column({ type: 'int', default: 0 })
	priority!: number;

	@Column({ type: 'float' })
	estimateDurationHour!: number;

	@Column({ type: 'int', default: 0 })
	completeness!: number;

	@Column({ type: 'float', nullable: true })
	actualDurationHour!: number | null;

	@ManyToMany(() => Tag, { cascade: true })
	@JoinTable()
	tags!: Tag[];

	@TreeChildren()
	childrenTasks!: Task[];

	@TreeParent()
	parentTask!: Task | null;

	@Column({ type: 'boolean', default: false })
	isSplittable!: boolean;

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
			completeness: this.completeness,
			actualStartDate: this.actualStartDate?.toISOString() ?? null,
			actualEndDate: this.actualEndDate?.toISOString() ?? null,
			actualDurationHour: this.actualDurationHour ?? null,
			tags: this.tags,
			childrenTaskIds: this.childrenTasks.map((task) => task.id) ?? [],
			parentTaskId: this.parentTask?.id ?? null,
			state: this.state,
			isSplittable: this.isSplittable,
		};
	}
}
