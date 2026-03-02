import { _decorator, Node, RichText, find, Button, EventHandler } from "cc";
import { gui } from "db://oops-framework/core/gui/Gui";
import { LayerType } from "db://oops-framework/core/gui/layer/LayerEnum";
import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCView } from "db://oops-framework/module/common/CCView";
import { Hall } from "../Hall";
import { oops } from "db://oops-framework/core/Oops";
import { UIID } from "../../common/config/GameUIConfig";
import { HttpClient } from "../../common/network/HttpClient";
import { NetConfig } from "../../common/network/NetConfig";
import { GameSocket } from "../../common/network/GameSocket";
import { RoomInfo } from "../model/HallModelComp";
import { smc } from "../../common/SingletonModuleComp";
import { GameRecordsViewComp } from "../../game_records/view/GameRecordsViewComp";
import { UserInfoHelper } from "../../common/UserInfoHelper";
import { GameEvent } from "../../common/config/GameEvent";

const { ccclass, property } = _decorator;

/** 视图层对象 */
@ccclass('HallViewComp')
@ecs.register('HallView', false)
@gui.register('HallView', { layer: LayerType.UI, prefab: "gui/hall/hall" })
export class HallViewComp extends CCView<Hall> {
    start() {
        UserInfoHelper.updateUserInfo(this.node);
        this.refreshRoomList();

        // btn_quick_play 在 prefab 中没有 Button 组件，手动绑定点击
        const btnQuickPlay = this.node.getChildByName("btn_quick_play");
        if (btnQuickPlay) {
            btnQuickPlay.on(Node.EventType.TOUCH_END, this.btn_quick_play_click, this);
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

    /** 刷新房间列表 */
    private async refreshRoomList() {
        try {
            const res = await HttpClient.get<{ rooms: RoomInfo[] }>(NetConfig.API.ROOMS);
            console.log("房间列表:", res.rooms?.length || 0, "个房间");
        } catch (e) {
            console.error("获取房间列表失败:", e);
        }
    }

    /** 创建房间并进入 */
    protected async create_room_click() {
        // 打开创建房间配置页面
        oops.gui.open(UIID.CreateRoomViewComp);
    }

    protected async leisure_ground_click() {
        oops.gui.open(UIID.LeisureGroundViewComp);
    }

    protected async shopping_click() {
        console.log('点击了商城');
        oops.gui.open(UIID.ShoppingViewComp);
    }

    /** 打开战绩弹窗（列表模式） */
    protected async game_records_click() {
        oops.gui.open(UIID.GameRecordsViewComp, { onAdded: (node: Node) => {
            if (!node.getComponent(GameRecordsViewComp)) {
                node.addComponent(GameRecordsViewComp);
            }
        }});
    }

    /** 快速游戏：匹配一个有空位的等待中房间 */
    protected async btn_quick_play_click() {
        try {
            const res = await HttpClient.post<{ room_id: string }>(NetConfig.API.QUICK_JOIN);
            GameSocket.connect(res.room_id);
            oops.gui.open(UIID.RoomViewComp);
        } catch (e: any) {
            let msg = "快速匹配失败";
            try {
                const raw = e?.message || "";
                const jsonStr = raw.substring(raw.indexOf("{"));
                const obj = JSON.parse(jsonStr);
                msg = obj.description || obj.error || msg;
            } catch { /* ignore parse error */ }
            console.warn("快速匹配失败:", e?.message || e);
            oops.gui.toast(msg, false);
        }
    }
}
