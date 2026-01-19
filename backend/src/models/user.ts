/**
 * User Domain Model
 * Represents a session-level user identity
 * 
 * CRITICAL: User does NOT represent a database account
 * CRITICAL: User lifecycle exists only for the current session
 */

export interface IUser {
    userId: string;
    nickname: string;
}
