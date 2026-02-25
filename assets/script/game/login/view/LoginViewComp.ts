import { _decorator } from "cc";
import { gui } from "db://oops-framework/core/gui/Gui";
import { LayerType } from "db://oops-framework/core/gui/layer/LayerEnum";
import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCView } from "db://oops-framework/module/common/CCView";
import { Login } from "../Login";
import { smc } from "../../common/SingletonModuleComp";
import { HallViewComp } from "../../hall/view/HallViewComp";

const { ccclass, property } = _decorator;

/** 视图层对象 */
@ccclass('LoginViewComp')
@ecs.register('LoginView', false)
@gui.register('LoginView', { layer: LayerType.UI, prefab: "gui/login/login" })
export class LoginViewComp extends CCView<Login> {
    start() {

    }

    reset() {
        this.node.destroy();
    }
    protected async wx_login_click() {
        await smc.login.addUi(HallViewComp);
        this.remove();
    }
}