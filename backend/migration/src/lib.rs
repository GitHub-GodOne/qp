#![allow(elided_lifetimes_in_paths)]
#![allow(clippy::wildcard_imports)]
pub use sea_orm_migration::prelude::*;
mod m20220101_000001_users;
mod m20240101_000002_rooms;
mod m20240101_000003_add_wallet_to_users;
mod m20240201_000004_game_records;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20220101_000001_users::Migration),
            Box::new(m20240101_000002_rooms::Migration),
            Box::new(m20240101_000003_add_wallet_to_users::Migration),
            Box::new(m20240201_000004_game_records::Migration),
            // inject-above (do not remove this comment)
        ]
    }
}
