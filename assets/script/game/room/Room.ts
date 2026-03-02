import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { RoomModelComp } from "./model/RoomModelComp";

/** 房间模块 */
@ecs.register('Room')
export class Room extends CCEntity {
    RoomModel!: RoomModelComp;
    protected init() {
        this.addComponents<ecs.Comp>(RoomModelComp);
    }
}
