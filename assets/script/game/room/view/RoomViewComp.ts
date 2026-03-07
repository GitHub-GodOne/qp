import {
  _decorator,
  Node,
  Label,
  UITransform,
  Size,
  Color,
  Vec3,
  Sprite,
  Button,
  EventHandler,
  HorizontalTextAlignment,
  VerticalTextAlignment,
  builtinResMgr,
  SpriteFrame,
  Texture2D,
  Widget,
  tween,
  EditBox,
  BlockInputEvents,
} from "cc";
import { gui } from "db://oops-framework/core/gui/Gui";
import { LayerType } from "db://oops-framework/core/gui/layer/LayerEnum";
import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCView } from "db://oops-framework/module/common/CCView";
import { Room } from "../Room";
import { oops } from "db://oops-framework/core/Oops";
import { UIID } from "../../common/config/GameUIConfig";
import { GameSocket } from "../../common/network/GameSocket";
import { smc } from "../../common/SingletonModuleComp";
import { GameRecordsViewComp } from "../../game_records/view/GameRecordsViewComp";
import { GameEvent } from "../../common/config/GameEvent";

const { ccclass } = _decorator;

interface PlayerInfo {
  user_pid: string;
  name: string;
  seat: number;
  is_ready: boolean;
  is_banker?: boolean;
  bet_amount?: number;
  coins?: number;
  wants_banker?: boolean | null;
}
interface CardInfo {
  suit: string;
  rank: number;
}

const SUIT_SYMBOL: Record<string, string> = {
  Spade: "S",
  Heart: "H",
  Diamond: "D",
  Club: "C",
};
const SUIT_COLOR: Record<string, Color> = {
  Spade: new Color(50, 50, 50),
  Heart: new Color(200, 30, 30),
  Diamond: new Color(200, 30, 30),
  Club: new Color(50, 50, 50),
};
const RANK_TEXT: Record<number, string> = { 1: "A", 11: "J", 12: "Q", 13: "K" };
const BULL_TEXT: Record<string, string> = {
  None: "无牛",
  Bull1: "牛一",
  Bull2: "牛二",
  Bull3: "牛三",
  Bull4: "牛四",
  Bull5: "牛五",
  Bull6: "牛六",
  Bull7: "牛七",
  Bull8: "牛八",
  Bull9: "牛九",
  BullBull: "牛牛",
  Bomb: "炸弹",
  FiveSmall: "五小牛",
};

// 椭圆围坐布局：6个座位，自己永远在底部，座位靠左，牌在右边
const SEAT_POS = [
  new Vec3(-60, 250, 0), // 顶部偏左
  new Vec3(260, 180, 0), // 右上
  new Vec3(260, -50, 0), // 右下
  new Vec3(-350, -260, 0), // 底部（自己）— 偏左，牌往右展开
  new Vec3(-400, -50, 0), // 左下
  new Vec3(-400, 180, 0), // 左上
];
// 每个座位的牌展开方向：1=向右, -1=向左
const CARD_DIR = [1, -1, -1, 1, 1, 1];
const CARD_W = 56;
const CARD_H = 82;
const HAND_Y = -210;
const HAND_START_X = -120;
const HAND_GAP = 62;
const MY_CARD_X = -120;
const MY_CARD_Y = -230; // 自己牌的起始位置
const SEAT_CARD_OFF = 100;
const SEAT_CARD_GAP = 45; // 增大间隔，让牌更容易看清
const TABLE_CENTER = new Vec3(0, 30, 0);

/** 斗牛房间视图 */
@ccclass("RoomViewComp")
@ecs.register("RoomView", false)
@gui.register("RoomView", {
  layer: LayerType.UI,
  prefab: "gui/bull_bull/bull_bull",
})
export class RoomViewComp extends CCView<Room> {
  private _myPid = "";
  private _mySeat = -1;
  private _isReady = false;
  private _sf: SpriteFrame | null = null;
  private _seats: Node[] = [];
  private _nameLabels: Label[] = [];
  private _avatarNodes: Node[] = [];
  private _avatarLabels: Label[] = [];
  private _resultNodes: Node[] = [];
  private _resultOverlay: Node | null = null;
  private _handCards: Node[] = [];
  private _statusLbl: Label | null = null;
  private _titleLbl: Label | null = null;
  private _bullLbl: Label | null = null;
  private _readyBtn: Node | null = null;
  private _startBtn: Node | null = null;
  private _handCardArea: Node | null = null;
  private _grabBankerArea: Node | null = null;
  private _bettingArea: Node | null = null;
  private _bankerPid: string = "";
  private _bankerLabels: Label[] = [];
  private _countdownLbl: Label | null = null;
  private _countdownTimer: number = 0;
  private _seatCardNodes: Node[][] = [];
  private _isRevealing = false;
  private _leaveBtn: Node | null = null;
  private _coinsLabels: Label[] = [];
  private _betLabels: Label[] = [];
  private _chatMsgs: { name: string; text: string }[] = [];
  private _chatMsgLabels: Label[] = [];
  private _chatPanel: Node | null = null;
  private _chatEditBox: EditBox | null = null;
  private _chatBody: Node | null = null;
  private _chatCollapsed: boolean = false;
  private _chatToggleLbl: Label | null = null;
  private _playerSeatMap: Map<string, number> = new Map();
  private _bubbleNodes: Node[] = [];
  private _bubbleLabels: Label[] = [];
  private _bubbleTimers: number[] = [];
  private _grabStatusNodes: Node[] = [];
  private _grabLabels: Label[] = [];
  private _rouletteRunning = false;
  private _pendingBettingData: any = null;

  start() {
    this._myPid = smc.login.LoginModel?.pid || "";
    this._sf = this.whiteSF();
    this.node.removeAllChildren();
    this.bg();
    this.topBar();
    this.table();
    this.seats();
    this.handArea();
    this.buttons();
    this.chatPanel();
    // 结果覆盖层 — 永远是最后一个子节点，确保战绩标签渲染在所有牌面之上
    this._resultOverlay = new Node("resultOverlay");
    this._resultOverlay.parent = this.node;
    this._resultOverlay.layer = this.node.layer;
    this._resultOverlay
      .addComponent(UITransform)
      .setContentSize(new Size(960, 640));
    // 将所有结果节点移入覆盖层
    for (const rn of this._resultNodes) {
      if (rn) rn.parent = this._resultOverlay;
    }
    this.listen();
    // 主动请求房间状态，防止连接时的 room_state 消息丢失
    GameSocket.send("get_room_state");
  }

  reset() {
    this.stopCountdown();
    this.clearSeatCards();
    GameSocket.clearHandlers();
    this.node.destroy();
  }

  /** 座位重映射：自己永远显示在底部(位置3) */
  private displayIdx(serverSeat: number): number {
    if (this._mySeat < 0) return serverSeat;
    return (serverSeat - this._mySeat + 3 + 6) % 6;
  }
  private serverIdx(displayPos: number): number {
    if (this._mySeat < 0) return displayPos;
    return (displayPos + this._mySeat - 3 + 6) % 6;
  }

  private whiteSF(): SpriteFrame {
    let sf = builtinResMgr.get<SpriteFrame>("ui-sprite-white");
    if (!sf) {
      sf = new SpriteFrame();
      const t = new Texture2D();
      t.reset({ width: 2, height: 2, format: Texture2D.PixelFormat.RGBA8888 });
      t.uploadData(new Uint8Array(16).fill(255));
      sf.texture = t;
    }
    return sf;
  }

  private bg() {
    const bg = this.rect(
      "bg",
      this.node,
      new Size(960, 640),
      new Color(12, 56, 30, 255),
    );
    const w = bg.addComponent(Widget);
    w.isAlignTop = w.isAlignBottom = w.isAlignLeft = w.isAlignRight = true;
    w.top = w.bottom = w.left = w.right = 0;
    // 添加 BlockInputEvents 组件阻止点击穿透到下层
    bg.addComponent(BlockInputEvents);
  }

