use std::sync::LazyLock;

use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;

use super::bull_bull::BullType;
use super::deck::Card;

pub static ROOM_MANAGER: LazyLock<RoomManager> = LazyLock::new(RoomManager::new);

const BROADCAST_CAPACITY: usize = 64;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GamePhase {
    Waiting,
    GrabBanker,
    Betting,
    Dealing,
    Revealing,
    Finished,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    pub user_pid: String,
    pub name: String,
    pub seat: usize,
    pub is_ready: bool,
    pub coins: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hand: Option<Vec<Card>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bull_type: Option<BullType>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wants_banker: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bet_amount: Option<u32>,
    #[serde(default)]
    pub is_banker: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub coin_change: Option<i32>,
    #[serde(default)]
    pub is_offline: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RoomStatus {
    Waiting,
    Playing,
    Finished,
}

pub struct GameRoom {
    pub room_id: String,
    pub owner_pid: String,
    pub max_players: usize,
    pub players: Vec<Player>,
    pub status: RoomStatus,
    pub phase: GamePhase,
    pub banker_pid: Option<String>,
    pub tx: broadcast::Sender<String>,
    pub timeout_handle: Option<tokio::task::JoinHandle<()>>,
}

impl GameRoom {
    fn new(room_id: String, owner_pid: String, max_players: usize) -> Self {
        let (tx, _) = broadcast::channel(BROADCAST_CAPACITY);
        Self {
            room_id,
            owner_pid,
            max_players,
            players: Vec::new(),
            status: RoomStatus::Waiting,
            phase: GamePhase::Waiting,
            banker_pid: None,
            tx,
            timeout_handle: None,
        }
    }
    pub fn add_player(
        &mut self,
        user_pid: &str,
        name: &str,
        coins: u32,
    ) -> Result<usize, &'static str> {
        if self.players.len() >= self.max_players {
            return Err("room is full");
        }
        if self.players.iter().any(|p| p.user_pid == user_pid) {
            return Err("already in room");
        }
        let seat = self.next_seat();
        self.players.push(Player {
            user_pid: user_pid.to_string(),
            name: name.to_string(),
            seat,
            is_ready: false,
            coins,
            hand: None,
            bull_type: None,
            wants_banker: None,
            bet_amount: None,
            is_banker: false,
            coin_change: None,
            is_offline: false,
        });
        Ok(seat)
    }

    pub fn remove_player(&mut self, user_pid: &str) -> bool {
        let is_active = self.phase != GamePhase::Waiting && self.phase != GamePhase::Finished;
        if is_active {
            // During active game: mark offline, auto-fill pending actions
            if let Some(p) = self.players.iter_mut().find(|p| p.user_pid == user_pid) {
                p.is_offline = true;
                if p.wants_banker.is_none() {
                    p.wants_banker = Some(false);
                }
                if !p.is_banker && p.bet_amount.is_none() {
                    p.bet_amount = Some(3);
                }
                return true;
            }
            false
        } else {
            let len = self.players.len();
            self.players.retain(|p| p.user_pid != user_pid);
            self.players.len() < len
        }
    }

    /// Remove offline players after round ends
    pub fn purge_offline(&mut self) {
        self.players.retain(|p| !p.is_offline);
    }

    pub fn set_ready(&mut self, user_pid: &str, ready: bool) -> bool {
        if let Some(p) = self.players.iter_mut().find(|p| p.user_pid == user_pid) {
            p.is_ready = ready;
            true
        } else {
            false
        }
    }

    pub fn all_ready(&self) -> bool {
        let active: Vec<&Player> = self.players.iter().filter(|p| !p.is_offline).collect();
        active.len() >= 2 && active.iter().all(|p| p.is_ready)
    }

    pub fn all_banker_responded(&self) -> bool {
        self.players.len() >= 2 && self.players.iter().all(|p| p.wants_banker.is_some())
    }

    pub fn all_bets_placed(&self) -> bool {
        self.players
            .iter()
            .all(|p| p.is_banker || p.bet_amount.is_some())
    }

    pub fn reset_round(&mut self) {
        if let Some(h) = self.timeout_handle.take() {
            h.abort();
        }
        self.purge_offline();
        self.phase = GamePhase::Waiting;
        self.banker_pid = None;
        for p in &mut self.players {
            p.is_ready = false;
            p.wants_banker = None;
            p.bet_amount = None;
            p.is_banker = false;
            p.hand = None;
            p.bull_type = None;
            p.coin_change = None;
        }
    }

    fn next_seat(&self) -> usize {
        let used: Vec<usize> = self.players.iter().map(|p| p.seat).collect();
        (0..self.max_players)
            .find(|s| !used.contains(s))
            .unwrap_or(0)
    }
}

pub struct RoomManager {
    rooms: DashMap<String, GameRoom>,
}

impl RoomManager {
    #[must_use]
    pub fn new() -> Self {
        Self {
            rooms: DashMap::new(),
        }
    }

    pub fn create_room(
        &self,
        room_id: &str,
        owner_pid: &str,
        max_players: usize,
    ) -> broadcast::Receiver<String> {
        let room = GameRoom::new(room_id.to_string(), owner_pid.to_string(), max_players);
        let rx = room.tx.subscribe();
        self.rooms.insert(room_id.to_string(), room);
        rx
    }

    pub fn subscribe(&self, room_id: &str) -> Option<broadcast::Receiver<String>> {
        self.rooms.get(room_id).map(|r| r.tx.subscribe())
    }

    pub fn broadcast(&self, room_id: &str, msg: &str) {
        if let Some(room) = self.rooms.get(room_id) {
            let _ = room.tx.send(msg.to_string());
        }
    }

    pub fn with_room<F, R>(&self, room_id: &str, f: F) -> Option<R>
    where
        F: FnOnce(&mut GameRoom) -> R,
    {
        self.rooms.get_mut(room_id).map(|mut r| f(r.value_mut()))
    }

    pub fn remove_room(&self, room_id: &str) {
        self.rooms.remove(room_id);
    }

    pub fn room_exists(&self, room_id: &str) -> bool {
        self.rooms.contains_key(room_id)
    }

    pub fn find_available_room(&self) -> Option<String> {
        let mut best: Option<(String, usize)> = None;
        for entry in self.rooms.iter() {
            let room = entry.value();
            if room.status == RoomStatus::Waiting && room.players.len() < room.max_players {
                let ready_count = room.players.iter().filter(|p| p.is_ready).count();
                if best
                    .as_ref()
                    .is_none_or(|(_, best_ready)| ready_count > *best_ready)
                {
                    best = Some((room.room_id.clone(), ready_count));
                }
            }
        }
        best.map(|(id, _)| id)
    }
}

impl Default for RoomManager {
    fn default() -> Self {
        Self::new()
    }
}
