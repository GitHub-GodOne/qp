import { _decorator, Node } from "cc";
import { gui } from "db://oops-framework/core/gui/Gui";
import { LayerType } from "db://oops-framework/core/gui/layer/LayerEnum";
import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCView } from "db://oops-framework/module/common/CCView";
import { LeisureGround } from "../LeisureGround";
import { oops } from "db://oops-framework/core/Oops";
import { UIID } from "../../common/config/GameUIConfig";
import { HttpClient } from "../../common/network/HttpClient";
import { NetConfig } from "../../common/network/NetConfig";
import { GameSocket } from "../../common/network/GameSocket";
import { UserInfoHelper } from "../../common/UserInfoHelper";
import { GameEvent } from "../../common/config/GameEvent";

const { ccclass, property } = _decorator;

/** 视图层对象 */
@ccclass('LeisureGroundViewComp')
@ecs.register('LeisureGroundView', false)
@gui.register('LeisureGroundView', { layer: LayerType.UI, prefab: "gui/leisure_ground/leisure_ground" })
export class LeisureGroundViewComp extends CCView<LeisureGround> {
    start() {
        UserInfoHelper.updateUserInfo(this.node);

        // 实际按钮在 content/ksks/ksks 路径下
        const ksksNode = this.node.getChildByPath("content/ksks/ksks");
        if (ksksNode) {
            ksksNode.on(Node.EventType.TOUCH_END, this.ksks_click, this);
        }

        // 监听用户资产变更事件（从房间退出后刷新金币等）
        oops.message.on(GameEvent.UserInfoChanged, this.onUserInfoChanged, this);
    }

    reset() {
        oops.message.off(GameEvent.UserInfoChanged, this.onUserInfoChanged, this);
        this.node.destroy();
    }

    private onUserInfoChanged(_event: string) {
        UserInfoHelper.updateUserInfo(this.node);
    }

    protected return_click() {
        oops.gui.remove(UIID.LeisureGroundViewComp);
    }

    /** 快速开始：匹配一个有空位的等待中房间 */
    protected async ksks_click() {
        try {
            const res = await HttpClient.post<{ room_id: string }>(NetConfig.API.QUICK_JOIN);
            GameSocket.connect(res.room_id);
            oops.gui.open(UIID.RoomViewComp);
        } catch (e: any) {
            console.warn("快速匹配失败:", e?.message || e);
            oops.gui.toast(e?.message || "快速匹配失败", false);
        }
    }

}