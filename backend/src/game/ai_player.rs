use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::room_type::RoomType;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIPlayer {
    pub user_pid: String,
    pub name: String,
    pub seat: usize,
    pub coins: i64,
    pub is_ai: bool,
}

impl AIPlayer {
    /// 创建一个新的AI玩家，金币数为房间最低要求
    pub fn new(seat: usize, room_type: RoomType) -> Self {
        let ai_names = vec!["智能助手", "电脑玩家", "机器人", "AI对手", "虚拟玩家"];
        let name = ai_names[seat % ai_names.len()].to_string();

        // AI玩家的初始金币为房间的最低要求
        let coins = room_type.min_coins() as i64;

        Self {
            user_pid: format!("ai_{}", Uuid::new_v4()),
            name,
            seat,
            coins,
            is_ai: true,
        }
    }

    /// AI决策：是否抢庄（总是抢庄）
    pub fn decide_grab_banker(&self) -> bool {
        true
    }

    /// AI决策：下注金额（总是选最大）
    pub fn decide_bet_amount(&self, available_amounts: &[i32]) -> i32 {
        *available_amounts.iter().max().unwrap_or(&3)
    }
}
