/**
 * STS Service
 * 获取腾讯云临时凭证（用于 ASR 语音识别）
 *
 * 通过后端 /tencent/credentials 接口获取临时的 SecretId、SecretKey 和 Token
 * 这些凭证有时效性，默认 7200 秒（2小时）后过期
 */

import { BACKEND_CONFIG } from '../constants/config';
import type { ISTSCredentials, ISTSResponse } from '../types/sts-api';

/** 凭证提前刷新时间（秒），在过期前 5 分钟刷新 */
const REFRESH_BUFFER_SECONDS = 300;

interface ISTSCacheData {
    credentials: ISTSCredentials;
    expiredTime: number;
}

class STSService {
    /** 缓存的凭证 */
    private cachedCredentials: ISTSCacheData | null = null;

    /** 是否正在获取凭证 */
    private isFetching: boolean = false;

    /** 等待获取凭证的 Promise 队列 */
    private pendingPromises: Array<{
        resolve: (credentials: ISTSCredentials) => void;
        reject: (error: Error) => void;
    }> = [];

    /**
     * 获取临时凭证
     * 会自动缓存凭证，在有效期内复用，过期前自动刷新
     * @returns Promise<ISTSCredentials> 临时凭证
     */
    async getCredentials(): Promise<ISTSCredentials> {
        // 检查缓存是否有效
        if (this.isCredentialsValid()) {
            console.log('[STSService] Using cached credentials');
            return this.cachedCredentials!.credentials;
        }

        // 如果正在获取，加入等待队列
        if (this.isFetching) {
            console.log('[STSService] Waiting for pending fetch');
            return new Promise<ISTSCredentials>((resolve, reject) => {
                this.pendingPromises.push({ resolve, reject });
            });
        }

        // 开始获取新凭证
        this.isFetching = true;
        console.log('[STSService] Fetching new credentials');

        try {
            const data = await this.fetchCredentials();
            this.cachedCredentials = {
                credentials: data.credentials,
                expiredTime: data.expiredTime,
            };

            // 通知所有等待的 Promise
            this.pendingPromises.forEach(({ resolve }) => {
                resolve(data.credentials);
            });
            this.pendingPromises = [];

            console.log(
                '[STSService] Credentials fetched, expires at:',
                new Date(data.expiredTime * 1000).toLocaleString()
            );

            return data.credentials;
        } catch (error) {
            // 通知所有等待的 Promise 失败
            const err =
                error instanceof Error
                    ? error
                    : new Error('Failed to fetch credentials');
            this.pendingPromises.forEach(({ reject }) => {
                reject(err);
            });
            this.pendingPromises = [];

            throw err;
        } finally {
            this.isFetching = false;
        }
    }

    /**
     * 检查缓存的凭证是否有效
     * @returns 凭证是否有效
     */
    private isCredentialsValid(): boolean {
        if (!this.cachedCredentials) {
            return false;
        }

        const now = Math.floor(Date.now() / 1000);
        const expiresAt =
            this.cachedCredentials.expiredTime - REFRESH_BUFFER_SECONDS;

        return now < expiresAt;
    }

    /**
     * 从后端获取新的临时凭证
     * @returns Promise<{ credentials, expiredTime }>
     */
    private fetchCredentials(): Promise<{
        credentials: ISTSCredentials;
        expiredTime: number;
    }> {
        return new Promise((resolve, reject) => {
            wx.request({
                url: `${BACKEND_CONFIG.HTTP_BASE_URL}/tencent/credentials`,
                method: 'GET',
                header: {
                    'content-type': 'application/json',
                },
                success: res => {
                    if (res.statusCode === 200) {
                        const response = res.data as ISTSResponse;

                        if (response.Credentials && response.ExpiredTime) {
                            resolve({
                                credentials: response.Credentials,
                                expiredTime: response.ExpiredTime,
                            });
                        } else if (response.error) {
                            reject(
                                new Error(
                                    response.error.message ??
                                        'Failed to get STS token'
                                )
                            );
                        } else {
                            reject(new Error('Invalid STS response'));
                        }
                    } else {
                        const response = res.data as ISTSResponse;
                        reject(
                            new Error(
                                response.error?.message ??
                                    `HTTP ${res.statusCode}: Failed to get STS token`
                            )
                        );
                    }
                },
                fail: error => {
                    reject(new Error(`Network error: ${error.errMsg}`));
                },
            });
        });
    }

    /**
     * 清除缓存的凭证
     * 在需要强制刷新时调用
     */
    clearCache(): void {
        this.cachedCredentials = null;
        console.log('[STSService] Cache cleared');
    }
}

// Export singleton instance
export const stsService = new STSService();
