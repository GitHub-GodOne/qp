use chrono::Local;
use loco_rs::prelude::*;
use sea_orm::{Condition, PaginatorTrait, QueryOrder, QuerySelect};

pub use super::_entities::game_records::{self, ActiveModel, Entity, Model};

impl ActiveModelBehavior for super::_entities::game_records::ActiveModel {}

impl Model {
    /// Create a new game record
    pub async fn create(
        db: &DatabaseConnection,
        room_id: &str,
        players_json: &str,
    ) -> ModelResult<Self> {
        let record = game_records::ActiveModel {
            room_id: ActiveValue::Set(room_id.to_string()),
            players: ActiveValue::Set(players_json.to_string()),
            played_at: ActiveValue::Set(Local::now().into()),
            ..Default::default()
        }
        .insert(db)
        .await?;
        Ok(record)
    }

    /// Find records where the given player PID appears in the players JSON
    pub async fn find_by_player_pid(
        db: &DatabaseConnection,
        pid: &str,
        limit: u64,
        offset: u64,
    ) -> ModelResult<(Vec<Self>, u64)> {
        let condition = Condition::all().add(game_records::Column::Players.contains(pid));

        let total = game_records::Entity::find()
            .filter(condition.clone())
            .count(db)
            .await?;

        let records = game_records::Entity::find()
            .filter(condition)
            .order_by_desc(game_records::Column::PlayedAt)
            .limit(limit)
            .offset(offset)
            .all(db)
            .await?;

        Ok((records, total))
    }
}
