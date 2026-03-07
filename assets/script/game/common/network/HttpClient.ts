import { NetConfig } from "./NetConfig";
import { sys } from "cc";

const TOKEN_KEY = "auth_token";

/** 简易 HTTP 客户端，使用 XMLHttpRequest 发送 JSON 请求 */
export class HttpClient {
    private static _token: string = sys.localStorage.getItem(TOKEN_KEY) || "";

    static get token(): string {
        return this._token;
    }

    static set token(val: string) {
        this._token = val;
        sys.localStorage.setItem(TOKEN_KEY, val);
    }

    /** 清除token */
    static clearToken(): void {
        this._token = "";
        sys.localStorage.removeItem(TOKEN_KEY);
    }

    static get<T = any>(path: string): Promise<T> {
        return this.request("GET", path);
    }

    static post<T = any>(path: string, body?: any): Promise<T> {
        return this.request("POST", path, body);
    }

    static delete<T = any>(path: string): Promise<T> {
        return this.request("DELETE", path);
    }

    private static request<T>(method: string, path: string, body?: any): Promise<T> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const url = `${NetConfig.API_BASE}${path}`;
            xhr.open(method, url, true);
            xhr.setRequestHeader("Content-Type", "application/json");
            if (this._token) {
                xhr.setRequestHeader("Authorization", `Bearer ${this._token}`);
            }
            xhr.onreadystatechange = () => {
                if (xhr.readyState !== 4) return;
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
                        resolve(data as T);
                    } catch {
                        resolve(null as any);
                    }
                } else if (xhr.status === 401) {
                    // 401 未授权，清除 token 并重新加载场景返回登录页
                    this.clearToken();
                    console.warn("Token 已失效，返回登录页面");
                    // 延迟一下再重新加载，让用户看到提示
                    import("cc").then(({ director }) => {
                        setTimeout(() => {
                            director.loadScene(director.getScene()!.name);
                        }, 500);
                    });
                    reject(new Error(`HTTP ${xhr.status}: ${xhr.responseText}`));
                } else {
                    reject(new Error(`HTTP ${xhr.status}: ${xhr.responseText}`));
                }
            };
            xhr.onerror = () => reject(new Error("Network error"));
            xhr.send(body ? JSON.stringify(body) : null);
        });
    }
}
