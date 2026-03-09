import { NetConfig } from "./NetConfig";
import { HttpClient } from "./HttpClient";
import { oops } from "db://oops-framework/core/Oops";

type MsgHandler = (data: any) => void;

/** 轻量 WebSocket 客户端，JSON 消息收发 + 事件回调 */
export class GameSocket {
    private static _ws: WebSocket | null = null;
    private static _handlers: Map<string, MsgHandler[]> = new Map();
    private static _roomId: string = "";
    private static _reconnectTimer: any = null;
    private static _isManualClose: boolean = false;
    private static _visibilityHandler: (() => void) | null = null;
    private static _reconnectAttempts: number = 0;
    private static _maxReconnectAttempts: number = 10;
    private static _heartbeatTimer: any = null;
    private static _heartbeatInterval: number = 30000; // 30秒心跳

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
        this._isManualClose = false;
        this._reconnectAttempts = 0;
        this._connect();
        this._setupVisibilityHandler();
    }

    private static _connect(): void {
        const token = HttpClient.token;
        const url = `${NetConfig.WS_BASE}${NetConfig.API.WS}?token=${token}&room_id=${this._roomId}`;

        console.log(`[GameSocket] connecting to room: ${this._roomId} (attempt ${this._reconnectAttempts + 1})`);

        this._ws = new WebSocket(url);

        this._ws.onopen = () => {
            console.log("[GameSocket] connected to room:", this._roomId);
            this._reconnectAttempts = 0;

            // 清除重连定时器
            if (this._reconnectTimer) {
                clearTimeout(this._reconnectTimer);
                this._reconnectTimer = null;
            }

            // 连接成功后立即请求房间状态
            setTimeout(() => {
                this.send("get_room_state");
                console.log("[GameSocket] requested room state after reconnection");
            }, 100);

            // 启动心跳
            this._startHeartbeat();

            // 显示重连成功提示
            if (this._reconnectAttempts > 0) {
                oops.gui.toast("重新连接成功", true);
            }
        };

        this._ws.onmessage = (ev: MessageEvent) => {
            console.log("[GameSocket] received message:", ev.data);
            try {
                const msg = JSON.parse(ev.data);
                console.log("[GameSocket] parsed message:", msg);
                const msgType = msg.type as string;
                const handlers = this._handlers.get(msgType);
                console.log(`[GameSocket] handlers for ${msgType}:`, handlers?.length || 0);
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
            this._stopHeartbeat();

            // 如果不是手动关闭，尝试重连
            if (!this._isManualClose && this._roomId) {
                if (this._reconnectAttempts < this._maxReconnectAttempts) {
                    this._reconnectAttempts++;
                    const delay = Math.min(2000 * this._reconnectAttempts, 10000); // 最多延迟10秒
                    console.log(`[GameSocket] attempting to reconnect in ${delay}ms... (attempt ${this._reconnectAttempts}/${this._maxReconnectAttempts})`);

                    // 显示重连提示
                    oops.gui.toast(`连接断开，正在重连... (${this._reconnectAttempts}/${this._maxReconnectAttempts})`, false);

                    this._reconnectTimer = setTimeout(() => {
                        if (!this._isManualClose && this._roomId) {
                            this._connect();
                        }
                    }, delay);
                } else {
                    console.error("[GameSocket] max reconnect attempts reached");
                    oops.gui.toast("连接失败，请刷新页面重试", false);
                }
            }
        };

        this._ws.onerror = (ev) => {
            console.error("[GameSocket] error:", ev);
        };
    }

    /** 启动心跳 */
    private static _startHeartbeat(): void {
        this._stopHeartbeat();
        this._heartbeatTimer = setInterval(() => {
            if (this.connected) {
                // 发送心跳消息（如果服务器支持）
                // this.send("ping");
                console.log("[GameSocket] heartbeat check - connected");
            } else {
                console.warn("[GameSocket] heartbeat check - disconnected, attempting reconnect");
                this._stopHeartbeat();
                if (!this._isManualClose && this._roomId) {
                    this._connect();
                }
            }
        }, this._heartbeatInterval);
    }

    /** 停止心跳 */
    private static _stopHeartbeat(): void {
        if (this._heartbeatTimer) {
            clearInterval(this._heartbeatTimer);
            this._heartbeatTimer = null;
        }
    }

    /** 设置页面可见性监听 */
    private static _setupVisibilityHandler(): void {
        if (this._visibilityHandler) {
            document.removeEventListener('visibilitychange', this._visibilityHandler);
        }

        this._visibilityHandler = () => {
            if (document.visibilityState === 'visible') {
                // 页面重新可见时，检查连接状态
                console.log("[GameSocket] page visible, checking connection...");
                if (!this.connected && this._roomId && !this._isManualClose) {
                    console.log("[GameSocket] reconnecting after page visible...");
                    this._reconnectAttempts = 0; // 重置重连次数
                    this._connect();
                }
            }
        };

        document.addEventListener('visibilitychange', this._visibilityHandler);
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
            console.warn("[GameSocket] not connected, cannot send message:", msgType);
            return;
        }
        const msg = { type: msgType, ...data };
        this._ws.send(JSON.stringify(msg));
    }

    /** 关闭连接 */
    static close(): void {
        this._isManualClose = true;
        this._reconnectAttempts = 0;

        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }

        this._stopHeartbeat();

        if (this._visibilityHandler) {
            document.removeEventListener('visibilitychange', this._visibilityHandler);
            this._visibilityHandler = null;
        }

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
