import { _decorator, Node, Label, UITransform, Size, Color, Vec3, Sprite, Button, EventHandler,
    HorizontalTextAlignment, VerticalTextAlignment, builtinResMgr, SpriteFrame, Texture2D, ScrollView, Widget, Mask, BlockInputEvents } from "cc";
import { gui } from "db://oops-framework/core/gui/Gui";
import { LayerType } from "db://oops-framework/core/gui/layer/LayerEnum";
import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCView } from "db://oops-framework/module/common/CCView";
import { GameRecords } from "../GameRecords";
import { oops } from "db://oops-framework/core/Oops";
import { UIID } from "../../common/config/GameUIConfig";
import { HttpClient } from "../../common/network/HttpClient";
import { NetConfig } from "../../common/network/NetConfig";
import { smc } from "../../common/SingletonModuleComp";
import { GameRecordItem } from "../model/GameRecordsModelComp";

const { ccclass } = _decorator;

const BULL_TEXT: Record<string, string> = {
    "None": "无牛", "Bull1": "牛一", "Bull2": "牛二", "Bull3": "牛三",
    "Bull4": "牛四", "Bull5": "牛五", "Bull6": "牛六", "Bull7": "牛七",
    "Bull8": "牛八", "Bull9": "牛九", "BullBull": "牛牛",
    "Bomb": "炸弹", "FiveSmall": "五小牛",
};

/** 战绩弹窗视图 */
@ccclass('GameRecordsViewComp')
@ecs.register('GameRecordsView', false)
@gui.register('GameRecordsView', { layer: LayerType.Dialog, prefab: "gui/game_records/game_records" })
export class GameRecordsViewComp extends CCView<GameRecords> {
    private _sf: SpriteFrame | null = null;
    private _myPid = "";
    private _contentNode: Node | null = null;
    private _singleMode = false;
    private _singleData: any[] | null = null;
    private _roomId: string = "";
    private _summaryLbl: Label | null = null;

    /** 外部可在 open 前设置，用于单局模式 */
    static pendingSingleData: { players: any[]; room_id: string } | null = null;

    start() {
        this._myPid = smc.login.LoginModel?.pid || "";
        this._sf = this.whiteSF();
        this.node.removeAllChildren();

        if (GameRecordsViewComp.pendingSingleData) {
            this._singleMode = true;
            this._singleData = GameRecordsViewComp.pendingSingleData.players;
            this._roomId = GameRecordsViewComp.pendingSingleData.room_id;
            GameRecordsViewComp.pendingSingleData = null;
        }

        this.buildUI();
    }

    reset() { this.node.destroy(); }

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

    private buildUI() {
        // Semi-transparent backdrop
        const bg = this.rect("bg", this.node, new Size(960, 640), new Color(0, 0, 0, 160));
        const bw = bg.addComponent(Widget);
        bw.isAlignTop = bw.isAlignBottom = bw.isAlignLeft = bw.isAlignRight = true;
        bw.top = bw.bottom = bw.left = bw.right = 0;
        // 添加 BlockInputEvents 组件阻止点击穿透到下层
        bg.addComponent(BlockInputEvents);

        // Dialog panel
        const panel = this.rect("panel", this.node, new Size(700, 500), new Color(30, 45, 30, 240));
        panel.setPosition(0, 0, 0);

        // Title bar
        const titleBar = this.rect("titleBar", panel, new Size(700, 44), new Color(20, 60, 30, 255));
        titleBar.setPosition(0, 228, 0);
        this.lbl("title", titleBar, "战 绩", 20, new Color(255, 215, 0), Vec3.ZERO, new Size(200, 40));

        // Close button
        const closeBtn = this.rect("closeBtn", titleBar, new Size(36, 36), new Color(150, 40, 40));
        closeBtn.setPosition(322, 0, 0);
        this.lbl("closeT", closeBtn, "✕", 20, Color.WHITE, Vec3.ZERO, new Size(36, 36));
        const btn = closeBtn.addComponent(Button);
        btn.transition = Button.Transition.SCALE; btn.zoomScale = 0.9;
        const eh = new EventHandler();
        eh.target = this.node; eh.component = "GameRecordsViewComp"; eh.handler = "onClose";
        btn.clickEvents.push(eh);

        // Summary line (list mode only)
        this._summaryLbl = this.lbl("summary", panel, "", 14, new Color(200, 200, 180), new Vec3(0, 196, 0), new Size(660, 24));
        this._summaryLbl.node.active = !this._singleMode;

        // Scroll area
        const scrollNode = new Node("scroll");
        scrollNode.parent = panel; scrollNode.layer = panel.layer;
        scrollNode.setPosition(0, -20, 0);
        const scrollUT = scrollNode.addComponent(UITransform);
        scrollUT.setContentSize(new Size(680, 400));

        // View node with Mask for clipping
        const viewNode = new Node("view");
        viewNode.parent = scrollNode; viewNode.layer = scrollNode.layer;
        const viewUT = viewNode.addComponent(UITransform);
        viewUT.setContentSize(new Size(680, 400));
        viewNode.addComponent(Mask);

        const content = new Node("content");
        content.parent = viewNode; content.layer = viewNode.layer;
        const contentUT = content.addComponent(UITransform);
        contentUT.setContentSize(new Size(680, 0));
        contentUT.setAnchorPoint(0.5, 1);
        content.setPosition(0, 200, 0);
        this._contentNode = content;

        const sv = scrollNode.addComponent(ScrollView);
        sv.content = content;
        sv.horizontal = false;
        sv.vertical = true;

        if (this._singleMode) {
            this.renderSingleRecord();
        } else {
            this.fetchRecords();
        }
    }

