
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { ShoppingModelComp } from "./model/ShoppingModelComp";


/** 登录模块 */
@ecs.register('Shopping')
export class Shopping extends CCEntity {
    ShoppingModel!: ShoppingModelComp;
    protected init() {
        this.addComponents<ecs.Comp>(ShoppingModelComp);
    }
}

