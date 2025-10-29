export type TaskState = 'Completed' | 'In Progress' | 'Overdue'

export interface ITaskJSON {
  id: string
  title: string
  deadline: string // ISO string
  completed: boolean
  state: TaskState
}

export class Task {
    id: string
    title: string
    deadline: Date
    completed: boolean

    constructor(id: string, title: string, deadline: Date, completed = false) {
        this.id = id
        this.title = title
        this.deadline = deadline
        this.completed = completed
    }

    markCompleted() {
        this.completed = true
    }

    markIncomplete() {
        this.completed = false
    }

    get state(): TaskState {
        if (this.completed) return 'Completed'
        const now = new Date()
        if (this.deadline.getTime() < now.getTime()) return 'Overdue'
        return 'In Progress'
    }

    toJSON(): ITaskJSON {
        return {
        id: this.id,
        title: this.title,
        deadline: this.deadline.toISOString(),
        completed: this.completed,
        state: this.state
        }
    }
}