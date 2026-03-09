use axum::{
    extract::{
        ws::{Message, WebSocket},
        Query, WebSocketUpgrade,
    },
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use loco_rs::{auth::jwt, prelude::*};
use sea_orm::{ActiveModelTrait, ActiveValue, DatabaseConnection, EntityTrait};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Duration;

use crate::game::{
    bull_bull,
    deck::{Card, Deck},
    room::{GamePhase, RoomStatus, ROOM_MANAGER},
};

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    pub token: String,
    pub room_id: String,
}

#[derive(Debug, Deserialize)]
struct ClientMsg {
    #[serde(rename = "type")]
    msg_type: String,
    #[serde(default)]
    ready: Option<bool>,
    #[serde(default)]
    wants: Option<bool>,
    #[serde(default)]
    amount: Option<u32>,
    #[serde(default)]
    text: Option<String>,
    #[serde(default)]
    seat: Option<usize>,
}

#[derive(Debug, Serialize)]
struct ServerMsg {
    #[serde(rename = "type")]
    msg_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

impl ServerMsg {
    fn event(msg_type: &str, data: serde_json::Value) -> String {
        serde_json::to_string(&Self {
            msg_type: msg_type.to_string(),
            data: Some(data),
            error: None,
        })
        .unwrap_or_default()
    }

