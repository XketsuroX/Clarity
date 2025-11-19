import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

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

	toJSON(): ICategoryJSON {
		return {
			id: this.id,
			title: this.title,
		};
	}
}
