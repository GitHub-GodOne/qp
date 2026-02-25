
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { LoginModelComp } from "./model/LoginModelComp";


/** 登录模块 */
@ecs.register('Login')
export class Login extends CCEntity {
    LoginModel!: LoginModelComp;
    protected init() {
        this.addComponents<ecs.Comp>(LoginModelComp);
    }
}

