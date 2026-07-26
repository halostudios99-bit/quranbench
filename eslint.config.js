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
      // The atomic-deploy build slots (scripts/deploy-atomic.sh). Same generated
      // output as .next; without these, a local build into a slot makes eslint
      // walk the entire bundle and report tens of thousands of errors.
      '**/.next-a/**',
      '**/.next-b/**',
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
    // Browser-automation scripts: the bodies passed to page.evaluate() are
    // serialised and run inside the page, so they legitimately reference DOM
    // globals that do not exist in the Node process running the file.
    files: ['**/tests/**/*.mjs'],
    languageOptions: {
      globals: {
        ...nodeGlobals,
        document: 'readonly',
        window: 'readonly',
        getComputedStyle: 'readonly',
      },
    },
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
