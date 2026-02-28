use loco_rs::prelude::*;
use serde::Deserialize;

use crate::{
    models::game_records,
    views::game_records::{GameRecordListResponse, GameRecordResponse},
};

#[derive(Debug, Deserialize)]
pub struct ListParams {
    pub limit: Option<u64>,
    pub offset: Option<u64>,
}

#[debug_handler]
async fn list(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Query(params): Query<ListParams>,
) -> Result<Response> {
    let limit = params.limit.unwrap_or(20).min(100);
    let offset = params.offset.unwrap_or(0);
    let user_pid = &auth.claims.pid;

    let (records, total) =
        game_records::Model::find_by_player_pid(&ctx.db, user_pid, limit, offset).await?;

    let records: Vec<GameRecordResponse> =
        records.iter().map(GameRecordResponse::from_model).collect();

    format::json(GameRecordListResponse { records, total })
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("/api/game-records")
        .add("/", get(list))
}
