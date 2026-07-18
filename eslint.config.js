import js from '@eslint/js';

const browserGlobals = {
  document: 'readonly',
  window: 'readonly',
  navigator: 'readonly',
  localStorage: 'readonly',
  matchMedia: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  performance: 'readonly',
  URLSearchParams: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  HTMLButtonElement: 'readonly',
  PointerEvent: 'readonly',
  KeyboardEvent: 'readonly',
  Image: 'readonly',
  fetch: 'readonly'
};

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: browserGlobals },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-constant-condition': ['error', { checkLoops: false }]
    }
  },
  {
    files: ['test/**/*.js', 'playwright.config.js'],
    languageOptions: {
      globals: { process: 'readonly', Buffer: 'readonly', window: 'readonly', localStorage: 'readonly', document: 'readonly', navigator: 'readonly' }
    }
  }
];
