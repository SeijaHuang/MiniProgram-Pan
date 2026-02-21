/// <reference path="./types/index.d.ts" />

interface IAppOption {
  globalData: {
    userInfo: {
      userId: string;
      nickName: string;
    };
    participants?: {
      hostNickName: string;
      guestNickName: string;
    };
  }
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback,
}