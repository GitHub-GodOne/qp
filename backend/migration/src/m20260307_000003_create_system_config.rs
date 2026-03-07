use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(SystemConfig::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(SystemConfig::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(SystemConfig::ConfigKey)
                            .string()
                            .not_null()
                            .unique_key(),
                    )
                    .col(
                        ColumnDef::new(SystemConfig::ConfigValue)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(SystemConfig::Description)
                            .string()
                            .null(),
                    )
                    .col(
                        ColumnDef::new(SystemConfig::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        ColumnDef::new(SystemConfig::UpdatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;

        // 插入默认配置
        let insert = Query::insert()
            .into_table(SystemConfig::Table)
            .columns([
                SystemConfig::ConfigKey,
                SystemConfig::ConfigValue,
                SystemConfig::Description,
            ])
            .values_panic([
                "new_user_gold".into(),
                "10000".into(),
                "新用户注册赠送金币".into(),
            ])
            .values_panic([
                "new_user_diamonds".into(),
                "100".into(),
                "新用户注册赠送钻石".into(),
            ])
            .values_panic([
                "new_user_cards".into(),
                "5".into(),
                "新用户注册赠送房卡".into(),
            ])
            .to_owned();

        manager.exec_stmt(insert).await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(SystemConfig::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum SystemConfig {
    Table,
    Id,
    ConfigKey,
    ConfigValue,
    Description,
    CreatedAt,
    UpdatedAt,
}