  private topBar() {
    const bar = this.rect(
      "topBar",
      this.node,
      new Size(960, 44),
      new Color(0, 0, 0, 120),
    );
    bar.setPosition(0, 298, 0);
    const bw = bar.addComponent(Widget);
    bw.isAlignLeft = bw.isAlignRight = bw.isAlignTop = true;
    bw.left = 0;
    bw.right = 0;
    bw.top = 0;
    const back = this.rect(
      "back",
      bar,
      new Size(64, 32),
      new Color(80, 80, 80, 180),
    );
    back.setPosition(-440, 0, 0);
    const backW = back.addComponent(Widget);
    backW.isAlignLeft = true;
    backW.left = 16;
    this.lbl(
      "backT",
      back,
      "< 返回",
      16,
      new Color(230, 230, 230),
      Vec3.ZERO,
      new Size(64, 32),
    );
    const btn = back.addComponent(Button);
    btn.transition = Button.Transition.SCALE;
    btn.zoomScale = 0.9;
    const eh = new EventHandler();
    eh.target = this.node;
    eh.component = "RoomViewComp";
    eh.handler = "onBackClick";
    btn.clickEvents.push(eh);
    this._titleLbl = this.lbl(
      "title",
      bar,
      `斗牛 #${GameSocket.roomId || "---"}`,
      18,
      new Color(255, 215, 0),
      Vec3.ZERO,
      new Size(400, 32),
    );
    this._statusLbl = this.lbl(
      "status",
      bar,
      "等待中",
      14,
      new Color(180, 230, 180),
      new Vec3(300, 0, 0),
      new Size(140, 28),
    );
    this._countdownLbl = this.lbl(
      "countdown",
      this.node,
      "",
      18,
      new Color(255, 100, 100),
      new Vec3(0, TABLE_CENTER.y - 80, 0),
      new Size(140, 28),
    );
    this._countdownLbl.node.active = false;
  }

  private table() {
    const c = this.rect(
      "deck",
      this.node,
      new Size(70, 48),
      new Color(30, 110, 55, 200),
    );
    c.setPosition(TABLE_CENTER);
    this.lbl(
      "deckIcon",
      c,
      "牌堆",
      16,
      new Color(200, 200, 180),
      Vec3.ZERO,
      new Size(70, 48),
    );

    // 在牌堆下方显示底分
    const baseBetLbl = this.lbl(
      "baseBetLabel",
      this.node,
      "底分: --",
      14,
      new Color(255, 255, 100),
      new Vec3(TABLE_CENTER.x, TABLE_CENTER.y - 35, 0),
      new Size(100, 20),
    );
    baseBetLbl.node.active = true;
  }

  private seats() {
    this._seats = [];
    this._nameLabels = [];
    this._avatarNodes = [];
    this._avatarLabels = [];
    this._resultNodes = [];
    this._bankerLabels = [];
    this._coinsLabels = [];
    this._betLabels = [];
    this._grabStatusNodes = [];
    this._grabLabels = [];
    const SIDE_Y: Record<number, number> = { 1: 180, 2: -50, 4: -50, 5: 180 };
    for (let i = 0; i < 6; i++) {
      const s = this.rect(
        `s${i}`,
        this.node,
        new Size(80, 80),
        new Color(20, 20, 20, 200),
      );
      s.setPosition(SEAT_POS[i]);
      if (i === 1 || i === 2) {
        const sw = s.addComponent(Widget);
        sw.isAlignRight = true;
        sw.right = 182;
        s.setPosition(SEAT_POS[i].x, SIDE_Y[i], 0);
      } else if (i === 4 || i === 5) {
        const sw = s.addComponent(Widget);
        sw.isAlignLeft = true;
        sw.left = 42;
        s.setPosition(SEAT_POS[i].x, SIDE_Y[i], 0);
      } else if (i === 3) {
        const sw = s.addComponent(Widget);
        sw.isAlignBottom = true;
        sw.bottom = 16;
      }
      // 头像 — 居中上方
      const av = this.rect(
        `av${i}`,
        s,
        new Size(50, 50),
        new Color(70, 70, 70, 255),
      );
      av.setPosition(0, 8, 0);
      const avLbl = this.lbl(
        `avT${i}`,
        av,
        "空",
        20,
        new Color(120, 120, 120),
        Vec3.ZERO,
        new Size(50, 50),
      );
      this._avatarNodes.push(av);
      this._avatarLabels.push(avLbl);
      // 庄家标记
      const bkLbl = this.lbl(
        `bk${i}`,
        s,
        "庄",
        13,
        new Color(255, 215, 0),
        new Vec3(34, 34, 0),
        new Size(24, 20),
      );
      bkLbl.node.active = false;
      this._bankerLabels.push(bkLbl);
      // 用户名
      const nm = this.lbl(
        `nm${i}`,
        s,
        "空座",
        13,
        new Color(180, 180, 180),
        new Vec3(0, -22, 0),
        new Size(80, 18),
      );
      this._nameLabels.push(nm);
      // 金币
      const cn = this.lbl(
        `cn${i}`,
        s,
        "",
        12,
        new Color(255, 215, 0),
        new Vec3(0, -36, 0),
        new Size(80, 16),
      );
      this._coinsLabels.push(cn);
      // 下注标签 — 显示在座位上方
      const bt = this.lbl(
        `bt${i}`,
        s,
        "",
        14,
        new Color(255, 150, 50),
        new Vec3(0, 52, 0),
        new Size(76, 22),
      );
      bt.node.active = false;
      this._betLabels.push(bt);
      // 结果标签 — 挂在主节点上，确保渲染在牌面之上
      const rn = new Node(`rn${i}`);
      rn.parent = this.node;
      rn.layer = this.node.layer;
      rn.addComponent(UITransform).setContentSize(new Size(100, 20));
      rn.setPosition(0, 0, 0);
      rn.active = false;
      this._resultNodes.push(rn);
      this._seats.push(s);
      // 气泡节点 — 座位上方
      const bubble = this.rect(
        `bub${i}`,
        s,
        new Size(100, 24),
        new Color(0, 0, 0, 180),
      );
      bubble.setPosition(0, 60, 0);
      bubble.active = false;
      const bubLbl = this.lbl(
        `bubT${i}`,
        bubble,
        "",
        11,
        Color.WHITE,
        Vec3.ZERO,
        new Size(96, 22),
      );
      bubLbl.overflow = Label.Overflow.CLAMP;
      this._bubbleNodes.push(bubble);
      this._bubbleLabels.push(bubLbl);
      this._bubbleTimers.push(0);
      // 抢庄状态标签 — 座位上方
      const grabLbl = this.lbl(
        `gr${i}`,
        s,
        "",
        14,
        new Color(100, 255, 100),
        new Vec3(0, 68, 0),
        new Size(76, 22),
      );
      grabLbl.node.active = false;
      this._grabStatusNodes.push(grabLbl.node);
      this._grabLabels.push(grabLbl);
    }
  }

  /** 底部手牌区域（无额外面板，直接挂在主节点） */
  private handArea() {
    this._handCardArea = new Node("handCards");
    this._handCardArea.parent = this.node;
    this._handCardArea.layer = this.node.layer;
    this._handCardArea
      .addComponent(UITransform)
      .setContentSize(new Size(600, 90));
    this._handCardArea.setPosition(0, HAND_Y, 0);
    // 牛型标签放在居中牌扇末端之后
    const bullX = MY_CARD_X + 5 * HAND_GAP + 90; // 牌起始位置，5张牌后偏移，留出间距
    this._bullLbl = this.lbl(
      "bull",
      this.node,
      "",
      16,
      new Color(255, 255, 100),
      new Vec3(bullX, MY_CARD_Y, 0),
      new Size(200, 30),
    );
    this._bullLbl.horizontalAlign = HorizontalTextAlignment.LEFT;
  }

