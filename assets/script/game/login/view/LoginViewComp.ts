import { _decorator, Node, EditBox, UITransform, Color, Label, Size, Sprite, Vec3, Button, EventHandler, HorizontalTextAlignment, builtinResMgr, SpriteFrame, Texture2D } from "cc";
import { gui } from "db://oops-framework/core/gui/Gui";
import { LayerType } from "db://oops-framework/core/gui/layer/LayerEnum";
import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCView } from "db://oops-framework/module/common/CCView";
import { oops } from "db://oops-framework/core/Oops";
import { Login } from "../Login";
import { smc } from "../../common/SingletonModuleComp";
import { HallViewComp } from "../../hall/view/HallViewComp";
import { HttpClient } from "../../common/network/HttpClient";
import { NetConfig } from "../../common/network/NetConfig";

const { ccclass, property } = _decorator;

/** 视图层对象 */
@ccclass('LoginViewComp')
@ecs.register('LoginView', false)
@gui.register('LoginView', { layer: LayerType.UI, prefab: "gui/login/login" })
export class LoginViewComp extends CCView<Login> {

    private emailInput: EditBox | null = null;
    private passwordInput: EditBox | null = null;
    private _whiteSF: SpriteFrame | null = null;

    start() {
        // 检查是否有保存的 token，尝试自动登录
        if (HttpClient.token) {
            this.tryAutoLogin();
            return;
        }
        this._whiteSF = this.getWhiteSpriteFrame();
        this.createInputFields();
        this.createButtons();
    }

    /** 用已保存的 token 尝试自动登录 */
    private async tryAutoLogin() {
        try {
            const profile = await HttpClient.get<{
                pid: string; name: string; gold: number; diamonds: number; cards: number;
            }>(NetConfig.API.PROFILE);
            const model = smc.login.LoginModel;
            model.token = HttpClient.token;
            model.pid = profile.pid;
            model.name = profile.name;
            model.AccountName = profile.name;
            console.log("自动登录成功:", profile.name);
            await smc.login.addUi(HallViewComp);
            this.remove();
        } catch (e) {
            // token 过期或无效，清除并显示登录界面
            console.log("自动登录失败，请重新登录");
            HttpClient.token = "";
            this._whiteSF = this.getWhiteSpriteFrame();
            this.createInputFields();
            this.createButtons();
        }
    }

    reset() {
        this.node.destroy();
    }

    /** 获取引擎内置白色 SpriteFrame */
    private getWhiteSpriteFrame(): SpriteFrame {
        // 引擎内置资源 key: "ui-sprite-white"
        let sf = builtinResMgr.get<SpriteFrame>("ui-sprite-white");
        if (!sf) {
            sf = new SpriteFrame();
            const tex = new Texture2D();
            tex.reset({
                width: 2,
                height: 2,
                format: Texture2D.PixelFormat.RGBA8888,
            });
            tex.uploadData(new Uint8Array([
                255, 255, 255, 255, 255, 255, 255, 255,
                255, 255, 255, 255, 255, 255, 255, 255,
            ]));
            sf.texture = tex;
        }
        return sf;
    }
    /** 创建一个 Label 节点 */
    private createLabel(name: string, parent: Node, text: string, fontSize: number, color: Color): Label {
        const node = new Node(name);
        node.parent = parent;
        node.layer = parent.layer;
        const transform = node.addComponent(UITransform);
        transform.setContentSize(new Size(380, 40));

        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 4;
        label.color = color;
        label.horizontalAlign = HorizontalTextAlignment.LEFT;
        label.overflow = Label.Overflow.CLAMP;
        return label;
    }

    /** 动态创建邮箱和密码输入框 */
    private createInputFields() {
        this.emailInput = this.createEditBox("emailInput", "请输入邮箱", false, 150);
        this.passwordInput = this.createEditBox("passwordInput", "请输入密码", true, 70);
    }

