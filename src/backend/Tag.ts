export interface ITagJSON {
    id: number
    text: string
    color: string
}

export class Tag {
    id: number
    text: string
    color: string

    constructor(id: number, text: string, color: string = '#000000') {
        this.id = id
        this.text = text
        this.color = color
    }

    changeColor(color: string): void {
        this.color = color
    }

    rename(text: string): void {
        this.text = text
    }

    toJSON(): ITagJSON {
        return {
            id: this.id,
            text: this.text,
            color: this.color
        }
    }
}