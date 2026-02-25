
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { HallModelComp } from "./model/HallModelComp";


/** 大厅模块 */
@ecs.register('Hall')
export class Hall extends CCEntity {
    HallModel!: HallModelComp;
    protected init() {
        this.addComponents<ecs.Comp>(HallModelComp);
    }
}

