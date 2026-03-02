import { ecs } from "db://oops-framework/libs/ecs/ECS";

export interface GameRecordPlayer {
    user_pid: string;
    name: string;
    seat: number;
    hand: { suit: string; rank: number }[];
    bull_type: string;
    is_banker: boolean;
    bet_amount: number | null;
    coin_change: number | null;
    coins: number;
}

export interface GameRecordItem {
    id: number;
    room_id: string;
    players: GameRecordPlayer[];
    played_at: string;
}

@ecs.register('GameRecordsModel')
export class GameRecordsModelComp extends ecs.Comp {
    /** 历史战绩列表 */
    records: GameRecordItem[] = [];
    /** 总记录数 */
    total: number = 0;
    /** 当前单局详情（结算弹出时使用） */
    currentDetail: GameRecordItem | null = null;

    reset(): void {
        this.records = [];
        this.total = 0;
        this.currentDetail = null;
    }
}
