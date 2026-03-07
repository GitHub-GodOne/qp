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
  BlockInputEvents,
  Widget,
  ScrollView,
  Layout,
  Event,
  EditBox,
  director,
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

interface RoomConfig {
  payment_type: string;
  max_players: number;
  rounds: number;
  banker_type: string;
  max_banker_multi: number;
  idle_push_multi: number;
  base_score_numerator: number;
  base_score_denominator: number;
  multiply_rule: string;
  special_cards: string[];
  joker_rule: string;
  flower_rule: string;
  room_password: string; // 7位数房间密码
}

/** 创建房间配置页 */
@ccclass("CreateRoomViewComp")
@ecs.register("CreateRoomView", false)
@gui.register("CreateRoomView", {
  layer: LayerType.UI,
  prefab: "gui/create_room/create_room",
})
export class CreateRoomViewComp extends CCView<CreateRoom> {
  private _whiteSF: SpriteFrame | null = null;
  private config: RoomConfig = {
    payment_type: "AA",
    max_players: 6,
    rounds: 10,
    banker_type: "OpenCard",
    max_banker_multi: 1,
    idle_push_multi: 0,
    base_score_numerator: 1,
    base_score_denominator: 2,
    multiply_rule: "Classic",
    special_cards: [],
    joker_rule: "None",
    flower_rule: "WithFlower",
    room_password: "",
  };

  private selectedButtons: Map<string, Node> = new Map();
  private initialized: boolean = false;
  private passwordDialogMask: Node | null = null; // 保存弹窗引用，防止重复创建

  onEnable() {
    // 只在第一次启用时初始化，并且节点名称必须是 create_room
    if (!this.initialized && this.node.name === "create_room") {
      console.log("CreateRoomViewComp onEnable - 开始初始化");
      this.initialized = true;
      this.initUI();
    } else {
      console.log(
        "CreateRoomViewComp onEnable - 跳过初始化，节点名称:",
        this.node.name,
        "已初始化:",
        this.initialized,
      );
    }
  }

  start() {
    // start 方法留空，所有初始化在 onEnable 中进行
  }

  private initUI() {
    console.log("CreateRoomViewComp initUI - 节点名称:", this.node.name);
    this._whiteSF = this.getWhiteSpriteFrame();

    // 查找 prefab 中的 ScrollView
    const scrollView = this.node.getChildByName("ScrollView");
    if (scrollView) {
      console.log("找到 ScrollView，使用 prefab 结构");
      this.setupWithPrefab(scrollView);
    } else {
      console.log("未找到 ScrollView，创建简单界面");
      this.createSimpleUI();
    }

    UserInfoHelper.updateUserInfo(this.node);
    oops.message.on(GameEvent.UserInfoChanged, this.onUserInfoChanged, this);
  }

  private setupWithPrefab(scrollView: Node) {
    console.log("setupWithPrefab - scrollView 节点名称:", scrollView.name);

    // 获取 ScrollView 组件
    const scrollComp = scrollView.getComponent(ScrollView);

    // 调整 ScrollView 的大小，不要覆盖底部按钮区域
    const scrollTransform = scrollView.getComponent(UITransform);
    if (scrollTransform) {
      const currentSize = scrollTransform.contentSize;
      // 缩小高度，给底部按钮留出空间（大约 100 像素）
      scrollTransform.setContentSize(
        new Size(currentSize.width, currentSize.height - 100),
      );
      // 向上移动一点，保持居中
      scrollView.setPosition(
        new Vec3(scrollView.position.x, scrollView.position.y + 50, 0),
      );
      console.log(
        "调整 ScrollView 尺寸:",
        scrollTransform.contentSize,
        "位置:",
        scrollView.position,
      );
    }

    // 直接查找 view/content 路径
    const view = scrollView.getChildByName("view");
    let content: Node | null = null;

    if (view) {
      content = view.getChildByName("content");
      console.log("找到 view/content 节点");
    }

    if (!content) {
      console.error("未找到 content 节点！");
      return;
    }

    // 禁用 ScrollView 的触摸拦截
    if (scrollComp) {
      scrollComp.cancelInnerEvents = false;
      console.log("已设置 ScrollView cancelInnerEvents = false");
    }

    // 不要删除子节点，而是隐藏所有原有的配置项
    console.log("隐藏 prefab 中的原有配置项");
    for (const child of content.children) {
      child.active = false;
    }

    // 在 content 中创建配置选项
    this.createConfigOptions(content);

    // 绑定返回按钮
    const fanhuiBtn = this.node.getChildByName("fanhui");
    if (fanhuiBtn) {
      const button = fanhuiBtn.getComponent(Button);
      if (button) {
        button.clickEvents = [];
        const eh = new EventHandler();
        eh.target = this.node;
        eh.component = "CreateRoomViewComp";
        eh.handler = "return_click";
        button.clickEvents.push(eh);
        console.log("已绑定返回按钮");
      }
    }

    // 创建新的创建房间按钮
    this.createBottomButtons();
  }

