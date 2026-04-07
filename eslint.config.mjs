import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import js from '@eslint/js'

const eslintConfig = defineConfig([
  // Base JavaScript recommended rules
  js.configs.recommended,

  // Next.js recommended configurations
  ...nextVitals,
  ...nextTs,

  // Override default ignores of eslint-config-next
  globalIgnores([
    // Build outputs
    '.next/**',
    'out/**',
    'build/**',
    'dist/**',

    // Dependencies
    'node_modules/**',

    // Generated files
    'next-env.d.ts',
    '*.generated.*',

    // Coverage reports
    'coverage/**',

    // Test artifacts
    'playwright-report/**',
    'test-results/**',
  ]),

  // TypeScript strict rules and custom rules
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    rules: {
      // TypeScript strict rules
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-unnecessary-condition': 'off', // Can be too strict for some patterns
      '@typescript-eslint/strict-boolean-expressions': 'off', // Can be too strict
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': false,
          minimumDescriptionLength: 10,
        },
      ],
    },
  },

  // React and JSX rules
  {
    files: ['**/*.{jsx,tsx}'],
    rules: {
      // React best practices
      'react/jsx-no-leaked-render': ['error', { validStrategies: ['ternary', 'coerce'] }],
      'react/jsx-curly-brace-presence': ['error', { props: 'never', children: 'never' }],
      'react/self-closing-comp': 'error',
      'react/jsx-boolean-value': ['error', 'never'],
      'react/jsx-fragments': ['error', 'syntax'],
      'react/jsx-no-useless-fragment': ['error', { allowExpressions: true }],
      'react/jsx-pascal-case': 'error',
      'react/no-array-index-key': 'warn',
      'react/jsx-sort-props': [
        'warn',
        {
          callbacksLast: true,
          shorthandFirst: true,
          reservedFirst: true,
          multiline: 'last',
        },
      ],

      // React Hooks rules (already included in next/core-web-vitals but being explicit)
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Accessibility rules (jsx-a11y - included in next/core-web-vitals)
  {
    files: ['**/*.{jsx,tsx}'],
    rules: {
      // Accessibility - stricter than defaults
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-has-content': 'error',
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/aria-activedescendant-has-tabindex': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/heading-has-content': 'error',
      'jsx-a11y/html-has-lang': 'error',
      'jsx-a11y/iframe-has-title': 'error',
      'jsx-a11y/img-redundant-alt': 'error',
      'jsx-a11y/interactive-supports-focus': 'warn',
      'jsx-a11y/label-has-associated-control': 'error',
      'jsx-a11y/media-has-caption': 'warn',
      'jsx-a11y/mouse-events-have-key-events': 'warn',
      'jsx-a11y/no-access-key': 'error',
      'jsx-a11y/no-autofocus': ['warn', { ignoreNonDOM: true }],
      'jsx-a11y/no-distracting-elements': 'error',
      'jsx-a11y/no-interactive-element-to-noninteractive-role': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
      'jsx-a11y/no-noninteractive-element-to-interactive-role': 'warn',
      'jsx-a11y/no-noninteractive-tabindex': 'warn',
      'jsx-a11y/no-redundant-roles': 'error',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',
      'jsx-a11y/scope': 'error',
      'jsx-a11y/tabindex-no-positive': 'error',
    },
  },

  // General JavaScript/TypeScript rules
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs,mts,cjs,cts}'],
    rules: {
      // Code quality
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-template': 'error',
      'prefer-arrow-callback': 'error',
      'arrow-body-style': ['error', 'as-needed'],
      'object-shorthand': 'error',
      'no-param-reassign': ['error', { props: false }],
      'no-nested-ternary': 'warn',
      'no-unneeded-ternary': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      curly: ['error', 'all'],
      'default-case-last': 'error',
      'no-else-return': ['error', { allowElseIf: false }],
      'no-lonely-if': 'error',
      'no-useless-return': 'error',
      'no-useless-rename': 'error',
      'no-useless-computed-key': 'error',
      'prefer-destructuring': [
        'warn',
        {
          VariableDeclarator: { array: false, object: true },
          AssignmentExpression: { array: false, object: false },
        },
      ],
      'prefer-spread': 'error',
      'prefer-rest-params': 'error',
      'no-duplicate-imports': 'off', // Handled by @typescript-eslint/consistent-type-imports
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../**/src/**'],
              message: 'Do not import from src directory using relative paths. Use @/ alias.',
            },
          ],
        },
      ],

      // Import ordering (requires eslint-plugin-import or handled by Prettier plugin)
      'sort-imports': [
        'error',
        {
          ignoreCase: true,
          ignoreDeclarationSort: true, // Let import plugin handle declaration sorting
          ignoreMemberSort: false,
          memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
        },
      ],
    },
  },

  // Production-specific rules
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: ['**/*.test.*', '**/*.spec.*', '**/__tests__/**', '**/tests/**'],
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  // Test file rules - more relaxed
  {
    files: ['**/*.test.*', '**/*.spec.*', '**/__tests__/**', '**/tests/**', '**/*.e2e.*'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'react/jsx-no-leaked-render': 'off',
    },
  },

  // Config files rules - more relaxed
  {
    files: [
      '*.config.{js,mjs,ts,mts}',
      'tailwind.config.*',
      'postcss.config.*',
      'next.config.*',
      'vitest.config.*',
      'playwright.config.*',
    ],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
])

export default eslintConfig
