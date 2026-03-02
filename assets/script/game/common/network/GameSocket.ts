import { NetConfig } from "./NetConfig";
import { HttpClient } from "./HttpClient";

type MsgHandler = (data: any) => void;

/** 轻量 WebSocket 客户端，JSON 消息收发 + 事件回调 */
export class GameSocket {
    private static _ws: WebSocket | null = null;
    private static _handlers: Map<string, MsgHandler[]> = new Map();
    private static _roomId: string = "";

    static get connected(): boolean {
        return this._ws !== null && this._ws.readyState === WebSocket.OPEN;
    }

    static get roomId(): string {
        return this._roomId;
    }

    /** 连接到指定房间 */
    static connect(roomId: string): void {
        this.close();
        this._roomId = roomId;
        const token = HttpClient.token;
        const url = `${NetConfig.WS_BASE}${NetConfig.API.WS}?token=${token}&room_id=${roomId}`;
        this._ws = new WebSocket(url);

        this._ws.onopen = () => {
            console.log("[GameSocket] connected to room:", roomId);
        };

        this._ws.onmessage = (ev: MessageEvent) => {
            try {
                const msg = JSON.parse(ev.data);
                const msgType = msg.type as string;
                const handlers = this._handlers.get(msgType);
                if (handlers) {
                    for (const h of handlers) {
                        h(msg.data || msg);
                    }
                }
            } catch (e) {
                console.warn("[GameSocket] parse error:", e);
            }
        };

        this._ws.onclose = () => {
            console.log("[GameSocket] disconnected");
            this._ws = null;
        };

        this._ws.onerror = (ev) => {
            console.error("[GameSocket] error:", ev);
        };
    }

    /** 注册消息处理器 */
    static on(msgType: string, handler: MsgHandler): void {
        if (!this._handlers.has(msgType)) {
            this._handlers.set(msgType, []);
        }
        this._handlers.get(msgType)!.push(handler);
    }

    /** 移除消息处理器 */
    static off(msgType: string, handler?: MsgHandler): void {
        if (!handler) {
            this._handlers.delete(msgType);
        } else {
            const arr = this._handlers.get(msgType);
            if (arr) {
                const idx = arr.indexOf(handler);
                if (idx >= 0) arr.splice(idx, 1);
            }
        }
    }

    /** 发送消息到服务器 */
    static send(msgType: string, data?: any): void {
        if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
            console.warn("[GameSocket] not connected");
            return;
        }
        const msg = { type: msgType, ...data };
        this._ws.send(JSON.stringify(msg));
    }

    /** 关闭连接 */
    static close(): void {
        if (this._ws) {
            this._ws.close();
            this._ws = null;
        }
        this._roomId = "";
    }

    /** 清除所有处理器 */
    static clearHandlers(): void {
        this._handlers.clear();
    }
}
