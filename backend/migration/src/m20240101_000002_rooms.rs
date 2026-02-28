use loco_rs::schema::*;
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        create_table(
            m,
            "rooms",
            &[
                ("id", ColType::PkAuto),
                ("room_id", ColType::StringUniq),
                ("owner_pid", ColType::Uuid),
                ("name", ColType::String),
                ("max_players", ColType::SmallInteger),
                ("status", ColType::String),
            ],
            &[],
        )
        .await?;
        Ok(())
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        drop_table(m, "rooms").await?;
        Ok(())
    }
}