  private createSimpleUI() {
    // 如果没有 prefab 结构，创建完整的界面
    const scrollNode = new Node("ScrollView");
    scrollNode.parent = this.node;
    scrollNode.layer = this.node.layer;
    scrollNode.setPosition(new Vec3(0, 50, 0));

    const scrollTransform = scrollNode.addComponent(UITransform);
    scrollTransform.setContentSize(new Size(900, 450));

    const scrollView = scrollNode.addComponent(ScrollView);
    scrollView.horizontal = false;
    scrollView.vertical = true;

    // 创建内容容器
    const content = new Node("content");
    content.parent = scrollNode;
    content.layer = scrollNode.layer;

    const contentTransform = content.addComponent(UITransform);
    contentTransform.setContentSize(new Size(900, 800));
    contentTransform.setAnchorPoint(0, 1);

    scrollView.content = contentTransform;

    this.createConfigOptions(content);
    this.createBottomButtons();
  }

  private createConfigOptions(parent: Node) {
    let yPos = -20;

    // 支付方式
    yPos = this.createOptionRow(
      parent,
      "支付方式",
      yPos,
      ["AA支付", "房主支付", "大赢家支付"],
      ["AA", "Owner", "Winner"],
      "payment_type",
      0,
    );

    // 人数
    yPos = this.createOptionRow(
      parent,
      "人数",
      yPos,
      ["4人", "6人", "8人"],
      [4, 6, 8],
      "max_players",
      1,
    );

    // 局数
    yPos = this.createOptionRow(
      parent,
      "局数",
      yPos,
      ["10局", "20局", "30局", "40局"],
      [10, 20, 30, 40],
      "rounds",
      0,
    );

    // 抢庄类型
    yPos = this.createOptionRow(
      parent,
      "抢庄类型",
      yPos,
      ["明牌抢庄", "无牛下庄", "通比做庄"],
      ["OpenCard", "NoBullDown", "Compare"],
      "banker_type",
      0,
    );

    // 最大抢庄
    yPos = this.createOptionRow(
      parent,
      "最大抢庄",
      yPos,
      ["1倍", "2倍", "3倍", "4倍"],
      [1, 2, 3, 4],
      "max_banker_multi",
      0,
    );

    // 闲家推注
    yPos = this.createOptionRow(
      parent,
      "闲家推注",
      yPos,
      ["无", "10倍", "20倍", "30倍"],
      [0, 10, 20, 30],
      "idle_push_multi",
      0,
    );

    // 底分
    yPos = this.createBaseScoreRow(parent, yPos);

    // 翻倍规则
    yPos = this.createOptionRow(
      parent,
      "翻倍规则",
      yPos,
      ["经典模式", "疯狂加倍"],
      ["Classic", "Crazy"],
      "multiply_rule",
      0,
    );

    // 特殊牌型（多选）
    yPos = this.createSpecialCardsRow(parent, yPos);

    // 王癞玩法
    yPos = this.createOptionRow(
      parent,
      "王癞玩法",
      yPos,
      ["无", "经典王癞子"],
      ["None", "Classic"],
      "joker_rule",
      0,
    );

    // 花牌
    yPos = this.createOptionRow(
      parent,
      "花牌",
      yPos,
      ["有花牌", "无花有10", "无花无10"],
      ["WithFlower", "NoFlowerWith10", "NoFlowerNo10"],
      "flower_rule",
      0,
    );

    // 更新 content 高度
    const contentTransform = parent.getComponent(UITransform);
    if (contentTransform) {
      contentTransform.setContentSize(new Size(800, Math.abs(yPos) + 40));
    }
  }

  private setupButtons() {
    // 查找 prefab 中的按钮，如果存在就绑定事件，不存在就不创建
    let createBtn = this.node.getChildByName("createBtn");
    if (createBtn) {
      console.log("找到 prefab 中的 createBtn，绑定点击事件");
      // 直接监听点击事件
      createBtn.on(Node.EventType.TOUCH_END, this.onCreateClick, this);
    }
  }

