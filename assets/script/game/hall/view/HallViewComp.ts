import { _decorator } from "cc";
import { gui } from "db://oops-framework/core/gui/Gui";
import { LayerType } from "db://oops-framework/core/gui/layer/LayerEnum";
import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCView } from "db://oops-framework/module/common/CCView";
import { Hall } from "../Hall";
import { smc } from "../../common/SingletonModuleComp";
import { CreateRoomViewComp } from "../../create_room/view/CreateRoomViewComp";
import { oops } from "db://oops-framework/core/Oops";
import { UIID } from "../../common/config/GameUIConfig";

const { ccclass, property } = _decorator;

/** 视图层对象 */
@ccclass('HallViewComp')
@ecs.register('HallView', false)
@gui.register('HallView', { layer: LayerType.UI, prefab: "gui/hall/hall" })
export class HallViewComp extends CCView<Hall> {
    start() {

    }

    reset() {
        this.node.destroy();
    }

    protected async create_room_click() {
        // await smc.login.addUi(CreateRoomViewComp);
        oops.gui.open(UIID.CreateRoomViewComp);
    }
    protected async leisure_ground_click() {
        // await smc.login.addUi(CreateRoomViewComp);
        oops.gui.open(UIID.LeisureGroundViewComp);
    }
    protected async shopping_click() {
        // await smc.login.addUi(CreateRoomViewComp);
        console.log('点击了商城')
        oops.gui.open(UIID.ShoppingViewComp);
    }
}