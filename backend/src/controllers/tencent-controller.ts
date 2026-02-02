import type { Request, Response } from 'express';
import type { IBaseResponse } from '../types/http';
import { EHttpErrorCode } from '../types/http';
import { sts } from 'tencentcloud-sdk-nodejs-sts';
import {
    GetFederationTokenRequest,
    GetFederationTokenResponse,
} from 'tencentcloud-sdk-nodejs-sts/tencentcloud/services/sts/v20180813/sts_models';
import { TENCENT_CONFIG } from '../constants/config';

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

export class TencentController {
    static async getSTSToken(req: Request, res: Response): Promise<void> {
        try {
            const response = await this._getSTSToken();
            res.status(200).json(response);
            return;
        } catch (error: unknown) {
            console.error('[TencentController] Get STS token failed:', error);
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

    private static _getSTSToken(): Promise<GetFederationTokenResponse> {
        const getFederationTokenRequest: GetFederationTokenRequest = {
            Name: 'pan-asr',
            Policy: JSON.stringify(policy),
        };
        return stsClient.GetFederationToken(getFederationTokenRequest);
    }
}
