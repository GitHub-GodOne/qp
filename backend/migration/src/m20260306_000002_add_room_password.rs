use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Rooms::Table)
                    .add_column(string_null(Rooms::RoomPassword))
                    .to_owned(),
            )
            .await?;

        // 添加唯一索引，确保房间密码不重复
        manager
            .create_index(
                Index::create()
                    .name("idx_rooms_password")
                    .table(Rooms::Table)
                    .col(Rooms::RoomPassword)
                    .unique()
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_index(Index::drop().name("idx_rooms_password").to_owned())
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Rooms::Table)
                    .drop_column(Rooms::RoomPassword)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum Rooms {
    Table,
    RoomPassword,
}
