import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import type { Linter } from 'eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import path from 'node:path';
import tseslint from 'typescript-eslint';
import type { NamingConventionOption } from './eslint-types.d.ts';
import svelteConfig from './web/svelte.config.js';

const gitignore_path = path.resolve(import.meta.dirname, '.gitignore');

export default [
    includeIgnoreFile(gitignore_path),

    // Ignore patterns
    {
        ignores: [
            '**/node_modules/**',
            '**/build/**',
            '**/dist/**',
            '**/.svelte-kit/**',
            'supabase/**',
            'agents/**',
            'e2e/**',
            'eslint-types.d.ts',
            'eslint.config.ts',
            'web/src/lib/types/material-symbols.ts',
            'server/src/database.types.ts',
        ]
    },

    // Base JS recommended rules
    js.configs.recommended,

    // TypeScript recommended (type-aware off for speed)
    ...tseslint.configs.strict,

    {
        rules: {
            'max-lines': [
                'error',
                {
                    max: 200,
                    skipBlankLines: true,
                    skipComments: true
                }
            ]
        }
    },

    // ESLint comments plugin [DO NOT CHANGE!!!]
    comments.recommended,
    {
        rules: {
            '@eslint-community/eslint-comments/no-use': 'error',
            '@eslint-community/eslint-comments/no-restricted-disable': [
                'error',
                '*'
            ]
        }
    },

    // Stylistic rules
    stylistic.configs.recommended,
    {
        plugins: { '@stylistic': stylistic },
        rules: {
            '@stylistic/semi': [ 'error', 'always' ],
            '@stylistic/indent': [ 'error', 4, { SwitchCase: 1 } ],
            '@stylistic/max-len': [ 'error', { code: 160, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreRegExpLiterals: true } ],
            '@stylistic/comma-dangle': [ 'error', 'never' ],
            '@stylistic/object-curly-spacing': [ 'error', 'always' ],
            '@stylistic/arrow-parens': [ 'error', 'always' ],
            '@stylistic/curly-newline': [ 'error', 'always' ]
        }
    },

    // Naming conventions
    {
        rules: {
            '@typescript-eslint/naming-convention': [
                'error',
                {
                    selector: 'default',
                    format: ['snake_case'],
                    trailingUnderscore: 'forbid',
                    leadingUnderscore: 'forbid',
                    filter: {
                        match: false,
                        regex: '^_*$'
                    }
                },
                {
                    selector: 'property',
                    format: [ 'snake_case', 'UPPER_CASE' ]
                },
                {
                    selector: 'property',
                    format: [ 'PascalCase' ],
                    filter: {
                        match: true,
                        regex: '^Variables$'
                    }
                },
                {
                    selector: 'enumMember',
                    format: ['UPPER_CASE']
                },
                {
                    selector: 'variable',
                    modifiers: [ 'const' ],
                    format: [ 'snake_case', 'UPPER_CASE' ]
                },
                {
                    selector: ['typeLike'],
                    format: ['PascalCase']
                },
                {
                    selector: 'import',
                    format: [ 'PascalCase', 'snake_case' ]
                },
                {
                    selector: 'typeParameter',
                    format: ['PascalCase'],
                    suffix: ['Type']
                },
                {
                    selector: ['objectLiteralMethod', 'objectLiteralProperty'],
                    format: null
                }
            ] satisfies [string, ...NamingConventionOption[]]
        }
    },

    // Global language options
    {
        languageOptions: {
            globals: { ...globals.browser, ...globals.node }
        }
    },

    // Svelte-specific config
    ...svelte.configs.recommended,
    {
        files: [ '**/*.svelte', '**/*.svelte.js', '**/*.svelte.ts' ],
        languageOptions: {
            parserOptions: {
                svelteConfig,
                parser: tseslint.parser
            }
        },
        rules: {
            'svelte/no-at-html-tags': 'warn'
        }
    },

    // Svelte rune modules (.svelte.ts) — declare rune globals
    {
        files: ['**/*.svelte.ts'],
        languageOptions: {
            globals: {
                $state: 'readonly',
                $derived: 'readonly',
                $effect: 'readonly',
                $props: 'readonly',
                $bindable: 'readonly',
                $inspect: 'readonly',
                $host: 'readonly'
            }
        }
    }
] satisfies Linter.Config[];

