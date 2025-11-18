import { DataSource } from 'typeorm';
import { join } from 'path';
import { app } from 'electron';
import { Task } from './Task';
import { Tag } from './Tag';

export const AppDataSource = new DataSource({
	type: 'sqlite',
	database: join(app.getPath('userData'), 'app.db'),
	entities: [Task, Tag],
	synchronize: true,
	logging: false,
	dropSchema: false,
});

export const initializeDB = async (): Promise<void> => {
	if (!AppDataSource.isInitialized) {
		try {
			await AppDataSource.initialize();
			console.log('DB initialized');
		} catch (err) {
			console.error('DB init error:', err);
		}
	}
};