    fn error(msg: &str) -> String {
        serde_json::to_string(&Self {
            msg_type: "error".to_string(),
            data: None,
            error: Some(msg.to_string()),
        })
        .unwrap_or_default()
    }
}
async fn ws_handler(
    ws: WebSocketUpgrade,
    State(ctx): State<AppContext>,
    Query(query): Query<WsQuery>,
) -> impl IntoResponse {
    let jwt_secret = ctx.config.get_jwt_config().unwrap();
    let claims = jwt::JWT::new(&jwt_secret.secret).validate(&query.token);
    match claims {
        Ok(claims) => {
            let user_pid = claims.claims.pid.clone();
            let room_id = query.room_id.clone();
            // Query user name and gold from DB
            let db = &ctx.db;
            let user = crate::models::_entities::users::Entity::find()
                .filter(
                    crate::models::_entities::users::Column::Pid
                        .eq(uuid::Uuid::parse_str(&user_pid).unwrap_or_default()),
                )
                .one(db)
                .await;
            let (user_name, user_gold) = match user {
                Ok(Some(u)) => (u.name, u.gold as u32),
                _ => (user_pid.clone(), 1000),
            };
            ws.on_upgrade(move |socket| {
                handle_socket(
                    socket,
                    user_pid,
                    user_name,
                    user_gold,
                    room_id,
                    ctx.db.clone(),
                )
            })
        }
        Err(_) => ws.on_upgrade(|socket| async {
            let (mut tx, _) = socket.split();
            let _ = tx
                .send(Message::Text(ServerMsg::error("invalid token").into()))
                .await;
        }),
    }
}

fn room_state_msg(room_id: &str) -> Option<String> {
    ROOM_MANAGER.with_room(room_id, |room| {
        let players: Vec<serde_json::Value> = room
            .players
            .iter()
            .map(|p| {
                json!({
                    "user_pid": p.user_pid,
                    "name": p.name,
                    "seat": p.seat,
                    "is_ready": p.is_ready,
                    "is_banker": p.is_banker,
                    "bet_amount": p.bet_amount,
                    "coins": p.coins,
                    "wants_banker": p.wants_banker,
                    "is_offline": p.is_offline,
                    "is_ai": p.is_ai,
                })
            })
            .collect();
        ServerMsg::event(
            "room_state",
            json!({
                "room_id": room.room_id,
                "owner_pid": room.owner_pid,
                "status": room.status,
                "phase": room.phase,
                "banker_pid": room.banker_pid,
                "base_bet": room.base_bet,
                "players": players,
            }),
        )
    })
}
async fn handle_socket(
    socket: WebSocket,
    user_pid: String,
    user_name: String,
    user_gold: u32,
    room_id: String,
    db: DatabaseConnection,
) {
    let (mut ws_tx, mut ws_rx) = socket.split();

    // Subscribe to room broadcast
    let mut rx = match ROOM_MANAGER.subscribe(&room_id) {
        Some(rx) => rx,
        None => {
            let _ = ws_tx
                .send(Message::Text(ServerMsg::error("room not found").into()))
                .await;
            return;
        }
    };

    // Auto join on connect
    let join_result = ROOM_MANAGER.with_room(&room_id, |room| {
        // 自定义房间不检查金币限制，系统房间需要检查
        if !room.is_custom && !room.room_type.can_enter(user_gold) {
            return Err("金币不足或超出房间要求");
        }
        room.add_player(&user_pid, &user_name, user_gold)
    });
    match join_result {
        Some(Ok(_seat)) => {
            // Broadcast to all existing players
            if let Some(msg) = room_state_msg(&room_id) {
                ROOM_MANAGER.broadcast(&room_id, &msg);
            }
            // Also send room_state directly to the new player (they may not
            // have received the broadcast if subscription happened before join)
            if let Some(state) = room_state_msg(&room_id) {
                let _ = ws_tx.send(Message::Text(state.into())).await;
            }
        }
        Some(Err(e)) => {
            let _ = ws_tx.send(Message::Text(ServerMsg::error(e).into())).await;
            return;
        }
        None => {
            let _ = ws_tx
                .send(Message::Text(ServerMsg::error("room not found").into()))
                .await;
            return;
        }
    }

    let room_id_clone = room_id.clone();
    let user_pid_clone = user_pid.clone();

    // Broadcast receiver → WebSocket sender
    let mut send_task = tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(msg) => {
                    if ws_tx.send(Message::Text(msg.into())).await.is_err() {
                        break;
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                Err(_) => break,
            }
        }
    });

    // WebSocket receiver → game logic
    let db_for_cleanup = db.clone();
    let db_clone = db;
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_rx.next().await {
            let text = match msg {
                Message::Text(t) => t.to_string(),
                Message::Close(_) => break,
                _ => continue,
            };
            let Ok(client_msg) = serde_json::from_str::<ClientMsg>(&text) else {
                continue;
            };
            handle_client_msg(&client_msg, &user_pid_clone, &room_id_clone, &db_clone);
        }
    });

    // Wait for either task to finish, then abort the other
    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    }

    // Cleanup: remove player on disconnect
    let phase_info = ROOM_MANAGER.with_room(&room_id, |room| {
        room.remove_player(&user_pid);
        (
            room.phase,
            room.all_banker_responded(),
            room.all_bets_placed(),
        )
    });
    if let Some(msg) = room_state_msg(&room_id) {
        ROOM_MANAGER.broadcast(&room_id, &msg);
    }
    // Offline player's auto-filled actions may advance the phase
    if let Some((phase, all_grab, all_bets)) = phase_info {
        if phase == GamePhase::GrabBanker && all_grab {
            ROOM_MANAGER.with_room(&room_id, |room| {
                if let Some(h) = room.timeout_handle.take() {
                    h.abort();
                }
            });
            select_banker(&room_id);
            if let Some(state) = room_state_msg(&room_id) {
                ROOM_MANAGER.broadcast(&room_id, &state);
            }
            // 延迟进入下注阶段，让前端有时间播放选庄动画
            let rid = room_id.clone();
            let db2 = db_for_cleanup.clone();
            tokio::spawn(async move {
                tokio::time::sleep(Duration::from_millis(4000)).await;
                enter_betting(&rid, &db2);
            });
        } else if phase == GamePhase::Betting && all_bets {
            ROOM_MANAGER.with_room(&room_id, |room| {
                if let Some(h) = room.timeout_handle.take() {
                    h.abort();
                }
            });
            let rid = room_id.clone();
            let db2 = db_for_cleanup.clone();
            tokio::spawn(async move {
                deal_and_settle_async(&rid, &db2).await;
            });
        }
    }
}
fn handle_client_msg(msg: &ClientMsg, user_pid: &str, room_id: &str, db: &DatabaseConnection) {
    match msg.msg_type.as_str() {
        "leave_room" => {
            let phase_info = ROOM_MANAGER.with_room(room_id, |room| {
                room.remove_player(user_pid);
                (
                    room.phase,
                    room.all_banker_responded(),
                    room.all_bets_placed(),
                )
            });
            let notify = ServerMsg::event("player_left", json!({ "user_pid": user_pid }));
            ROOM_MANAGER.broadcast(room_id, &notify);
            if let Some(state) = room_state_msg(room_id) {
                ROOM_MANAGER.broadcast(room_id, &state);
            }
            // Offline player's auto-filled actions may advance the phase
            if let Some((phase, all_grab, all_bets)) = phase_info {
                if phase == GamePhase::GrabBanker && all_grab {
                    ROOM_MANAGER.with_room(room_id, |room| {
                        if let Some(h) = room.timeout_handle.take() {
                            h.abort();
                        }
                    });
                    select_banker(room_id);
                    if let Some(state) = room_state_msg(room_id) {
                        ROOM_MANAGER.broadcast(room_id, &state);
                    }
                    // 延迟进入下注阶段，让前端有时间播放选庄动画
                    let rid = room_id.to_string();
                    let db2 = db.clone();
                    tokio::spawn(async move {
                        tokio::time::sleep(Duration::from_millis(4000)).await;
                        enter_betting(&rid, &db2);
                    });
                } else if phase == GamePhase::Betting && all_bets {
                    ROOM_MANAGER.with_room(room_id, |room| {
                        if let Some(h) = room.timeout_handle.take() {
                            h.abort();
                        }
                    });
                    let rid = room_id.to_string();
                    let db2 = db.clone();
                    tokio::spawn(async move {
                        deal_and_settle_async(&rid, &db2).await;
                    });
                }
            }
        }
        "ready" => {
            let ready = msg.ready.unwrap_or(true);
            // 检查金币是否满足房间要求（仅对系统房间检查）
            if ready {
                let check_result = ROOM_MANAGER
                    .with_room(room_id, |room| {
                        let player = room.players.iter().find(|p| p.user_pid == user_pid)?;
                        Some((player.coins, room.room_type, room.is_custom))
                    })
                    .flatten();
                if let Some((coins, room_type, is_custom)) = check_result {
                    // 自定义房间只要金币大于0即可，系统房间需要检查范围
                    let should_kick = if is_custom {
                        coins == 0
                    } else {
                        !room_type.can_enter(coins)
                    };

                    if should_kick {
                        ROOM_MANAGER.with_room(room_id, |room| {
                            room.remove_player(user_pid);
                        });
                        let reason = if is_custom {
                            "金币不足，无法继续游戏".to_string()
                        } else {
                            let min = room_type.min_coins();
                            let max = room_type.max_coins();
                            if let Some(max_coins) = max {
                                format!(
                                    "金币不在范围内，{}需要{}-{}金币",
                                    room_type.display_name(),
                                    min,
                                    max_coins
                                )
                            } else {
                                format!(
                                    "金币不足{}，无法在{}继续游戏",
                                    min,
                                    room_type.display_name()
                                )
                            }
                        };
                        let kick_msg = ServerMsg::event(
                            "kicked",
                            json!({ "target_pid": user_pid, "reason": reason }),
                        );
                        ROOM_MANAGER.broadcast(room_id, &kick_msg);
                        if let Some(state) = room_state_msg(room_id) {
                            ROOM_MANAGER.broadcast(room_id, &state);
                        }
                        return;
                    }
                }
            }
            let should_start = ROOM_MANAGER.with_room(room_id, |room| {
                room.set_ready(user_pid, ready);
                room.phase == GamePhase::Waiting && room.all_ready()
            });
            if let Some(state) = room_state_msg(room_id) {
                ROOM_MANAGER.broadcast(room_id, &state);
            }

            // AI玩家自动准备
            if ready {
                let rid = room_id.to_string();
                let db2 = db.clone();
                tokio::spawn(async move {
                    tokio::time::sleep(Duration::from_millis(800)).await;
                    let should_start = ROOM_MANAGER.with_room(&rid, |room| {
                        if room.phase != GamePhase::Waiting {
                            return false;
                        }
                        // 让所有AI玩家自动准备
                        for p in &mut room.players {
                            if p.is_ai && !p.is_ready {
                                p.is_ready = true;
                            }
                        }
                        room.all_ready()
                    });

                    if let Some(state) = room_state_msg(&rid) {
                        ROOM_MANAGER.broadcast(&rid, &state);
                    }

                    if should_start == Some(true) {
                        enter_grab_banker(&rid, &db2);
                    }
                });
            }

            if should_start == Some(true) {
                enter_grab_banker(room_id, db);
            }
        }
        "start_game" => {
            // Manual start: check all ready and phase is Waiting
            let can_start = ROOM_MANAGER.with_room(room_id, |room| {
                room.phase == GamePhase::Waiting && room.all_ready()
            });
            if can_start == Some(true) {
                enter_grab_banker(room_id, db);
            }
        }
        "grab_banker" => {
            let wants = msg.wants.unwrap_or(false);
            let all_responded = ROOM_MANAGER.with_room(room_id, |room| {
                if room.phase != GamePhase::GrabBanker {
                    return false;
                }
                if let Some(p) = room.players.iter_mut().find(|p| p.user_pid == user_pid) {
                    p.wants_banker = Some(wants);
                }
                room.all_banker_responded()
            });
            // Broadcast so all clients see who grabbed/passed
            if let Some(state) = room_state_msg(room_id) {
                ROOM_MANAGER.broadcast(room_id, &state);
            }
            if all_responded == Some(true) {
                // Abort timeout
                ROOM_MANAGER.with_room(room_id, |room| {
                    if let Some(h) = room.timeout_handle.take() {
                        h.abort();
                    }
                });
                select_banker(room_id);
                if let Some(state) = room_state_msg(room_id) {
                    ROOM_MANAGER.broadcast(room_id, &state);
                }
                // 延迟进入下注阶段，让前端有时间播放选庄动画
                let rid = room_id.to_string();
                let db2 = db.clone();
                tokio::spawn(async move {
                    tokio::time::sleep(Duration::from_millis(4000)).await;
                    enter_betting(&rid, &db2);
                });
            }
        }
        "set_bet" => {
            let amount = msg.amount.unwrap_or(3);
            let valid_amount = match amount {
                3 | 6 | 10 => amount,
                _ => 3,
            };
            let all_bets = ROOM_MANAGER.with_room(room_id, |room| {
                if room.phase != GamePhase::Betting {
                    return false;
                }
                if let Some(p) = room
                    .players
                    .iter_mut()
                    .find(|p| p.user_pid == user_pid && !p.is_banker)
                {
                    p.bet_amount = Some(valid_amount);
                }
                room.all_bets_placed()
            });
            // Broadcast updated state so everyone sees the bet
            if let Some(state) = room_state_msg(room_id) {
                ROOM_MANAGER.broadcast(room_id, &state);
            }
            if all_bets == Some(true) {
                // Abort timeout
                ROOM_MANAGER.with_room(room_id, |room| {
                    if let Some(h) = room.timeout_handle.take() {
                        h.abort();
                    }
                });
                let rid = room_id.to_string();
                let db2 = db.clone();
                tokio::spawn(async move {
                    deal_and_settle_async(&rid, &db2).await;
                });
            }
        }
        "get_room_state" => {
            if let Some(state) = room_state_msg(room_id) {
                ROOM_MANAGER.broadcast(room_id, &state);
            }
        }
        "send_chat" => {
            if let Some(text) = &msg.text {
                let trimmed = text.trim();
                if !trimmed.is_empty() && trimmed.len() <= 200 {
                    let player_name = ROOM_MANAGER
                        .with_room(room_id, |room| {
                            room.players
                                .iter()
                                .find(|p| p.user_pid == user_pid)
                                .map(|p| p.name.clone())
                        })
                        .flatten()
                        .unwrap_or_default();
                    let chat_msg = ServerMsg::event(
                        "chat_message",
                        json!({
                            "user_pid": user_pid,
                            "name": player_name,
                            "text": trimmed,
                        }),
                    );
                    ROOM_MANAGER.broadcast(room_id, &chat_msg);
                }
            }
        }
        "add_ai_player" => {
            // Only allow adding AI if room is in Waiting phase
            let can_add = ROOM_MANAGER.with_room(room_id, |room| {
                room.phase == GamePhase::Waiting && room.players.len() < room.max_players
            });

            if can_add == Some(true) {
                let target_seat = msg.seat;
                let result =
                    ROOM_MANAGER.with_room(room_id, |room| room.add_ai_player(target_seat));

                match result {
                    Some(Ok(seat)) => {
                        // Broadcast updated room state
                        if let Some(state) = room_state_msg(room_id) {
                            ROOM_MANAGER.broadcast(room_id, &state);
                        }

                        // AI auto-ready after joining - spawn async task
                        let ai_pid = ROOM_MANAGER
                            .with_room(room_id, |room| {
                                room.players
                                    .iter()
                                    .find(|p| p.seat == seat && p.is_ai)
                                    .map(|p| p.user_pid.clone())
                            })
                            .flatten();

                        if let Some(ai_pid) = ai_pid {
                            let rid = room_id.to_string();
                            let db2 = db.clone();
                            tokio::spawn(async move {
                                tokio::time::sleep(Duration::from_millis(500)).await;
                                let should_start = ROOM_MANAGER.with_room(&rid, |room| {
                                    room.set_ready(&ai_pid, true);
                                    room.phase == GamePhase::Waiting && room.all_ready()
                                });

                                if let Some(state) = room_state_msg(&rid) {
                                    ROOM_MANAGER.broadcast(&rid, &state);
                                }

                                if should_start == Some(true) {
                                    enter_grab_banker(&rid, &db2);
                                }
                            });
                        }
                    }
                    Some(Err(e)) => {
                        let err_msg = ServerMsg::error(e);
                        ROOM_MANAGER.broadcast(room_id, &err_msg);
                    }
                    None => {}
                }
            }
        }
        _ => {}
    }
}

