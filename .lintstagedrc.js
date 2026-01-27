const path = require('path');

module.exports = {
    // Frontend files - use root ESLint config
    'miniprogram/**/*.{ts,js}': ['eslint --fix', 'prettier --write'],

    // Backend files - run eslint from backend directory to use correct tsconfig
    'backend/src/**/*.{ts,js}': filenames => {
        const backendFiles = filenames.map(f =>
            path.relative('backend', f).replace(/\\/g, '/')
        );
        return [
            `cd backend && eslint --fix ${backendFiles.map(f => `"${f}"`).join(' ')}`,
            `prettier --write ${filenames.map(f => `"${f}"`).join(' ')}`,
        ];
    },

    // Root level ts/js files (if any)
    '*.{ts,js}': ['eslint --fix', 'prettier --write'],

    // JSON and Markdown files
    '*.{json,md}': ['prettier --write'],
    'miniprogram/**/*.{json,md}': ['prettier --write'],
    'backend/**/*.{json,md}': ['prettier --write'],
};
