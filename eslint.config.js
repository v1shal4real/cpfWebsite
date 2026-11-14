// @ts-check
import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Lint rules. Formatting is Prettier's job (`npm run format`), so
 * `eslint-config-prettier` comes last and switches off every stylistic rule
 * that would argue with it.
 *
 * - jsx-a11y: accessibility checks on JSX (spec §3.4).
 * - react-hooks: the rules of hooks and exhaustive effect dependencies.
 * - react-refresh: components files export components, so Fast Refresh works.
 */
export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, jsxA11y.flatConfigs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Tests and config run in Node.
    files: ['**/*.test.{ts,tsx}', '**/*.bench.ts', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
