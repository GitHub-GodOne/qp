import { _decorator } from "cc";
import { gui } from "db://oops-framework/core/gui/Gui";
import { LayerType } from "db://oops-framework/core/gui/layer/LayerEnum";
import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCView } from "db://oops-framework/module/common/CCView";
import { LeisureGround } from "../LeisureGround";
import { oops } from "db://oops-framework/core/Oops";
import { UIID } from "../../common/config/GameUIConfig";

const { ccclass, property } = _decorator;

/** 视图层对象 */
@ccclass('LeisureGroundViewComp')
@ecs.register('LeisureGroundView', false)
@gui.register('LeisureGroundView', { layer: LayerType.UI, prefab: "gui/leisure_ground/leisure_ground" })
export class LeisureGroundViewComp extends CCView<LeisureGround> {
    start() {

    }

    reset() {
        this.node.destroy();
    }

    protected return_click() {
        oops.gui.remove(UIID.LeisureGroundViewComp);
    }
}