fn enter_grab_banker(room_id: &str, db: &DatabaseConnection) {
    let transitioned = ROOM_MANAGER.with_room(room_id, |room| {
        if room.phase != GamePhase::Waiting {
            return false;
        }
        room.status = RoomStatus::Playing;
        room.phase = GamePhase::GrabBanker;
        true
    });
    if transitioned != Some(true) {
        return;
    }
    let msg = ServerMsg::event("grab_banker_phase", json!({ "countdown_secs": 10 }));
    ROOM_MANAGER.broadcast(room_id, &msg);
    // Also broadcast room_state so clients can recover phase from state
    if let Some(state) = room_state_msg(room_id) {
        ROOM_MANAGER.broadcast(room_id, &state);
    }

    // AI players auto-respond immediately
    let rid_for_ai = room_id.to_string();
    let db_for_ai = db.clone();
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(800)).await;
        let all_responded = ROOM_MANAGER.with_room(&rid_for_ai, |room| {
            use crate::game::ai_player::AIPlayer;
            let room_type = room.room_type;
            for p in &mut room.players {
                if p.is_ai && p.wants_banker.is_none() {
                    // AI always grabs banker
                    p.wants_banker = Some(AIPlayer::new(p.seat, room_type).decide_grab_banker());
                }
            }
            room.all_banker_responded()
        });

        if let Some(state) = room_state_msg(&rid_for_ai) {
            ROOM_MANAGER.broadcast(&rid_for_ai, &state);
        }

        if all_responded == Some(true) {
            ROOM_MANAGER.with_room(&rid_for_ai, |room| {
                if let Some(h) = room.timeout_handle.take() {
                    h.abort();
                }
            });
            select_banker(&rid_for_ai);
            if let Some(state) = room_state_msg(&rid_for_ai) {
                ROOM_MANAGER.broadcast(&rid_for_ai, &state);
            }
            // 延迟进入下注阶段，让前端有时间播放选庄动画
            tokio::time::sleep(Duration::from_millis(4000)).await;
            enter_betting(&rid_for_ai, &db_for_ai);
        }
    });

    // Spawn timeout task
    let rid = room_id.to_string();
    let db2 = db.clone();
    let handle = tokio::spawn(async move {
        tokio::time::sleep(Duration::from_secs(10)).await;
        // Auto-fill unresponded players as not wanting banker
        let should_proceed = ROOM_MANAGER.with_room(&rid, |room| {
            if room.phase != GamePhase::GrabBanker {
                return false;
            }
            for p in &mut room.players {
                if p.wants_banker.is_none() {
                    p.wants_banker = Some(false);
                }
            }
            true
        });
        if should_proceed == Some(true) {
            // Broadcast so clients see auto-filled wants_banker before banker selection
            if let Some(state) = room_state_msg(&rid) {
                ROOM_MANAGER.broadcast(&rid, &state);
            }
            select_banker(&rid);
            // 延迟进入下注阶段，让前端有时间播放选庄动画
            tokio::time::sleep(Duration::from_millis(4000)).await;
            enter_betting(&rid, &db2);
        }
    });
    ROOM_MANAGER.with_room(room_id, |room| {
        room.timeout_handle = Some(handle);
    });
}

