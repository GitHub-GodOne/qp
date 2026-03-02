import { ecs } from "db://oops-framework/libs/ecs/ECS";

export interface RoomInfo {
    room_id: string;
    owner_pid: string;
    name: string;
    max_players: number;
    status: string;
}

@ecs.register('HallCom')
export class HallModelComp extends ecs.Comp {

    /** 房间列表 */
    rooms: RoomInfo[] = [];

    reset(): void {
        this.rooms = [];
    }
}
