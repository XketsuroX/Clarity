import { Column, Entity, JoinTable, ManyToMany, PrimaryColumn } from 'typeorm'
import { Tag } from './Tag'

export type TaskState = 'Completed' | 'In Progress' | 'Overdue'

export interface ITaskJSON {
    id: string
    title: string
    description: string
    deadline: string // ISO string
    startDate: string // ISO string
    completed: boolean
    categoryId?: number | null
    priority: number
    estimateDurationHour: number
    isRoot: boolean
    tags: Tag[]
    childrenTaskIds: string[]
    state: TaskState
}
@Entity()
export class Task {
    @PrimaryColumn({ type: 'varchar' })
    id: string

    @Column({ type: 'varchar' })
    title: string

    @Column({ type: 'varchar' })
    description: string

    @Column({ type: 'datetime' })
    deadline: Date;

    @Column({ type: 'datetime' })
    startDate: Date;

    @Column({ type: 'boolean', default: false })
    completed: boolean;

    @Column({ type: 'int', nullable: true })
    categoryId?: number | null;

    @Column({ type: 'int', default: 0 })
    priority: number;

    @Column({ type: 'int', default: 0 })
    estimateDurationHour: number;

    @Column({ type: 'boolean', default: false })
    isRoot: boolean;

    @ManyToMany(() => Tag, { cascade: true })
    @JoinTable()
    tags: Tag[];

    @Column('simple-array')
    childrenTaskIds: string[]

    constructor(
        id: string,
        title: string,
        description: string,
        deadline: Date,
        startDate: Date,
        completed = false,
        categoryId: number | null = null,
        priority = 0,
        estimateDurationHour = 0,
        isRoot = false,
        tags: Tag[],
        childrenTaskIds: string[] = []
    ) {
        this.id = id
        this.title = title
        this.description = description
        this.deadline = deadline
        this.startDate = startDate
        this.completed = completed
        this.categoryId = categoryId
        this.priority = priority
        this.estimateDurationHour = estimateDurationHour
        this.isRoot = isRoot
        this.tags = tags
        this.childrenTaskIds = childrenTaskIds
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
            description: this.description,
            deadline: this.deadline.toISOString(),
            startDate: this.startDate.toISOString(),
            completed: this.completed,
            categoryId: this.categoryId ?? null,
            priority: this.priority,
            estimateDurationHour: this.estimateDurationHour,
            isRoot: this.isRoot,
            tags: this.tags,
            childrenTaskIds: this.childrenTaskIds,
            state: this.state
        }
    }
}