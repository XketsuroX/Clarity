import { defineConfig } from 'eslint/config';
import tseslint from '@electron-toolkit/eslint-config-ts';
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier';
import eslintPluginVue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';

export default defineConfig(
	{ ignores: ['**/node_modules', '**/dist', '**/out'] },

	{
		files: ['**/*.{ts,mts,tsx,vue}'],
		extends: [...tseslint.configs.recommended],
		languageOptions: {
			parserOptions: {
				project: ['./tsconfig.node.json', './tsconfig.web.json', './tsconfig.json'],
				extraFileExtensions: ['.vue'],
			},
		},
		rules: {
			semi: ['error', 'always'],
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/explicit-module-boundary-types': 'warn',
			'@typescript-eslint/no-unnecessary-condition': 'warn',
		},
	},

	{
		files: ['**/*.vue'],
		extends: [...eslintPluginVue.configs['flat/recommended'], ...tseslint.configs.recommended],
		languageOptions: {
			parser: vueParser,
			parserOptions: {
				parser: tseslint.parser,
				project: ['./tsconfig.node.json', './tsconfig.web.json', './tsconfig.json'],
				extraFileExtensions: ['.vue'],
			},
		},
		rules: {
			'vue/require-default-prop': 'off',
			'vue/multi-word-component-names': 'off',
			'vue/block-lang': [
				'error',
				{
					script: {
						lang: 'ts',
					},
				},
			],
		},
	},

	eslintConfigPrettier
);
