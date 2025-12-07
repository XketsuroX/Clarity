import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export interface ITagJSON {
	id: number;
	name: string;
	color: string;
}

@Entity()
export class Tag {
	/* istanbul ignore next */
	@PrimaryGeneratedColumn()
	id!: number;

	/* istanbul ignore next */
	@Column({ type: 'varchar' })
	name: string;

	/* istanbul ignore next */
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
