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
    },
    onLaunch() {
        // 展示本地存储能力
        const logs = wx.getStorageSync('logs') || [];
        logs.unshift(Date.now());
        wx.setStorageSync('logs', logs);

        // 登录
        wx.login({
            success: res => {
                logger.log('App', res.code);
                // 发送 res.code 到后台换取 openId, sessionKey, unionId
            },
        });
    },
});