  private createActionButton(
    text: string,
    pos: Vec3,
    color: Color,
    handler: string,
  ): Node {
    const btn = new Node(text);
    btn.layer = this.node.layer;
    btn.setPosition(pos);

    const transform = btn.addComponent(UITransform);
    transform.setContentSize(new Size(200, 50));

    const sprite = btn.addComponent(Sprite);
    sprite.spriteFrame = this._whiteSF;
    sprite.color = color;

    const labelNode = new Node("label");
    labelNode.parent = btn;
    labelNode.layer = btn.layer;

    const labelTransform = labelNode.addComponent(UITransform);
    labelTransform.setContentSize(new Size(200, 50));

    const label = labelNode.addComponent(Label);
    label.string = text;
    label.fontSize = 26;
    label.color = new Color(255, 255, 255);
    label.horizontalAlign = HorizontalTextAlignment.CENTER;

    const button = btn.addComponent(Button);
    button.transition = Button.Transition.SCALE;
    button.zoomScale = 0.95;

    const eventHandler = new EventHandler();
    eventHandler.target = this.node;
    eventHandler.component = "CreateRoomViewComp";
    eventHandler.handler = handler;
    button.clickEvents.push(eventHandler);

    return btn;
  }

  reset() {
    // 只有正确的节点才需要清理
    if (this.node.name === "create_room") {
      oops.message.off(GameEvent.UserInfoChanged, this.onUserInfoChanged, this);
      this.node.destroy();
    }
  }

