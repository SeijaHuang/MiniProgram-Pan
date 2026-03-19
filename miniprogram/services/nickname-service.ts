/**
 * Nickname Service
 * Handles nickname storage, retrieval, and validation
 */

export const DEFAULT_NICK_NAME = '申冤人';

const STORAGE_KEY_NICK_NAME = 'userNickName';
const MAX_NICK_LENGTH = 12;

class NicknameService {
    /**
     * Get user nickname: Storage → default '申冤人'
     */
    getNickName(): string {
        const stored: string = wx.getStorageSync(STORAGE_KEY_NICK_NAME) || '';
        return stored || DEFAULT_NICK_NAME;
    }

    /**
     * Save nickname to Storage
     */
    saveNickName(name: string): void {
        wx.setStorageSync(STORAGE_KEY_NICK_NAME, name.trim());
    }

    /**
     * Validate nickname: non-empty, non-whitespace, length ≤ 12
     */
    validate(name: string): boolean {
        const trimmed = name.trim();
        return trimmed.length > 0 && trimmed.length <= MAX_NICK_LENGTH;
    }
}

export const nicknameService = new NicknameService();
