import {
  _decorator,
  Node,
  RichText,
  find,
  Button,
  EventHandler,
  BlockInputEvents,
  UITransform,
  Size,
  Widget,
  Sprite,
  Label,
  Color,
  Vec3,
  HorizontalTextAlignment,
  VerticalTextAlignment,
  builtinResMgr,
  SpriteFrame,
  Texture2D,
  director,
  game,
  EditBox,
  AudioClip,
  AudioSource,
  resources,
} from "cc";
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
import { audioManager } from "../../common/AudioManager";

const { ccclass, property } = _decorator;

/** 视图层对象 */
@ccclass("HallViewComp")
@ecs.register("HallView", false)
@gui.register("HallView", { layer: LayerType.UI, prefab: "gui/hall/hall" })
export class HallViewComp extends CCView<Hall> {
  start() {
    // 添加阻挡层防止点击穿透
    this.addBlockInputLayer();

    UserInfoHelper.updateUserInfo(this.node);
    this.refreshRoomList();

    // btn_quick_play 在 prefab 中没有 Button 组件，手动绑定点击
    const btnQuickPlay = this.node.getChildByPath("bottom/btn_quick_play");
    if (btnQuickPlay) {
      btnQuickPlay.on(
        Node.EventType.TOUCH_END,
        this.btn_quick_play_click,
        this,
      );
    } else {
      console.warn("未找到 btn_quick_play 节点");
    }

    // 动态创建退出登录按钮
    this.createLogoutButton();

    // 动态创建战绩按钮
    // this.createGameRecordsButton();

    // 动态创建"密码加入"按钮（点击后弹出对话框）
    // this.createPasswordJoinButton();

    // 监听用户资产变更事件（从房间退出后刷新金币等）
    oops.message.on(GameEvent.UserInfoChanged, this.onUserInfoChanged, this);

    // 播放大厅背景音乐
    audioManager.playBGM("Sound/SoundCommon/大厅背景声音");
  }

  reset() {
    oops.message.off(GameEvent.UserInfoChanged, this.onUserInfoChanged, this);
    this.node.destroy();
  }

  /** 添加阻挡层防止点击穿透到下层 */
  private addBlockInputLayer() {
    // 创建一个全屏的阻挡层作为最底层
    const blockLayer = new Node("blockInputLayer");
    blockLayer.layer = this.node.layer;

    // 添加 UITransform 组件
    const transform = blockLayer.addComponent(UITransform);
    transform.setContentSize(new Size(960, 640));

    // 添加 Widget 组件使其全屏
    const widget = blockLayer.addComponent(Widget);
    widget.isAlignTop =
      widget.isAlignBottom =
      widget.isAlignLeft =
      widget.isAlignRight =
        true;
    widget.top = widget.bottom = widget.left = widget.right = 0;

    // 添加 BlockInputEvents 组件阻止点击穿透
    blockLayer.addComponent(BlockInputEvents);

    // 将阻挡层添加为第一个子节点（最底层）
    blockLayer.parent = this.node;
    blockLayer.setSiblingIndex(0);
  }

  /** 动态创建退出登录按钮 */
  private createLogoutButton() {
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

    const logoutBtn = new Node("logoutBtn");
    logoutBtn.parent = this.node;
    logoutBtn.layer = this.node.layer;
    logoutBtn.setPosition(new Vec3(400, 280, 0)); // 右上角位置

    const ut = logoutBtn.addComponent(UITransform);
    ut.setContentSize(new Size(100, 40));

    const sp = logoutBtn.addComponent(Sprite);
    sp.type = Sprite.Type.SIMPLE;
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    sp.spriteFrame = sf;
    sp.color = new Color(200, 50, 50, 255); // 红色背景

    const lblNode = new Node("lbl");
    lblNode.parent = logoutBtn;
    lblNode.layer = logoutBtn.layer;
    const lut = lblNode.addComponent(UITransform);
    lut.setContentSize(new Size(100, 40));
    const lbl = lblNode.addComponent(Label);
    lbl.string = "退出登录";
    lbl.fontSize = 18;
    lbl.lineHeight = 40;
    lbl.color = new Color(255, 255, 255);
    lbl.horizontalAlign = HorizontalTextAlignment.CENTER;

    const btn = logoutBtn.addComponent(Button);
    btn.transition = Button.Transition.SCALE;
    btn.zoomScale = 0.95;
    const eh = new EventHandler();
    eh.target = this.node;
    eh.component = "HallViewComp";
    eh.handler = "logout_click";
    btn.clickEvents = [eh];
  }

