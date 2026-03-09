/*
 * @Author: dgflash
 * @Date: 2021-07-03 16:13:17
 * @LastEditors: dgflash
 * @LastEditTime: 2022-08-05 18:25:56
 */
import { _decorator, profiler, screen, sys } from 'cc';
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

        // 所有平台自动全屏和横屏锁定
        this.enableFullscreenAndLandscape();
    }

    /** 启用全屏和横屏锁定 */
    private enableFullscreenAndLandscape() {
        // 请求全屏
        const requestFullscreen = () => {
            if (!screen.fullScreen()) {
                screen.requestFullScreen().catch(err => {
                    console.warn('全屏请求失败:', err);
                });
            }
        };

        requestFullscreen();

        // 锁定横屏方向
        if (screen.supportsOrientation) {
            screen.orientation = screen.Orientation.LANDSCAPE;
        }

        // 使用 Web API 锁定屏幕方向（针对支持的浏览器）
        if (typeof window !== 'undefined' && window.screen && (window.screen as any).orientation) {
            const orientation = (window.screen as any).orientation;
            if (orientation.lock) {
                orientation.lock('landscape').catch((err: any) => {
                    console.warn('屏幕方向锁定失败:', err);
                });
            }
        }

        // 移动端：持续监听用户交互，每次交互都尝试全屏（直到成功）
        if (sys.isMobile) {
            let fullscreenAchieved = false;

            const tryFullscreenOnInteraction = () => {
                if (!fullscreenAchieved && !screen.fullScreen()) {
                    requestFullscreen();
                }
            };

            // 监听多种交互事件
            document.addEventListener('touchstart', tryFullscreenOnInteraction);
            document.addEventListener('touchend', tryFullscreenOnInteraction);
            document.addEventListener('click', tryFullscreenOnInteraction);

            // 一旦成功进入全屏，停止监听交互事件
            const checkFullscreen = () => {
                if (screen.fullScreen()) {
                    fullscreenAchieved = true;
                    document.removeEventListener('touchstart', tryFullscreenOnInteraction);
                    document.removeEventListener('touchend', tryFullscreenOnInteraction);
                    document.removeEventListener('click', tryFullscreenOnInteraction);
                }
            };

            document.addEventListener('fullscreenchange', checkFullscreen);
            document.addEventListener('webkitfullscreenchange', checkFullscreen);
        } else {
            // PC端：首次交互时尝试全屏
            const tryFullscreen = () => {
                requestFullscreen();
            };
            document.addEventListener('click', tryFullscreen, { once: true });
        }

        // 监听全屏状态变化，如果退出全屏则自动重新进入
        const handleFullscreenChange = () => {
            if (!screen.fullScreen()) {
                // 延迟一小段时间再请求全屏，避免与用户操作冲突
                setTimeout(() => {
                    requestFullscreen();
                }, 100);
            }
        };

        // 监听多种全屏变化事件（兼容不同浏览器）
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);
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
