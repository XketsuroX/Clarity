import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export interface ITagJSON {
	id: number;
	text: string;
	color: string;
}

@Entity()
export class Tag {
	@PrimaryGeneratedColumn()
	id!: number;

	@Column({ type: 'varchar' })
	text: string;

	@Column({ type: 'varchar' })
	color: string;

	constructor(text: string, color: string = '#000000') {
		this.text = text;
		this.color = color;
	}

	changeColor(color: string): void {
		this.color = color;
	}

	rename(text: string): void {
		this.text = text;
	}

	toJSON(): ITagJSON {
		return {
			id: this.id,
			text: this.text,
			color: this.color,
		};
	}
}
