const path = require('path');

module.exports = {
    // Frontend files - use root ESLint config
    'miniprogram/**/*.{ts,js}': ['eslint --fix', 'prettier --write'],

    // Backend files - run eslint from backend directory to use correct tsconfig
    'backend/src/**/*.{ts,js}': ['npm --prefix backend run lint:fix'],

    // Root level ts/js files (if any)
    '*.{ts,js}': ['eslint --fix', 'prettier --write'],

    // JSON and Markdown files
    '*.{json,md}': ['prettier --write'],
    'miniprogram/**/*.{json,md}': ['prettier --write'],
    'backend/**/*.{json,md}': ['prettier --write'],
};
