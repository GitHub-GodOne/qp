use serde::{Deserialize, Serialize};

/// 支付方式
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PaymentType {
    /// AA支付
    AA,
    /// 房主支付
    Owner,
    /// 大赢家支付
    Winner,
}

/// 抢庄类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BankerType {
    /// 明牌抢庄
    OpenCard,
    /// 无牛下庄
    NoBullDown,
    /// 通比做庄
    Compare,
}

/// 翻倍规则
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MultiplyRule {
    /// 经典模式：牛牛x4，牛九x3，牛八x2，牛七x2
    Classic,
    /// 疯狂加倍：牛一牛牛1～10倍，特殊牌15～20倍，同花顺25倍
    Crazy,
}

/// 特殊牌型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SpecialCard {
    /// 同花顺(25倍)
    StraightFlush,
    /// 炸弹牛（20倍）
    Bomb,
    /// 五小牛（19倍）
    FiveSmall,
    /// 葫芦（18倍）
    FullHouse,
    /// 同花牛（17倍）
    Flush,
    /// 五花牛（16倍）
    FiveFace,
    /// 顺子牛（15倍）
    Straight,
}

impl SpecialCard {
    #[must_use]
    pub fn multiplier(self) -> u32 {
        match self {
            Self::StraightFlush => 25,
            Self::Bomb => 20,
            Self::FiveSmall => 19,
            Self::FullHouse => 18,
            Self::Flush => 17,
            Self::FiveFace => 16,
            Self::Straight => 15,
        }
    }
}

/// 王癞玩法
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum JokerRule {
    /// 无
    None,
    /// 经典王癞子
    Classic,
}

/// 花牌规则
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FlowerRule {
    /// 有花牌
    WithFlower,
    /// 无花有10
    NoFlowerWith10,
    /// 无花无10
    NoFlowerNo10,
}

/// 房间配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomConfig {
    /// 支付方式
    pub payment_type: PaymentType,
    /// 最大人数
    pub max_players: u8,
    /// 局数
    pub rounds: u16,
    /// 抢庄类型
    pub banker_type: BankerType,
    /// 最大抢庄倍数
    pub max_banker_multi: u8,
    /// 闲家推注倍数（0表示无）
    pub idle_push_multi: u8,
    /// 底分（存储为分子/分母，如1/2表示0.5）
    pub base_score_numerator: u8,
    pub base_score_denominator: u8,
    /// 翻倍规则
    pub multiply_rule: MultiplyRule,
    /// 特殊牌型（多选）
    pub special_cards: Vec<SpecialCard>,
    /// 王癞玩法
    pub joker_rule: JokerRule,
    /// 花牌规则
    pub flower_rule: FlowerRule,
}

impl Default for RoomConfig {
    fn default() -> Self {
        Self {
            payment_type: PaymentType::AA,
            max_players: 6,
            rounds: 10,
            banker_type: BankerType::OpenCard,
            max_banker_multi: 1,
            idle_push_multi: 0,
            base_score_numerator: 1,
            base_score_denominator: 2,
            multiply_rule: MultiplyRule::Classic,
            special_cards: vec![],
            joker_rule: JokerRule::None,
            flower_rule: FlowerRule::WithFlower,
        }
    }
}

impl RoomConfig {
    /// 获取实际底分
    #[must_use]
    pub fn get_base_score(&self) -> f32 {
        f32::from(self.base_score_numerator) / f32::from(self.base_score_denominator)
    }

    /// 验证配置是否有效
    #[must_use]
    pub fn is_valid(&self) -> bool {
        // 人数必须是4、6或8
        if ![4, 6, 8].contains(&self.max_players) {
            return false;
        }
        // 局数必须是10、20、30或40
        if ![10, 20, 30, 40].contains(&self.rounds) {
            return false;
        }
        // 最大抢庄倍数必须是1-4
        if !(1..=4).contains(&self.max_banker_multi) {
            return false;
        }
        // 闲家推注倍数必须是0、10、20或30
        if ![0, 10, 20, 30].contains(&self.idle_push_multi) {
            return false;
        }
        // 底分分母不能为0
        if self.base_score_denominator == 0 {
            return false;
        }
        true
    }
}