fn select_banker(room_id: &str) {
    use rand::seq::SliceRandom;

    let result = ROOM_MANAGER.with_room(room_id, |room| {
        let candidates: Vec<serde_json::Value> = room
            .players
            .iter()
            .filter(|p| p.wants_banker == Some(true))
            .map(|p| json!({ "user_pid": p.user_pid, "seat": p.seat }))
            .collect();

        let candidate_pids: Vec<String> = room
            .players
            .iter()
            .filter(|p| p.wants_banker == Some(true))
            .map(|p| p.user_pid.clone())
            .collect();

        let chosen = if candidate_pids.is_empty() {
            // No one wanted banker — pick randomly from all players
            room.players
                .choose(&mut rand::thread_rng())
                .map(|p| p.user_pid.clone())
                .unwrap_or_default()
        } else {
            candidate_pids
                .choose(&mut rand::thread_rng())
                .cloned()
                .unwrap_or_default()
        };

        room.banker_pid = Some(chosen.clone());
        for p in &mut room.players {
            p.is_banker = p.user_pid == chosen;
        }
        (chosen, candidates)
    });

    if let Some((pid, candidates)) = result {
        let msg = ServerMsg::event(
            "banker_selected",
            json!({ "banker_pid": pid, "candidates": candidates }),
        );
        ROOM_MANAGER.broadcast(room_id, &msg);
    }
}

