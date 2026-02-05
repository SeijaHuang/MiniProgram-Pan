/**
 * STS API Types
 * 腾讯云 STS 临时凭证 API 类型定义
 * 用于 ASR 语音识别初始化
 */

/**
 * STS Credentials
 * 临时凭证
 */
export interface ISTSCredentials {
    /** 临时 Secret ID */
    TmpSecretId: string;
    /** 临时 Secret Key */
    TmpSecretKey: string;
    /** Token */
    Token: string;
}

/**
 * STS Response Data from Tencent Cloud
 * 腾讯云 STS 响应数据
 */
export interface ISTSResponseData {
    /** 临时凭证 */
    Credentials: ISTSCredentials;
    /** 过期时间（Unix 时间戳，秒） */
    ExpiredTime: number;
    /** 请求 ID */
    RequestId: string;
}

/**
 * STS API Error
 * STS API 错误
 */
export interface ISTSError {
    code: string;
    message: string;
}

/**
 * STS API Response
 * STS API 响应（包装后端响应）
 */
export interface ISTSResponse {
    /** 临时凭证 */
    Credentials?: ISTSCredentials;
    /** 过期时间（Unix 时间戳，秒） */
    ExpiredTime?: number;
    /** 请求 ID */
    RequestId?: string;
    /** 错误信息（失败时存在） */
    error?: ISTSError;
    /** 是否成功 */
    success?: boolean;
}
