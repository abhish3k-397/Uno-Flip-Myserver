const socket = io();

const url = new URL(window.location.href);
const room = url.searchParams.get("room");
const name = url.searchParams.get("name");

if (!room || !name) {
  window.location.href = "/";
}

socket.on("connect", () => {
  socket.emit("join", { room, name });
});

socket.on("message", (data) => {
  const { type, payload } = data;

  switch (type) {
    case "error":
      alert(payload);
      window.location.href = "/";
      break;
    case "update":
      update(payload);
      break;
  }
});

const themeToggle = document.querySelector("#theme-toggle");
const startButton = document.querySelector("#start-button");
const endTurnButton = document.querySelector("#end-turn-button");
const unoButton = document.querySelector("#uno-button");
const drawButton = document.querySelector("#draw-button");

const gameHeader = document.querySelector(".game-header");
const roomName = document.querySelector("#room-name");
const side = document.querySelector("#side");
const topCard = document.querySelector("#top-card");
const deckSize = document.querySelector("#deck-size");

const playersContainer = document.querySelector(".players-container");
const playerArea = document.querySelector(".player-area");

let me = null;
let onTurn = null;

const update = (state) => {
  me = state.players.find((p) => p.id === socket.id);
  onTurn = state.onTurn;

  document.body.classList.toggle("dark", state.dark);
  themeToggle.checked = state.dark;

  gameHeader.style.backgroundColor = `var(--${state.topCard.color.toLowerCase()}-color)`;
  roomName.textContent = room;
  side.textContent = state.dark ? "Dark" : "Light";
  topCard.innerHTML = getCardHTML(state.topCard, false);
  deckSize.textContent = `${state.discardPile.length} cards`;

  playersContainer.innerHTML = "";
  for (const player of state.players) {
    if (player.id === socket.id) continue;
    playersContainer.innerHTML += getPlayerHTML(player);
  }

  playerArea.innerHTML = getPlayerHTML(me, true);

  if (state.onTurn !== socket.id) {
    endTurnButton.style.display = "none";
    drawButton.style.display = "none";
  } else {
    endTurnButton.style.display = "block";
    drawButton.style.display = "block";
  }

  if (me.cards.length === 1) {
    unoButton.style.display = "block";
  } else {
    unoButton.style.display = "none";
  }
};

const getPlayerHTML = (player, isMe) => {
  const onTurnClass = onTurn === player.id ? "on-turn" : "";

  let cardsHTML = "";
  if (isMe) {
    for (let i = 0; i < player.cards.length; i++) {
      cardsHTML += `<div class="card-container" onclick="play(${i})">${getCardHTML(
        player.cards[i],
        true
      )}</div>`;
    }
  } else {
    for (let i = 0; i < player.cards; i++) {
      cardsHTML += getCardHTML(null, false);
    }
  }

  return `
    <div class="player ${onTurnClass}">
      <div class="player-info">
        <span class="player-name">${player.name}</span>
      </div>
      <div class="cards">
        ${cardsHTML}
      </div>
    </div>
  `;
};

const getCardHTML = (card, canPlay) => {
  if (!card) {
    return `<div class="card back"></div>`;
  }

  let color = card.isDark ? "dark" : card.color;

  if (card.isWild) {
    color = "wild";
  }

  const canPlayClass = canPlay ? "can-play" : "";

  return `
    <div class="card ${color.toLowerCase()} ${canPlayClass}">
      <span class="card-value">${card.value}</span>
    </div>
  `;
};

const play = (cardIndex) => {
  const card = me.cards[cardIndex];

  if (card.isWild) {
    const color = prompt("Enter a color (red, green, blue, yellow)");
    socket.emit("play", { cardIndex, color });
  } else {
    socket.emit("play", { cardIndex });
  }
};

startButton.addEventListener("click", () => {
  socket.emit("start");
  startButton.style.display = "none";
});
drawButton.addEventListener("click", () => socket.emit("draw"));
