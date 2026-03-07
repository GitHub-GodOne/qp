import {
  _decorator,
  Node,
  EditBox,
  UITransform,
  Color,
  Label,
  Size,
  Sprite,
  Vec3,
  Button,
  EventHandler,
  HorizontalTextAlignment,
  builtinResMgr,
  SpriteFrame,
  Texture2D,
} from "cc";
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
@ccclass("LoginViewComp")
@ecs.register("LoginView", false)
@gui.register("LoginView", { layer: LayerType.UI, prefab: "gui/login/login" })
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
        pid: string;
        name: string;
        gold: number;
        diamonds: number;
        cards: number;
      }>(NetConfig.API.PROFILE);
      const model = smc.login.LoginModel;
      model.token = HttpClient.token;
      model.pid = profile.pid;
      model.name = profile.name;
      model.AccountName = profile.name;
      model.gold = profile.gold;
      model.diamonds = profile.diamonds;
      model.cards = profile.cards;
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
      tex.uploadData(
        new Uint8Array([
          255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
          255, 255,
        ]),
      );
      sf.texture = tex;
    }
    return sf;
  }
  /** 创建一个 Label 节点 */
  private createLabel(
    name: string,
    parent: Node,
    text: string,
    fontSize: number,
    color: Color,
  ): Label {
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
    this.emailInput = this.createEditBox(
      "emailInput",
      "请输入邮箱",
      false,
      150,
    );
    this.passwordInput = this.createEditBox(
      "passwordInput",
      "请输入密码",
      true,
      70,
    );
  }

  private createEditBox(
    name: string,
    placeholder: string,
    isPassword: boolean,
    yPos: number,
  ): EditBox {
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

    // 文本 Label - 设置位置在输入框内部左侧，添加左边距
    const textLabelNode = new Node("TEXT_LABEL");
    textLabelNode.parent = node;
    textLabelNode.layer = node.layer;
    const textTransform = textLabelNode.addComponent(UITransform);
    textTransform.setContentSize(new Size(380, 50));
    textTransform.setAnchorPoint(0, 1);
    textLabelNode.setPosition(new Vec3(-190, 0, 0));
    const textLabel = textLabelNode.addComponent(Label);
    textLabel.string = "";
    // textLabel.fontSize = 24;
    // textLabel.lineHeight = 24;
    // textLabel.color = new Color(255, 255, 255, 255);
    textLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
    textLabel.overflow = Label.Overflow.CLAMP;

    // 占位符 Label - 设置位置在输入框内部左侧，添加左边距
    const placeholderLabelNode = new Node("PLACEHOLDER_LABEL");
    placeholderLabelNode.parent = node;
    placeholderLabelNode.layer = node.layer;
    const placeholderTransform = placeholderLabelNode.addComponent(UITransform);
    placeholderTransform.setContentSize(new Size(380, 50));
    placeholderTransform.setAnchorPoint(0, 1);
    placeholderLabelNode.setPosition(new Vec3(-190, 0, 0));
    const placeholderLabel = placeholderLabelNode.addComponent(Label);
    placeholderLabel.string = placeholder;
    // placeholderLabel.fontSize = 24;
    // placeholderLabel.lineHeight = 24;
    placeholderLabel.color = new Color(150, 150, 150, 255);
    placeholderLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
    placeholderLabel.overflow = Label.Overflow.CLAMP;

    const editBox = node.addComponent(EditBox);
    editBox.textLabel = textLabel;
    editBox.placeholderLabel = placeholderLabel;
    editBox.placeholder = placeholder;
    editBox.maxLength = 50;
    editBox.inputMode = EditBox.InputMode.SINGLE_LINE;
    editBox.returnType = EditBox.KeyboardReturnType.DONE;

    if (isPassword) {
      editBox.inputFlag = EditBox.InputFlag.PASSWORD;
      // 密码框按回车触发登录
      editBox.node.on(
        "editing-return",
        () => {
          this.login_click();
        },
        this,
      );
    }

    return editBox;
  }
  /** 创建按钮 */
  private createButtons() {
    this.createBtn(
      "loginBtn",
      "登 录",
      new Vec3(-110, -20, 0),
      new Color(46, 139, 87, 255),
      "login_click",
    );
    this.createBtn(
      "registerBtn",
      "注 册",
      new Vec3(110, -20, 0),
      new Color(70, 130, 180, 255),
      "register_click",
    );
  }

  private createBtn(
    name: string,
    text: string,
    pos: Vec3,
    bgColor: Color,
    handlerName: string,
  ) {
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
        token: string;
        pid: string;
        name: string;
        is_verified: boolean;
      }>(NetConfig.API.LOGIN, { email, password });

      HttpClient.token = res.token;
      const model = smc.login.LoginModel;
      model.token = res.token;
      model.pid = res.pid;
      model.name = res.name;
      model.isVerified = res.is_verified;
      model.AccountName = res.name;

      // 获取用户资产信息
      try {
        const profile = await HttpClient.get<{
          pid: string;
          name: string;
          gold: number;
          diamonds: number;
          cards: number;
        }>(NetConfig.API.PROFILE);
        model.gold = profile.gold;
        model.diamonds = profile.diamonds;
        model.cards = profile.cards;
      } catch (e) {
        console.warn("获取用户资产失败:", e);
      }

      console.log("登录成功:", res.name);

      // 显示登录成功提示
      oops.gui.toast("登录成功！", true);

      await smc.login.addUi(HallViewComp);
      this.remove();
    } catch (e: any) {
      console.error("登录失败:", e);
      // 解析错误信息
      let errorMsg = "登录失败，请检查邮箱和密码";
      try {
        const errorText = e?.message || "";
        if (
          errorText.includes("Invalid credentials") ||
          errorText.includes("unauthorized")
        ) {
          errorMsg = "邮箱或密码错误";
        } else if (errorText.includes("not found")) {
          errorMsg = "用户不存在，请先注册";
        }
      } catch {}
      oops.gui.toast(errorMsg, false);
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
    if (password.length < 6) {
      oops.gui.toast("密码长度至少6位", false);
      return;
    }
    try {
      await HttpClient.post(NetConfig.API.REGISTER, {
        email,
        password,
        name: email.split("@")[0],
      });
      console.log("注册成功，请登录");
      // 显示注册成功提示
      oops.gui.toast("注册成功！已获得200,000金币奖励", true);
    } catch (e: any) {
      console.error("注册失败:", e);
      // 解析错误信息
      let errorMsg = "注册失败，请重试";
      try {
        const errorText = e?.message || "";
        if (
          errorText.includes("already exists") ||
          errorText.includes("EntityAlreadyExists")
        ) {
          errorMsg = "该邮箱已被注册，请直接登录";
        } else if (errorText.includes("invalid email")) {
          errorMsg = "邮箱格式不正确";
        } else if (errorText.includes("password")) {
          errorMsg = "密码格式不符合要求";
        }
      } catch {}
      oops.gui.toast(errorMsg, false);
    }
  }

  /** 兼容旧的微信登录按钮 */
  protected async wx_login_click() {
    await this.login_click();
  }
}
