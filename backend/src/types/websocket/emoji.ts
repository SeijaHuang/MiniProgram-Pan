import type { IWSMessage } from './base';
import { EWSMessageType } from './base';

export interface IEmojiMessage {
    roomId: string;
    senderId: string;
    emoji: string;
}

export interface IEmojiSendMessage extends IWSMessage<IEmojiMessage> {
    type: EWSMessageType.EmojiSend;
}

export interface IEmojiReceiveMessage extends IWSMessage<IEmojiMessage> {
    type: EWSMessageType.EmojiReceive;
}
