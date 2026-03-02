import { ecs } from "db://oops-framework/libs/ecs/ECS";

@ecs.register('LoginModel')
export class LoginModelComp extends ecs.Comp {

    /** 账号名 */
    AccountName: string = null!;
    /** JWT token */
    token: string = "";
    /** 用户 PID */
    pid: string = "";
    /** 用户昵称 */
    name: string = "";
    /** 是否已验证邮箱 */
    isVerified: boolean = false;

    reset(): void {
        this.AccountName = null!;
        this.token = "";
        this.pid = "";
        this.name = "";
        this.isVerified = false;
    }
}
