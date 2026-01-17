// pages/drum/index.ts

interface IDrumPageData {
    placeholder: string;
}

Page<IDrumPageData, WechatMiniprogram.Page.CustomOption>({
    data: {
        placeholder: '击鼓抢麦（占位页）',
    },

    onLoad(): void {
        // 页面加载时执行
    },

    onShow(): void {
        // 页面显示时执行
    },
});
