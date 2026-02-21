/**
 * Nickname Service
 * Handles user identity: nickname storage, retrieval, and validation
 */

export const DEFAULT_NICK_NAME = '申冤人';

const STORAGE_KEY_USER_ID = 'userId';
const STORAGE_KEY_NICK_NAME = 'userNickName';
const MAX_NICK_LENGTH = 12;

class NicknameService {
    /**
     * Get user nickname: globalData → Storage → default '申冤人'
     */
    getNickName(): string {
        const app = getApp<IAppOption>();
        if (app.globalData.userInfo.nickName) {
            return app.globalData.userInfo.nickName;
        }
        const stored: string = wx.getStorageSync(STORAGE_KEY_NICK_NAME) || '';
        if (stored) {
            app.globalData.userInfo.nickName = stored;
            return stored;
        }
        return DEFAULT_NICK_NAME;
    }

    /**
     * Save nickname to both globalData and Storage
     */
    saveNickName(name: string): void {
        const trimmed = name.trim();
        const app = getApp<IAppOption>();
        app.globalData.userInfo.nickName = trimmed;
        wx.setStorageSync(STORAGE_KEY_NICK_NAME, trimmed);
    }

    /**
     * Get user ID: globalData → Storage → generate new UUID
     */
    getUserId(): string {
        const app = getApp<IAppOption>();
        if (app.globalData.userInfo.userId) {
            return app.globalData.userInfo.userId;
        }
        const stored: string = wx.getStorageSync(STORAGE_KEY_USER_ID) || '';
        if (stored) {
            app.globalData.userInfo.userId = stored;
            return stored;
        }
        const newId = this.generateUserId();
        app.globalData.userInfo.userId = newId;
        wx.setStorageSync(STORAGE_KEY_USER_ID, newId);
        return newId;
    }

    /**
     * Validate nickname: non-empty, non-whitespace, length ≤ 12
     */
    validate(name: string): boolean {
        const trimmed = name.trim();
        return trimmed.length > 0 && trimmed.length <= MAX_NICK_LENGTH;
    }

    /**
     * Generate a UUID-like user ID
     */
    private generateUserId(): string {
        return Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
}

export const nicknameService = new NicknameService();