fn enter_betting(room_id: &str, db: &DatabaseConnection) {
    ROOM_MANAGER.with_room(room_id, |room| {
        room.phase = GamePhase::Betting;
    });
    let banker_pid = ROOM_MANAGER
        .with_room(room_id, |room| room.banker_pid.clone())
        .flatten();
    let msg = ServerMsg::event(
        "betting_phase",
        json!({ "banker_pid": banker_pid, "countdown_secs": 10 }),
    );
    ROOM_MANAGER.broadcast(room_id, &msg);

    // AI players auto-bet immediately (always max)
    let rid_for_ai = room_id.to_string();
    let db_for_ai = db.clone();
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(800)).await;
        let all_bets = ROOM_MANAGER.with_room(&rid_for_ai, |room| {
            use crate::game::ai_player::AIPlayer;
            let room_type = room.room_type;
            for p in &mut room.players {
                if p.is_ai && !p.is_banker && p.bet_amount.is_none() {
                    // AI always bets max (10)
                    let available = vec![3, 6, 10];
                    p.bet_amount =
                        Some(AIPlayer::new(p.seat, room_type).decide_bet_amount(&available) as u32);
                }
            }
            room.all_bets_placed()
        });

        if let Some(state) = room_state_msg(&rid_for_ai) {
            ROOM_MANAGER.broadcast(&rid_for_ai, &state);
        }

        if all_bets == Some(true) {
            ROOM_MANAGER.with_room(&rid_for_ai, |room| {
                if let Some(h) = room.timeout_handle.take() {
                    h.abort();
                }
            });
            deal_and_settle_async(&rid_for_ai, &db_for_ai).await;
        }
    });

    // Spawn timeout task
    let rid = room_id.to_string();
    let db2 = db.clone();
    let handle = tokio::spawn(async move {
        tokio::time::sleep(Duration::from_secs(10)).await;
        // Auto-fill unbet non-banker players with default 3
        let should_proceed = ROOM_MANAGER.with_room(&rid, |room| {
            if room.phase != GamePhase::Betting {
                return false;
            }
            for p in &mut room.players {
                if !p.is_banker && p.bet_amount.is_none() {
                    p.bet_amount = Some(3);
                }
            }
            true
        });
        if should_proceed == Some(true) {
            // Broadcast so clients see auto-filled bets before dealing
            if let Some(state) = room_state_msg(&rid) {
                ROOM_MANAGER.broadcast(&rid, &state);
            }
            deal_and_settle_async(&rid, &db2).await;
        }
    });
    ROOM_MANAGER.with_room(room_id, |room| {
        room.timeout_handle = Some(handle);
    });
}

