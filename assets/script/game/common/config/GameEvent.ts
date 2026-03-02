/*
 * @Author: dgflash
 * @Date: 2021-11-23 15:28:39
 * @LastEditors: dgflash
 * @LastEditTime: 2022-01-26 16:42:00
 */

/** 游戏事件 */
export enum GameEvent {
    /** 游戏服务器连接成功 */
    GameServerConnected = "GameServerConnected",
    /** 登陆成功 */
    LoginSuccess = "LoginSuccess",
    /** 加入房间 */
    RoomJoined = "RoomJoined",
    /** 离开房间 */
    RoomLeft = "RoomLeft",
    /** 游戏开始（发牌） */
    GameStarted = "GameStarted",
    /** 游戏结果 */
    GameResult = "GameResult",
    /** 用户资产变更（金币/钻石/房卡），需要刷新 userInfo */
    UserInfoChanged = "UserInfoChanged",
}
