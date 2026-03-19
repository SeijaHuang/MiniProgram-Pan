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
  }
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback,
}