  private buttons() {
    // 所有按钮组共用同一中心位置
    const centerX = 0;
    const centerY = -310;
    this._readyBtn = this.btn(
      "readyBtn",
      "准 备",
      new Vec3(centerX - 80, centerY, 0),
      new Color(40, 130, 80),
      "onReadyClick",
    );
    this._startBtn = null;
    this._leaveBtn = this.btn(
      "leaveBtn",
      "离开房间",
      new Vec3(centerX + 80, centerY, 0),
      new Color(150, 45, 45),
      "onLeaveClick",
    );

    this._grabBankerArea = new Node("grabBankerArea");
    this._grabBankerArea.parent = this.node;
    this._grabBankerArea.layer = this.node.layer;
    this._grabBankerArea
      .addComponent(UITransform)
      .setContentSize(new Size(400, 50));
    this._grabBankerArea.setPosition(centerX, centerY, 0);
    this._grabBankerArea.active = false;
    this.btn(
      "grabYes",
      "抢 庄",
      new Vec3(-80, 0, 0),
      new Color(200, 130, 20),
      "onGrabYes",
    ).parent = this._grabBankerArea;
    this.btn(
      "grabNo",
      "不 抢",
      new Vec3(80, 0, 0),
      new Color(100, 100, 100),
      "onGrabNo",
    ).parent = this._grabBankerArea;

    this._bettingArea = new Node("bettingArea");
    this._bettingArea.parent = this.node;
    this._bettingArea.layer = this.node.layer;
    this._bettingArea
      .addComponent(UITransform)
      .setContentSize(new Size(500, 50));
    this._bettingArea.setPosition(centerX, centerY, 0);
    this._bettingArea.active = false;
    this.btn(
      "bet3",
      "3 分",
      new Vec3(-120, 0, 0),
      new Color(40, 130, 80),
      "onBet3",
    ).parent = this._bettingArea;
    this.btn(
      "bet6",
      "6 分",
      new Vec3(0, 0, 0),
      new Color(170, 130, 20),
      "onBet6",
    ).parent = this._bettingArea;
    this.btn(
      "bet10",
      "10 分",
      new Vec3(120, 0, 0),
      new Color(200, 60, 30),
      "onBet10",
    ).parent = this._bettingArea;
  }

  private listen() {
    GameSocket.on("room_state", (d: any) => {
      // 检查节点是否还有效
      if (!this.node || !this.node.isValid || !this._titleLbl) return;
      if (d.room_id) this._titleLbl!.string = `斗牛 #${d.room_id}`;
      if (d.players) this.syncPlayers(d.players);
      if (d.status) this.setStatus(d.status);
      if (d.banker_pid) this._bankerPid = d.banker_pid;

      // 更新底分显示
      console.log("收到 room_state 消息, base_bet:", d.base_bet);
      if (d.base_bet !== undefined) {
        const baseBetLbl = this.node
          .getChildByName("baseBetLabel")
          ?.getComponent(Label);
        if (baseBetLbl) {
          baseBetLbl.string = `底分: ${d.base_bet}`;
          console.log("已更新底分显示:", baseBetLbl.string);
        } else {
          console.error("未找到 baseBetLabel 节点");
        }
      } else {
        console.warn("room_state 消息中没有 base_bet 字段");
      }

      // Phase recovery: if we missed a phase-specific event, sync UI from room_state
      const myData = d.players?.find((p: any) => p.user_pid === this._myPid);
      if (
        d.phase === "GrabBanker" &&
        !this._grabBankerArea!.active &&
        !this._bettingArea!.active
      ) {
        // Only show grab banker UI if I haven't responded yet
        if (myData && myData.wants_banker == null) {
          this.dismissResultPanel();
          this.setStatus("抢庄中");
          this._readyBtn!.active = false;
          if (this._startBtn) this._startBtn.active = false;
          this._leaveBtn!.active = false;
          this._grabBankerArea!.active = true;
          this._bettingArea!.active = false;
          this.startCountdown(10);
        }
      } else if (
        d.phase === "Betting" &&
        !this._bettingArea!.active &&
        !this._grabBankerArea!.active
      ) {
        // Only show betting UI if I'm not banker and haven't bet yet
        if (myData && !myData.is_banker && myData.bet_amount == null) {
          this._grabBankerArea!.active = false;
          this._readyBtn!.active = false;
          if (this._startBtn) this._startBtn.active = false;
          this._leaveBtn!.active = false;
          this._bettingArea!.active = true;
          this.startCountdown(10);
        }
      }
    });
    GameSocket.on("player_joined", (d: any) => {
      if (!this.node || !this.node.isValid) return;
      if (d.players) this.syncPlayers(d.players);
    });
    GameSocket.on("player_left", (d: any) => {
      if (!this.node || !this.node.isValid) return;
      if (d.players) this.syncPlayers(d.players);
    });
    GameSocket.on("player_ready", (d: any) => {
      if (!this.node || !this.node.isValid) return;
      if (d.players) this.syncPlayers(d.players);
    });
    GameSocket.on("grab_banker_phase", (d: any) => {
      if (!this.node || !this.node.isValid) return;
      this.dismissResultPanel();
      this.setStatus("抢庄中");
      this._readyBtn!.active = false;
      if (this._startBtn) this._startBtn.active = false;
      this._leaveBtn!.active = false;
      this._grabBankerArea!.active = true;
      this._bettingArea!.active = false;
      for (let i = 0; i < 6; i++) {
        if (this._grabLabels[i]) this._grabLabels[i].node.active = false;
      }
      this.startCountdown(d.countdown_secs || 10);
    });
    GameSocket.on("banker_selected", (d: any) => {
      if (!this.node || !this.node.isValid) return;
      this._bankerPid = d.banker_pid || "";
      this._grabBankerArea!.active = false;
      this.stopCountdown();
      // 隐藏所有抢庄标签
      for (let i = 0; i < 6; i++) {
        if (this._grabLabels[i]) this._grabLabels[i].node.active = false;
        if (this._bankerLabels[i]) this._bankerLabels[i].node.active = false;
      }
      const candidates: { user_pid: string; seat: number }[] =
        d.candidates || [];
      const bankerPid = d.banker_pid || "";
      if (candidates.length > 1) {
        this.rouletteSelectBanker(candidates, bankerPid);
      } else {
        this.showBankerMark(bankerPid);
        this.setStatus("庄家已选");
      }
    });
    GameSocket.on("betting_phase", (d: any) => {
      if (!this.node || !this.node.isValid) return;
      // 如果选庄动画还在播放，暂存下注数据，等动画结束再显示
      if (this._rouletteRunning) {
        this._pendingBettingData = d;
        return;
      }
      this.showBettingPhase(d);
    });
    GameSocket.on("all_bets_placed", (_d: any) => {
      if (!this.node || !this.node.isValid) return;
      this._bettingArea!.active = false;
      this.stopCountdown();
      this.setStatus("发牌中");
    });
    GameSocket.on("dealing_start", (d: any) => {
      if (!this.node || !this.node.isValid) return;
      this.clearSeatCards();
      const players: { user_pid: string; seat: number }[] = d.players || [];
      for (const p of players) {
        this.dealCardBacksToSeat(this.displayIdx(p.seat), 5, 0.1);
      }
    });
    GameSocket.on("game_started", (d: any) => {
      if (!this.node || !this.node.isValid) return;
      if (d.target_pid && d.target_pid !== this._myPid) return;
      const hand: CardInfo[] = d.hand || [];
      this.setStatus("游戏中");
      this.dealCards(hand);
    });
    GameSocket.on("reveal_start", (_d: any) => {
      if (!this.node || !this.node.isValid) return;
      this._isRevealing = true;
      this.setStatus("亮牌中");
    });
    GameSocket.on("reveal_player", (d: any) => {
      if (!this.node || !this.node.isValid) return;
      this.revealPlayer(d);
    });
    GameSocket.on("game_result", (d: any) => {
      if (!this.node || !this.node.isValid) return;
      this._isRevealing = false;
      this.showResult(d.players || []);
      this.setStatus("已结束");

      // 金币不足检测，延迟3秒自动退出
      const myPlayer = (d.players || []).find(
        (p: any) => p.user_pid === this._myPid,
      );
      if (myPlayer && myPlayer.coins < 300) {
        setTimeout(() => {
          this.dismissResultPanel();
          GameSocket.send("leave_room");
          GameSocket.close();
          oops.message.dispatchEvent(GameEvent.UserInfoChanged);
          oops.gui.remove(UIID.RoomViewComp);
          oops.gui.toast("金币不足300，已自动退出房间", false);
        }, 3000);
        return;
      }
      // 恢复准备/离开按钮（战绩面板关闭或新游戏开始时清理牌面）
      if (this._readyBtn) {
        this._readyBtn.active = true;
        this._readyBtn.setSiblingIndex(this.node.children.length - 1);
      }
      if (this._leaveBtn) {
        this._leaveBtn.active = true;
        this._leaveBtn.setSiblingIndex(this.node.children.length - 1);
      }
      // 结果覆盖层保持最顶
      if (this._resultOverlay)
        this._resultOverlay.setSiblingIndex(this.node.children.length - 1);
      this._isReady = false;
      const bl = this._readyBtn
        ?.getChildByName("readyBtn_lbl")
        ?.getComponent(Label);
      if (bl) bl.string = "准 备";
    });
    GameSocket.on("error", (d: any) => {
      console.error("[Room] error:", d.error || d);
    });
    GameSocket.on("chat_message", (d: any) => {
      if (!this.node || !this.node.isValid) return;
      this.addChatMsg(d.name || "???", d.text || "");
      this.showBubble(d.user_pid || "", d.text || "");
    });
    GameSocket.on("kicked", (d: any) => {
      if (d.target_pid && d.target_pid !== this._myPid) return;
      const reason = d.reason || "您已被移出房间";
      console.warn("[Room] kicked:", reason);
      this.closeRecordsDialog();
      GameSocket.close();
      oops.message.dispatchEvent(GameEvent.UserInfoChanged);
      oops.gui.remove(UIID.RoomViewComp);
      oops.gui.toast(reason, false);
    });
  }

