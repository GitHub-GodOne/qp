import {
  _decorator,
  Node,
  Button,
  EventHandler,
  Label,
  UITransform,
  Size,
  Color,
  Vec3,
  Sprite,
  HorizontalTextAlignment,
  builtinResMgr,
  SpriteFrame,
  Texture2D,
} from "cc";
import { gui } from "db://oops-framework/core/gui/Gui";
import { LayerType } from "db://oops-framework/core/gui/layer/LayerEnum";
import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCView } from "db://oops-framework/module/common/CCView";
import { CreateRoom } from "../CreateRoom";
import { oops } from "db://oops-framework/core/Oops";
import { UIID } from "../../common/config/GameUIConfig";
import { HttpClient } from "../../common/network/HttpClient";
import { NetConfig } from "../../common/network/NetConfig";
import { GameSocket } from "../../common/network/GameSocket";
import { RoomInfo } from "../../hall/model/HallModelComp";
import { UserInfoHelper } from "../../common/UserInfoHelper";
import { GameEvent } from "../../common/config/GameEvent";

const { ccclass, property } = _decorator;

/** 创建房间配置页 */
@ccclass("CreateRoomViewComp")
@ecs.register("CreateRoomView", false)
@gui.register("CreateRoomView", {
  layer: LayerType.UI,
  prefab: "gui/create_room/create_room",
})
export class CreateRoomViewComp extends CCView<CreateRoom> {
  start() {
    UserInfoHelper.updateUserInfo(this.node);
    this.createConfirmButton();
    oops.message.on(GameEvent.UserInfoChanged, this.onUserInfoChanged, this);
  }

  reset() {
    oops.message.off(GameEvent.UserInfoChanged, this.onUserInfoChanged, this);
    this.node.destroy();
  }

  private onUserInfoChanged(_event: string) {
    UserInfoHelper.updateUserInfo(this.node);
  }

  private createConfirmButton() {
    let sf = builtinResMgr.get<SpriteFrame>("ui-sprite-white");
    if (!sf) {
      sf = new SpriteFrame();
      const tex = new Texture2D();
      tex.reset({
        width: 2,
        height: 2,
        format: Texture2D.PixelFormat.RGBA8888,
      });
      tex.uploadData(
        new Uint8Array([
          255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
          255, 255,
        ]),
      );
      sf.texture = tex;
    }

    const node = new Node("createBtn");
    node.parent = this.node;
    node.layer = this.node.layer;
    node.setPosition(new Vec3(0, -260, 0));

    const ut = node.addComponent(UITransform);
    ut.setContentSize(new Size(240, 60));

    const sp = node.addComponent(Sprite);
    sp.type = Sprite.Type.SIMPLE;
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    sp.spriteFrame = sf;
    sp.color = new Color(220, 160, 30, 255);

    const lblNode = new Node("lbl");
    lblNode.parent = node;
    lblNode.layer = node.layer;
    const lut = lblNode.addComponent(UITransform);
    lut.setContentSize(new Size(240, 60));
    const lbl = lblNode.addComponent(Label);
    lbl.string = "创建房间";
    lbl.fontSize = 28;
    lbl.lineHeight = 60;
    lbl.color = new Color(255, 255, 255);
    lbl.horizontalAlign = HorizontalTextAlignment.CENTER;

    const btn = node.addComponent(Button);
    btn.transition = Button.Transition.SCALE;
    btn.zoomScale = 0.95;
    const eh = new EventHandler();
    eh.target = this.node;
    eh.component = "CreateRoomViewComp";
    eh.handler = "onCreateClick";
    btn.clickEvents = [eh];
  }

  /** 返回大厅 */
  protected return_click() {
    oops.gui.remove(UIID.CreateRoomViewComp);
  }

  /** 创建房间 */
  protected async onCreateClick() {
    try {
      const res = await HttpClient.post<RoomInfo>(NetConfig.API.ROOMS, {
        name: "斗牛房间",
        max_players: 6,
      });
      console.log("创建房间成功:", res.room_id);

      GameSocket.connect(res.room_id);
      oops.gui.remove(UIID.CreateRoomViewComp);
      oops.gui.open(UIID.RoomViewComp);
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("房卡不足")) {
        oops.gui.toast("房卡不足，无法创建房间", false);
      } else {
        oops.gui.toast(msg || "创建房间失败", false);
      }
      console.error("创建房间失败:", e);
    }
  }
}
