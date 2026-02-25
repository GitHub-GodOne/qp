
import { ecs } from "db://oops-framework/libs/ecs/ECS";

@ecs.register('LoginCom')
export class LoginModelComp extends ecs.Comp {

    /** 账号名 */
    AccountName: string = null!;


    reset(): void {
        this.AccountName = null!;
    }

}

