/*
 * @Author: dgflash
 * @Date: 2021-07-03 16:13:17
 * @LastEditors: dgflash
 * @LastEditTime: 2022-08-05 18:25:56
 */
import { _decorator, profiler, screen, sys, view } from 'cc';
import { DEBUG } from 'cc/env';
import { oops } from '../../extensions/oops-plugin-framework/assets/core/Oops';
import { Root } from '../../extensions/oops-plugin-framework/assets/core/Root';
import { ecs } from '../../extensions/oops-plugin-framework/assets/libs/ecs/ECS';
import { smc } from './game/common/SingletonModuleComp';
import { UIConfigData } from './game/common/config/GameUIConfig';
import { Initialize } from './game/initialize/Initialize';
import { Login } from './game/login/Login';

const { ccclass, property } = _decorator;

@ccclass('Main')
export class Main extends Root {
    start() {
        // if (DEBUG) profiler.showStats();
        profiler.hideStats();

        // 设置 Cocos 的屏幕适配策略
        this.setupScreenAdapter();

        // 自动尝试进入全屏
        this.autoEnterFullscreen();
    }

    /** 设置屏幕适配 */
    private setupScreenAdapter() {
        // 使用 Cocos 的 ResolutionPolicy.FIXED_HEIGHT 策略
        // 这样无论横屏竖屏，都会保持设计分辨率的高度，宽度自适应
        view.setResolutionPolicy(view.ResolutionPolicy.FIXED_HEIGHT);

        console.log('[ScreenAdapter] 使用 FIXED_HEIGHT 适配策略');
        console.log('[ScreenAdapter] 设计分辨率:', view.getDesignResolutionSize());
    }

    /** 自动进入全屏 */
    private autoEnterFullscreen() {
        const tryFullscreen = () => {
            console.log('[Fullscreen] 自动尝试进入全屏');

            const elem = document.documentElement;

            // 尝试标准 API
            if (elem.requestFullscreen) {
                elem.requestFullscreen().then(() => {
                    console.log('[Fullscreen] 自动全屏成功');
                }).catch((err) => {
                    console.warn('[Fullscreen] 自动全屏失败:', err);
                });
                return;
            }

            // 尝试 webkit
            if ((elem as any).webkitRequestFullscreen) {
                try {
                    (elem as any).webkitRequestFullscreen();
                    console.log('[Fullscreen] webkit 自动全屏');
                } catch (err) {
                    console.warn('[Fullscreen] webkit 失败:', err);
                }
                return;
            }

            // 尝试 webkitRequestFullScreen
            if ((elem as any).webkitRequestFullScreen) {
                try {
                    (elem as any).webkitRequestFullScreen();
                    console.log('[Fullscreen] webkitRequestFullScreen 自动全屏');
                } catch (err) {
                    console.warn('[Fullscreen] webkitRequestFullScreen 失败:', err);
                }
                return;
            }

            // 尝试 moz
            if ((elem as any).mozRequestFullScreen) {
                try {
                    (elem as any).mozRequestFullScreen();
                    console.log('[Fullscreen] moz 自动全屏');
                } catch (err) {
                    console.warn('[Fullscreen] moz 失败:', err);
                }
                return;
            }

            // 尝试 ms
            if ((elem as any).msRequestFullscreen) {
                try {
                    (elem as any).msRequestFullscreen();
                    console.log('[Fullscreen] ms 自动全屏');
                } catch (err) {
                    console.warn('[Fullscreen] ms 失败:', err);
                }
                return;
            }

            // 尝试 Cocos screen API
            try {
                if (screen && typeof screen.requestFullScreen === 'function') {
                    screen.requestFullScreen().catch((err: any) => {
                        console.warn('[Fullscreen] Cocos API 失败:', err);
                    });
                }
            } catch (err) {
                console.warn('[Fullscreen] Cocos API 异常:', err);
            }
        };

        // 立即尝试
        tryFullscreen();

        // 监听用户首次交互，再次尝试（浏览器安全限制）
        const events = ['click', 'touchstart', 'touchend', 'keydown'];
        const onInteraction = () => {
            tryFullscreen();
            // 只尝试一次
            events.forEach(event => {
                document.removeEventListener(event, onInteraction);
            });
        };

        events.forEach(event => {
            document.addEventListener(event, onInteraction, { once: true });
        });
    }

    protected run() {
        smc.initialize = ecs.getEntity<Initialize>(Initialize);
        smc.login = ecs.getEntity<Login>(Login);
    }

    protected initGui() {
        oops.gui.init(UIConfigData);
    }

    // protected initEcsSystem() {
    //     oops.ecs.add(new EcsInitializeSystem());
    // }
}
