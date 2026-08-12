import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Legacy API DTOs are being migrated incrementally; keep them visible without blocking production builds.
      // Legacy response adapters are checked separately by the API contract audit.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'prefer-const': 'warn',
      // Shared hooks/variants are intentionally exported beside their shadcn components.
      // Shared shadcn contexts and variants intentionally live beside their components.
      'react-refresh/only-export-components': 'off',
      // TanStack Table exposes an imperative instance by design; React Compiler cannot memoize it.
      'react-hooks/incompatible-library': 'off',
    },
  },
])