    private async fetchRecords() {
        try {
            const res = await HttpClient.get<{ records: GameRecordItem[]; total: number }>(
                `${NetConfig.API.GAME_RECORDS}?limit=20&offset=0`
            );
            const records = res.records || [];
            this.updateSummary(records);
            this.renderRecordList(records);
        } catch (e) {
            console.error("获取战绩失败:", e);
        }
    }

    private updateSummary(records: GameRecordItem[]) {
        if (!this._summaryLbl) return;
        let totalGames = records.length;
        let wins = 0;
        let netGain = 0;
        for (const r of records) {
            const me = r.players.find(p => p.user_pid === this._myPid);
            if (me) {
                const cc = me.coin_change ?? 0;
                if (cc > 0) wins++;
                netGain += cc;
            }
        }
        const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
        const netStr = netGain >= 0 ? `+${netGain}` : `${netGain}`;
        this._summaryLbl.string = `总场次: ${totalGames}  胜率: ${winRate}%  净盈: ${netStr}`;
        this._summaryLbl.color = netGain >= 0 ? new Color(100, 255, 100) : new Color(255, 80, 80);
    }

    private renderRecordList(records: GameRecordItem[]) {
        if (!this._contentNode) return;
        this._contentNode.removeAllChildren();
        let yOffset = 0;
        const cardH = 80;
        const gap = 8;

        for (const record of records) {
            const card = this.renderRecordCard(record, false);
            card.parent = this._contentNode;
            this.setLayerRecursive(card, this._contentNode.layer);
            card.setPosition(0, -yOffset - cardH / 2, 0);
            yOffset += cardH + gap;
        }

        if (records.length === 0) {
            this.lbl("empty", this._contentNode, "暂无战绩", 16, new Color(150, 150, 150), new Vec3(0, -40, 0), new Size(200, 30));
        }

        const contentUT = this._contentNode.getComponent(UITransform);
        if (contentUT) contentUT.setContentSize(new Size(680, yOffset));
    }

    private renderSingleRecord() {
        if (!this._contentNode || !this._singleData) return;
        this._contentNode.removeAllChildren();

        const item: GameRecordItem = {
            id: 0,
            room_id: this._roomId,
            players: this._singleData,
            played_at: new Date().toISOString(),
        };
        const card = this.renderRecordCard(item, true);
        card.parent = this._contentNode;
        this.setLayerRecursive(card, this._contentNode.layer);
        card.setPosition(0, -10, 0);

        const contentUT = this._contentNode.getComponent(UITransform);
        if (contentUT) contentUT.setContentSize(new Size(680, 40 + item.players.length * 26));
    }

