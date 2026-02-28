use loco_rs::schema::*;
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        create_table(
            m,
            "game_records",
            &[
                ("id", ColType::PkAuto),
                ("room_id", ColType::String),
                ("players", ColType::Text),
                ("played_at", ColType::TimestampWithTimeZone),
            ],
            &[],
        )
        .await?;
        Ok(())
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        drop_table(m, "game_records").await?;
        Ok(())
    }
}
