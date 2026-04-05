import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.validation.test.mjs'],
    exclude: ['**/node_modules/**'],
  },
});
