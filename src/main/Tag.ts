import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export interface ITagJSON {
	id: number;
	name: string;
	color: string;
}

@Entity()
export class Tag {
	@PrimaryGeneratedColumn()
	id!: number;

	@Column({ type: 'varchar' })
	name: string;

	@Column({ type: 'varchar', default: '#000000' })
	color: string;

	constructor(name: string, color: string = '#000000') {
		this.name = name;
		this.color = color;
	}

	toJSON(): ITagJSON {
		return {
			id: this.id,
			name: this.name,
			color: this.color,
		};
	}
}
