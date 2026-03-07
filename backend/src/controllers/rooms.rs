use crate::{
    game::room::ROOM_MANAGER,
    game::room_type::RoomType,
    game::room_config::{RoomConfig, PaymentType, BankerType, MultiplyRule, SpecialCard, JokerRule, FlowerRule},
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
    pub room_type: Option<String>,
    pub room_password: Option<String>, // 7位数房间密码
    // 房间配置
    pub payment_type: Option<String>,
    pub rounds: Option<u16>,
    pub banker_type: Option<String>,
    pub max_banker_multi: Option<u8>,
    pub idle_push_multi: Option<u8>,
    pub base_score_numerator: Option<u8>,
    pub base_score_denominator: Option<u8>,
    pub multiply_rule: Option<String>,
    pub special_cards: Option<Vec<String>>,
    pub joker_rule: Option<String>,
    pub flower_rule: Option<String>,
}

#[debug_handler]
async fn create(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Json(params): Json<CreateRoomParams>,
) -> Result<Response> {
    let owner_pid = Uuid::parse_str(&auth.claims.pid).map_err(|e| Error::string(&e.to_string()))?;

    // 验证房间密码
    let room_password = params.room_password.as_deref();
    if let Some(pwd) = room_password {
        // 验证密码格式：必须是7位数字
        if pwd.len() != 7 || !pwd.chars().all(|c| c.is_ascii_digit()) {
            return bad_request("房间密码必须是7位数字");
        }

        // 检查密码是否已存在
        if rooms::Model::find_by_password(&ctx.db, pwd).await.is_ok() {
            return bad_request("房间密码已存在，请更换密码");
        }
    } else {
        return bad_request("请输入房间密码");
    }

    // Check if user has enough cards
    let user = UserModel::find_by_pid(&ctx.db, &auth.claims.pid)
        .await
        .map_err(|_| Error::string("user not found"))?;
    if user.cards <= 0 {
        return bad_request("房卡不足，无法创建房间");
    }

    // Parse room type, default to Newbie
    let room_type = params
        .room_type
        .as_deref()
        .and_then(RoomType::from_str)
        .unwrap_or(RoomType::Newbie);

    // Parse room config
    let payment_type = match params.payment_type.as_deref() {
        Some("Owner") => PaymentType::Owner,
        Some("Winner") => PaymentType::Winner,
        _ => PaymentType::AA,
    };

    let banker_type = match params.banker_type.as_deref() {
        Some("NoBullDown") => BankerType::NoBullDown,
        Some("Compare") => BankerType::Compare,
        _ => BankerType::OpenCard,
    };

    let multiply_rule = match params.multiply_rule.as_deref() {
        Some("Crazy") => MultiplyRule::Crazy,
        _ => MultiplyRule::Classic,
    };

    let special_cards = params.special_cards.as_ref().map_or(vec![], |cards| {
        cards.iter().filter_map(|s| match s.as_str() {
            "StraightFlush" => Some(SpecialCard::StraightFlush),
            "Bomb" => Some(SpecialCard::Bomb),
            "FiveSmall" => Some(SpecialCard::FiveSmall),
            "FullHouse" => Some(SpecialCard::FullHouse),
            "Flush" => Some(SpecialCard::Flush),
            "FiveFace" => Some(SpecialCard::FiveFace),
            "Straight" => Some(SpecialCard::Straight),
            _ => None,
        }).collect()
    });

    let joker_rule = match params.joker_rule.as_deref() {
        Some("Classic") => JokerRule::Classic,
        _ => JokerRule::None,
    };

    let flower_rule = match params.flower_rule.as_deref() {
        Some("NoFlowerWith10") => FlowerRule::NoFlowerWith10,
        Some("NoFlowerNo10") => FlowerRule::NoFlowerNo10,
        _ => FlowerRule::WithFlower,
    };

    let config = RoomConfig {
        payment_type,
        max_players: params.max_players.unwrap_or(6) as u8,
        rounds: params.rounds.unwrap_or(10),
        banker_type,
        max_banker_multi: params.max_banker_multi.unwrap_or(1),
        idle_push_multi: params.idle_push_multi.unwrap_or(0),
        base_score_numerator: params.base_score_numerator.unwrap_or(1),
        base_score_denominator: params.base_score_denominator.unwrap_or(2),
        multiply_rule,
        special_cards,
        joker_rule,
        flower_rule,
    };

    // Validate config
    if !config.is_valid() {
        return bad_request("房间配置无效");
    }

    tracing::info!(
        "创建房间配置: payment_type={:?}, max_players={}, rounds={}, base_score={}/{}",
        config.payment_type,
        config.max_players,
        config.rounds,
        config.base_score_numerator,
        config.base_score_denominator
    );

    // Deduct 1 card
    let mut active: users::ActiveModel = user.into();
    active.cards = ActiveValue::Set(active.cards.unwrap() - 1);
    active
        .update(&ctx.db)
        .await
        .map_err(|e| Error::string(&e.to_string()))?;

    let max_players = config.max_players as i16;
    let room = rooms::Model::create(&ctx.db, owner_pid, &params.name, max_players, params.room_password).await?;

    // 同时在内存中创建 GameRoom，供 WebSocket 使用
    // 自定义房间不检查金币限制
    ROOM_MANAGER.create_room(&room.room_id, &auth.claims.pid, max_players as usize, room_type, config, true);

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

#[derive(Debug, Deserialize)]
pub struct QuickJoinParams {
    pub room_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct JoinByPasswordParams {
    pub password: String,
}

#[debug_handler]
async fn join_by_password(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Json(params): Json<JoinByPasswordParams>,
) -> Result<Response> {
    // 验证密码格式
    if params.password.len() != 7 || !params.password.chars().all(|c| c.is_ascii_digit()) {
        return bad_request("房间密码必须是7位数字");
    }

    // 查找房间
    let room = rooms::Model::find_by_password(&ctx.db, &params.password)
        .await
        .map_err(|_| Error::string("房间不存在或已关闭"))?;

    // 检查房间是否在内存中（是否还在运行）
    if !ROOM_MANAGER.room_exists(&room.room_id) {
        return bad_request("房间已关闭");
    }

    format::json(serde_json::json!({ "room_id": room.room_id }))
}

#[debug_handler]
async fn quick_join(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Query(params): Query<QuickJoinParams>,
) -> Result<Response> {
    // Parse room type, default to Newbie
    let room_type = params
        .room_type
        .as_deref()
        .and_then(RoomType::from_str)
        .unwrap_or(RoomType::Newbie);

    // 获取用户信息
    let user = UserModel::find_by_pid(&ctx.db, &auth.claims.pid)
        .await
        .map_err(|_| Error::string("user not found"))?;

    // 检查用户金币是否满足进入条件
    if !room_type.can_enter(user.gold as u32) {
        let min = room_type.min_coins();
        let max = room_type.max_coins();
        let msg = if let Some(max_coins) = max {
            format!(
                "金币不足或超出范围，{}需要{}-{}金币",
                room_type.display_name(),
                min,
                max_coins
            )
        } else {
            format!(
                "金币不足，{}需要{}金币以上",
                room_type.display_name(),
                min
            )
        };
        return bad_request(&msg);
    }

    // 优先从内存中找对应类型的有空位且准备人数最多的房间
    if let Some(room_id) = ROOM_MANAGER.find_available_room(room_type) {
        return format::json(serde_json::json!({ "room_id": room_id }));
    }

    // 内存中没有，自动创建新房间
    let room_id = Uuid::new_v4().to_string();
    let room_name = format!("{}_{}", room_type.display_name(), &room_id[..8]);

    // 在数据库中创建房间记录（系统房间不需要密码）
    let owner_pid = Uuid::parse_str(&auth.claims.pid).map_err(|e| Error::string(&e.to_string()))?;
    let _room = rooms::Model::create(&ctx.db, owner_pid, &room_name, 6, None).await?;

    // 使用默认配置创建房间
    let config = RoomConfig::default();

    // 在内存中创建 GameRoom，系统房间需要检查金币
    ROOM_MANAGER.create_room(&room_id, &auth.claims.pid, 6, room_type, config, false);

    format::json(serde_json::json!({ "room_id": room_id }))
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
        .add("/quick-join", get(quick_join))
        .add("/join-by-password", post(join_by_password))
        .add("/{room_id}", get(get_one))
        .add("/{room_id}", delete(remove))
}
