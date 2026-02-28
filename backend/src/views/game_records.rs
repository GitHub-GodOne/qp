use serde::{Deserialize, Serialize};

use crate::models::_entities::game_records;

#[derive(Debug, Deserialize, Serialize)]
pub struct GameRecordResponse {
    pub id: i32,
    pub room_id: String,
    pub players: serde_json::Value,
    pub played_at: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct GameRecordListResponse {
    pub records: Vec<GameRecordResponse>,
    pub total: u64,
}

impl GameRecordResponse {
    #[must_use]
    pub fn from_model(record: &game_records::Model) -> Self {
        let players =
            serde_json::from_str(&record.players).unwrap_or(serde_json::Value::Array(vec![]));
        Self {
            id: record.id,
            room_id: record.room_id.clone(),
            players,
            played_at: record.played_at.to_rfc3339(),
        }
    }
}
