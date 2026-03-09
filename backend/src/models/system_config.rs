use loco_rs::prelude::*;
use sea_orm::{ConnectionTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};

pub use super::_entities::system_config::{ActiveModel, Entity, Model};

impl Model {
    /// 根据配置键获取配置值
    pub async fn get_config(db: &impl ConnectionTrait, key: &str) -> Result<Option<String>> {
        let config = Entity::find()
            .filter(super::_entities::system_config::Column::ConfigKey.eq(key))
            .one(db)
            .await?;
        Ok(config.map(|c| c.config_value))
    }

    /// 获取配置值并解析为 i64
    pub async fn get_config_i64(db: &impl ConnectionTrait, key: &str) -> Result<i64> {
        let value = Self::get_config(db, key)
            .await?
            .ok_or_else(|| Error::string(&format!("Config key not found: {key}")))?;
        value
            .parse::<i64>()
            .map_err(|e| Error::string(&format!("Failed to parse config value: {e}")))
    }

    /// 获取配置值并解析为 i32
    pub async fn get_config_i32(db: &impl ConnectionTrait, key: &str) -> Result<i32> {
        let value = Self::get_config(db, key)
            .await?
            .ok_or_else(|| Error::string(&format!("Config key not found: {key}")))?;
        value
            .parse::<i32>()
            .map_err(|e| Error::string(&format!("Failed to parse config value: {e}")))
    }

    /// 获取新用户初始资源配置
    pub async fn get_new_user_resources(db: &impl ConnectionTrait) -> Result<(i64, i64, i32)> {
        let gold = Self::get_config_i64(db, "new_user_gold")
            .await
            .unwrap_or(10000);
        let diamonds = Self::get_config_i64(db, "new_user_diamonds")
            .await
            .unwrap_or(100);
        let cards = Self::get_config_i32(db, "new_user_cards")
            .await
            .unwrap_or(5);
        Ok((gold, diamonds, cards))
    }

    /// 更新配置值
    pub async fn update_config(db: &DatabaseConnection, key: &str, value: &str) -> Result<Model> {
        let config = Entity::find()
            .filter(super::_entities::system_config::Column::ConfigKey.eq(key))
            .one(db)
            .await?
            .ok_or_else(|| Error::string(&format!("Config key not found: {key}")))?;

        let mut active: ActiveModel = config.into();
        active.config_value = Set(value.to_string());
        active.updated_at = Set(chrono::Utc::now().into());
        let updated = active.update(db).await?;
        Ok(updated)
    }
}
