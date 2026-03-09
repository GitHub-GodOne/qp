use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Users::Table)
                    .add_column(string_null(Users::VoiceGender).default("female"))
                    .add_column(integer_null(Users::SoundVolume).default(50))
                    .add_column(integer_null(Users::MusicVolume).default(50))
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Users::Table)
                    .drop_column(Users::VoiceGender)
                    .drop_column(Users::SoundVolume)
                    .drop_column(Users::MusicVolume)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum Users {
    Table,
    VoiceGender,
    SoundVolume,
    MusicVolume,
}
