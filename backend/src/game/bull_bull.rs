use super::deck::Card;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum BullType {
    None, // 无牛
    Bull1,
    Bull2,
    Bull3,
    Bull4,
    Bull5,
    Bull6,
    Bull7,
    Bull8,
    Bull9,
    BullBull,  // 牛牛
    Bomb,      // 炸弹 (四张相同)
    FiveSmall, // 五小牛 (五张牌点数之和 <= 10，且每张 <= 5)
}

impl BullType {
    #[must_use]
    pub fn multiplier(self) -> u32 {
        match self {
            Self::None
            | Self::Bull1
            | Self::Bull2
            | Self::Bull3
            | Self::Bull4
            | Self::Bull5
            | Self::Bull6 => 1,
            Self::Bull7 | Self::Bull8 => 2,
            Self::Bull9 | Self::BullBull => 3,
            Self::Bomb => 4,
            Self::FiveSmall => 5,
        }
    }

    #[must_use]
    pub fn label(self) -> &'static str {
        match self {
            Self::None => "无牛",
            Self::Bull1 => "牛一",
            Self::Bull2 => "牛二",
            Self::Bull3 => "牛三",
            Self::Bull4 => "牛四",
            Self::Bull5 => "牛五",
            Self::Bull6 => "牛六",
            Self::Bull7 => "牛七",
            Self::Bull8 => "牛八",
            Self::Bull9 => "牛九",
            Self::BullBull => "牛牛",
            Self::Bomb => "炸弹",
            Self::FiveSmall => "五小牛",
        }
    }
}

/// Evaluate a 5-card hand and return the bull type.
#[must_use]
pub fn evaluate(hand: &[Card; 5]) -> BullType {
    // Check five-small: all cards rank <= 5 and sum of bull_values <= 10
    if hand.iter().all(|c| c.rank <= 5)
        && hand.iter().map(|c| u32::from(c.bull_value())).sum::<u32>() <= 10
    {
        return BullType::FiveSmall;
    }

    // Check bomb: four cards with same rank
    let mut ranks: Vec<u8> = hand.iter().map(|c| c.rank).collect();
    ranks.sort_unstable();
    if ranks[0] == ranks[3] || ranks[1] == ranks[4] {
        return BullType::Bomb;
    }

    // Standard bull check: pick 3 cards whose bull_values sum to multiple of 10,
    // then check remaining 2 cards
    let vals: Vec<u8> = hand.iter().map(|c| c.bull_value()).collect();

    for i in 0..3 {
        for j in (i + 1)..4 {
            for k in (j + 1)..5 {
                let three_sum = u32::from(vals[i]) + u32::from(vals[j]) + u32::from(vals[k]);
                if three_sum % 10 != 0 {
                    continue;
                }
                // Remaining two cards
                let mut two_sum = 0u32;
                for (idx, &v) in vals.iter().enumerate() {
                    if idx != i && idx != j && idx != k {
                        two_sum += u32::from(v);
                    }
                }
                let remainder = two_sum % 10;
                return match remainder {
                    0 => BullType::BullBull,
                    1 => BullType::Bull1,
                    2 => BullType::Bull2,
                    3 => BullType::Bull3,
                    4 => BullType::Bull4,
                    5 => BullType::Bull5,
                    6 => BullType::Bull6,
                    7 => BullType::Bull7,
                    8 => BullType::Bull8,
                    9 => BullType::Bull9,
                    _ => unreachable!(),
                };
            }
        }
    }

    BullType::None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game::deck::Suit;

    fn c(rank: u8, suit: Suit) -> Card {
        Card { suit, rank }
    }

    #[test]
    fn test_bull_bull() {
        // 10+10+10=30, K+Q=10+10=20 → 牛牛
        let hand = [
            c(10, Suit::Spade),
            c(10, Suit::Heart),
            c(10, Suit::Diamond),
            c(13, Suit::Club),
            c(12, Suit::Spade),
        ];
        assert_eq!(evaluate(&hand), BullType::BullBull);
    }

    #[test]
    fn test_bull7() {
        // 10+10+10=30, 5+2=7 → 牛七
        let hand = [
            c(10, Suit::Spade),
            c(10, Suit::Heart),
            c(10, Suit::Diamond),
            c(5, Suit::Club),
            c(2, Suit::Spade),
        ];
        assert_eq!(evaluate(&hand), BullType::Bull7);
    }

    #[test]
    fn test_no_bull() {
        // 1+2+4=7, 3+8=11 → no triple sums to 10x → 无牛
        let hand = [
            c(1, Suit::Spade),
            c(2, Suit::Heart),
            c(4, Suit::Diamond),
            c(3, Suit::Club),
            c(8, Suit::Spade),
        ];
        // Verify: (1,2,4)=7 (1,2,3)=6 (1,2,8)=11 (1,4,3)=8 (1,4,8)=13 (1,3,8)=12
        // (2,4,3)=9 (2,4,8)=14 (2,3,8)=13 (4,3,8)=15 → none mod 10 == 0
        assert_eq!(evaluate(&hand), BullType::None);
    }

    #[test]
    fn test_bomb() {
        let hand = [
            c(7, Suit::Spade),
            c(7, Suit::Heart),
            c(7, Suit::Diamond),
            c(7, Suit::Club),
            c(3, Suit::Spade),
        ];
        assert_eq!(evaluate(&hand), BullType::Bomb);
    }

    #[test]
    fn test_five_small() {
        // All <= 5, sum = 1+1+2+2+3 = 9 <= 10
        let hand = [
            c(1, Suit::Spade),
            c(1, Suit::Heart),
            c(2, Suit::Diamond),
            c(2, Suit::Club),
            c(3, Suit::Spade),
        ];
        assert_eq!(evaluate(&hand), BullType::FiveSmall);
    }
}
