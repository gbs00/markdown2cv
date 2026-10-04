import obsidianmd from 'eslint-plugin-obsidianmd';

export default [
  { ignores: ['dist/**', 'dev-vault/**', 'tmp/**', 'release/**', 'output/**', 'evidence/**', 'scripts/**', 'tests/**', 'eslint.config.mjs'] },
  ...obsidianmd.configs.recommended,
  { files: ['src/**/*.ts'], languageOptions: { parserOptions: { project: './tsconfig.json' } } },
  // Explicit ownerDocument creation is intentional for detached print/preview DOM.
  // The suggested doc.win.createEl helper is not exposed by the pinned SDK's Window type.
  { files: ['src/render.ts'], rules: { 'obsidianmd/prefer-create-el': 'off' } },
  // Pure cancellation logic is shared with Node tests; it does not own a UI window.
  { files: ['src/model.ts'], rules: { 'obsidianmd/no-global-this': 'off' } },
];