  /** 动态创建战绩按钮 */
  private createGameRecordsButton() {
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

    const recordsBtn = new Node("gameRecordsBtn");
    recordsBtn.parent = this.node;
    recordsBtn.layer = this.node.layer;
    recordsBtn.setPosition(new Vec3(280, 280, 0)); // 退出登录按钮左边

    const ut = recordsBtn.addComponent(UITransform);
    ut.setContentSize(new Size(100, 40));

    const sp = recordsBtn.addComponent(Sprite);
    sp.type = Sprite.Type.SIMPLE;
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    sp.spriteFrame = sf;
    sp.color = new Color(50, 120, 200, 255); // 蓝色背景

    const lblNode = new Node("lbl");
    lblNode.parent = recordsBtn;
    lblNode.layer = recordsBtn.layer;
    const lut = lblNode.addComponent(UITransform);
    lut.setContentSize(new Size(100, 40));
    const lbl = lblNode.addComponent(Label);
    lbl.string = "战绩";
    lbl.fontSize = 18;
    lbl.lineHeight = 40;
    lbl.color = new Color(255, 255, 255);
    lbl.horizontalAlign = HorizontalTextAlignment.CENTER;

    const btn = recordsBtn.addComponent(Button);
    btn.transition = Button.Transition.SCALE;
    btn.zoomScale = 0.95;
    const eh = new EventHandler();
    eh.target = this.node;
    eh.component = "HallViewComp";
    eh.handler = "game_records_click";
    btn.clickEvents = [eh];
  }

  /** 动态创建"密码加入"按钮 */
  // private createPasswordJoinButton() {
  //     let sf = builtinResMgr.get<SpriteFrame>("ui-sprite-white");
  //     if (!sf) {
  //         sf = new SpriteFrame();
  //         const tex = new Texture2D();
  //         tex.reset({ width: 2, height: 2, format: Texture2D.PixelFormat.RGBA8888 });
  //         tex.uploadData(new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255]));
  //         sf.texture = tex;
  //     }

  //     const btn = new Node("passwordJoinBtn");
  //     btn.parent = this.node;
  //     btn.layer = this.node.layer;
  //     btn.setPosition(new Vec3(-100, 280, 0)); // 右上角，退出按钮左边

  //     const ut = btn.addComponent(UITransform);
  //     ut.setContentSize(new Size(120, 40));

  //     const sp = btn.addComponent(Sprite);
  //     sp.type = Sprite.Type.SIMPLE;
  //     sp.sizeMode = Sprite.SizeMode.CUSTOM;
  //     sp.spriteFrame = sf;
  //     sp.color = new Color(50, 150, 200, 255); // 蓝色背景

  //     const lblNode = new Node("lbl");
  //     lblNode.parent = btn;
  //     lblNode.layer = btn.layer;
  //     const lut = lblNode.addComponent(UITransform);
  //     lut.setContentSize(new Size(120, 40));
  //     const lbl = lblNode.addComponent(Label);
  //     lbl.string = "密码加入";
  //     lbl.fontSize = 18;
  //     lbl.lineHeight = 40;
  //     lbl.color = new Color(255, 255, 255);
  //     lbl.horizontalAlign = HorizontalTextAlignment.CENTER;

  //     const btnComp = btn.addComponent(Button);
  //     btnComp.transition = Button.Transition.SCALE;
  //     btnComp.zoomScale = 0.95;
  //     const eh = new EventHandler();
  //     eh.target = this.node;
  //     eh.component = "HallViewComp";
  //     eh.handler = "show_password_dialog";
  //     btnComp.clickEvents = [eh];
  // }

