import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Task } from './Task';

export interface ICategoryJSON {
	id: number;
	title: string;
}

@Entity()
export class Category {
	@PrimaryGeneratedColumn()
	id!: number;

	@Column({ type: 'varchar', unique: true })
	title!: string;

	@CreateDateColumn()
	createdAt!: Date;

	@OneToMany(() => Task, (task) => task.category)
	tasks!: Task[];
}
