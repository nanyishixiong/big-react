import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import replace from '@rollup/plugin-replace';
import { resolePkgPath } from '../rollup/utils';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		react(),
		replace({
			__DEV__: true, // 作用：开发环境下代码中的 __DEV__ 被编译为true，生产环境编译为false
			preventAssignment: true
		})
	],
	resolve: {
		alias: [
			{
				find: 'react',
				replacement: resolePkgPath('react')
			},
			{
				find: 'react-dom',
				replacement: resolePkgPath('react-dom')
			},
			{
				find: 'hostConfig',
				replacement: path.resolve(
					resolePkgPath('react-dom'),
					'./src/hostConfig.ts'
				)
			}
		]
	}
});
