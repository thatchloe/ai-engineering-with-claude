// ESLint flat config used by the ESLint MCP server (mcp__eslint__lint-files)
// when subagents lint the PR files stored under .temp/.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'reports/**', 'logs/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-var': 'error',
      'prefer-const': 'warn',
      eqeqeq: ['warn', 'always']
    }
  }
);
