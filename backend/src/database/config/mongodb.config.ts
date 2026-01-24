/**
 * MongoDB Configuration
 * MongoDB-specific configuration and connection
 *
 * ARCHITECTURE: Infrastructure Layer
 * - MongoDB connection setup
 * - Connection pooling
 * - Error handling
 *
 * FUTURE: Activate when MongoDB is chosen as the database
 */

/**
 * MongoDB configuration
 */
export interface IMongoDBConfig {
    uri: string;
    options?: {
        useNewUrlParser?: boolean;
        useUnifiedTopology?: boolean;
        maxPoolSize?: number;
        minPoolSize?: number;
    };
}

/**
 * Get MongoDB configuration from environment
 */
export function getMongoDBConfig(): IMongoDBConfig {
    return {
        uri:
            process.env.MONGODB_URI ||
            'mongodb://localhost:27017/miniprogram-pan',
        options: {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 10,
            minPoolSize: 2,
        },
    };
}

/**
 * Connect to MongoDB
 *
 * Example usage:
 * ```typescript
 * import mongoose from 'mongoose';
 * import { connectMongoDB } from './config/mongodb.config';
 *
 * await connectMongoDB();
 * ```
 */
export function connectMongoDB(): Promise<void> {
    // TODO: Implement MongoDB connection when mongoose is installed
    // const mongoose = require('mongoose');
    // const config = getMongoDBConfig();
    // await mongoose.connect(config.uri, config.options);
    return Promise.reject(
        new Error('MongoDB not configured yet - install mongoose first')
    );
}
