/// <reference path="./types/index.d.ts" />

interface IAppOption {
  globalData: {
    selfUserId: string;
    selfNickname: string;
    opponentUserId: string;
    opponentNickname: string;
    roomId: string;
    roomCode: string;
    firstSpeakerUserId: string;
    hostUserId: string;
  }
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback,
}

// 微信隐私保护 API（基础库 2.32.3+，miniprogram-api-typings@2.8.3 暂未收录）
declare namespace WechatMiniprogram {
    interface IPrivacyResolveOption {
        event: 'agree' | 'disagree';
        buttonId?: string;
    }
    interface IGetPrivacySettingSuccessResult {
        needAuthorization: boolean;
        privacyContractName: string;
    }
    interface Wx {
        onNeedPrivacyAuthorization(
            callback: (
                resolve: (opts: IPrivacyResolveOption) => void,
                eventInfo: { privacyContractName: string },
            ) => void,
        ): void;
        getPrivacySetting(opts: {
            success?: (res: IGetPrivacySettingSuccessResult) => void;
            fail?: (err: GeneralCallbackResult) => void;
            complete?: (res: GeneralCallbackResult) => void;
        }): void;
        requirePrivacyAuthorize(opts?: {
            success?: () => void;
            fail?: (err: GeneralCallbackResult) => void;
            complete?: (res: GeneralCallbackResult) => void;
        }): void;
    }
}