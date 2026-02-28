use loco_rs::prelude::*;
use sea_orm::ActiveValue;
use uuid::Uuid;

pub use super::_entities::rooms::{self, ActiveModel, Entity, Model};

impl ActiveModelBehavior for super::_entities::rooms::ActiveModel {}

impl Model {
    pub async fn create(
        db: &DatabaseConnection,
        owner_pid: Uuid,
        name: &str,
        max_players: i16,
    ) -> ModelResult<Self> {
        let room = rooms::ActiveModel {
            room_id: ActiveValue::set(Uuid::new_v4().to_string()),
            owner_pid: ActiveValue::set(owner_pid),
            name: ActiveValue::set(name.to_string()),
            max_players: ActiveValue::set(max_players),
            status: ActiveValue::set("waiting".to_string()),
            ..Default::default()
        }
        .insert(db)
        .await?;
        Ok(room)
    }

    pub async fn find_by_room_id(db: &DatabaseConnection, room_id: &str) -> ModelResult<Self> {
        let room = rooms::Entity::find()
            .filter(
                model::query::condition()
                    .eq(rooms::Column::RoomId, room_id)
                    .build(),
            )
            .one(db)
            .await?;
        room.ok_or(ModelError::EntityNotFound)
    }

    pub async fn list_waiting(db: &DatabaseConnection) -> ModelResult<Vec<Self>> {
        let rooms = rooms::Entity::find()
            .filter(
                model::query::condition()
                    .eq(rooms::Column::Status, "waiting")
                    .build(),
            )
            .all(db)
            .await?;
        Ok(rooms)
    }

    pub async fn update_status(
        db: &DatabaseConnection,
        room_id: &str,
        status: &str,
    ) -> ModelResult<Self> {
        let room = Self::find_by_room_id(db, room_id).await?;
        let mut active: rooms::ActiveModel = room.into();
        active.status = ActiveValue::set(status.to_string());
        active.update(db).await.map_err(ModelError::from)
    }

    pub async fn delete_by_room_id(
        db: &DatabaseConnection,
        room_id: &str,
        owner_pid: Uuid,
    ) -> ModelResult<()> {
        let room = Self::find_by_room_id(db, room_id).await?;
        if room.owner_pid != owner_pid {
            return Err(ModelError::msg("only room owner can delete"));
        }
        rooms::Entity::delete_by_id(room.id).exec(db).await?;
        Ok(())
    }
}