  private bullText(raw: string): string {
    return BULL_TEXT[raw] || raw || "无牛";
  }

  private syncPlayers(players: PlayerInfo[]) {
    // 检测自己的座位
    const me = players.find((x) => x.user_pid === this._myPid);
    if (me && this._mySeat < 0) this._mySeat = me.seat;

    // 维护 user_pid → seat 映射
    this._playerSeatMap.clear();
    for (const p of players) this._playerSeatMap.set(p.user_pid, p.seat);

    for (let i = 0; i < 6; i++) {
      const nm = this._nameLabels[i];
      const av = this._avatarNodes[i];
      const avLbl = this._avatarLabels[i];
      const bkLbl = this._bankerLabels[i];
      const cnLbl = this._coinsLabels[i];
      const betLbl = this._betLabels[i];
      if (!nm) continue;
      const serverSeat = this.serverIdx(i);
      const p = players.find((x) => x.seat === serverSeat);
      if (p) {
        const isMe = p.user_pid === this._myPid;
        nm.string = isMe ? `${p.name}(我)` : p.name;
        nm.color = Color.WHITE;
        cnLbl.string = `${p.coins ?? 0} 币`;
        if (bkLbl) bkLbl.node.active = !this._rouletteRunning && !!p.is_banker;
        // 下注显示
        if (p.bet_amount) {
          betLbl.string = `${p.bet_amount}分`;
          betLbl.node.active = true;
        } else if (p.is_banker) {
          betLbl.string = "庄家";
          betLbl.color = new Color(255, 215, 0);
          betLbl.node.active = true;
        } else {
          betLbl.node.active = false;
        }
        // 抢庄状态显示
        const grabLbl = this._grabLabels[i];
        if (grabLbl) {
          if (p.wants_banker === true) {
            grabLbl.string = "抢庄";
            grabLbl.color = new Color(100, 255, 100);
            grabLbl.node.active = true;
          } else if (p.wants_banker === false) {
            grabLbl.string = "不抢";
            grabLbl.color = new Color(150, 150, 150);
            grabLbl.node.active = true;
          } else {
            grabLbl.node.active = false;
          }
        }
        const firstChar = p.name.charAt(0) || "P";
        const sp = av?.getComponent(Sprite);
        if (p.is_offline) {
          avLbl.string = "离线";
          avLbl.fontSize = 13;
          avLbl.color = new Color(180, 80, 80);
          if (sp) sp.color = new Color(60, 40, 40);
          nm.color = new Color(120, 120, 120);
        } else if (p.is_ready) {
          avLbl.string = "准备";
          avLbl.fontSize = 13;
          avLbl.color = new Color(100, 255, 100);
          if (sp) sp.color = new Color(40, 120, 60);
        } else {
          avLbl.string = firstChar;
          avLbl.fontSize = 18;
          avLbl.color = Color.WHITE;
          if (sp) sp.color = new Color(70, 70, 70);
        }
      } else {
        nm.string = "空座";
        nm.color = new Color(140, 140, 140);
        cnLbl.string = "";
        betLbl.node.active = false;
        if (this._grabLabels[i]) this._grabLabels[i].node.active = false;
        avLbl.string = "空";
        avLbl.fontSize = 16;
        avLbl.color = new Color(120, 120, 120);
        const sp = av?.getComponent(Sprite);
        if (sp) sp.color = new Color(70, 70, 70);
        if (bkLbl) bkLbl.node.active = false;
      }
    }
    this._statusLbl!.string = `${players.length}/6 人`;
  }

  private setStatus(s: string) {
    const m: Record<string, string> = {
      Waiting: "等待准备",
      Playing: "游戏中",
      Finished: "已结束",
      GrabBanker: "抢庄中",
      Betting: "下注中",
      Dealing: "发牌中",
    };
    this._statusLbl!.string = m[s] || s;
  }

  private dealCards(hand: CardInfo[]) {
    this._handCards.forEach((n) => n.destroy());
    this._handCards = [];
    this._bullLbl!.string = "";
    const myDispIdx = 3;
    const seatPos = SEAT_POS[myDispIdx];

    // 斗牛规则：左3张凑整数，右2张显示牛数，中间留间隔
    const leftGroup = 3;
    const groupGap = 20; // 两组之间的额外间隔

    // 复用 dealing_start 阶段已发到位的暗牌，逐张翻转亮牌
    const existingBacks = this._seatCardNodes[myDispIdx];
    if (existingBacks && existingBacks.length >= hand.length) {
      for (let i = 0; i < hand.length; i++) {
        const node = existingBacks[i];
        const c = hand[i];
        this._handCards.push(node);

        // 重新计算位置，按分组显示
        let tx: number;
        if (i < leftGroup) {
          // 左边3张：0, 1, 2
          tx = MY_CARD_X + i * HAND_GAP;
        } else {
          // 右边的牌：3, 4 -> 从第4张位置开始，加上间隔
          const rightIdx = i - leftGroup; // 0, 1
          tx =
            MY_CARD_X + leftGroup * HAND_GAP + groupGap + rightIdx * HAND_GAP;
        }
        node.setPosition(tx, MY_CARD_Y, 0);

        tween(node)
          .delay(i * 0.2)
          .call(() => this.flip(node, c))
          .start();
      }
      this._seatCardNodes[myDispIdx] = [];
    } else {
      // fallback: 没有暗牌时直接在目标位置创建并翻转
      for (let i = 0; i < hand.length; i++) {
        const c = hand[i];
        const node = this.cardBack(i);
        node.parent = this.node;
        this.setLayerRecursive(node, this.node.layer);

        // 按分组计算位置
        let tx: number;
        if (i < leftGroup) {
          // 左边3张：0, 1, 2
          tx = MY_CARD_X + i * HAND_GAP;
        } else {
          // 右边的牌：3, 4 -> 从第4张位置开始，加上间隔
          const rightIdx = i - leftGroup; // 0, 1
          tx =
            MY_CARD_X + leftGroup * HAND_GAP + groupGap + rightIdx * HAND_GAP;
        }
        const ty = MY_CARD_Y;
        node.setPosition(tx, ty, 0);
        node.setScale(1, 1, 1);
        this._handCards.push(node);
        tween(node)
          .delay(i * 0.2)
          .call(() => this.flip(node, c))
          .start();
      }
    }
    // 确保结果覆盖层始终在最顶层
    if (this._resultOverlay)
      this._resultOverlay.setSiblingIndex(this.node.children.length - 1);
  }

  private cardBack(i: number): Node {
    const n = this.rect(
      `cb${i}`,
      null!,
      new Size(CARD_W, CARD_H),
      new Color(30, 30, 30),
    );
    const inner = this.rect(
      `cbi${i}`,
      n,
      new Size(CARD_W - 4, CARD_H - 4),
      new Color(55, 70, 150),
    );
    inner.setPosition(0, 0, 0);
    this.lbl(
      `cbT${i}`,
      inner,
      "背",
      18,
      new Color(35, 50, 120),
      Vec3.ZERO,
      new Size(CARD_W - 4, CARD_H - 4),
    );
    return n;
  }

  private flip(node: Node, c: CardInfo) {
    tween(node)
      .to(0.12, { scale: new Vec3(0, 1, 1) })
      .call(() => this.cardFace(node, c))
      .to(0.12, { scale: new Vec3(1, 1, 1) })
      .start();
  }

