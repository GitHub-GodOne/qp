
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { LeisureGroundModelComp } from "./model/LeisureGroundModelComp";


/** 大厅模块 */
@ecs.register('LeisureGround')
export class LeisureGround extends CCEntity {
    LeisureGroundModel!: LeisureGroundModelComp;
    protected init() {
        this.addComponents<ecs.Comp>(LeisureGroundModelComp);
    }
}

