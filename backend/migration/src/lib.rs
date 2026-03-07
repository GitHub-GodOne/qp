#![allow(elided_lifetimes_in_paths)]
#![allow(clippy::wildcard_imports)]
pub use sea_orm_migration::prelude::*;
mod m20220101_000001_users;
mod m20240101_000002_rooms;
mod m20240101_000003_add_wallet_to_users;
mod m20240201_000004_game_records;
mod m20260305_000001_add_room_config;
mod m20260306_000002_add_room_password;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20220101_000001_users::Migration),
            Box::new(m20240101_000002_rooms::Migration),
            Box::new(m20240101_000003_add_wallet_to_users::Migration),
            Box::new(m20240201_000004_game_records::Migration),
            Box::new(m20260305_000001_add_room_config::Migration),
            Box::new(m20260306_000002_add_room_password::Migration),
            // inject-above (do not remove this comment)
        ]
    }
}
