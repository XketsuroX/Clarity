export interface ICategoryJSON {
    id: number
    title: string
}

export class Category {
    id: number;
    title: string;

    constructor(id: number, title: string) {
        this.id = id;
        this.title = title;
    }

    rename(string: string) {
        this.title = string;
    }

    toJSON(): ICategoryJSON {
        return {
            id: this.id,
            title: this.title
        }
    }
}