  private getWhiteSpriteFrame(): SpriteFrame {
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
      sf.reset({
        texture: tex,
      });
    }
    return sf;
  }

  /** 添加阻挡层防止点击穿透到下层 */
  private addBlockInputLayer() {
    const blockLayer = new Node("blockInputLayer");
    blockLayer.layer = this.node.layer;
    const transform = blockLayer.addComponent(UITransform);
    transform.setContentSize(new Size(960, 640));
    const widget = blockLayer.addComponent(Widget);
    widget.isAlignTop =
      widget.isAlignBottom =
      widget.isAlignLeft =
      widget.isAlignRight =
        true;
    widget.top = widget.bottom = widget.left = widget.right = 0;
    blockLayer.addComponent(BlockInputEvents);
    blockLayer.parent = this.node;
    blockLayer.setSiblingIndex(0);
  }

  private onUserInfoChanged(_event: string) {
    if (!this.node || !this.node.isValid) return;
    UserInfoHelper.updateUserInfo(this.node);
  }

  private createOptionRow(
    parent: Node,
    title: string,
    yPos: number,
    labels: string[],
    values: any[],
    configKey: string,
    defaultIndex: number,
  ): number {
    const row = new Node(configKey);
    row.parent = parent;
    row.layer = parent.layer;
    row.setPosition(new Vec3(0, yPos, 0));

    const rowTransform = row.addComponent(UITransform);
    rowTransform.setContentSize(new Size(860, 60)); // 增大行高从 50 到 60

    // 标题
    const titleNode = new Node("title");
    titleNode.parent = row;
    titleNode.layer = row.layer;
    titleNode.setPosition(new Vec3(-350, 0, 0));
    const titleTransform = titleNode.addComponent(UITransform);
    titleTransform.setContentSize(new Size(150, 40));
    const titleLabel = titleNode.addComponent(Label);
    titleLabel.string = title;
    titleLabel.fontSize = 28;
    titleLabel.color = new Color(0, 0, 0);
    titleLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
    titleLabel.isBold = true;

    // 选项按钮
    const startX = -100;
    const gap = labels.length === 2 ? 180 : labels.length === 3 ? 140 : 100;

    labels.forEach((label, index) => {
      const btn = this.createOptionButton(
        row,
        label,
        new Vec3(startX + index * gap, 0, 0),
        () => {
          console.log(`点击了按钮: ${title} - ${label}`);
          // 更新配置
          (this.config as any)[configKey] = values[index];
          console.log(`选择 ${title}: ${label}`, this.config);
          // 更新按钮选中状态
          this.updateButtonSelection(configKey, btn);
        },
        labels.length === 2 ? 120 : labels.length === 3 ? 90 : 70,
      );

      // 设置默认选中
      if (index === defaultIndex) {
        (this.config as any)[configKey] = values[index];
        this.updateButtonSelection(configKey, btn);
        console.log(`默认选中 ${title}: ${label}`);
      }
    });

    return yPos - 70; // 增大间距从 60 到 70
  }

  private createBaseScoreRow(parent: Node, yPos: number): number {
    const row = new Node("base_score");
    row.parent = parent;
    row.layer = parent.layer;
    row.setPosition(new Vec3(0, yPos, 0));

    const rowTransform = row.addComponent(UITransform);
    rowTransform.setContentSize(new Size(860, 60)); // 增大行高从 50 到 60

    // 标题
    const titleNode = new Node("title");
    titleNode.parent = row;
    titleNode.layer = row.layer;
    titleNode.setPosition(new Vec3(-350, 0, 0));
    const titleTransform = titleNode.addComponent(UITransform);
    titleTransform.setContentSize(new Size(150, 40));
    const titleLabel = titleNode.addComponent(Label);
    titleLabel.string = "底分";
    titleLabel.fontSize = 28;
    titleLabel.color = new Color(0, 0, 0);
    titleLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
    titleLabel.isBold = true;

    const scores = [
      { label: "1/2", num: 1, den: 2 },
      { label: "2/4", num: 2, den: 4 },
      { label: "4/8", num: 4, den: 8 },
      { label: "5/10", num: 5, den: 10 },
    ];

    const startX = -120;
    const gap = 100;

    scores.forEach((score, index) => {
      const btn = this.createOptionButton(
        row,
        score.label,
        new Vec3(startX + index * gap, 0, 0),
        () => {
          this.config.base_score_numerator = score.num;
          this.config.base_score_denominator = score.den;
          console.log(`选择底分: ${score.label}`);
          this.updateButtonSelection("base_score", btn);
        },
        70,
      );

      if (index === 0) {
        this.updateButtonSelection("base_score", btn);
      }
    });

    return yPos - 70; // 增大间距从 60 到 70
  }

  private createSpecialCardsRow(parent: Node, yPos: number): number {
    const row = new Node("special_cards");
    row.parent = parent;
    row.layer = parent.layer;
    row.setPosition(new Vec3(0, yPos, 0));

    const rowTransform = row.addComponent(UITransform);
    rowTransform.setContentSize(new Size(860, 130)); // 增大高度从 100 到 130

    // 标题
    const titleNode = new Node("title");
    titleNode.parent = row;
    titleNode.layer = row.layer;
    titleNode.setPosition(new Vec3(-350, 40, 0)); // 调整标题位置
    const titleTransform = titleNode.addComponent(UITransform);
    titleTransform.setContentSize(new Size(150, 40));
    const titleLabel = titleNode.addComponent(Label);
    titleLabel.string = "特殊牌型";
    titleLabel.fontSize = 28;
    titleLabel.color = new Color(0, 0, 0);
    titleLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
    titleLabel.isBold = true;

    const cards = [
      { label: "同花顺", value: "StraightFlush" },
      { label: "炸弹牛", value: "Bomb" },
      { label: "五小牛", value: "FiveSmall" },
      { label: "葫芦", value: "FullHouse" },
      { label: "同花牛", value: "Flush" },
      { label: "五花牛", value: "FiveFace" },
      { label: "顺子牛", value: "Straight" },
    ];

    const startX = -120;
    const gap = 90;
    const rowGap = 60; // 增大行间距从 45 到 60

    cards.forEach((card, index) => {
      const cardRow = Math.floor(index / 4);
      const col = index % 4;
      const btn = this.createOptionButton(
        row,
        card.label,
        new Vec3(startX + col * gap, 40 - cardRow * rowGap, 0), // 调整起始位置
        () => {
          const idx = this.config.special_cards.indexOf(card.value);
          if (idx >= 0) {
            this.config.special_cards.splice(idx, 1);
            this.updateMultiButtonSelection(card.value, btn, false);
            console.log(`取消选择特殊牌型: ${card.label}`);
          } else {
            this.config.special_cards.push(card.value);
            this.updateMultiButtonSelection(card.value, btn, true);
            console.log(`选择特殊牌型: ${card.label}`);
          }
        },
        70,
      );
    });

    return yPos - 140; // 增大间距从 110 到 140
  }

  private createOptionButton(
    parent: Node,
    text: string,
    pos: Vec3,
    onClick: () => void,
    width: number = 90,
  ): Node {
    const node = new Node(text);
    node.parent = parent;
    node.layer = parent.layer;
    node.setPosition(pos);

    const height = 50; // 增大高度从 35 到 50
    const transform = node.addComponent(UITransform);
    transform.setContentSize(new Size(width, height));

    const sprite = node.addComponent(Sprite);
    sprite.spriteFrame = this._whiteSF;
    sprite.color = new Color(220, 220, 220); // 默认浅灰色背景
    sprite.type = Sprite.Type.SIMPLE;
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;

    const button = node.addComponent(Button);
    button.transition = Button.Transition.SCALE;
    button.zoomScale = 0.95;

    // 使用 EventHandler 方式，和 HallViewComp 一样
    const eh = new EventHandler();
    eh.target = this.node;
    eh.component = "CreateRoomViewComp";
    eh.handler = "onOptionClick";
    eh.customEventData = text;
    button.clickEvents = [eh];

    // 保存回调函数到节点
    (node as any)._onClick = onClick;

    const labelNode = new Node("label");
    labelNode.parent = node;
    labelNode.layer = node.layer;
    const labelTransform = labelNode.addComponent(UITransform);
    labelTransform.setContentSize(new Size(width, height));
    const label = labelNode.addComponent(Label);
    label.string = text;
    label.fontSize = 26; // 增大字体从 22 到 26
    label.color = new Color(0, 0, 0); // 默认黑色文字
    label.horizontalAlign = HorizontalTextAlignment.CENTER;
    label.isBold = true;

    // 添加选中标记（勾号）在右上角
    const checkMark = new Node("checkMark");
    checkMark.parent = node;
    checkMark.layer = node.layer;
    checkMark.setPosition(new Vec3(width / 2 - 10, height / 2 - 8, 0));
    const checkTransform = checkMark.addComponent(UITransform);
    checkTransform.setContentSize(new Size(20, 20)); // 增大勾号从 16 到 20
    const checkLabel = checkMark.addComponent(Label);
    checkLabel.string = "✓";
    checkLabel.fontSize = 24; // 增大勾号字体从 20 到 24
    checkLabel.color = new Color(255, 255, 255);
    checkLabel.horizontalAlign = HorizontalTextAlignment.CENTER;
    checkLabel.isBold = true;
    checkMark.active = false; // 默认隐藏

    console.log(
      `创建按钮: ${text}, 位置: ${pos.x}, ${pos.y}, 宽度: ${width}, 高度: ${height}, layer: ${node.layer}`,
    );

    return node;
  }

  /** 选项按钮点击处理 */
  protected onOptionClick(event: Event, customEventData: string) {
    console.log("onOptionClick 被调用, customEventData:", customEventData);
    const button = event.target as Node;
    const onClick = (button as any)._onClick;
    if (onClick) {
      console.log("执行回调函数");
      onClick();
    } else {
      console.error("未找到回调函数");
    }
  }

  private updateButtonSelection(key: string, selectedBtn: Node) {
    console.log(
      `updateButtonSelection 被调用: key=${key}, btn=${selectedBtn.name}`,
    );
    // 取消之前选中的按钮
    const prevBtn = this.selectedButtons.get(key);
    if (prevBtn && prevBtn.isValid) {
      const sprite = prevBtn.getComponent(Sprite);
      const label = prevBtn.getChildByName("label")?.getComponent(Label);
      const checkMark = prevBtn.getChildByName("checkMark");
      if (sprite) sprite.color = new Color(220, 220, 220);
      if (label) label.color = new Color(0, 0, 0);
      if (checkMark) checkMark.active = false; // 隐藏勾号
      console.log(`取消之前的选中: ${prevBtn.name}`);
    }

    // 选中新按钮 - 绿色背景，白色文字，显示勾号
    const sprite = selectedBtn.getComponent(Sprite);
    const label = selectedBtn.getChildByName("label")?.getComponent(Label);
    const checkMark = selectedBtn.getChildByName("checkMark");
    if (sprite) sprite.color = new Color(46, 139, 87);
    if (label) label.color = new Color(255, 255, 255);
    if (checkMark) checkMark.active = true; // 显示勾号
    this.selectedButtons.set(key, selectedBtn);
    console.log(
      `选中新按钮: ${selectedBtn.name}, 勾号显示: ${checkMark?.active}`,
    );
  }

  private updateMultiButtonSelection(
    key: string,
    btn: Node,
    selected: boolean,
  ) {
    console.log(`updateMultiButtonSelection: key=${key}, selected=${selected}`);
    const sprite = btn.getComponent(Sprite);
    const label = btn.getChildByName("label")?.getComponent(Label);
    const checkMark = btn.getChildByName("checkMark");

    if (sprite) {
      sprite.color = selected
        ? new Color(46, 139, 87)
        : new Color(220, 220, 220);
    }
    if (label) {
      label.color = selected ? new Color(255, 255, 255) : new Color(0, 0, 0);
    }
    if (checkMark) {
      checkMark.active = selected; // 显示/隐藏勾号
      console.log(`多选勾号状态: ${selected}`);
    }
  }

  private createBottomButtons() {
    // 找到 left 节点
    const leftNode = this.node.getChildByName("left");
    if (!leftNode) {
      console.error("未找到 left 节点！");
      return;
    }

    // 直接获取 SpriteFrame，不使用缓存的 _whiteSF
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

    // 创建房间按钮 - 添加到 left 节点中
    const createBtn = new Node("createBtn");
    createBtn.parent = leftNode;
    createBtn.layer = leftNode.layer;
    createBtn.setPosition(new Vec3(0, -250, 0));

    const createTransform = createBtn.addComponent(UITransform);
    createTransform.setContentSize(new Size(300, 80));

    const createSprite = createBtn.addComponent(Sprite);
    createSprite.type = Sprite.Type.SIMPLE;
    createSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    createSprite.spriteFrame = sf;
    createSprite.color = new Color(46, 139, 87, 255); // 绿色背景

    const createLabelNode = new Node("label");
    createLabelNode.parent = createBtn;
    createLabelNode.layer = createBtn.layer;
    const createLabelTransform = createLabelNode.addComponent(UITransform);
    createLabelTransform.setContentSize(new Size(300, 80));
    const createLabel = createLabelNode.addComponent(Label);
    createLabel.string = "创建房间";
    createLabel.fontSize = 36;
    createLabel.lineHeight = 80;
    createLabel.color = new Color(255, 255, 255);
    createLabel.horizontalAlign = HorizontalTextAlignment.CENTER;
    createLabel.isBold = true;

    const createButton = createBtn.addComponent(Button);
    createButton.transition = Button.Transition.SCALE;
    createButton.zoomScale = 0.95;

    // 使用 EventHandler 方式
    const eh = new EventHandler();
    eh.target = this.node;
    eh.component = "CreateRoomViewComp";
    eh.handler = "onCreateClick";
    createButton.clickEvents = [eh];

    console.log(
      "创建房间按钮已添加到 left 节点，位置:",
      createBtn.position,
      "尺寸: 300x80",
      "背景色: RGB(46, 139, 87, 255)",
      "spriteFrame:",
      sf,
    );
  }

  /** 返回大厅 */
  protected return_click() {
    oops.gui.remove(UIID.CreateRoomViewComp);
  }

  /** 创建房间 */
  protected async onCreateClick() {
    console.log("onCreateClick 被调用");

    // 如果弹窗已经存在，不重复创建
    if (this.passwordDialogMask && this.passwordDialogMask.isValid) {
      console.log("密码弹窗已存在，不重复创建");
      return;
    }

    // 显示密码输入弹窗
    this.showPasswordDialog();
  }

  /** 显示密码输入弹窗 */
  private showPasswordDialog() {
    // 禁用 ScrollView 的触摸，防止拦截弹窗输入
    const scrollView = this.node.getChildByName("ScrollView");
    let scrollComp: ScrollView | null = null;
    if (scrollView) {
      scrollComp = scrollView.getComponent(ScrollView);
      if (scrollComp) {
        scrollComp.enabled = false;
        console.log("已禁用 ScrollView 触摸");
      }
    }

    // 每次都创建新的 SpriteFrame，确保纹理正确
    const sf = new SpriteFrame();
    const tex = new Texture2D();
    tex.reset({ width: 2, height: 2, format: Texture2D.PixelFormat.RGBA8888 });
    tex.uploadData(
      new Uint8Array([
        255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
        255, 255,
      ]),
    );
    sf.texture = tex;
    sf.reset({ texture: tex });

    // 创建遮罩层 - 简单的背景，不添加任何阻挡组件
    const mask = new Node("passwordMask");
    mask.parent = this.node;
    mask.layer = this.node.layer;
    mask.setPosition(new Vec3(0, 0, 0));
    mask.setSiblingIndex(999);

    const maskTransform = mask.addComponent(UITransform);
    maskTransform.setContentSize(new Size(960, 640));

    const maskSprite = mask.addComponent(Sprite);
    maskSprite.type = Sprite.Type.SIMPLE;
    maskSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    maskSprite.spriteFrame = sf;
    maskSprite.color = new Color(0, 0, 0, 180);

    // 保存引用
    this.passwordDialogMask = mask;

    // 弹窗背景（带黑色边框）
    const dialog = new Node("passwordDialog");
    dialog.parent = mask;
    dialog.layer = mask.layer;
    dialog.setPosition(new Vec3(0, 0, 0));

    const dialogTransform = dialog.addComponent(UITransform);
    dialogTransform.setContentSize(new Size(520, 320));

    const dialogSprite = dialog.addComponent(Sprite);
    dialogSprite.type = Sprite.Type.SIMPLE;
    dialogSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    dialogSprite.spriteFrame = sf;
    dialogSprite.color = new Color(0, 0, 0);

    // 内容区（白色）
    const content = new Node("content");
    content.parent = dialog;
    content.layer = dialog.layer;
    content.setPosition(new Vec3(0, 0, 0));

    const contentTransform = content.addComponent(UITransform);
    contentTransform.setContentSize(new Size(500, 300));

    const contentSprite = content.addComponent(Sprite);
    contentSprite.type = Sprite.Type.SIMPLE;
    contentSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    contentSprite.spriteFrame = sf;
    contentSprite.color = new Color(240, 240, 240);

    // 标题
    const titleNode = new Node("title");
    titleNode.parent = content;
    titleNode.layer = content.layer;
    titleNode.setPosition(new Vec3(0, 100, 0));

    const titleTransform = titleNode.addComponent(UITransform);
    titleTransform.setContentSize(new Size(400, 50));

    const titleLabel = titleNode.addComponent(Label);
    titleLabel.string = "设置房间密码";
    titleLabel.fontSize = 32;
    titleLabel.color = new Color(0, 0, 0);
    titleLabel.horizontalAlign = HorizontalTextAlignment.CENTER;
    titleLabel.isBold = true;

    // 提示文字
    const hintNode = new Node("hint");
    hintNode.parent = content;
    hintNode.layer = content.layer;
    hintNode.setPosition(new Vec3(0, 40, 0));

    const hintTransform = hintNode.addComponent(UITransform);
    hintTransform.setContentSize(new Size(400, 40));
    hintTransform.setAnchorPoint(0, 1);

    const hintLabel = hintNode.addComponent(Label);
    hintLabel.string = "请输入7位数字密码";
    hintLabel.fontSize = 24;
    hintLabel.color = new Color(100, 100, 100);
    hintLabel.horizontalAlign = HorizontalTextAlignment.CENTER;

    // 输入框 - 完全模仿大厅的方式
    const inputNode = new Node("inputBg");
    inputNode.parent = content;
    inputNode.layer = content.layer;
    inputNode.setPosition(new Vec3(0, -20, 0));

    const inputTransform = inputNode.addComponent(UITransform);
    inputTransform.setContentSize(new Size(350, 60));

    const inputSprite = inputNode.addComponent(Sprite);
    inputSprite.type = Sprite.Type.SIMPLE;
    inputSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    inputSprite.spriteFrame = sf;
    inputSprite.color = new Color(255, 255, 255);

    // EditBox - 使用和大厅一样的配置
    const editBox = inputNode.addComponent(EditBox);
    editBox.maxLength = 7;
    editBox.placeholder = "请输入7位数字";
    editBox.fontSize = 28;
    editBox.inputMode = EditBox.InputMode.SINGLE_LINE; // 和大厅一样

    console.log("创建密码输入框，layer:", inputNode.layer);

    // 确认按钮
    const confirmBtn = new Node("confirmBtn");
    confirmBtn.parent = content;
    confirmBtn.layer = content.layer;
    confirmBtn.setPosition(new Vec3(-120, -100, 0));

    const confirmTransform = confirmBtn.addComponent(UITransform);
    confirmTransform.setContentSize(new Size(180, 70));

    const confirmSprite = confirmBtn.addComponent(Sprite);
    confirmSprite.type = Sprite.Type.SIMPLE;
    confirmSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    confirmSprite.spriteFrame = sf;
    confirmSprite.color = new Color(46, 139, 87, 255); // 绿色背景

    const confirmLabelNode = new Node("label");
    confirmLabelNode.parent = confirmBtn;
    confirmLabelNode.layer = confirmBtn.layer;

    const confirmLabelTransform = confirmLabelNode.addComponent(UITransform);
    confirmLabelTransform.setContentSize(new Size(180, 70));

    const confirmLabel = confirmLabelNode.addComponent(Label);
    confirmLabel.string = "确认";
    confirmLabel.fontSize = 32;
    confirmLabel.lineHeight = 70;
    confirmLabel.color = new Color(255, 255, 255);
    confirmLabel.horizontalAlign = HorizontalTextAlignment.CENTER;
    confirmLabel.isBold = true;

    const confirmButton = confirmBtn.addComponent(Button);
    confirmButton.transition = Button.Transition.SCALE;
    confirmButton.zoomScale = 0.95;

    console.log(
      "创建确认按钮，背景色:",
      confirmSprite.color,
      "spriteFrame:",
      sf,
    );

    // 确认按钮点击事件
    confirmBtn.on(
      Node.EventType.TOUCH_END,
      async () => {
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

        // 保存密码到配置
        this.config.room_password = password;

        // 恢复 ScrollView
        if (scrollComp) {
          scrollComp.enabled = true;
          console.log("已恢复 ScrollView 触摸");
        }

        // 清空引用并关闭弹窗
        this.passwordDialogMask = null;
        mask.destroy();

        // 创建房间
        await this.createRoomWithPassword();
      },
      this,
    );

    // 取消按钮
    const cancelBtn = new Node("cancelBtn");
    cancelBtn.parent = content;
    cancelBtn.layer = content.layer;
    cancelBtn.setPosition(new Vec3(120, -100, 0));

    const cancelTransform = cancelBtn.addComponent(UITransform);
    cancelTransform.setContentSize(new Size(180, 70));

    const cancelSprite = cancelBtn.addComponent(Sprite);
    cancelSprite.type = Sprite.Type.SIMPLE;
    cancelSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    cancelSprite.spriteFrame = sf;
    cancelSprite.color = new Color(150, 150, 150, 255); // 灰色背景

    const cancelLabelNode = new Node("label");
    cancelLabelNode.parent = cancelBtn;
    cancelLabelNode.layer = cancelBtn.layer;

    const cancelLabelTransform = cancelLabelNode.addComponent(UITransform);
    cancelLabelTransform.setContentSize(new Size(180, 70));

    const cancelLabel = cancelLabelNode.addComponent(Label);
    cancelLabel.string = "取消";
    cancelLabel.fontSize = 32;
    cancelLabel.lineHeight = 70;
    cancelLabel.color = new Color(255, 255, 255);
    cancelLabel.horizontalAlign = HorizontalTextAlignment.CENTER;
    cancelLabel.isBold = true;

    const cancelButton = cancelBtn.addComponent(Button);
    cancelButton.transition = Button.Transition.SCALE;
    cancelButton.zoomScale = 0.95;

    console.log("创建取消按钮，背景色:", cancelSprite.color);

    // 取消按钮点击事件
    cancelBtn.on(
      Node.EventType.TOUCH_END,
      () => {
        // 恢复 ScrollView
        if (scrollComp) {
          scrollComp.enabled = true;
          console.log("已恢复 ScrollView 触摸");
        }
        this.passwordDialogMask = null;
        mask.destroy();
      },
      this,
    );
  }

  /** 使用密码创建房间 */
  private async createRoomWithPassword() {
    try {
      // 先关闭可能存在的旧房间界面
      if (oops.gui.has(UIID.RoomViewComp)) {
        oops.gui.remove(UIID.RoomViewComp);
      }

      console.log("创建房间配置:", JSON.stringify(this.config, null, 2));

      const res = await HttpClient.post<RoomInfo>(NetConfig.API.ROOMS, {
        name: "自定义房间",
        ...this.config,
      });
      console.log("创建房间成功:", res.room_id);

      oops.gui.toast("房间创建成功", true);
      GameSocket.connect(res.room_id);
      oops.gui.remove(UIID.CreateRoomViewComp);
      oops.gui.open(UIID.RoomViewComp);
    } catch (e: any) {
      let msg = "创建房间失败";
      try {
        const raw = e?.message || "";
        const jsonStr = raw.substring(raw.indexOf("{"));
        const obj = JSON.parse(jsonStr);
        msg = obj.description || obj.error || msg;
      } catch {
        /* ignore parse error */
      }
      console.error("创建房间失败:", e?.message || e);
      oops.gui.toast(msg, false);
    }
  }
}
