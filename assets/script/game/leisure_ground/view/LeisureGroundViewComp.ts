import { _decorator, Node, BlockInputEvents, UITransform, Size, Widget, Sprite, Label, Color, Vec3, HorizontalTextAlignment, Button, EventHandler, builtinResMgr, SpriteFrame, Texture2D, director } from "cc";
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
import { smc } from "../../common/SingletonModuleComp";

const { ccclass, property } = _decorator;

/** 视图层对象 */
@ccclass('LeisureGroundViewComp')
@ecs.register('LeisureGroundView', false)
@gui.register('LeisureGroundView', { layer: LayerType.UI, prefab: "gui/leisure_ground/leisure_ground" })
export class LeisureGroundViewComp extends CCView<LeisureGround> {
    start() {
        // 添加阻挡层防止点击穿透
        this.addBlockInputLayer();

        UserInfoHelper.updateUserInfo(this.node);

        // 打印节点树结构，帮助调试
        console.log("=== 休闲场节点树结构 ===");
        this.printNodeTree(this.node, 0);

        // 实际按钮在 content/ksks/ksks 路径下
        const ksksNode = this.node.getChildByPath("content/ksks/ksks");
        if (ksksNode) {
            ksksNode.on(Node.EventType.TOUCH_END, this.ksks_click, this);
            console.log("ksks按钮绑定成功");
        } else {
            console.warn("未找到ksks按钮");
        }

        // 添加4个房间类型按钮的点击事件
        // 尝试多种路径：直接节点、子节点、孙节点
        this.bindRoomButton("cnc", "菜鸟场");
        this.bindRoomButton("pmc", "平民场");
        this.bindRoomButton("gjc", "官甲场");
        this.bindRoomButton("thc", "土豪场");

        // 监听用户资产变更事件（从房间退出后刷新金币等）
        oops.message.on(GameEvent.UserInfoChanged, this.onUserInfoChanged, this);
    }

    /** 打印节点树结构（调试用） */
    private printNodeTree(node: Node, depth: number) {
        const indent = "  ".repeat(depth);
        console.log(`${indent}${node.name}`);
        for (const child of node.children) {
            this.printNodeTree(child, depth + 1);
        }
    }

    /** 绑定房间按钮 */
    private bindRoomButton(buttonName: string, roomName: string) {
        const paths = [
            `content/${buttonName}`,           // 直接路径
            `content/${buttonName}/${buttonName}`, // 子节点路径（像ksks一样）
        ];

        for (const path of paths) {
            const node = this.node.getChildByPath(path);
            if (node) {
                const btn = node.getComponent(Button);
                if (btn) {
                    const handler = new EventHandler();
                    handler.target = this.node;
                    handler.component = "LeisureGroundViewComp";
                    handler.handler = `${buttonName}_click`;
                    btn.clickEvents.push(handler);
                    console.log(`${buttonName}按钮绑定成功 (路径: ${path})`);
                    return;
                }
            }
        }

        console.warn(`未找到${roomName}(${buttonName})按钮或Button组件`);
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
        eh.component = "LeisureGroundViewComp";
        eh.handler = "logout_click";
        btn.clickEvents = [eh];
    }

    private onUserInfoChanged(_event: string) {
        // 检查节点是否还有效，避免在销毁后触发事件
        if (!this.node || !this.node.isValid) return;
        UserInfoHelper.updateUserInfo(this.node);
    }

    protected return_click() {
        oops.gui.remove(UIID.LeisureGroundViewComp);
    }

    /** 快速开始：根据用户金币自动匹配对应范围的房间 */
    protected async ksks_click() {
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
            console.warn("快速匹配失败:", e?.message || e);
            oops.gui.toast(e?.message || "快速匹配失败", false);
        }
    }

    /** 菜鸟场：300-40000金币，底分100 */
    protected async cnc_click() {
        console.log("=== cnc按钮被点击 ===");
        const userGold = smc.login.LoginModel?.gold || 0;
        console.log("当前用户金币:", userGold);
        await this.joinRoomByType("newbie", 300, 40_000, "菜鸟场");
    }

    /** 平民场：40000-500000金币，底分1000 */
    protected async pmc_click() {
        console.log("=== pmc按钮被点击 ===");
        const userGold = smc.login.LoginModel?.gold || 0;
        console.log("当前用户金币:", userGold);
        await this.joinRoomByType("civilian", 40_000, 500_000, "平民场");
    }

    /** 官甲场：500000-1500000金币，底分5000 */
    protected async gjc_click() {
        console.log("=== gjc按钮被点击 ===");
        const userGold = smc.login.LoginModel?.gold || 0;
        console.log("当前用户金币:", userGold);
        await this.joinRoomByType("official", 500_000, 1_500_000, "官甲场");
    }

    /** 土豪场：1500000+金币，底分10000 */
    protected async thc_click() {
        console.log("=== thc按钮被点击 ===");
        const userGold = smc.login.LoginModel?.gold || 0;
        console.log("当前用户金币:", userGold);
        await this.joinRoomByType("tycoon", 1_500_000, null, "土豪场");
    }

    /** 根据房间类型加入房间 */
    private async joinRoomByType(roomType: string, minGold: number, maxGold: number | null, roomName: string) {
        try {
            // 获取用户金币
            const userGold = smc.login.LoginModel?.gold || 0;
            console.log(`尝试进入${roomName}，用户金币: ${userGold}, 要求: ${minGold}-${maxGold || '无上限'}`);

            // 验证金币是否满足条件
            if (userGold < minGold) {
                oops.gui.toast(`金币不足，${roomName}需要${minGold}金币以上`, false);
                return;
            }

            if (maxGold !== null && userGold > maxGold) {
                oops.gui.toast(`金币超出范围，${roomName}需要${minGold}-${maxGold}金币`, false);
                return;
            }

            // 先关闭可能存在的旧房间界面
            if (oops.gui.has(UIID.RoomViewComp)) {
                oops.gui.remove(UIID.RoomViewComp);
            }

            const res = await HttpClient.get<{ room_id: string }>(
                `${NetConfig.API.QUICK_JOIN}?room_type=${roomType}`
            );
            GameSocket.connect(res.room_id);
            oops.gui.open(UIID.RoomViewComp);
        } catch (e: any) {
            console.warn("加入房间失败:", e?.message || e);
            oops.gui.toast(e?.message || "加入房间失败", false);
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
            const loginModel = this.entity.ecs.getSingleton("login")?.LoginModel;
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

}