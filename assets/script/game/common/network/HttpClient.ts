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
                } else {
                    reject(new Error(`HTTP ${xhr.status}: ${xhr.responseText}`));
                }
            };
            xhr.onerror = () => reject(new Error("Network error"));
            xhr.send(body ? JSON.stringify(body) : null);
        });
    }
}
