/** 网络配置常量 */
export const NetConfig = {
    /** 后端 API 基础地址 */
    API_BASE: "http://127.0.0.1:5150",
    /** WebSocket 地址 */
    WS_BASE: "ws://127.0.0.1:5150",
    /** API 路径 */
    API: {
        LOGIN: "/api/auth/login",
        REGISTER: "/api/auth/register",
        CURRENT_USER: "/api/auth/current",
        PROFILE: "/api/auth/profile",
        ROOMS: "/api/rooms",
        QUICK_JOIN: "/api/rooms/quick-join",
        WS: "/api/ws",
        GAME_RECORDS: "/api/game-records",
    },
};
