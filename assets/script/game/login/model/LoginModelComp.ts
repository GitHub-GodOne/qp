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
    /** 用户金币 */
    gold: number = 0;
    /** 用户钻石 */
    diamonds: number = 0;
    /** 用户房卡 */
    cards: number = 0;

    reset(): void {
        this.AccountName = null!;
        this.token = "";
        this.pid = "";
        this.name = "";
        this.isVerified = false;
        this.gold = 0;
        this.diamonds = 0;
        this.cards = 0;
    }
}
