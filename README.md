# UNO-FLIP

A web-based multiplayer UNO Flip card game.

## Features

*   **Multiplayer Gameplay:** Play with 2-6 players in real-time.
*   **Game Lobbies:** Create or join game rooms with a unique room code.
*   **UNO Flip Mechanic:** Experience the classic UNO game with a twist! The "Flip" card switches the game to a "dark side" with different cards and rules.
*   **Special Cards:** Includes all the classic UNO cards like Skip, Reverse, and Draw, plus the special Flip card.
*   **Real-time Communication:** Uses Socket.io for seamless real-time communication between players.

## How to Play

1.  Enter your name and create a new game or join an existing game using a room code.
2.  Once in the lobby, the host can start the game when at least two players have joined.
3.  The goal of the game is to be the first player to get rid of all your cards.
4.  Match the top card on the discard pile by either number, color, or symbol.
5.  Use special cards to change the flow of the game.
6.  If you have one card left, don't forget to call "UNO!"
7.  The first player to play all their cards wins the round.

## Technical Stack

*   **Backend:** Node.js, Express.js, Socket.io
*   **Frontend:** HTML, CSS, JavaScript

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

*   Node.js and npm installed on your machine.

### Installation

1.  Clone the repo.
2.  Navigate to the project directory:
    ```sh
    cd UNO-FLIP
    ```
3.  Install NPM packages:
    ```sh
    npm install
    ```

### Running the Application

1.  Start the server:
    ```sh
    npm start
    ```
2.  Open your browser and navigate to `http://localhost:3000`.

## Project Structure

```
UNO-FLIP/
├── node_modules/
├── public/
│   ├── css/
│   ├── images/
│   ├── js/
│   │   ├── client.js
│   │   └── game.js
│   └── index.html
├── server/
│   ├── app.js
│   ├── game.js
│   └── socket.js
├── .gitignore
├── package-lock.json
└── package.json
```

## License

Distributed under the MIT License.