  /** 显示密码输入对话框 */
  protected show_password_dialog() {
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

    // 创建遮罩层
    const mask = new Node("passwordDialogMask");
    mask.parent = this.node;
    mask.layer = this.node.layer;
    mask.setPosition(Vec3.ZERO);

    const maskUt = mask.addComponent(UITransform);
    maskUt.setContentSize(new Size(960, 640));

    const maskWidget = mask.addComponent(Widget);
    maskWidget.isAlignTop =
      maskWidget.isAlignBottom =
      maskWidget.isAlignLeft =
      maskWidget.isAlignRight =
        true;
    maskWidget.top = maskWidget.bottom = maskWidget.left = maskWidget.right = 0;

    const maskSp = mask.addComponent(Sprite);
    maskSp.type = Sprite.Type.SIMPLE;
    maskSp.sizeMode = Sprite.SizeMode.CUSTOM;
    maskSp.spriteFrame = sf;
    maskSp.color = new Color(0, 0, 0, 180); // 半透明黑色遮罩

    mask.addComponent(BlockInputEvents);

    // 创建对话框
    const dialog = new Node("passwordDialog");
    dialog.parent = mask;
    dialog.layer = mask.layer;
    dialog.setPosition(Vec3.ZERO);

    const dialogUt = dialog.addComponent(UITransform);
    dialogUt.setContentSize(new Size(400, 200));

    const dialogSp = dialog.addComponent(Sprite);
    dialogSp.type = Sprite.Type.SIMPLE;
    dialogSp.sizeMode = Sprite.SizeMode.CUSTOM;
    dialogSp.spriteFrame = sf;
    dialogSp.color = new Color(40, 40, 40, 255); // 深灰色背景

    // 标题
    const titleNode = new Node("title");
    titleNode.parent = dialog;
    titleNode.layer = dialog.layer;
    titleNode.setPosition(new Vec3(0, 70, 0));
    const titleUt = titleNode.addComponent(UITransform);
    titleUt.setContentSize(new Size(400, 30));
    const titleLbl = titleNode.addComponent(Label);
    titleLbl.string = "输入房间密码";
    titleLbl.fontSize = 20;
    titleLbl.lineHeight = 30;
    titleLbl.color = new Color(255, 215, 0);
    titleLbl.horizontalAlign = HorizontalTextAlignment.CENTER;

    // 输入框
    const inputNode = new Node("passwordInput");
    inputNode.parent = dialog;
    inputNode.layer = dialog.layer;
    inputNode.setPosition(new Vec3(0, 10, 0));

    const inputUt = inputNode.addComponent(UITransform);
    inputUt.setContentSize(new Size(350, 60)); // 从 300x40 增大到 350x60

    const inputSp = inputNode.addComponent(Sprite);
    inputSp.type = Sprite.Type.SIMPLE;
    inputSp.sizeMode = Sprite.SizeMode.CUSTOM;
    inputSp.spriteFrame = sf;
    inputSp.color = new Color(255, 255, 255, 255); // 白色背景

    // 创建文本标签节点
    const textLabelNode = new Node("TEXT_LABEL");
    textLabelNode.parent = inputNode;
    textLabelNode.layer = inputNode.layer;
    const textLabelTransform = textLabelNode.addComponent(UITransform);
    textLabelTransform.setContentSize(new Size(340, 56));
    textLabelTransform.setAnchorPoint(0, 1);
    const textLabel = textLabelNode.addComponent(Label);
    textLabel.string = "";
    textLabel.fontSize = 28; // 从 18 增大到 28
    textLabel.color = new Color(0, 0, 0);
    textLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
    textLabel.verticalAlign = VerticalTextAlignment.CENTER;

    // 创建 placeholder 标签节点
    const placeholderLabelNode = new Node("PLACEHOLDER_LABEL");
    placeholderLabelNode.parent = inputNode;
    placeholderLabelNode.layer = inputNode.layer;
    const placeholderLabelTransform =
      placeholderLabelNode.addComponent(UITransform);
    placeholderLabelTransform.setContentSize(new Size(340, 56));
    placeholderLabelTransform.setAnchorPoint(0, 1);
    const placeholderLabel = placeholderLabelNode.addComponent(Label);
    placeholderLabel.string = "请输入7位数字密码";
    placeholderLabel.fontSize = 28; // 从 18 增大到 28
    placeholderLabel.color = new Color(150, 150, 150);
    placeholderLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
    placeholderLabel.verticalAlign = VerticalTextAlignment.CENTER;

    const editBox = inputNode.addComponent(EditBox);
    editBox.textLabel = textLabel;
    editBox.placeholderLabel = placeholderLabel;
    editBox.maxLength = 7;
    editBox.placeholder = "请输入7位数字密码";
    editBox.fontSize = 28; // 从 18 增大到 28
    editBox.inputMode = EditBox.InputMode.SINGLE_LINE;
    editBox.returnType = EditBox.KeyboardReturnType.DONE;

    // 确认按钮
    const confirmBtn = new Node("confirmBtn");
    confirmBtn.parent = dialog;
    confirmBtn.layer = dialog.layer;
    confirmBtn.setPosition(new Vec3(-80, -60, 0));

    const confirmUt = confirmBtn.addComponent(UITransform);
    confirmUt.setContentSize(new Size(120, 40));

    const confirmSp = confirmBtn.addComponent(Sprite);
    confirmSp.type = Sprite.Type.SIMPLE;
    confirmSp.sizeMode = Sprite.SizeMode.CUSTOM;
    confirmSp.spriteFrame = sf;
    confirmSp.color = new Color(50, 150, 50, 255); // 绿色

    const confirmLblNode = new Node("lbl");
    confirmLblNode.parent = confirmBtn;
    confirmLblNode.layer = confirmBtn.layer;
    const confirmLblUt = confirmLblNode.addComponent(UITransform);
    confirmLblUt.setContentSize(new Size(120, 40));
    const confirmLbl = confirmLblNode.addComponent(Label);
    confirmLbl.string = "确认";
    confirmLbl.fontSize = 18;
    confirmLbl.lineHeight = 40;
    confirmLbl.color = new Color(255, 255, 255);
    confirmLbl.horizontalAlign = HorizontalTextAlignment.CENTER;

    const confirmBtnComp = confirmBtn.addComponent(Button);
    confirmBtnComp.transition = Button.Transition.SCALE;
    confirmBtnComp.zoomScale = 0.95;
    const confirmEh = new EventHandler();
    confirmEh.target = this.node;
    confirmEh.component = "HallViewComp";
    confirmEh.handler = "confirm_password_join";
    confirmBtnComp.clickEvents = [confirmEh];

    // EditBox 回车事件 - 触发确认
    editBox.node.on(
      "editing-return",
      () => {
        this.confirm_password_join();
      },
      this,
    );

    // 取消按钮
    const cancelBtn = new Node("cancelBtn");
    cancelBtn.parent = dialog;
    cancelBtn.layer = dialog.layer;
    cancelBtn.setPosition(new Vec3(80, -60, 0));

    const cancelUt = cancelBtn.addComponent(UITransform);
    cancelUt.setContentSize(new Size(120, 40));

    const cancelSp = cancelBtn.addComponent(Sprite);
    cancelSp.type = Sprite.Type.SIMPLE;
    cancelSp.sizeMode = Sprite.SizeMode.CUSTOM;
    cancelSp.spriteFrame = sf;
    cancelSp.color = new Color(150, 50, 50, 255); // 红色

    const cancelLblNode = new Node("lbl");
    cancelLblNode.parent = cancelBtn;
    cancelLblNode.layer = cancelBtn.layer;
    const cancelLblUt = cancelLblNode.addComponent(UITransform);
    cancelLblUt.setContentSize(new Size(120, 40));
    const cancelLbl = cancelLblNode.addComponent(Label);
    cancelLbl.string = "取消";
    cancelLbl.fontSize = 18;
    cancelLbl.lineHeight = 40;
    cancelLbl.color = new Color(255, 255, 255);
    cancelLbl.horizontalAlign = HorizontalTextAlignment.CENTER;

    const cancelBtnComp = cancelBtn.addComponent(Button);
    cancelBtnComp.transition = Button.Transition.SCALE;
    cancelBtnComp.zoomScale = 0.95;
    const cancelEh = new EventHandler();
    cancelEh.target = this.node;
    cancelEh.component = "HallViewComp";
    cancelEh.handler = "close_password_dialog";
    cancelBtnComp.clickEvents = [cancelEh];

    // 保存引用
    this.node["_passwordDialog"] = mask;
    this.node["_passwordInput"] = editBox;
  }

