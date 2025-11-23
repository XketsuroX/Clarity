import type { Config } from 'jest';

const config: Config = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/src'],
	testMatch: ['**/__tests__/**/*.+(ts|tsx)'],
	moduleNameMapper: {
		'\\.(css|less|sass|scss|png|jpg|svg)$': '<rootDir>/__mocks__/fileMock.js',
	},
	setupFiles: ['<rootDir>/jest.setup.ts'],
	transform: {
		'^.+\\.tsx?$': [
			'ts-jest',
			{
				tsconfig: 'tsconfig.node.json',
			},
		],
	},
};

export default config;
