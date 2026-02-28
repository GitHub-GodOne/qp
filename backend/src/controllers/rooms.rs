use crate::{
    game::room::ROOM_MANAGER,
    models::{_entities::users, rooms, users::Model as UserModel},
    views::rooms::{RoomListResponse, RoomResponse},
};
use loco_rs::prelude::*;
use sea_orm::ActiveValue;
use serde::Deserialize;
use serde_json;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct CreateRoomParams {
    pub name: String,
    pub max_players: Option<i16>,
}

#[debug_handler]
async fn create(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Json(params): Json<CreateRoomParams>,
) -> Result<Response> {
    let owner_pid = Uuid::parse_str(&auth.claims.pid).map_err(|e| Error::string(&e.to_string()))?;

    // Check if user has enough cards
    let user = UserModel::find_by_pid(&ctx.db, &auth.claims.pid)
        .await
        .map_err(|_| Error::string("user not found"))?;
    if user.cards <= 0 {
        return bad_request("房卡不足，无法创建房间");
    }

    // Deduct 1 card
    let mut active: users::ActiveModel = user.into();
    active.cards = ActiveValue::Set(active.cards.unwrap() - 1);
    active
        .update(&ctx.db)
        .await
        .map_err(|e| Error::string(&e.to_string()))?;

    let max_players = params.max_players.unwrap_or(6);
    let room = rooms::Model::create(&ctx.db, owner_pid, &params.name, max_players).await?;

    // 同时在内存中创建 GameRoom，供 WebSocket 使用
    ROOM_MANAGER.create_room(&room.room_id, &auth.claims.pid, max_players as usize);

    format::json(RoomResponse::new(&room))
}

#[debug_handler]
async fn list(_auth: auth::JWT, State(ctx): State<AppContext>) -> Result<Response> {
    let rooms = rooms::Model::list_waiting(&ctx.db).await?;
    let list: Vec<RoomResponse> = rooms.iter().map(RoomResponse::new).collect();
    format::json(RoomListResponse { rooms: list })
}

#[debug_handler]
async fn get_one(
    _auth: auth::JWT,
    State(ctx): State<AppContext>,
    Path(room_id): Path<String>,
) -> Result<Response> {
    let room = rooms::Model::find_by_room_id(&ctx.db, &room_id).await?;
    format::json(RoomResponse::new(&room))
}

#[debug_handler]
async fn quick_join(auth: auth::JWT, State(ctx): State<AppContext>) -> Result<Response> {
    // 金币不足300，拦截快速加入
    let user = UserModel::find_by_pid(&ctx.db, &auth.claims.pid)
        .await
        .map_err(|_| Error::string("user not found"))?;
    if user.gold < 300 {
        return bad_request("金币不足300，无法快速加入房间");
    }

    // 优先从内存中找有空位且准备人数最多的房间
    if let Some(room_id) = ROOM_MANAGER.find_available_room() {
        return format::json(serde_json::json!({ "room_id": room_id }));
    }

    // 内存中没有，从数据库查 waiting 房间，取第一个并在内存中创建
    let db_rooms = rooms::Model::list_waiting(&ctx.db)
        .await
        .map_err(|e| Error::string(&e.to_string()))?;

    if let Some(room) = db_rooms.first() {
        if !ROOM_MANAGER.room_exists(&room.room_id) {
            ROOM_MANAGER.create_room(
                &room.room_id,
                &room.owner_pid.to_string(),
                room.max_players as usize,
            );
        }
        return format::json(serde_json::json!({ "room_id": room.room_id }));
    }

    bad_request("没有可用的房间，请创建新房间")
}

#[debug_handler]
async fn remove(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Path(room_id): Path<String>,
) -> Result<Response> {
    let owner_pid = Uuid::parse_str(&auth.claims.pid).map_err(|e| Error::string(&e.to_string()))?;
    rooms::Model::delete_by_room_id(&ctx.db, &room_id, owner_pid).await?;
    format::json(())
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("/api/rooms")
        .add("/", post(create))
        .add("/", get(list))
        .add("/quick-join", post(quick_join))
        .add("/{room_id}", get(get_one))
        .add("/{room_id}", delete(remove))
}
