/*
 * @Author: dgflash
 * @Date: 2021-07-03 16:13:17
 * @LastEditors: dgflash
 * @LastEditTime: 2022-08-05 18:25:56
 */
import { _decorator, profiler } from 'cc';
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
