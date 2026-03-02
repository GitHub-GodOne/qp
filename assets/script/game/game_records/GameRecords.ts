import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { GameRecordsModelComp } from "./model/GameRecordsModelComp";

/** 战绩模块 */
@ecs.register('GameRecords')
export class GameRecords extends CCEntity {
    GameRecordsModel!: GameRecordsModelComp;
    protected init() {
        this.addComponents<ecs.Comp>(GameRecordsModelComp);
    }
}
