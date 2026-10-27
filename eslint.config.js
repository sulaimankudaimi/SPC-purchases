export default [
  {
    ignores: [
      'dist/**',
      'out/**',
      'node_modules/**',
      'coverage/**',
      'test-results/**',
      'data-private/**',
      '**/*.ts',
      '**/*.tsx'
    ]
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    rules: {
      'no-debugger': 'error',
      'no-unused-vars': 'off'
    }
  }
];
