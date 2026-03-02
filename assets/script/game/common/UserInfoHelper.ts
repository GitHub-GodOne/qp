import { Node, RichText } from "cc";
import { smc } from "./SingletonModuleComp";
import { HttpClient } from "./network/HttpClient";
import { NetConfig } from "./network/NetConfig";

/** 公共 userInfo prefab 数据更新工具 */
export class UserInfoHelper {
    /**
     * 更新 userInfo 嵌套 prefab 中的用户数据
     * @param rootNode 包含 userInfo 子节点的页面根节点
     */
    static async updateUserInfo(rootNode: Node): Promise<void> {
        const userInfoNode = rootNode.getChildByName("userInfo");
        if (!userInfoNode) return;

        const model = smc.login?.LoginModel;
        if (!model) return;

        // 用本地登录数据更新用户名和ID
        this.setRichText(userInfoNode, "ID", model.name || "未知");
        this.setRichText(userInfoNode, "UserName", `ID:${model.pid.substring(0, 8)}`);

        // 从后端拉取钱包数据
        try {
            const profile = await HttpClient.get<{
                pid: string; name: string; gold: number; diamonds: number; cards: number;
            }>(NetConfig.API.PROFILE);
            this.setRichText(userInfoNode, "coins", String(profile.gold));
            this.setRichText(userInfoNode, "gems", String(profile.diamonds));
            this.setRichText(userInfoNode, "card", String(profile.cards));
        } catch (e) {
            console.error("获取用户资产失败:", e);
        }
    }

    /** 在子节点中找到带 RichText 组件的同名节点并设置文本（深度搜索） */
    private static setRichText(root: Node, name: string, text: string): void {
        const found = this.findRichTextNode(root, name);
        if (found) {
            found.string = text;
        }
    }

    /** 递归查找名为 name 且带 RichText 组件的节点 */
    private static findRichTextNode(node: Node, name: string): RichText | null {
        for (const child of node.children) {
            if (child.name === name) {
                const rt = child.getComponent(RichText);
                if (rt) return rt;
            }
            // 深度搜索子节点
            const found = this.findRichTextNode(child, name);
            if (found) return found;
        }
        return null;
    }
}
