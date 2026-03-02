import { ecs } from "db://oops-framework/libs/ecs/ECS";

export interface PlayerInfo {
    user_pid: string;
    name: string;
    seat: number;
    is_ready: boolean;
}

export interface CardInfo {
    suit: string;
    rank: number;
}

export interface PlayerResult {
    user_pid: string;
    name: string;
    seat: number;
    hand: CardInfo[];
    bull_type: string;
}

@ecs.register('RoomModel')
export class RoomModelComp extends ecs.Comp {

    /** 房间 ID */
    roomId: string = "";
    /** 房主 PID */
    ownerPid: string = "";
    /** 房间状态 */
    status: string = "Waiting";
    /** 玩家列表 */
    players: PlayerInfo[] = [];
    /** 自己的手牌 */
    myHand: CardInfo[] = [];
    /** 游戏结果 */
    results: PlayerResult[] = [];

    reset(): void {
        this.roomId = "";
        this.ownerPid = "";
        this.status = "Waiting";
        this.players = [];
        this.myHand = [];
        this.results = [];
    }
}
