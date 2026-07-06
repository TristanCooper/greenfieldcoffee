import { defineConfig } from 'eslint/config';
import nextPlugin from 'eslint-config-next';

export default defineConfig([
  ...nextPlugin,
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'dist/**',
      'build/**',
      'out/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
]);