async fn deal_and_settle_async(room_id: &str, db: &DatabaseConnection) {
    ROOM_MANAGER.with_room(room_id, |room| {
        room.phase = GamePhase::Dealing;
    });

    // Notify all bets are in
    let bets: Vec<serde_json::Value> = ROOM_MANAGER
        .with_room(room_id, |room| {
            room.players
                .iter()
                .map(|p| {
                    json!({
                        "user_pid": p.user_pid,
                        "seat": p.seat,
                        "is_banker": p.is_banker,
                        "bet_amount": p.bet_amount,
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    let bets_msg = ServerMsg::event("all_bets_placed", json!({ "players": bets }));
    ROOM_MANAGER.broadcast(room_id, &bets_msg);

    // Step 1: Broadcast dealing_start so all clients show card-back animations
    let seat_info: Vec<serde_json::Value> = ROOM_MANAGER
        .with_room(room_id, |room| {
            room.players
                .iter()
                .map(|p| json!({ "user_pid": p.user_pid, "seat": p.seat }))
                .collect()
        })
        .unwrap_or_default();
    let dealing_msg = ServerMsg::event("dealing_start", json!({ "players": seat_info }));
    ROOM_MANAGER.broadcast(room_id, &dealing_msg);

    // Wait for deal animation
    tokio::time::sleep(Duration::from_millis(1500)).await;

    // Step 2: Deal cards and evaluate
    let mut deck = Deck::new_shuffled();
    let player_pids: Vec<String> = ROOM_MANAGER
        .with_room(room_id, |room| {
            room.players.iter().map(|p| p.user_pid.clone()).collect()
        })
        .unwrap_or_default();

    let mut hands: Vec<(String, [crate::game::deck::Card; 5])> = Vec::new();
    for pid in &player_pids {
        if let Some(cards) = deck.deal(5) {
            let hand: [crate::game::deck::Card; 5] = cards.try_into().unwrap();
            let bull = bull_bull::evaluate(&hand);
            ROOM_MANAGER.with_room(room_id, |room| {
                if let Some(p) = room.players.iter_mut().find(|p| p.user_pid == *pid) {
                    p.hand = Some(hand.to_vec());
                    p.bull_type = Some(bull);
                }
            });
            hands.push((pid.clone(), hand));
        }
    }

    // Step 3: Send each player their own hand (original order, not arranged)
    for (pid, hand) in &hands {
        let targeted = ServerMsg::event(
            "game_started",
            json!({
                "target_pid": pid,
                "hand": hand,
            }),
        );
        ROOM_MANAGER.broadcast(room_id, &targeted);
    }

    // Wait for hand flip animation
    tokio::time::sleep(Duration::from_millis(1500)).await;

    // Step 4: Revealing phase — broadcast reveal_start
    ROOM_MANAGER.with_room(room_id, |room| {
        room.phase = GamePhase::Revealing;
    });
    let reveal_start_msg = ServerMsg::event("reveal_start", json!({}));
    ROOM_MANAGER.broadcast(room_id, &reveal_start_msg);

    // Step 5: Reveal each player one by one, sorted by seat
    let reveal_players: Vec<serde_json::Value> = ROOM_MANAGER
        .with_room(room_id, |room| {
            let mut list: Vec<serde_json::Value> = room
                .players
                .iter()
                .map(|p| {
                    // Arrange hand to show bull combination (left 3 cards sum to 10x, right 2 cards)
                    let arranged_hand = if let Some(ref hand) = p.hand {
                        if hand.len() == 5 {
                            let hand_array: [Card; 5] =
                                [hand[0], hand[1], hand[2], hand[3], hand[4]];
                            let arranged = bull_bull::arrange_hand(&hand_array);
                            Some(arranged.to_vec())
                        } else {
                            p.hand.clone()
                        }
                    } else {
                        None
                    };

                    json!({
                        "user_pid": p.user_pid,
                        "seat": p.seat,
                        "hand": p.hand,
                        "arranged_hand": arranged_hand,
                        "bull_type": p.bull_type,
                        "is_banker": p.is_banker,
                    })
                })
                .collect();
            list.sort_by_key(|v| v["seat"].as_u64().unwrap_or(0));
            list
        })
        .unwrap_or_default();

    for rp in &reveal_players {
        let reveal_msg = ServerMsg::event("reveal_player", rp.clone());
        ROOM_MANAGER.broadcast(room_id, &reveal_msg);
        tokio::time::sleep(Duration::from_millis(1200)).await;
    }

    tokio::time::sleep(Duration::from_millis(500)).await;

    // Step 5.5: Settlement — banker vs each non-banker
    ROOM_MANAGER.with_room(room_id, |room| {
        // Find banker index
        let banker_idx = room.players.iter().position(|p| p.is_banker);
        let Some(bi) = banker_idx else { return };
        let banker_bull = room.players[bi]
            .bull_type
            .unwrap_or(bull_bull::BullType::None);

        // Use room's base_bet instead of hardcoded 3000
        let base_bet = room.base_bet;

        // Collect non-banker settlement info
        let settlements: Vec<(usize, i32)> = room
            .players
            .iter()
            .enumerate()
            .filter(|(i, p)| *i != bi && !p.is_banker)
            .map(|(i, p)| {
                let player_bull = p.bull_type.unwrap_or(bull_bull::BullType::None);
                let bet = p.bet_amount.unwrap_or(3) as i32;
                let (winner_mult, banker_wins) = if banker_bull >= player_bull {
                    (banker_bull.multiplier() as i32, true)
                } else {
                    (player_bull.multiplier() as i32, false)
                };
                let raw_amount = base_bet as i32 * bet * winner_mult;
                if banker_wins {
                    // Player loses, banker gains
                    let actual = raw_amount.min(p.coins as i32);
                    (i, -actual)
                } else {
                    // Player wins, banker loses
                    let actual = raw_amount.min(room.players[bi].coins as i32);
                    (i, actual)
                }
            })
            .collect();

        // Apply settlements
        let mut banker_change: i32 = 0;
        for &(pi, change) in &settlements {
            room.players[pi].coins = (room.players[pi].coins as i32 + change).max(0) as u32;
            room.players[pi].coin_change = Some(change);
            banker_change -= change; // opposite of player
        }
        room.players[bi].coins = (room.players[bi].coins as i32 + banker_change).max(0) as u32;
        room.players[bi].coin_change = Some(banker_change);
    });

    // Step 5.6: Persist gold changes to DB (only for real players, not AI)
    let db_updates: Vec<(String, i64, bool)> = ROOM_MANAGER
        .with_room(room_id, |room| {
            room.players
                .iter()
                .map(|p| (p.user_pid.clone(), p.coins as i64, p.is_ai))
                .collect()
        })
        .unwrap_or_default();
    for (pid, new_gold, is_ai) in db_updates {
        if !is_ai {
            if let Ok(user) = crate::models::users::Model::find_by_pid(db, &pid).await {
                let mut active: crate::models::_entities::users::ActiveModel = user.into();
                active.gold = ActiveValue::Set(new_gold);
                let _ = active.update(db).await;
            }
        }
    }

    // Step 6: Final result
    let results: Vec<serde_json::Value> = ROOM_MANAGER
        .with_room(room_id, |room| {
            room.phase = GamePhase::Finished;
            room.status = RoomStatus::Finished;
            room.players
                .iter()
                .map(|p| {
                    json!({
                        "user_pid": p.user_pid,
                        "name": p.name,
                        "seat": p.seat,
                        "hand": p.hand,
                        "bull_type": p.bull_type,
                        "is_banker": p.is_banker,
                        "bet_amount": p.bet_amount,
                        "coin_change": p.coin_change,
                        "coins": p.coins,
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    let result_msg = ServerMsg::event("game_result", json!({ "players": results }));
    ROOM_MANAGER.broadcast(room_id, &result_msg);

    // Persist game record
    let players_json = serde_json::to_string(&results).unwrap_or_default();
    if let Err(e) = crate::models::game_records::Model::create(db, room_id, &players_json).await {
        tracing::error!("Failed to persist game record: {e}");
    }

    // Reset round state so next round requires fresh ready
    ROOM_MANAGER.with_room(room_id, |room| {
        room.reset_round();
        room.status = RoomStatus::Waiting;
    });
    // Broadcast updated state so clients see everyone as not-ready
    if let Some(state) = room_state_msg(room_id) {
        ROOM_MANAGER.broadcast(room_id, &state);
    }
}

pub fn routes() -> Routes {
    Routes::new().prefix("/api").add("/ws", get(ws_handler))
}