  private cardFace(node: Node, c: CardInfo) {
    node.removeAllChildren();
    const sp = node.getComponent(Sprite);
    if (sp) sp.color = new Color(60, 60, 60);
    const face = this.rect(
      "face",
      node,
      new Size(CARD_W - 4, CARD_H - 4),
      new Color(248, 248, 244),
    );
    face.setPosition(0, 0, 0);
    const suit = SUIT_SYMBOL[c.suit] || c.suit;
    const clr = SUIT_COLOR[c.suit] || new Color(50, 50, 50);
    const rank = RANK_TEXT[c.rank] || c.rank.toString();
    this.lbl("s1", face, suit, 12, clr, new Vec3(-14, 26, 0), new Size(18, 16));
    this.lbl("r", face, rank, 20, clr, new Vec3(0, -2, 0), new Size(28, 26));
    this.lbl("s2", face, suit, 12, clr, new Vec3(14, -26, 0), new Size(18, 16));
  }

  private showResult(players: any[]) {
    // 确保结果覆盖层在最顶层
    if (this._resultOverlay)
      this._resultOverlay.setSiblingIndex(this.node.children.length - 1);
    // 隐藏所有旧的单独结果节点
    for (const rn of this._resultNodes) {
      if (rn) {
        rn.removeAllChildren();
        rn.active = false;
      }
    }
    // 自己的牛型仍用 _bullLbl 显示
    const me = players.find((p: any) => p.user_pid === this._myPid);
    if (me) {
      const bt = this.bullText(me.bull_type);
      const role = me.is_banker ? "[庄]" : `[${me.bet_amount || 0}分]`;
      const cc = me.coin_change ?? 0;
      const ccStr = cc >= 0 ? `+${cc}` : `${cc}`;
      this._bullLbl!.string = `${role} ${bt} ${ccStr}`;
      this._bullLbl!.color =
        cc >= 0 ? new Color(100, 255, 100) : new Color(255, 80, 80);
    }
    // 对手座位显示牛型 + 金币变化
    for (const p of players) {
      if (p.user_pid === this._myPid) continue;
      const dispIdx = this.displayIdx(p.seat);
      const seatNode = this._seats[dispIdx];
      if (!seatNode) continue;
      const seatPos = seatNode.position;
      const rn = this._resultNodes[dispIdx];
      if (!rn) continue;
      rn.removeAllChildren();
      rn.active = true;
      const ut = rn.getComponent(UITransform) || rn.addComponent(UITransform);
      ut.setContentSize(new Size(140, 28));
      const bt = this.bullText(p.bull_type);
      const role = p.is_banker ? "庄" : `${p.bet_amount || 0}分`;
      const cc = p.coin_change ?? 0;
      const ccStr = cc >= 0 ? `+${cc}` : `${cc}`;
      const ccColor =
        cc >= 0 ? new Color(100, 255, 100) : new Color(255, 80, 80);
      const cardCenterX = this.seatCardCenterX(dispIdx, seatPos, 5);
      rn.setPosition(cardCenterX, seatPos.y - CARD_H / 2 - 18, 0);
      this.rect(
        `rsbg${dispIdx}`,
        rn,
        new Size(140, 28),
        new Color(0, 0, 0, 180),
      );
      this.lbl(
        `rsbl${dispIdx}`,
        rn,
        `[${role}] ${bt} ${ccStr}`,
        13,
        ccColor,
        Vec3.ZERO,
        new Size(136, 28),
      );
    }
    // 牌面保留，等下局开始或离开房间时再清理
    // 居中战绩面板
    const sorted = [...players].sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));
    const rowH = 28;
    const panelH = sorted.length * rowH + 36;
    const panelW = 360;
    const panel = this.rect(
      "resultPanel",
      this._resultOverlay!,
      new Size(panelW, panelH),
      new Color(0, 0, 0, 200),
    );
    panel.setPosition(TABLE_CENTER.x, TABLE_CENTER.y, 0);
    this.lbl(
      "rpTitle",
      panel,
      "— 本局战绩 —",
      15,
      new Color(255, 215, 0),
      new Vec3(0, panelH / 2 - 16, 0),
      new Size(panelW, 24),
    );
    // X 关闭按钮
    const closeBtn = this.rect(
      "rpClose",
      panel,
      new Size(28, 28),
      new Color(150, 50, 50, 200),
    );
    closeBtn.setPosition(panelW / 2 - 18, panelH / 2 - 16, 0);
    this.lbl(
      "rpCloseT",
      closeBtn,
      "×",
      18,
      Color.WHITE,
      Vec3.ZERO,
      new Size(28, 28),
    );
    const cb = closeBtn.addComponent(Button);
    cb.transition = Button.Transition.SCALE;
    cb.zoomScale = 0.9;
    const ceh = new EventHandler();
    ceh.target = this.node;
    ceh.component = "RoomViewComp";
    ceh.handler = "onDismissResult";
    cb.clickEvents.push(ceh);
    const startY = panelH / 2 - 36;
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      const bs = this.bullText(p.bull_type);
      const role = p.is_banker ? "庄" : `${p.bet_amount || 0}分`;
      const cc = p.coin_change ?? 0;
      const ccStr = cc >= 0 ? `+${cc}` : `${cc}`;
      const isMe = p.user_pid === this._myPid;
      const ccColor =
        cc >= 0 ? new Color(100, 255, 100) : new Color(255, 80, 80);
      const nameStr = isMe ? `${p.name}(我)` : p.name;
      const rowY = startY - i * rowH;
      // 名字左对齐
      this.lbl(
        `rpn${i}`,
        panel,
        nameStr,
        13,
        isMe ? new Color(255, 230, 100) : Color.WHITE,
        new Vec3(-90, rowY, 0),
        new Size(110, rowH),
      );
      // 牛型 + 角色
      this.lbl(
        `rpb${i}`,
        panel,
        `[${role}] ${bs}`,
        13,
        new Color(220, 220, 200),
        new Vec3(30, rowY, 0),
        new Size(120, rowH),
      );
      // 金币变化
      this.lbl(
        `rpc${i}`,
        panel,
        ccStr,
        14,
        ccColor,
        new Vec3(125, rowY, 0),
        new Size(60, rowH),
      );
    }
    // 更新所有玩家金币
    for (const p of players) {
      const dispIdx = this.displayIdx(p.seat);
      const cnLbl = this._coinsLabels[dispIdx];
      if (cnLbl && p.coins != null) cnLbl.string = `${p.coins} 币`;
      const ss = this._seats[dispIdx]?.getComponent(Sprite);
      const bs = this.bullText(p.bull_type);
      if (ss && (bs === "牛牛" || bs === "炸弹" || bs === "五小牛")) {
        ss.color = new Color(80, 65, 10, 230);
      }
    }
  }

  private closeRecordsDialog() {
    oops.gui.remove(UIID.GameRecordsViewComp);
  }

  /** 关闭居中战绩面板并清理牌面状态 */
  private dismissResultPanel() {
    if (this._resultOverlay) {
      const panel = this._resultOverlay.getChildByName("resultPanel");
      if (panel) panel.destroy();
    }
    for (const rn of this._resultNodes) {
      if (rn) {
        rn.removeAllChildren();
        rn.active = false;
      }
    }
    this.clearSeatCards();
    this._handCards.forEach((n) => n.destroy());
    this._handCards = [];
    if (this._bullLbl) this._bullLbl.string = "";
    for (let i = 0; i < 6; i++) {
      const ss = this._seats[i]?.getComponent(Sprite);
      if (ss) ss.color = new Color(20, 20, 20, 200);
      if (this._bankerLabels[i]) this._bankerLabels[i].node.active = false;
      if (this._betLabels[i]) this._betLabels[i].node.active = false;
      if (this._grabLabels[i]) this._grabLabels[i].node.active = false;
    }
  }

  protected onDismissResult() {
    this.dismissResultPanel();
  }

  protected onBackClick() {
    this.stopCountdown();
    GameSocket.clearHandlers();
    this.closeRecordsDialog();
    GameSocket.send("leave_room");
    GameSocket.close();
    oops.message.dispatchEvent(GameEvent.UserInfoChanged);
    oops.gui.remove(UIID.RoomViewComp);
  }
  protected onReadyClick() {
    this.closeRecordsDialog();
    this._isReady = !this._isReady;
    GameSocket.send("ready", { ready: this._isReady });
    for (let i = 0; i < 6; i++) {
      const nm = this._nameLabels[i];
      if (nm && nm.string.includes("(我)")) {
        const avLbl = this._avatarLabels[i];
        const sp = this._avatarNodes[i]?.getComponent(Sprite);
        if (this._isReady) {
          avLbl.string = "准备";
          avLbl.fontSize = 13;
          avLbl.color = new Color(100, 255, 100);
          if (sp) sp.color = new Color(40, 120, 60);
        } else {
          avLbl.string = "我";
          avLbl.fontSize = 18;
          avLbl.color = Color.WHITE;
          if (sp) sp.color = new Color(70, 70, 70);
        }
      }
    }
    const bl = this._readyBtn
      ?.getChildByName("readyBtn_lbl")
      ?.getComponent(Label);
    if (bl) bl.string = this._isReady ? "取消准备" : "准 备";
  }
  protected onStartClick() {
    this.closeRecordsDialog();
    GameSocket.send("start_game");
  }
  protected onGrabYes() {
    GameSocket.send("grab_banker", { wants: true });
    this._grabBankerArea!.active = false;
    this.stopCountdown();
    // 乐观更新：自己座位显示"抢庄"
    const myDisp = this.displayIdx(this._mySeat);
    if (this._grabLabels[myDisp]) {
      this._grabLabels[myDisp].string = "抢庄";
      this._grabLabels[myDisp].color = new Color(100, 255, 100);
      this._grabLabels[myDisp].node.active = true;
    }
    this.setStatus("等待其他玩家...");
  }
  protected onGrabNo() {
    GameSocket.send("grab_banker", { wants: false });
    this._grabBankerArea!.active = false;
    this.stopCountdown();
    // 乐观更新：自己座位显示"不抢"
    const myDisp = this.displayIdx(this._mySeat);
    if (this._grabLabels[myDisp]) {
      this._grabLabels[myDisp].string = "不抢";
      this._grabLabels[myDisp].color = new Color(150, 150, 150);
      this._grabLabels[myDisp].node.active = true;
    }
    this.setStatus("等待其他玩家...");
  }
  protected onBet3() {
    this.placeBet(3);
  }
  protected onBet6() {
    this.placeBet(6);
  }
  protected onBet10() {
    this.placeBet(10);
  }
  private placeBet(amount: number) {
    GameSocket.send("set_bet", { amount });
    this._bettingArea!.active = false;
    this.stopCountdown();
    this.setStatus("等待其他玩家下注...");
  }
  private showBettingPhase(d: any) {
    this.setStatus("下注中");
    this._grabBankerArea!.active = false;
    if (this._myPid !== (d.banker_pid || "")) {
      this._bettingArea!.active = true;
    } else {
      this.setStatus("等待闲家下注");
    }
    this.startCountdown(d.countdown_secs || 10);
  }
  protected onLeaveClick() {
    this.stopCountdown();
    GameSocket.clearHandlers();
    this.closeRecordsDialog();
    GameSocket.send("leave_room");
    GameSocket.close();
    oops.message.dispatchEvent(GameEvent.UserInfoChanged);
    oops.gui.remove(UIID.RoomViewComp);
  }

  private startCountdown(seconds: number) {
    this.stopCountdown();
    if (!this._countdownLbl) return;
    let remaining = seconds;
    this._countdownLbl.string = `倒计时 ${remaining}s`;
    this._countdownLbl.node.active = true;
    this._countdownLbl.color = new Color(255, 255, 255);
    this._countdownTimer = setInterval(() => {
      if (!this._countdownLbl || !this._countdownLbl.isValid) {
        this.stopCountdown();
        return;
      }
      remaining--;
      if (remaining <= 0) {
        this.stopCountdown();
        // 超时自动显示
        const myDisp = this.displayIdx(this._mySeat);
        if (this._grabBankerArea && this._grabBankerArea.active) {
          this._grabBankerArea.active = false;
          if (this._grabLabels[myDisp]) {
            this._grabLabels[myDisp].string = "不抢";
            this._grabLabels[myDisp].color = new Color(150, 150, 150);
            this._grabLabels[myDisp].node.active = true;
          }
        }
        if (this._bettingArea && this._bettingArea.active) {
          this._bettingArea.active = false;
          if (this._betLabels[myDisp]) {
            this._betLabels[myDisp].string = "3分";
            this._betLabels[myDisp].node.active = true;
          }
        }
        return;
      }
      this._countdownLbl.string = `倒计时 ${remaining}s`;
      if (remaining <= 3) this._countdownLbl.color = new Color(255, 60, 60);
    }, 1000) as unknown as number;
  }

  private stopCountdown() {
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer);
      this._countdownTimer = 0;
    }
    if (this._countdownLbl) this._countdownLbl.node.active = false;
  }

  private showBankerMark(bankerPid: string) {
    const serverSeat = this._playerSeatMap.get(bankerPid);
    if (serverSeat == null) return;
    const dispIdx = this.displayIdx(serverSeat);
    if (this._bankerLabels[dispIdx]) {
      const bkNode = this._bankerLabels[dispIdx].node;
      bkNode.active = true;
      // 放大再缩小的弹跳动画，突出庄家标记
      bkNode.setScale(0.5, 0.5, 1);
      tween(bkNode)
        .to(0.25, { scale: new Vec3(2.2, 2.2, 1) }, { easing: "backOut" })
        .to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: "cubicIn" })
        .start();
    }
    // 恢复所有座位背景
    for (let i = 0; i < 6; i++) {
      const sp = this._seats[i]?.getComponent(Sprite);
      if (sp) sp.color = new Color(20, 20, 20, 200);
    }
  }

  private rouletteSelectBanker(
    candidates: { user_pid: string; seat: number }[],
    bankerPid: string,
  ) {
    this.setStatus("选庄中...");
    this._rouletteRunning = true;
    const dispIndices = candidates.map((c) => this.displayIdx(c.seat));
    const bankerSeat = this._playerSeatMap.get(bankerPid);
    const bankerDisp =
      bankerSeat != null ? this.displayIdx(bankerSeat) : dispIndices[0];
    // 构建轮盘序列：快速轮转候选人，最终停在 banker
    const steps: number[] = [];
    const totalCycles = 3; // 转3圈
    for (let c = 0; c < totalCycles; c++) {
      for (const di of dispIndices) steps.push(di);
    }
    // 确保最后停在 banker
    // 移除末尾直到最后一个不是 bankerDisp，再加上 bankerDisp
    while (steps.length > 0 && steps[steps.length - 1] === bankerDisp)
      steps.pop();
    steps.push(bankerDisp);
    let stepIdx = 0;
    const totalSteps = steps.length;
    const highlight = (idx: number) => {
      // 清除所有候选人高亮
      for (const di of dispIndices) {
        const sp = this._seats[di]?.getComponent(Sprite);
        if (sp) sp.color = new Color(20, 20, 20, 200);
      }
      // 高亮当前
      const sp = this._seats[idx]?.getComponent(Sprite);
      if (sp) sp.color = new Color(180, 160, 30, 230);
    };
    const doStep = () => {
      if (stepIdx >= totalSteps) {
        this._rouletteRunning = false;
        this.showBankerMark(bankerPid);
        this.setStatus("庄家已选");
        // 处理在动画期间收到的下注阶段
        if (this._pendingBettingData) {
          const data = this._pendingBettingData;
          this._pendingBettingData = null;
          // 延迟一小段让玩家看清庄家标记
          setTimeout(() => this.showBettingPhase(data), 800);
        }
        return;
      }
      highlight(steps[stepIdx]);
      // 间隔从 80ms 逐渐增大到 300ms
      const progress = stepIdx / Math.max(totalSteps - 1, 1);
      const delay = 80 + progress * 220;
      stepIdx++;
      setTimeout(doStep, delay);
    };
    doStep();
  }

  private dealCardBacksToSeat(dispIdx: number, count: number, delay: number) {
    const seatNode = this._seats[dispIdx];
    if (!seatNode) return;
    const cards: Node[] = [];
    const dir = CARD_DIR[dispIdx] || 1;
    const isSelf = dispIdx === 3;
    const seatPos = isSelf ? SEAT_POS[dispIdx] : seatNode.position;
    for (let i = 0; i < count; i++) {
      const card = this.cardBack(100 + dispIdx * 10 + i);
      card.parent = this.node;
      this.setLayerRecursive(card, this.node.layer);
      card.setPosition(TABLE_CENTER);
      card.setScale(0.3, 0.3, 1);
      cards.push(card);
      const tx = isSelf
        ? MY_CARD_X + i * HAND_GAP
        : dir < 0
          ? seatPos.x - SEAT_CARD_OFF - (count - 1 - i) * SEAT_CARD_GAP
          : seatPos.x + SEAT_CARD_OFF + i * SEAT_CARD_GAP;
      const ty = isSelf ? MY_CARD_Y : seatPos.y;
      const targetScale = isSelf ? new Vec3(1, 1, 1) : new Vec3(0.7, 0.7, 1);
      tween(card)
        .delay(i * delay)
        .to(
          0.3,
          { position: new Vec3(tx, ty, 0), scale: targetScale },
          { easing: "cubicOut" },
        )
        .start();
    }
    this._seatCardNodes[dispIdx] = cards;
    // 确保结果覆盖层始终在最顶层
    if (this._resultOverlay)
      this._resultOverlay.setSiblingIndex(this.node.children.length - 1);
  }

  private clearSeatCards() {
    for (const cards of this._seatCardNodes) {
      if (cards)
        cards.forEach((n) => {
          if (n.isValid) n.destroy();
        });
    }
    this._seatCardNodes = [];
  }

  private revealPlayer(d: any) {
    const serverSeat: number = d.seat;
    const dispIdx = this.displayIdx(serverSeat);
    const hand: CardInfo[] = d.arranged_hand || d.hand || [];
    const bullType: string = d.bull_type || "None";
    const isBanker: boolean = d.is_banker || false;
    const userPid: string = d.user_pid || "";

    const oldCards = this._seatCardNodes[dispIdx];
    if (oldCards) {
      oldCards.forEach((n) => {
        if (n.isValid) n.destroy();
      });
      this._seatCardNodes[dispIdx] = [];
    }

    if (userPid === this._myPid) {
      const bt = this.bullText(bullType);
      this._bullLbl!.string = `${isBanker ? "[庄]" : ""} ${bt}`;
      this._bullLbl!.color =
        bt === "牛牛" ? new Color(255, 200, 50) : new Color(255, 255, 100);
      return;
    }

    const seatNode = this._seats[dispIdx];
    const seatPos = seatNode ? seatNode.position : SEAT_POS[dispIdx];
    if (!seatPos) return;
    const dir = CARD_DIR[dispIdx] || 1;
    const newCards: Node[] = [];

    // 斗牛规则：左3张凑整数，右2张显示牛数，中间留间隔
    const leftGroup = 3; // 左边3张
    const groupGap = 15; // 两组之间的额外间隔

    for (let i = 0; i < hand.length; i++) {
      const c = hand[i];
      // 深色边框 + 白色牌面，2px边框提供层叠分隔感
      const card = this.rect(
        `rv${dispIdx}_${i}`,
        this.node,
        new Size(CARD_W, CARD_H),
        new Color(60, 60, 60),
      );
      const face = this.rect(
        `rvf${dispIdx}_${i}`,
        card,
        new Size(CARD_W - 2, CARD_H - 2),
        new Color(248, 248, 244),
      );
      face.setPosition(0, 0, 0);

      // 计算X位置：左3张一组，右2张一组，中间留间隔
      let tx: number;
      if (i < leftGroup) {
        // 左边3张：正常排列
        tx =
          dir < 0
            ? seatPos.x - SEAT_CARD_OFF - (leftGroup - 1 - i) * SEAT_CARD_GAP
            : seatPos.x + SEAT_CARD_OFF + i * SEAT_CARD_GAP;
      } else {
        // 右边的牌：从第4张开始，加上额外间隔
        const rightIdx = i - leftGroup; // 0, 1, 2...
        tx =
          dir < 0
            ? seatPos.x -
              SEAT_CARD_OFF -
              (leftGroup - 1) * SEAT_CARD_GAP -
              groupGap -
              (rightIdx + 1) * SEAT_CARD_GAP
            : seatPos.x +
              SEAT_CARD_OFF +
              leftGroup * SEAT_CARD_GAP +
              groupGap +
              rightIdx * SEAT_CARD_GAP;
      }

      const ty = seatPos.y;
      // 使用 z 坐标控制层级
      // 右边座位(dir=1)：从左往右排列，后面的牌(索引大)应该在上层，用 i
      // 左边座位(dir=-1)：从右往左排列，后面的牌(索引大)应该在上层，也用 i
      const tz = i * 10; // 乘以10确保层级差异明显
      card.setPosition(tx, ty, tz);
      card.setScale(0, 1, 1);

      const suit = SUIT_SYMBOL[c.suit] || c.suit;
      const clr = SUIT_COLOR[c.suit] || new Color(50, 50, 50);
      const rank = RANK_TEXT[c.rank] || c.rank.toString();
      // rank+suit紧贴露出侧的角落，确保在层叠中可见
      const lx = -20;
      this.lbl(
        `rvr${dispIdx}_${i}`,
        face,
        rank,
        18,
        clr,
        new Vec3(lx, 26, 0),
        new Size(20, 22),
      );
      this.lbl(
        `rvs${dispIdx}_${i}`,
        face,
        suit,
        11,
        clr,
        new Vec3(lx, 10, 0),
        new Size(16, 14),
      );
      newCards.push(card);
    }

    // 播放动画
    for (let i = 0; i < newCards.length; i++) {
      tween(newCards[i])
        .delay(i * 0.08)
        .to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" })
        .start();
    }
    this._seatCardNodes[dispIdx] = newCards;
    // 确保结果覆盖层始终在最顶层
    if (this._resultOverlay)
      this._resultOverlay.setSiblingIndex(this.node.children.length - 1);

    // 牛型标签放在牌面下方居中
    const rn = this._resultNodes[dispIdx];
    if (rn) {
      rn.removeAllChildren();
      rn.active = true;
      const ut = rn.getComponent(UITransform) || rn.addComponent(UITransform);
      ut.setContentSize(new Size(120, 28));
      const bt = this.bullText(bullType);
      const role = isBanker ? "庄" : "";
      const cardCenterX = this.seatCardCenterX(dispIdx, seatPos, hand.length);
      rn.setPosition(cardCenterX, seatPos.y - CARD_H / 2 - 18, 0);
      this.rect(
        `rvbg${dispIdx}`,
        rn,
        new Size(120, 28),
        new Color(0, 0, 0, 180),
      );
      this.lbl(
        `rvbl${dispIdx}`,
        rn,
        `${role} ${bt}`,
        14,
        new Color(255, 230, 100),
        Vec3.ZERO,
        new Size(120, 28),
      );
    }
  }

  /** 递归设置节点及所有子节点的 layer */
  private setLayerRecursive(node: Node, layer: number) {
    node.layer = layer;
    for (const child of node.children) {
      this.setLayerRecursive(child, layer);
    }
  }

  /** 计算某座位牌面的水平中心 X */
  private seatCardCenterX(
    dispIdx: number,
    seatPos: Vec3,
    count: number,
  ): number {
    const dir = CARD_DIR[dispIdx] || 1;
    const span = (count - 1) * SEAT_CARD_GAP;
    if (dir < 0) {
      // 牌在头像左边：从 seatPos.x - SEAT_CARD_OFF - span 到 seatPos.x - SEAT_CARD_OFF
      return seatPos.x - SEAT_CARD_OFF - span / 2;
    }
    // 牌在头像右边：从 seatPos.x + SEAT_CARD_OFF 到 seatPos.x + SEAT_CARD_OFF + span
    return seatPos.x + SEAT_CARD_OFF + span / 2;
  }

  private chatPanel() {
    const panel = this.rect(
      "chatPanel",
      this.node,
      new Size(180, 260),
      new Color(0, 0, 0, 160),
    );
    panel.setPosition(340, -100, 0);
    const pw = panel.addComponent(Widget);
    pw.isAlignRight = true;
    pw.right = 10;
    this._chatPanel = panel;
    this._chatCollapsed = true;

    // 标题
    this.lbl(
      "chatTitle",
      panel,
      "聊天",
      14,
      new Color(255, 215, 0),
      new Vec3(-20, 115, 0),
      new Size(120, 20),
    );

    // 折叠按钮
    const toggleNode = this.rect(
      "chatToggle",
      panel,
      new Size(28, 20),
      new Color(80, 80, 80, 180),
    );
    toggleNode.setPosition(72, 115, 0);
    this._chatToggleLbl = this.lbl(
      "chatToggleT",
      toggleNode,
      "▲",
      12,
      Color.WHITE,
      Vec3.ZERO,
      new Size(28, 20),
    );
    const toggleBtn = toggleNode.addComponent(Button);
    toggleBtn.transition = Button.Transition.SCALE;
    toggleBtn.zoomScale = 0.9;
    const toggleEh = new EventHandler();
    toggleEh.target = this.node;
    toggleEh.component = "RoomViewComp";
    toggleEh.handler = "onToggleChat";
    toggleBtn.clickEvents.push(toggleEh);

    // body 容器
    const body = new Node("chatBody");
    body.parent = panel;
    body.layer = panel.layer;
    body.addComponent(UITransform).setContentSize(new Size(180, 230));
    body.active = false;
    this._chatBody = body;

    // 设置折叠尺寸
    const panelUt = panel.getComponent(UITransform);
    if (panelUt) panelUt.setContentSize(new Size(180, 30));

    // 消息列表区域 — 8条消息
    this._chatMsgLabels = [];
    for (let i = 0; i < 8; i++) {
      const ml = this.lbl(
        `cm${i}`,
        body,
        "",
        11,
        new Color(200, 200, 200),
        new Vec3(0, 85 - i * 22, 0),
        new Size(168, 20),
      );
      ml.horizontalAlign = HorizontalTextAlignment.LEFT;
      ml.overflow = Label.Overflow.CLAMP;
      this._chatMsgLabels.push(ml);
    }

    // 快捷消息按钮 — 2行×3列
    const quickMsgs = [
      "快开始吧",
      "好牌！",
      "厉害👍",
      "再来一局",
      "不要走",
      "等等我",
    ];
    for (let i = 0; i < quickMsgs.length; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const bx = -52 + col * 56;
      const by = -95 - row * 30;
      const qb = this.rect(
        `qc${i}`,
        body,
        new Size(52, 26),
        new Color(60, 100, 60, 200),
      );
      qb.setPosition(bx, by, 0);
      this.lbl(
        `qcT${i}`,
        qb,
        quickMsgs[i],
        10,
        Color.WHITE,
        Vec3.ZERO,
        new Size(52, 26),
      );
      const btn = qb.addComponent(Button);
      btn.transition = Button.Transition.SCALE;
      btn.zoomScale = 0.9;
      const eh = new EventHandler();
      eh.target = this.node;
      eh.component = "RoomViewComp";
      eh.handler = `onQuickChat`;
      eh.customEventData = quickMsgs[i];
      btn.clickEvents.push(eh);
    }

    // EditBox 自定义输入
    const ebNode = new Node("chatEditBox");
    ebNode.parent = body;
    ebNode.layer = body.layer;
    ebNode.setPosition(-20, -160, 0);
    ebNode.addComponent(UITransform).setContentSize(new Size(120, 26));
    const ebBg = new Node("ebBg");
    ebBg.parent = ebNode;
    ebBg.layer = ebNode.layer;
    ebBg.addComponent(UITransform).setContentSize(new Size(120, 26));
    const ebSp = ebBg.addComponent(Sprite);
    ebSp.type = Sprite.Type.SIMPLE;
    ebSp.sizeMode = Sprite.SizeMode.CUSTOM;
    ebSp.spriteFrame = this._sf;
    ebSp.color = new Color(40, 40, 40, 220);
    const textLbl = this.lbl(
      "TEXT_LABEL",
      ebNode,
      "",
      12,
      Color.WHITE,
      Vec3.ZERO,
      new Size(116, 24),
    );
    textLbl.horizontalAlign = HorizontalTextAlignment.LEFT;
    const phLbl = this.lbl(
      "PLACEHOLDER_LABEL",
      ebNode,
      "输入消息...",
      12,
      new Color(120, 120, 120),
      Vec3.ZERO,
      new Size(116, 24),
    );
    phLbl.horizontalAlign = HorizontalTextAlignment.LEFT;
    const eb = ebNode.addComponent(EditBox);
    eb.textLabel = textLbl;
    eb.placeholderLabel = phLbl;
    eb.placeholder = "输入消息...";
    eb.maxLength = 50;
    eb.returnType = EditBox.KeyboardReturnType.DONE;
    this._chatEditBox = eb;

    // 发送按钮
    const sendNode = this.rect(
      "chatSendBtn",
      body,
      new Size(40, 26),
      new Color(40, 130, 80, 230),
    );
    sendNode.setPosition(68, -160, 0);
    this.lbl(
      "sendT",
      sendNode,
      "发送",
      11,
      Color.WHITE,
      Vec3.ZERO,
      new Size(40, 26),
    );
    const sendBtn = sendNode.addComponent(Button);
    sendBtn.transition = Button.Transition.SCALE;
    sendBtn.zoomScale = 0.9;
    const sendEh = new EventHandler();
    sendEh.target = this.node;
    sendEh.component = "RoomViewComp";
    sendEh.handler = "onSendChat";
    sendBtn.clickEvents.push(sendEh);
  }

  private addChatMsg(name: string, text: string) {
    this._chatMsgs.push({ name, text });
    if (this._chatMsgs.length > 8) this._chatMsgs.shift();
    for (let i = 0; i < 8; i++) {
      const msg = this._chatMsgs[i];
      if (this._chatMsgLabels[i]) {
        this._chatMsgLabels[i].string = msg ? `${msg.name}: ${msg.text}` : "";
      }
    }
  }

  protected onQuickChat(_ev: Event, text: string) {
    GameSocket.send("send_chat", { text });
  }

  protected onSendChat() {
    if (!this._chatEditBox) return;
    const text = this._chatEditBox.string.trim();
    if (!text) return;
    GameSocket.send("send_chat", { text });
    this._chatEditBox.string = "";
  }

  protected onToggleChat() {
    this._chatCollapsed = !this._chatCollapsed;
    if (this._chatBody) this._chatBody.active = !this._chatCollapsed;
    const panelUt = this._chatPanel?.getComponent(UITransform);
    if (panelUt)
      panelUt.setContentSize(new Size(180, this._chatCollapsed ? 30 : 260));
    if (this._chatToggleLbl)
      this._chatToggleLbl.string = this._chatCollapsed ? "▲" : "▼";
  }

  private showBubble(userPid: string, text: string) {
    const serverSeat = this._playerSeatMap.get(userPid);
    if (serverSeat == null) return;
    const dispIdx = this.displayIdx(serverSeat);
    if (dispIdx < 0 || dispIdx >= 6) return;
    const bubble = this._bubbleNodes[dispIdx];
    const lbl = this._bubbleLabels[dispIdx];
    if (!bubble || !lbl) return;
    lbl.string = text.length > 12 ? text.substring(0, 12) + "..." : text;
    bubble.active = true;
    if (this._bubbleTimers[dispIdx]) clearTimeout(this._bubbleTimers[dispIdx]);
    this._bubbleTimers[dispIdx] = setTimeout(() => {
      bubble.active = false;
    }, 3000) as unknown as number;
  }

  private rect(name: string, parent: Node, size: Size, color: Color): Node {
    const n = new Node(name);
    if (parent) {
      n.parent = parent;
      n.layer = parent.layer;
    }
    n.addComponent(UITransform).setContentSize(size);
    const sp = n.addComponent(Sprite);
    sp.type = Sprite.Type.SIMPLE;
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    sp.spriteFrame = this._sf;
    sp.color = color;
    return n;
  }

  private lbl(
    name: string,
    parent: Node,
    text: string,
    size: number,
    color: Color,
    pos: Vec3,
    area: Size,
  ): Label {
    const n = new Node(name);
    n.parent = parent;
    n.layer = parent.layer;
    n.setPosition(pos);
    n.addComponent(UITransform).setContentSize(area);
    const l = n.addComponent(Label);
    l.string = text;
    l.fontSize = size;
    l.lineHeight = area.height;
    l.color = color;
    l.horizontalAlign = HorizontalTextAlignment.CENTER;
    l.verticalAlign = VerticalTextAlignment.CENTER;
    l.overflow = Label.Overflow.CLAMP;
    return l;
  }

  private btn(
    name: string,
    text: string,
    pos: Vec3,
    bg: Color,
    handler: string,
  ): Node {
    const n = this.rect(name, this.node, new Size(130, 38), bg);
    n.setPosition(pos);
    this.lbl(
      `${name}_lbl`,
      n,
      text,
      16,
      Color.WHITE,
      Vec3.ZERO,
      new Size(130, 38),
    );
    const b = n.addComponent(Button);
    b.transition = Button.Transition.SCALE;
    b.zoomScale = 0.92;
    const eh = new EventHandler();
    eh.target = this.node;
    eh.component = "RoomViewComp";
    eh.handler = handler;
    b.clickEvents.push(eh);
    return n;
  }
}
