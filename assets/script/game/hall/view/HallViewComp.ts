import { _decorator, Node, RichText, find, Button, EventHandler, BlockInputEvents, UITransform, Size, Widget, Sprite, Label, Color, Vec3, HorizontalTextAlignment, builtinResMgr, SpriteFrame, Texture2D, director, game, EditBox } from "cc";
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
        // 添加阻挡层防止点击穿透
        this.addBlockInputLayer();

        UserInfoHelper.updateUserInfo(this.node);
        this.refreshRoomList();

        // btn_quick_play 在 prefab 中没有 Button 组件，手动绑定点击
        const btnQuickPlay = this.node.getChildByPath("bottom/btn_quick_play");
        if (btnQuickPlay) {
            btnQuickPlay.on(Node.EventType.TOUCH_END, this.btn_quick_play_click, this);
        } else {
            console.warn("未找到 btn_quick_play 节点");
        }

        // 动态创建退出登录按钮
        this.createLogoutButton();

        // 动态创建密码加入房间按钮
        this.createJoinByPasswordButton();

        // 监听用户资产变更事件（从房间退出后刷新金币等）
        oops.message.on(GameEvent.UserInfoChanged, this.onUserInfoChanged, this);
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
        widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
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
            tex.reset({ width: 2, height: 2, format: Texture2D.PixelFormat.RGBA8888 });
            tex.uploadData(new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255]));
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

    /** 动态创建密码加入房间按钮 */
    private createJoinByPasswordButton() {
        let sf = builtinResMgr.get<SpriteFrame>("ui-sprite-white");
        if (!sf) {
            sf = new SpriteFrame();
            const tex = new Texture2D();
            tex.reset({ width: 2, height: 2, format: Texture2D.PixelFormat.RGBA8888 });
            tex.uploadData(new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255]));
            sf.texture = tex;
        }

        // 创建输入框
        const inputNode = new Node("passwordInput");
        inputNode.parent = this.node;
        inputNode.layer = this.node.layer;
        inputNode.setPosition(new Vec3(-100, 280, 0)); // 右上角，退出按钮左边

        const inputUt = inputNode.addComponent(UITransform);
        inputUt.setContentSize(new Size(150, 40));

        const inputSp = inputNode.addComponent(Sprite);
        inputSp.type = Sprite.Type.SIMPLE;
        inputSp.sizeMode = Sprite.SizeMode.CUSTOM;
        inputSp.spriteFrame = sf;
        inputSp.color = new Color(255, 255, 255, 255); // 白色背景

        const editBox = inputNode.addComponent(EditBox);
        editBox.maxLength = 7;
        editBox.placeholder = "输入房间密码";
        editBox.fontSize = 16;
        editBox.inputMode = EditBox.InputMode.SINGLE_LINE;

        // 创建加入按钮
        const joinBtn = new Node("joinByPasswordBtn");
        joinBtn.parent = this.node;
        joinBtn.layer = this.node.layer;
        joinBtn.setPosition(new Vec3(80, 280, 0)); // 输入框右边

        const btnUt = joinBtn.addComponent(UITransform);
        btnUt.setContentSize(new Size(100, 40));

        const btnSp = joinBtn.addComponent(Sprite);
        btnSp.type = Sprite.Type.SIMPLE;
        btnSp.sizeMode = Sprite.SizeMode.CUSTOM;
        btnSp.spriteFrame = sf;
        btnSp.color = new Color(50, 150, 50, 255); // 绿色背景

        const lblNode = new Node("lbl");
        lblNode.parent = joinBtn;
        lblNode.layer = joinBtn.layer;
        const lut = lblNode.addComponent(UITransform);
        lut.setContentSize(new Size(100, 40));
        const lbl = lblNode.addComponent(Label);
        lbl.string = "加入房间";
        lbl.fontSize = 18;
        lbl.lineHeight = 40;
        lbl.color = new Color(255, 255, 255);
        lbl.horizontalAlign = HorizontalTextAlignment.CENTER;

        const btn = joinBtn.addComponent(Button);
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 0.95;
        const eh = new EventHandler();
        eh.target = this.node;
        eh.component = "HallViewComp";
        eh.handler = "join_by_password_click";
        btn.clickEvents = [eh];

        // 保存输入框引用
        this.node["_passwordInput"] = editBox;
    }

    private onUserInfoChanged(_event: string) {
        // 检查节点是否还有效，避免在销毁后触发事件
        if (!this.node || !this.node.isValid) return;
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
                `${NetConfig.API.QUICK_JOIN}?room_type=${roomType}`
            );
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
                { password }
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
            } catch { /* ignore parse error */ }
            console.warn("通过密码加入房间失败:", e?.message || e);
            oops.gui.toast(msg, false);
        }
    }
}
