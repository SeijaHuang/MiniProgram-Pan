import type { Request, Response } from 'express';
import type { IBaseResponse } from '../types/http';
import { EHttpErrorCode } from '../types/http';
import { sts } from 'tencentcloud-sdk-nodejs-sts';
import {
    GetFederationTokenRequest,
    GetFederationTokenResponse,
} from 'tencentcloud-sdk-nodejs-sts/tencentcloud/services/sts/v20180813/sts_models';
import { TENCENT_CONFIG } from '../constants/config';
import { logger } from '../utils/logger';

const StsClient = sts.v20180813.Client;

const stsClient = new StsClient({
    credential: {
        secretId: TENCENT_CONFIG.SECRET_ID,
        secretKey: TENCENT_CONFIG.SECRET_KEY,
    },
    region: TENCENT_CONFIG.REGION,
});

const policy = {
    version: '2.0',
    statement: [{ effect: 'allow', action: ['name/asr:*'], resource: '*' }],
};

// Token duration: 24 hours in seconds
const TOKEN_DURATION_SECONDS = 24 * 60 * 60;
// Refresh threshold: 1 minute in seconds
const REFRESH_THRESHOLD_SECONDS = 60;

// Cached token storage
let cachedToken: GetFederationTokenResponse | null = null;

export class TencentController {
    static async getSTSToken(_req: Request, res: Response): Promise<void> {
        try {
            const response = await this._getSTSTokenWithCache();
            res.status(200).json(response);
            logger.info('tencent.credentials.ok', {});
            return;
        } catch (error: unknown) {
            logger.error('TencentController', 'Get STS token failed:', error);
            logger.error('tencent.credentials.failed', {
                error: error instanceof Error ? error.message : String(error),
            });
            const response: IBaseResponse<never> = {
                success: false,
                error: {
                    code: EHttpErrorCode.STSGetFailed,
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                },
            };
            res.status(500).json(response);
            return;
        }
    }

    private static async _getSTSTokenWithCache(): Promise<GetFederationTokenResponse> {
        // Check if cached token exists and is still valid
        if (cachedToken && this._isTokenValid(cachedToken)) {
            logger.log('TencentController', 'Using cached STS token');
            return cachedToken;
        }

        // Fetch new token
        logger.log('TencentController', 'Fetching new STS token');
        const newToken = await this._fetchSTSToken();
        cachedToken = newToken;
        return newToken;
    }

    private static _isTokenValid(token: GetFederationTokenResponse): boolean {
        if (!token.ExpiredTime) {
            return false;
        }

        const currentTimeSeconds = Math.floor(Date.now() / 1000);
        const remainingSeconds = token.ExpiredTime - currentTimeSeconds;

        // Token is valid if remaining time > refresh threshold (1 minute)
        return remainingSeconds > REFRESH_THRESHOLD_SECONDS;
    }

    private static _fetchSTSToken(): Promise<GetFederationTokenResponse> {
        const getFederationTokenRequest: GetFederationTokenRequest = {
            Name: 'pan-asr',
            Policy: JSON.stringify(policy),
            DurationSeconds: TOKEN_DURATION_SECONDS,
        };
        return stsClient.GetFederationToken(getFederationTokenRequest);
    }
}
