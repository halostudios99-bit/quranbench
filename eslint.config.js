import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Node and browser globals. typescript-eslint disables no-undef for .ts/.tsx (the
// type-checker already catches undefined names), so these blocks only matter for
// plain .js/.mjs files — the service worker and the build scripts — which are
// otherwise flagged for using platform globals.
const nodeGlobals = {
  process: 'readonly',
  Buffer: 'readonly',
  console: 'readonly',
  URL: 'readonly',
  __dirname: 'readonly',
  module: 'readonly',
  require: 'readonly',
};

const serviceWorkerGlobals = {
  self: 'readonly',
  caches: 'readonly',
  fetch: 'readonly',
  URL: 'readonly',
  console: 'readonly',
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      'packages/corpus-build/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.mjs', '**/scripts/**/*.{js,mjs,ts}'],
    languageOptions: { globals: nodeGlobals },
  },
  {
    files: ['**/public/**/*.js'],
    languageOptions: { globals: serviceWorkerGlobals },
  },
  {
    rules: {
      // Arabic-block regexes legitimately contain characters ESLint reads as
      // irregular whitespace; never flag inside strings, templates or regexes.
      'no-irregular-whitespace': [
        'error',
        { skipStrings: true, skipTemplates: true, skipRegExps: true, skipComments: true },
      ],
    },
  },
);
