const deck = require("./deck");
const { flipCard, canPlay } = require("./rules");

const MAX_PLAYERS = 4;
const CARDS_PER_PLAYER = 7;

let dark = false;
let topCard = null;
let onTurn = null;
let isReversed = false;

let players = [];
let discardPile = [];
let drawPile = [];

const clients = {};

const getGameState = (reveal) => ({
  topCard: { ...topCard, isDark: topCard.isDark ? dark : !dark },
  onTurn: onTurn.id,
  dark,
  players: players.map((p) => ({
    ...p,
    cards: reveal.includes(p.id) ? p.cards : p.cards.length,
  })),
  isReversed,
  discardPile: discardPile.map((c) => ({
    ...c,
    isDark: c.isDark ? dark : !dark,
  })),
});

const nextTurn = () => {
  let onTurnIndex = players.findIndex((p) => p.id === onTurn.id);

  if (isReversed) {
    onTurnIndex--;
    if (onTurnIndex < 0) {
      onTurnIndex = players.length - 1;
    }
  } else {
    onTurnIndex++;
    if (onTurnIndex >= players.length) {
      onTurnIndex = 0;
    }
  }

  onTurn = players[onTurnIndex];
};

const join = (id, name) => {
  if (players.length >= MAX_PLAYERS) {
    throw new Error("Room is full");
  }

  if (players.find((p) => p.name === name)) {
    throw new Error("Name is taken");
  }

  players.push({ id, name, cards: [] });
};

const start = () => {
  if (players.length < 2) {
    throw new Error("Not enough players");
  }

  drawPile = deck.create();
  discardPile = [];
  dark = false;
  isReversed = false;
  onTurn = players[0];

  deck.shuffle(drawPile);

  for (const player of players) {
    player.cards = [];
    for (let i = 0; i < CARDS_PER_PLAYER; i++) {
      player.cards.push(drawPile.pop());
    }
  }

  topCard = drawPile.pop();
  if (topCard.isWild) {
    topCard.color = "red";
  }
};

const play = (playerId, cardIndex, color) => {
  if (onTurn.id !== playerId) {
    throw new Error("Not your turn");
  }

  const player = players.find((p) => p.id === playerId);
  const card = player.cards[cardIndex];

  if (!canPlay(card, topCard, dark)) {
    throw new Error("Invalid card");
  }

  if (card.isWild && !color) {
    throw new Error("Color not specified");
  }

  player.cards.splice(cardIndex, 1);
  discardPile.push(topCard);
  topCard = card;

  if (card.isWild) {
    topCard.color = color;
  }

  switch (topCard.value) {
    case "reverse":
      isReversed = !isReversed;
      break;

    case "skip":
      nextTurn();
      break;

    case "draw2":
    case "draw4":
      let onTurnIndex = players.findIndex((p) => p.id === onTurn.id);
      nextTurn();
      const nextPlayer = players[onTurnIndex === players.length - 1 ? 0 : onTurnIndex + 1];
      for (let i = 0; i < (topCard.value === "draw2" ? 2 : 4); i++) {
        if (drawPile.length === 0) {
          drawPile = discardPile;
          discardPile = [];
          deck.shuffle(drawPile);
        }
        nextPlayer.cards.push(drawPile.pop());
      }
      break;
    case "flip":
      dark = !dark;
      topCard = flipCard(topCard);
      break;
  }

  nextTurn();
};

const draw = (playerId) => {
  if (onTurn.id !== playerId) {
    throw new Error("Not your turn");
  }

  const player = players.find((p) => p.id === playerId);

  if (drawPile.length === 0) {
    drawPile = discardPile;
    discardPile = [];
    deck.shuffle(drawPile);
  }

  player.cards.push(drawPile.pop());

  nextTurn();
};

const addClient = (id, client) => {
  clients[id] = client;
};

const removeClient = (id) => {
  const index = players.findIndex((p) => p.id === id);
  if (index >= 0) {
    players.splice(index, 1);
  }
  delete clients[id];
};

module.exports = {
  getGameState,
  nextTurn,
  join,
  start,
  play,
  draw,
  addClient,
  removeClient,
};
