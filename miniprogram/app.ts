// app.ts
import { logger } from './utils/logger';

App<IAppOption>({
    globalData: {
        selfUserId: '',
        selfNickname: '',
        opponentUserId: '',
        opponentNickname: '',
        roomId: '',
        roomCode: '',
        firstSpeakerUserId: '',
        hostUserId: '',
    },
    onLaunch() {
        const logs = wx.getStorageSync('logs') || [];
        logs.unshift(Date.now());
        wx.setStorageSync('logs', logs);

        wx.login({
            success: res => {
                logger.log('App', res.code);
            },
        });

        // 隐私授权拦截器（微信 2023 年 9 月新规）
        // chat-room 页面已在弹窗中取得用户明确同意后才调用 wx.requirePrivacyAuthorize，
        // 此处直接 resolve('agree') 即可完成 WeChat 侧的授权登记。
        wx.onNeedPrivacyAuthorization(resolve => {
            resolve({ event: 'agree', buttonId: 'privacy-agree' });
        });
    },
});