  /** 关闭密码输入对话框 */
  protected close_password_dialog() {
    const dialog = this.node["_passwordDialog"] as Node;
    if (dialog && dialog.isValid) {
      dialog.destroy();
      this.node["_passwordDialog"] = null;
      this.node["_passwordInput"] = null;
    }
  }

  /** 确认密码加入 */
  protected async confirm_password_join() {
    await this.join_by_password_click();
    this.close_password_dialog();
  }

  private onUserInfoChanged(_event: string) {
    // 检查节点是否还有效，避免在销毁后触发事件
    if (!this.node || !this.node.isValid) return;
    UserInfoHelper.updateUserInfo(this.node);
  }

  /** 刷新房间列表 */
  private async refreshRoomList() {
    try {
      const res = await HttpClient.get<{ rooms: RoomInfo[] }>(
        NetConfig.API.ROOMS,
      );
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
    console.log("点击了商城");
    oops.gui.open(UIID.ShoppingViewComp);
  }

  /** 打开战绩弹窗（列表模式） */
  protected async game_records_click() {
    oops.gui.open(UIID.GameRecordsViewComp, {
      onAdded: (node: Node) => {
        if (!node.getComponent(GameRecordsViewComp)) {
          node.addComponent(GameRecordsViewComp);
        }
      },
    });
  }

  /** 快速游戏：根据用户金币自动匹配对应范围的房间 */
  protected async btn_quick_play_click() {
    try {
      // 先关闭可能存在的旧房间界面
      if (oops.gui.has(UIID.RoomViewComp)) {
        oops.gui.remove(UIID.RoomViewComp);
      }

      // 获取用户金币数量
      const userGold = smc.login.LoginModel?.gold || 0;

      // 根据金币数量确定房间类型
      let roomType = "newbie"; // 默认菜鸟场
      if (userGold >= 1_500_000) {
        roomType = "tycoon"; // 土豪场
      } else if (userGold >= 500_000) {
        roomType = "official"; // 官甲场
      } else if (userGold >= 40_000) {
        roomType = "civilian"; // 平民场
      } else if (userGold >= 300) {
        roomType = "newbie"; // 菜鸟场
      } else {
        oops.gui.toast("金币不足300，无法进入游戏", false);
        return;
      }

      const res = await HttpClient.get<{ room_id: string }>(
        `${NetConfig.API.QUICK_JOIN}?room_type=${roomType}`,
      );

      // 停止大厅背景音乐
      audioManager.stopBGM();

      GameSocket.connect(res.room_id);
      oops.gui.open(UIID.RoomViewComp);
    } catch (e: any) {
      let msg = "快速匹配失败";
      try {
        const raw = e?.message || "";
        const jsonStr = raw.substring(raw.indexOf("{"));
        const obj = JSON.parse(jsonStr);
        msg = obj.description || obj.error || msg;
      } catch {
        /* ignore parse error */
      }
      console.warn("快速匹配失败:", e?.message || e);
      oops.gui.toast(msg, false);
    }
  }

  /** 退出登录 */
  protected async logout_click() {
    try {
      // 调用后端退出登录API
      await HttpClient.post(NetConfig.API.LOGOUT);
    } catch (e: any) {
      console.warn("退出登录请求失败:", e?.message || e);
    } finally {
      // 无论后端请求是否成功，都清除本地缓存
      HttpClient.clearToken();

      // 清除登录模块数据
      const loginModel = smc.login?.LoginModel;
      if (loginModel) {
        loginModel.reset();
      }

      // 断开WebSocket连接
      GameSocket.close();

      // 提示用户
      oops.gui.toast("已退出登录", true);

      // 延迟后重新加载场景，返回登录界面
      setTimeout(() => {
        director.loadScene(director.getScene().name);
      }, 500);
    }
  }

  /** 通过密码加入房间 */
  protected async join_by_password_click() {
    try {
      const editBox = this.node["_passwordInput"] as EditBox;
      if (!editBox) {
        oops.gui.toast("输入框未找到", false);
        return;
      }

      const password = editBox.string.trim();

      // 验证密码格式
      if (!password || password.length !== 7) {
        oops.gui.toast("请输入7位数字房间密码", false);
        return;
      }
      if (!/^\d{7}$/.test(password)) {
        oops.gui.toast("房间密码必须是7位数字", false);
        return;
      }

      // 先关闭可能存在的旧房间界面
      if (oops.gui.has(UIID.RoomViewComp)) {
        oops.gui.remove(UIID.RoomViewComp);
      }

      // 调用后端API查找房间
      const res = await HttpClient.post<{ room_id: string }>(
        NetConfig.API.JOIN_BY_PASSWORD,
        { password },
      );

      // 连接WebSocket并打开房间界面
      GameSocket.connect(res.room_id);
      oops.gui.open(UIID.RoomViewComp);

      // 清空输入框
      editBox.string = "";
    } catch (e: any) {
      let msg = "加入房间失败";
      try {
        const raw = e?.message || "";
        const jsonStr = raw.substring(raw.indexOf("{"));
        const obj = JSON.parse(jsonStr);
        msg = obj.description || obj.error || msg;
      } catch {
        /* ignore parse error */
      }
      console.warn("通过密码加入房间失败:", e?.message || e);
      oops.gui.toast(msg, false);
    }
  }
}
