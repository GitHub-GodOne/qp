import { _decorator } from "cc";
import { gui } from "db://oops-framework/core/gui/Gui";
import { LayerType } from "db://oops-framework/core/gui/layer/LayerEnum";
import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCView } from "db://oops-framework/module/common/CCView";
import { Shopping } from "../Shopping";
import { smc } from "../../common/SingletonModuleComp";
import { HallViewComp } from "../../hall/view/HallViewComp";
import { oops } from "db://oops-framework/core/Oops";
import { UIID } from "../../common/config/GameUIConfig";

const { ccclass, property } = _decorator;

/** 视图层对象 */
@ccclass('ShoppingViewComp')
@ecs.register('ShoppingView', false)
@gui.register('ShoppingView', { layer: LayerType.UI, prefab: "gui/shopping/shopping" })
export class ShoppingViewComp extends CCView<Shopping> {
    start() {

    }

    reset() {
        this.node.destroy();
    }
    protected return_click() {
        oops.gui.remove(UIID.ShoppingViewComp);
    }
}