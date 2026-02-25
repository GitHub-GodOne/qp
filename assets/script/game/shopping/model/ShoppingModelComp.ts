
import { ecs } from "db://oops-framework/libs/ecs/ECS";

@ecs.register('ShoppingCom')
export class ShoppingModelComp extends ecs.Comp {

    /** 账号名 */
    AccountName: string = null!;


    reset(): void {
        this.AccountName = null!;
    }

}

