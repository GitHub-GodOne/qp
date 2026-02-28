use rand::seq::SliceRandom;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Suit {
    Spade,
    Heart,
    Diamond,
    Club,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Card {
    pub suit: Suit,
    pub rank: u8, // 1=A, 2-10, 11=J, 12=Q, 13=K
}

impl Card {
    /// Value used in bull-bull calculation (J/Q/K = 10, others = face value)
    #[must_use]
    pub fn bull_value(self) -> u8 {
        if self.rank >= 10 {
            10
        } else {
            self.rank
        }
    }
}

pub struct Deck {
    cards: Vec<Card>,
}

impl Deck {
    #[must_use]
    pub fn new_shuffled() -> Self {
        let mut cards = Vec::with_capacity(52);
        for &suit in &[Suit::Spade, Suit::Heart, Suit::Diamond, Suit::Club] {
            for rank in 1..=13 {
                cards.push(Card { suit, rank });
            }
        }
        let mut rng = rand::thread_rng();
        cards.shuffle(&mut rng);
        Self { cards }
    }

    /// Deal `n` cards. Returns None if not enough cards.
    pub fn deal(&mut self, n: usize) -> Option<Vec<Card>> {
        if self.cards.len() < n {
            return None;
        }
        Some(self.cards.split_off(self.cards.len() - n))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deck_has_52_cards() {
        let deck = Deck::new_shuffled();
        assert_eq!(deck.cards.len(), 52);
    }

    #[test]
    fn deal_returns_correct_count() {
        let mut deck = Deck::new_shuffled();
        let hand = deck.deal(5).unwrap();
        assert_eq!(hand.len(), 5);
        assert_eq!(deck.cards.len(), 47);
    }

    #[test]
    fn deal_fails_when_not_enough() {
        let mut deck = Deck::new_shuffled();
        let _ = deck.deal(50).unwrap();
        assert!(deck.deal(5).is_none());
    }
}
