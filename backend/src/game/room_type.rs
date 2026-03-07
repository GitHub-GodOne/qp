use serde::{Deserialize, Serialize};

/// 房间类型枚举
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RoomType {
    /// 菜鸟场：300-40000金币，底分100
    Newbie,
    /// 平民场：40000-500000金币，底分1000
    Civilian,
    /// 官甲场：500000-1500000金币，底分5000
    Official,
    /// 土豪场：1500000+金币，底分10000
    Tycoon,
}

impl RoomType {
    /// 获取房间类型的底分
    #[must_use]
    pub fn base_bet(self) -> u32 {
        match self {
            Self::Newbie => 100,
            Self::Civilian => 1000,
            Self::Official => 5000,
            Self::Tycoon => 10000,
        }
    }

    /// 获取房间类型的最小金币要求
    #[must_use]
    pub fn min_coins(self) -> u32 {
        match self {
            Self::Newbie => 300,
            Self::Civilian => 40_000,
            Self::Official => 500_000,
            Self::Tycoon => 1_500_000,
        }
    }

    /// 获取房间类型的最大金币限制（None表示无上限）
    #[must_use]
    pub fn max_coins(self) -> Option<u32> {
        match self {
            Self::Newbie => Some(40_000),
            Self::Civilian => Some(500_000),
            Self::Official => Some(1_500_000),
            Self::Tycoon => None,
        }
    }

    /// 检查用户金币是否满足进入条件
    #[must_use]
    pub fn can_enter(self, user_coins: u32) -> bool {
        if user_coins < self.min_coins() {
            return false;
        }
        if let Some(max) = self.max_coins() {
            user_coins <= max
        } else {
            true
        }
    }

    /// 从字符串解析房间类型
    #[must_use]
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "newbie" | "cnc" => Some(Self::Newbie),
            "civilian" | "pmc" => Some(Self::Civilian),
            "official" | "gjc" => Some(Self::Official),
            "tycoon" | "thc" => Some(Self::Tycoon),
            _ => None,
        }
    }

    /// 转换为字符串标识
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Newbie => "newbie",
            Self::Civilian => "civilian",
            Self::Official => "official",
            Self::Tycoon => "tycoon",
        }
    }

    /// 获取房间类型的显示名称
    #[must_use]
    pub fn display_name(self) -> &'static str {
        match self {
            Self::Newbie => "菜鸟场",
            Self::Civilian => "平民场",
            Self::Official => "官甲场",
            Self::Tycoon => "土豪场",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_can_enter() {
        assert!(RoomType::Newbie.can_enter(300));
        assert!(RoomType::Newbie.can_enter(20_000));
        assert!(!RoomType::Newbie.can_enter(200));
        assert!(!RoomType::Newbie.can_enter(50_000));

        assert!(RoomType::Civilian.can_enter(40_000));
        assert!(RoomType::Civilian.can_enter(100_000));
        assert!(!RoomType::Civilian.can_enter(30_000));
        assert!(!RoomType::Civilian.can_enter(600_000));

        assert!(RoomType::Tycoon.can_enter(1_500_000));
        assert!(RoomType::Tycoon.can_enter(10_000_000));
        assert!(!RoomType::Tycoon.can_enter(1_000_000));
    }

    #[test]
    fn test_base_bet() {
        assert_eq!(RoomType::Newbie.base_bet(), 100);
        assert_eq!(RoomType::Civilian.base_bet(), 1000);
        assert_eq!(RoomType::Official.base_bet(), 5000);
        assert_eq!(RoomType::Tycoon.base_bet(), 10000);
    }
}
