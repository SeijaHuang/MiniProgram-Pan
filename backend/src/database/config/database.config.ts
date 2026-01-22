/**
 * Database Configuration
 * Centralized database configuration management
 *
 * ARCHITECTURE: Infrastructure Layer
 * - Manages database connection settings
 * - Supports multiple database types
 * - Environment-based configuration
 *
 * FUTURE: Will be activated when database is integrated
 */

/**
 * Database type enum
 */
export enum EDatabaseType {
    MongoDB = 'mongodb',
    PostgreSQL = 'postgresql',
    MySQL = 'mysql',
    InMemory = 'in-memory', // Current default
}

/**
 * Base database configuration
 */
export interface IDatabaseConfig {
    type: EDatabaseType;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    uri?: string; // Full connection URI
    options?: Record<string, unknown>;
}

/**
 * Get database configuration from environment
 * FUTURE: This will be used when database is integrated
 */
export function getDatabaseConfig(): IDatabaseConfig {
    const dbType =
        (process.env.DATABASE_TYPE as EDatabaseType) || EDatabaseType.InMemory;

    switch (dbType) {
        case EDatabaseType.MongoDB:
            return {
                type: EDatabaseType.MongoDB,
                uri:
                    process.env.MONGODB_URI ||
                    'mongodb://localhost:27017/miniprogram-pan',
                options: {
                    useNewUrlParser: true,
                    useUnifiedTopology: true,
                },
            };

        case EDatabaseType.PostgreSQL:
            return {
                type: EDatabaseType.PostgreSQL,
                host: process.env.POSTGRES_HOST || 'localhost',
                port: parseInt(process.env.POSTGRES_PORT || '5432'),
                database: process.env.POSTGRES_DB || 'miniprogram_pan',
                username: process.env.POSTGRES_USER || 'postgres',
                password: process.env.POSTGRES_PASSWORD || '',
            };

        case EDatabaseType.InMemory:
        default:
            return {
                type: EDatabaseType.InMemory,
            };
    }
}
