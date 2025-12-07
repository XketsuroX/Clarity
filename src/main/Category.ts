import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Task } from './Task';

export interface ICategoryJSON {
	id: number;
	title: string;
}

@Entity()
export class Category {
	/* istanbul ignore next */
	@PrimaryGeneratedColumn()
	id!: number;

	@Column({ type: 'varchar', unique: true })
	title!: string;

	/* istanbul ignore next */
	@CreateDateColumn()
	createdAt!: Date;

	/* istanbul ignore next */
	@OneToMany(() => Task, (task) => task.category)
	tasks!: Task[];

	toJSON(): ICategoryJSON {
		return {
			id: this.id,
			title: this.title,
		};
	}
}
