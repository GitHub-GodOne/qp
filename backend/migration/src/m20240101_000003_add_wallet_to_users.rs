use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("users"))
                    .add_column(
                        ColumnDef::new(Alias::new("gold"))
                            .big_integer()
                            .not_null()
                            .default(0),
                    )
                    .add_column(
                        ColumnDef::new(Alias::new("diamonds"))
                            .big_integer()
                            .not_null()
                            .default(0),
                    )
                    .add_column(
                        ColumnDef::new(Alias::new("cards"))
                            .integer()
                            .not_null()
                            .default(0),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("users"))
                    .drop_column(Alias::new("gold"))
                    .drop_column(Alias::new("diamonds"))
                    .drop_column(Alias::new("cards"))
                    .to_owned(),
            )
            .await
    }
}
