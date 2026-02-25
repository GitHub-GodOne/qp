import { _decorator } from "cc";
import { gui } from "db://oops-framework/core/gui/Gui";
import { LayerType } from "db://oops-framework/core/gui/layer/LayerEnum";
import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCView } from "db://oops-framework/module/common/CCView";
import { CreateRoom } from "../CreateRoom";
import { oops } from "db://oops-framework/core/Oops";
import { UIID } from "../../common/config/GameUIConfig";

const { ccclass, property } = _decorator;

/** 视图层对象 */
@ccclass('CreateRoomViewComp')
@ecs.register('CreateRoomView', false)
@gui.register('CreateRoomView', { layer: LayerType.UI, prefab: "gui/create_room/create_room" })
export class CreateRoomViewComp extends CCView<CreateRoom> {
    start() {

    }

    reset() {
        this.node.destroy();
    }

    protected return_click() {
        oops.gui.remove(UIID.CreateRoomViewComp);
    }
}