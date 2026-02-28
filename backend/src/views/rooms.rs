use serde::{Deserialize, Serialize};

use crate::models::_entities::rooms;

#[derive(Debug, Serialize, Deserialize)]
pub struct RoomResponse {
    pub room_id: String,
    pub owner_pid: String,
    pub name: String,
    pub max_players: i16,
    pub status: String,
}

impl RoomResponse {
    #[must_use]
    pub fn new(room: &rooms::Model) -> Self {
        Self {
            room_id: room.room_id.clone(),
            owner_pid: room.owner_pid.to_string(),
            name: room.name.clone(),
            max_players: room.max_players,
            status: room.status.clone(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RoomListResponse {
    pub rooms: Vec<RoomResponse>,
}
