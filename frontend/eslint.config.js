import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    ignores: ['**/__tests__/**', '**/__mocks__/**', '**/setupTests.js'],
    extends: [
      js.configs.recommended,
      react.configs.flat.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // React 17+ / Vite : pas besoin d'importer React dans chaque fichier JSX
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // Règle très pédante (apostrophes brutes dans du texte JSX) sans impact fonctionnel,
      // désactivée pour éviter de devoir échapper ~15 occurrences dans les textes existants.
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    // Fichiers de test (Jest) : besoin des globales jest/test/expect/describe...
    files: ['**/__tests__/**/*.{js,jsx}', '**/setupTests.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.browser, ...globals.jest, ...globals.node },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // Mocks Jest (CommonJS) : module.exports
    files: ['**/__mocks__/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
      sourceType: 'commonjs',
    },
  },
  {
    // Fichiers de config Node (vite.config.js, etc.)
    files: ['*.config.js', 'vite.config.js'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
      sourceType: 'module',
    },
  },
])