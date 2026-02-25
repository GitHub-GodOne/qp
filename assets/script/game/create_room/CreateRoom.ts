
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { CreateRoomModelComp } from "./model/CreateRoomModelComp";


/** 大厅模块 */
@ecs.register('CreateRoom')
export class CreateRoom extends CCEntity {
    CreateRoomModel!: CreateRoomModelComp;
    protected init() {
        this.addComponents<ecs.Comp>(CreateRoomModelComp);
    }
}

