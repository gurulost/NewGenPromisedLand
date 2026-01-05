import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        plugins: {
            'react-hooks': reactHooks,
            '@typescript-eslint': tseslint,
        },
        rules: {
            // Enforce Rules of Hooks - prevents React Error #310
            'react-hooks/rules-of-hooks': 'error',
            // Warn about missing dependencies in useEffect/useMemo/useCallback
            'react-hooks/exhaustive-deps': 'warn',
        },
    },
];
