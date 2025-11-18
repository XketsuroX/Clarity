import { Column, Entity, PrimaryColumn } from 'typeorm';

export interface ICategoryJSON {
	id: number;
	title: string;
}

@Entity()
export class Category {
	@PrimaryColumn({ type: 'int' })
	id: number;

	@Column({ type: 'varchar' })
	title: string;

	constructor(id: number, title: string) {
		this.id = id;
		this.title = title;
	}

	rename(string: string): void {
		this.title = string;
	}

	toJSON(): ICategoryJSON {
		return {
			id: this.id,
			title: this.title,
		};
	}
}