    private renderRecordCard(record: GameRecordItem, expanded: boolean): Node {
        const me = record.players.find(p => p.user_pid === this._myPid);
        const roomShort = record.room_id.substring(0, 4).toUpperCase();
        const time = this.formatTime(record.played_at);
        const myBull = me ? (BULL_TEXT[me.bull_type] || "无牛") : "—";
        const myRole = me ? (me.is_banker ? "[庄]" : `[${me.bet_amount || 0}分]`) : "";
        const cc = me?.coin_change ?? 0;
        const ccStr = cc >= 0 ? `+${cc}` : `${cc}`;
        const ccColor = cc >= 0 ? new Color(100, 255, 100) : new Color(255, 80, 80);

        const playerCount = expanded ? record.players.length : 0;
        const cardH = expanded ? 36 + playerCount * 26 : 70;
        const card = this.rect("card", null!, new Size(660, cardH), new Color(40, 60, 40, 220));

        // Header line
        this.lbl("room", card, `房间 ${roomShort}`, 13, new Color(180, 180, 160), new Vec3(-260, expanded ? cardH / 2 - 16 : 10, 0), new Size(120, 20));
        this.lbl("time", card, time, 12, new Color(140, 140, 130), new Vec3(-120, expanded ? cardH / 2 - 16 : 10, 0), new Size(160, 20));
        this.lbl("myBull", card, `${myBull} ${myRole}`, 14, new Color(255, 230, 100), new Vec3(100, expanded ? cardH / 2 - 16 : 10, 0), new Size(160, 20));
        this.lbl("myCC", card, `${ccStr} 币`, 14, ccColor, new Vec3(260, expanded ? cardH / 2 - 16 : 10, 0), new Size(80, 20));

        if (!expanded) {
            // Compact: second line with brief info
            const names = record.players.map(p => p.name).join(", ");
            this.lbl("names", card, names, 11, new Color(140, 140, 140), new Vec3(0, -14, 0), new Size(620, 18));
        }

        if (expanded) {
            // Separator
            const sep = this.rect("sep", card, new Size(620, 1), new Color(80, 100, 80));
            sep.setPosition(0, cardH / 2 - 32, 0);

            // Player rows
            for (let i = 0; i < record.players.length; i++) {
                const p = record.players[i];
                const y = cardH / 2 - 42 - i * 26;
                const bull = BULL_TEXT[p.bull_type] || "无牛";
                const role = p.is_banker ? "[庄]" : `[${p.bet_amount || 0}分]`;
                const pcc = p.coin_change ?? 0;
                const pccStr = pcc >= 0 ? `+${pcc}` : `${pcc}`;
                const pccClr = pcc >= 0 ? new Color(100, 255, 100) : new Color(255, 80, 80);
                const isMe = p.user_pid === this._myPid;
                const nameClr = isMe ? new Color(255, 230, 100) : new Color(200, 200, 200);
                const nameStr = isMe ? `${p.name}(我)` : p.name;

                this.lbl(`pn${i}`, card, nameStr, 12, nameClr, new Vec3(-240, y, 0), new Size(120, 20));
                this.lbl(`pr${i}`, card, role, 12, new Color(180, 180, 160), new Vec3(-120, y, 0), new Size(60, 20));
                this.lbl(`pb${i}`, card, bull, 12, new Color(255, 230, 100), new Vec3(-30, y, 0), new Size(80, 20));
                this.lbl(`pc${i}`, card, pccStr, 13, pccClr, new Vec3(80, y, 0), new Size(60, 20));
                this.lbl(`pg${i}`, card, `${p.coins} 币`, 11, new Color(160, 160, 140), new Vec3(170, y, 0), new Size(80, 20));
            }
        }
        // expanded rows end
        return card;
    }

    private formatTime(iso: string): string {
        try {
            const d = new Date(iso);
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            const hh = String(d.getHours()).padStart(2, "0");
            const mi = String(d.getMinutes()).padStart(2, "0");
            return `${mm}-${dd} ${hh}:${mi}`;
        } catch {
            return iso;
        }
    }

    protected onClose() {
        oops.gui.remove(UIID.GameRecordsViewComp);
    }

    private setLayerRecursive(node: Node, layer: number) {
        node.layer = layer;
        for (const child of node.children) {
            this.setLayerRecursive(child, layer);
        }
    }

    private rect(name: string, parent: Node, size: Size, color: Color): Node {
        const n = new Node(name);
        if (parent) { n.parent = parent; n.layer = parent.layer; }
        n.addComponent(UITransform).setContentSize(size);
        const sp = n.addComponent(Sprite);
        sp.type = Sprite.Type.SIMPLE;
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.spriteFrame = this._sf;
        sp.color = color;
        return n;
    }

    private lbl(name: string, parent: Node, text: string, size: number, color: Color, pos: Vec3, area: Size): Label {
        const n = new Node(name);
        n.parent = parent; n.layer = parent.layer; n.setPosition(pos);
        n.addComponent(UITransform).setContentSize(area);
        const l = n.addComponent(Label);
        l.string = text; l.fontSize = size; l.lineHeight = area.height;
        l.color = color;
        l.horizontalAlign = HorizontalTextAlignment.CENTER;
        l.verticalAlign = VerticalTextAlignment.CENTER;
        l.overflow = Label.Overflow.CLAMP;
        return l;
    }
}