    private createEditBox(name: string, placeholder: string, isPassword: boolean, yPos: number): EditBox {
        const node = new Node(name);
        node.parent = this.node;
        node.layer = this.node.layer;
        node.setPosition(new Vec3(0, yPos, 0));

        const uiTransform = node.addComponent(UITransform);
        uiTransform.setContentSize(new Size(400, 50));

        // 背景
        const bgNode = new Node("background");
        bgNode.parent = node;
        bgNode.layer = node.layer;
        const bgTransform = bgNode.addComponent(UITransform);
        bgTransform.setContentSize(new Size(400, 50));
        const bgSprite = bgNode.addComponent(Sprite);
        bgSprite.type = Sprite.Type.SIMPLE;
        bgSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        bgSprite.spriteFrame = this._whiteSF;
        bgSprite.color = new Color(50, 50, 50, 200);

        // 文本 Label
        const textLabel = this.createLabel("TEXT_LABEL", node, "", 24, new Color(255, 255, 255, 255));
        // 占位符 Label
        const placeholderLabel = this.createLabel("PLACEHOLDER_LABEL", node, placeholder, 24, new Color(150, 150, 150, 255));

        const editBox = node.addComponent(EditBox);
        editBox.textLabel = textLabel;
        editBox.placeholderLabel = placeholderLabel;
        editBox.placeholder = placeholder;
        editBox.maxLength = 50;
        editBox.returnType = EditBox.KeyboardReturnType.DONE;

        if (isPassword) {
            editBox.inputFlag = EditBox.InputFlag.PASSWORD;
        }

        return editBox;
    }
    /** 创建按钮 */
    private createButtons() {
        this.createBtn("loginBtn", "登 录", new Vec3(-110, -20, 0), new Color(46, 139, 87, 255), "login_click");
        this.createBtn("registerBtn", "注 册", new Vec3(110, -20, 0), new Color(70, 130, 180, 255), "register_click");
    }

    private createBtn(name: string, text: string, pos: Vec3, bgColor: Color, handlerName: string) {
        const node = new Node(name);
        node.parent = this.node;
        node.layer = this.node.layer;
        node.setPosition(pos);

        const uiTransform = node.addComponent(UITransform);
        uiTransform.setContentSize(new Size(180, 50));

        const sprite = node.addComponent(Sprite);
        sprite.type = Sprite.Type.SIMPLE;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = this._whiteSF;
        sprite.color = bgColor;

        // 按钮文字
        const labelNode = new Node("label");
        labelNode.parent = node;
        labelNode.layer = node.layer;
        const labelTransform = labelNode.addComponent(UITransform);
        labelTransform.setContentSize(new Size(180, 50));
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = 26;
        label.lineHeight = 50;
        label.color = new Color(255, 255, 255, 255);
        label.horizontalAlign = HorizontalTextAlignment.CENTER;

        const btn = node.addComponent(Button);
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 0.95;

        const handler = new EventHandler();
        handler.target = this.node;
        handler.component = "LoginViewComp";
        handler.handler = handlerName;
        btn.clickEvents.push(handler);
    }

    /** 登录 */
    protected async login_click() {
        const email = this.emailInput?.string || "";
        const password = this.passwordInput?.string || "";
        if (!email || !password) {
            oops.gui.toast("请输入邮箱和密码", false);
            return;
        }
        try {
            const res = await HttpClient.post<{
                token: string; pid: string; name: string; is_verified: boolean;
            }>(NetConfig.API.LOGIN, { email, password });

            HttpClient.token = res.token;
            const model = smc.login.LoginModel;
            model.token = res.token;
            model.pid = res.pid;
            model.name = res.name;
            model.isVerified = res.is_verified;
            model.AccountName = res.name;
            console.log("登录成功:", res.name);

            await smc.login.addUi(HallViewComp);
            this.remove();
        } catch (e) {
            console.error("登录失败:", e);
            oops.gui.toast("登录失败，请检查邮箱和密码", false);
        }
    }

    /** 注册 */
    protected async register_click() {
        const email = this.emailInput?.string || "";
        const password = this.passwordInput?.string || "";
        if (!email || !password) {
            oops.gui.toast("请输入邮箱和密码", false);
            return;
        }
        try {
            await HttpClient.post(NetConfig.API.REGISTER, {
                email, password, name: email.split("@")[0],
            });
            console.log("注册成功，请登录");
        } catch (e) {
            console.error("注册失败:", e);
            oops.gui.toast("注册失败，请重试", false);
        }
    }

    /** 兼容旧的微信登录按钮 */
    protected async wx_login_click() {
        await this.login_click();
    }
}
