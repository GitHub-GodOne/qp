use axum::extract::State;
use loco_rs::prelude::*;
use serde::{Deserialize, Serialize};

use crate::models::_entities::users;

#[derive(Debug, Deserialize, Serialize)]
pub struct AudioSettingsRequest {
    pub voice_gender: Option<String>,
    pub sound_volume: Option<i32>,
    pub music_volume: Option<i32>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct AudioSettingsResponse {
    pub voice_gender: String,
    pub sound_volume: i32,
    pub music_volume: i32,
}

/// Get current user's audio settings
pub async fn get_audio_settings(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let user = users::Model::find_by_pid(&ctx.db, &auth.claims.pid).await?;

    let response = AudioSettingsResponse {
        voice_gender: user.voice_gender.unwrap_or_else(|| "female".to_string()),
        sound_volume: user.sound_volume.unwrap_or(50),
        music_volume: user.music_volume.unwrap_or(50),
    };

    format::json(response)
}

/// Update current user's audio settings
pub async fn update_audio_settings(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Json(params): Json<AudioSettingsRequest>,
) -> Result<Response> {
    let user = users::Model::find_by_pid(&ctx.db, &auth.claims.pid).await?;
    let mut user: users::ActiveModel = user.into();

    if let Some(voice_gender) = params.voice_gender {
        if voice_gender != "male" && voice_gender != "female" {
            return Err(Error::BadRequest(
                "voice_gender must be 'male' or 'female'".to_string(),
            ));
        }
        user.voice_gender = Set(Some(voice_gender));
    }

    if let Some(sound_volume) = params.sound_volume {
        if !(0..=100).contains(&sound_volume) {
            return Err(Error::BadRequest(
                "sound_volume must be between 0 and 100".to_string(),
            ));
        }
        user.sound_volume = Set(Some(sound_volume));
    }

    if let Some(music_volume) = params.music_volume {
        if !(0..=100).contains(&music_volume) {
            return Err(Error::BadRequest(
                "music_volume must be between 0 and 100".to_string(),
            ));
        }
        user.music_volume = Set(Some(music_volume));
    }

    let updated_user = user.update(&ctx.db).await?;

    let response = AudioSettingsResponse {
        voice_gender: updated_user
            .voice_gender
            .unwrap_or_else(|| "female".to_string()),
        sound_volume: updated_user.sound_volume.unwrap_or(50),
        music_volume: updated_user.music_volume.unwrap_or(50),
    };

    format::json(response)
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("api/user/settings")
        .add("/audio", get(get_audio_settings))
        .add("/audio", post(update_audio_settings))
}
