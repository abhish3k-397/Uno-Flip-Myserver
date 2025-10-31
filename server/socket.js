
class SocketHandler {
    constructor(io, gameManager) {
        this.io = io;
        this.gameManager = gameManager;
        this.setupSocketHandlers();
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`🔗 Player connected: ${socket.id}`);

            // Lobby events
            socket.on('createGame', (data) => this.handleCreateGame(socket, data));
            socket.on('joinGame', (data) => this.handleJoinGame(socket, data));
            socket.on('startGame', (data) => this.handleStartGame(socket, data));

            // Game events
            socket.on('playCard', (data) => this.handlePlayCard(socket, data));
            socket.on('drawCard', (data) => this.handleDrawCard(socket, data));
            socket.on('sayUno', (data) => this.handleSayUno(socket, data));
            socket.on('chooseWildColor', (data) => this.handleWildColor(socket, data));
            socket.on('playAgain', (data) => this.handlePlayAgain(socket, data));
            socket.on('endTurn', (data) => this.handleEndTurn(socket, data));

            // Disconnection
            socket.on('disconnect', () => this.handleDisconnect(socket));
        });
    }

    // Lobby Handlers
    handleCreateGame(socket, data) {
        try {
            const game = this.gameManager.createGame({
                id: socket.id,
                name: data.playerName
            });

            socket.join(game.roomCode);
            
            socket.emit('gameCreated', {
                roomCode: game.roomCode,
                players: game.players
            });

            this.updateLobby(game.roomCode);
            
            console.log(`🎮 Game created: ${game.roomCode} by ${data.playerName}`);
        } catch (error) {
            console.error(`❌ Error creating game: ${error.message}`);
            socket.emit('joinError', { message: error.message });
        }
    }

    handleJoinGame(socket, data) {
        try {
            const game = this.gameManager.joinGame(data.roomCode, {
                id: socket.id,
                name: data.playerName
            });

            socket.join(game.roomCode);
            
            socket.emit('joinSuccess', {
                roomCode: game.roomCode,
                players: game.players
            });

            this.updateLobby(game.roomCode);
            
            console.log(`👤 ${data.playerName} joined game: ${data.roomCode}`);
        } catch (error) {
            console.error(`❌ Error joining game: ${error.message}`);
            socket.emit('joinError', { message: error.message });
        }
    }

    handleStartGame(socket, data) {
        try {
            const game = this.gameManager.getGameByRoomCode(data.roomCode);
            if (!game) {
                socket.emit('error', { message: 'Game not found' });
                return;
            }

            // Only host can start the game
            if (game.players[0].id !== socket.id) {
                socket.emit('error', { message: 'Only the host can start the game' });
                return;
            }

            console.log(`🎲 Starting game in room: ${data.roomCode}`);
            game.startGame();

            // Send game start to all players in the room with their individual hands
            game.players.forEach(player => {
                const playerSocket = this.io.sockets.sockets.get(player.id);
                if (playerSocket) {
                    const gameState = {
                        ...game.getPublicGameState(),
                        playerHand: game.getPlayerHand(player.id)
                    };
                    
                    console.log(`📤 Sending game start to ${player.name} with ${gameState.playerHand.length} cards`);
                    playerSocket.emit('gameStart', gameState);
                }
            });

            // Notify whose turn it is
            this.io.to(data.roomCode).emit('playerTurn', {
                playerId: game.currentPlayer.id,
                playerName: game.currentPlayer.name
            });

            console.log(`🎲 Game started successfully in room: ${data.roomCode}`);
            console.log(`🔄 First turn: ${game.currentPlayer.name}`);

        } catch (error) {
            console.error(`❌ Error starting game: ${error.message}`);
            socket.emit('error', { message: error.message });
        }
    }

    // Game Action Handlers
    handlePlayCard(socket, data) {
        try {
            const game = this.gameManager.getGameByRoomCode(data.roomCode);
            if (!game) {
                socket.emit('error', { message: 'Game not found' });
                return;
            }

            const playerId = socket.id;
            console.log(`🃏 ${this.getPlayerName(game, playerId)} attempting to play card at index ${data.cardIndex}`);

            const result = game.playCard(playerId, data.cardIndex);

            // If it's a wild card that requires color choice, wait for that
            if (result.requiresColorChoice) {
                socket.emit('chooseColor', {
                    card: result.playedCard
                });
                
                // Update all players with current game state
                this.broadcastGameState(data.roomCode, game);
                
                this.io.to(data.roomCode).emit('cardPlayed', {
                    playerName: game.players.find(p => p.id === playerId).name,
                    card: result.playedCard,
                    waitingForColor: true
                });

                console.log(`🎨 Waiting for color choice from ${this.getPlayerName(game, data.playerId)}`);
                return;
            }

            // Update all players with new game state
            this.broadcastGameState(data.roomCode, game);

            // Notify about the played card
            this.io.to(data.roomCode).emit('cardPlayed', {
                playerName: game.players.find(p => p.id === playerId).name,
                card: result.playedCard,
                waitingForColor: false
            });

            console.log(`✅ ${this.getPlayerName(game, playerId)} played ${result.playedCard.color} ${result.playedCard.value}`);

            // Handle game over
            if (result.gameOver) {
                console.log(`🏆 Game over! Winner: ${result.winner.name}`);
                this.io.to(data.roomCode).emit('gameOver', {
                    winner: result.winner,
                    winnerName: result.winner.name
                });
                return;
            }

            // Handle flip card
            if (result.playedCard && result.playedCard.value === 'flip') {
                this.io.to(data.roomCode).emit('gameFlipped', {
                    newSide: game.currentSide
                });
            }

            // Notify next player's turn
            this.io.to(data.roomCode).emit('playerTurn', {
                playerId: game.currentPlayer.id,
                playerName: game.currentPlayer.name
            });

        } catch (error) {
            console.error(`❌ Error playing card: ${error.message}`);
            socket.emit('error', { message: error.message });
        }
    }

    handleDrawCard(socket, data) {
        try {
            const game = this.gameManager.getGameByRoomCode(data.roomCode);
            if (!game) {
                socket.emit('error', { message: 'Game not found' });
                return;
            }

            const playerId = socket.id;
            console.log(`📥 ${this.getPlayerName(game, playerId)} drawing a card`);

            const drawResult = game.drawCardForPlayer(playerId);

            // Update all players with new game state
            this.broadcastGameState(data.roomCode, game);

            // Handle different draw types
            if (drawResult && drawResult.type === 'drawUntilColor') {
                this.io.to(data.roomCode).emit('drawUntilColor', {
                    playerName: game.players.find(p => p.id === playerId).name,
                    playerId: playerId,
                    cards: drawResult.cards,
                    targetColor: drawResult.targetColor
                });

                // After draw-until, the turn has advanced on the server; notify next player
                this.io.to(data.roomCode).emit('playerTurn', {
                    playerId: game.currentPlayer.id,
                    playerName: game.currentPlayer.name
                });
            } else if (drawResult && drawResult.type === 'normal') {
                // Voluntary normal draw: player may play the drawn card immediately. Do not advance the turn.
                this.io.to(data.roomCode).emit('cardDrawn', {
                    playerName: game.players.find(p => p.id === playerId).name,
                    playerId: playerId,
                    card: drawResult.card
                });
                // Do not emit playerTurn change since current player remains the same
            } else {
                // Penalty draw or other cases: cardDrawn + advance turn
                this.io.to(data.roomCode).emit('cardDrawn', {
                    playerName: game.players.find(p => p.id === playerId).name,
                    playerId: playerId
                });

                // Notify next player's turn
                this.io.to(data.roomCode).emit('playerTurn', {
                    playerId: game.currentPlayer.id,
                    playerName: game.currentPlayer.name
                });
            }

        } catch (error) {
            console.error(`❌ Error drawing card: ${error.message}`);
            socket.emit('error', { message: error.message });
        }
    }

    handleSayUno(socket, data) {
        try {
            const game = this.gameManager.getGameByRoomCode(data.roomCode);
            if (!game) return;

            const playerId = socket.id;
            game.sayUno(playerId);

            this.io.to(data.roomCode).emit('unoCalled', {
                playerName: game.players.find(p => p.id === playerId).name
            });

            // Update game state for all players
            this.broadcastGameState(data.roomCode, game);

        } catch (error) {
            console.error(`❌ Error calling UNO: ${error.message}`);
            socket.emit('error', { message: error.message });
        }
    }

    handleWildColor(socket, data) {
        try {
            const game = this.gameManager.getGameByRoomCode(data.roomCode);
            if (!game) return;

            const playerId = socket.id;
            console.log(`🎨 ${this.getPlayerName(game, playerId)} choosing wild color: ${data.color}`);

            game.handleWildColorChoice(data.color);

            // Broadcast updated game state after color choice
            this.broadcastGameState(data.roomCode, game);

            // Notify all players about the color choice
            this.io.to(data.roomCode).emit('wildColorChosen', {
                color: data.color,
                playerName: game.players.find(p => p.id === playerId).name
            });

            // Notify next player's turn
            this.io.to(data.roomCode).emit('playerTurn', {
                playerId: game.currentPlayer.id,
                playerName: game.currentPlayer.name
            });

        } catch (error) {
            console.error(`❌ Error choosing wild color: ${error.message}`);
            socket.emit('error', { message: error.message });
        }
    }

    handleEndTurn(socket, data) {
        try {
            const game = this.gameManager.getGameByRoomCode(data.roomCode);
            if (!game) return;

            // Ensure it's the player's turn
            const playerId = socket.id;
            if (game.currentPlayer.id !== playerId) {
                socket.emit('error', { message: "It's not your turn" });
                return;
            }

            // Call game logic to end turn
            try {
                game.endTurn(playerId);
            } catch (e) {
                socket.emit('error', { message: e.message });
                return;
            }

            // Broadcast updated game state
            this.broadcastGameState(data.roomCode, game);

            // Notify next player's turn
            this.io.to(data.roomCode).emit('playerTurn', {
                playerId: game.currentPlayer.id,
                playerName: game.currentPlayer.name
            });

        } catch (error) {
            console.error(`❌ Error ending turn: ${error.message}`);
            socket.emit('error', { message: error.message });
        }
    }

    handlePlayAgain(socket, data) {
        try {
            const game = this.gameManager.getGameByRoomCode(data.roomCode);
            if (!game) return;

            // Reset game state but keep players
            game.initializeDeck();
            game.discardPile = [];
            game.currentSide = 'light';
            game.currentPlayerIndex = 0;
            game.direction = 1;
            game.gameStarted = false;
            game.gameOver = false;
            game.hasDrawnCard = false;
            game.waitingForColorChoice = false;

            game.players.forEach(player => {
                player.hand = [];
                player.hasUno = false;
            });

            // Return to lobby
            this.updateLobby(data.roomCode);
            this.io.to(data.roomCode).emit('returnToLobby');

        } catch (error) {
            console.error(`❌ Error resetting game: ${error.message}`);
            socket.emit('error', { message: error.message });
        }
    }

    handleDisconnect(socket) {
        console.log(`🔌 Player disconnected: ${socket.id}`);

        const result = this.gameManager.removePlayer(socket.id);
        if (result && result.game) {
            const { game, player } = result;
            
            // Notify other players
            this.io.to(game.roomCode).emit('playerLeft', {
                playerName: player.name
            });

            console.log(`👋 ${player.name} left game: ${game.roomCode}`);

            // Update lobby or game state
            if (game.gameStarted && !game.gameOver) {
                this.broadcastGameState(game.roomCode, game);
            } else {
                this.updateLobby(game.roomCode);
            }
        }
    }

    // Utility Methods
    updateLobby(roomCode) {
        const game = this.gameManager.getGameByRoomCode(roomCode);
        if (game) {
            this.io.to(roomCode).emit('lobbyUpdate', {
                players: game.players,
                roomCode: roomCode
            });
        }
    }

    getPlayerName(game, playerId) {
        const player = game.players.find(p => p.id === playerId);
        return player ? player.name : 'Unknown Player';
    }

    broadcastGameState(roomCode, game) {
        const publicGameState = game.getPublicGameState();
        
        game.players.forEach(player => {
            const playerSocket = this.io.sockets.sockets.get(player.id);
            if (playerSocket) {
                const playerState = {
                    ...publicGameState,
                    playerHand: game.getPlayerHand(player.id)
                };
                playerSocket.emit('gameStateUpdate', playerState);
            }
        });
    }
}

module.exports = SocketHandler;
