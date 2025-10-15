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
            socket.on('endTurn', (data) => this.handleEndTurn(socket, data));
            socket.on('sayUno', (data) => this.handleSayUno(socket, data));
            socket.on('chooseWildColor', (data) => this.handleWildColor(socket, data));
            socket.on('playAgain', (data) => this.handlePlayAgain(socket, data));

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

            game.startGame();

            // Send game start to all players in the room with their individual hands
            game.players.forEach(player => {
                const playerSocket = this.io.sockets.sockets.get(player.id);
                if (playerSocket) {
                    playerSocket.emit('gameStart', {
                        ...game.getPublicGameState(),
                        playerHand: game.getPlayerHand(player.id)
                    });
                }
            });

            // Notify whose turn it is
            this.io.to(data.roomCode).emit('playerTurn', {
                playerId: game.currentPlayer.id,
                playerName: game.currentPlayer.name
            });

            console.log(`🎲 Game started in room: ${data.roomCode}`);
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

            console.log(`🃏 ${this.getPlayerName(game, data.playerId)} attempting to play card at index ${data.cardIndex}`);

            const result = game.playCard(data.playerId, data.cardIndex);

            // If it's a wild card that requires color choice, wait for that
            if (result.requiresColorChoice) {
                // Notify the player to choose a color
                socket.emit('chooseColor', {
                    card: result.playedCard
                });
                
                // Update all players with current game state (card was played but turn not advanced)
                this.broadcastGameState(data.roomCode, game);
                
                // Notify about the played card (but not turn change yet)
                this.io.to(data.roomCode).emit('cardPlayed', {
                    playerName: game.players.find(p => p.id === data.playerId).name,
                    card: result.playedCard,
                    waitingForColor: true
                });

                console.log(`🎨 Waiting for color choice from ${this.getPlayerName(game, data.playerId)}`);
                return;
            }

            // Update all players with new game state including their individual hands
            this.broadcastGameState(data.roomCode, game);

            // Notify about the played card
            this.io.to(data.roomCode).emit('cardPlayed', {
                playerName: game.players.find(p => p.id === data.playerId).name,
                card: result.playedCard,
                waitingForColor: false
            });

            console.log(`✅ ${this.getPlayerName(game, data.playerId)} played ${result.playedCard.color} ${result.playedCard.value}`);

            // Handle game over
            if (result.gameOver) {
                console.log(`🏆 Game over! Winner: ${result.winner.name}`);
                this.io.to(data.roomCode).emit('gameOver', {
                    winner: result.winner
                });
                return;
            }

            // Handle flip card
            if (result.playedCard && result.playedCard.value === 'flip') {
                this.io.to(data.roomCode).emit('gameFlipped', {
                    newSide: game.currentSide
                });
            }

            // Notify next player's turn (if turn was advanced)
            if (!result.requiresColorChoice) {
                this.io.to(data.roomCode).emit('playerTurn', {
                    playerId: game.currentPlayer.id,
                    playerName: game.currentPlayer.name
                });
                console.log(`🔄 Next turn: ${game.currentPlayer.name}`);
            }

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

            console.log(`📥 ${this.getPlayerName(game, data.playerId)} drawing a card`);

            const pendingBefore = game.pendingDrawCount || 0;
            const drawUntilBefore = game.drawUntilColor;
            const drawResult = game.drawCardForPlayer(data.playerId);

            // Update all players with new game state including their individual hands
            this.broadcastGameState(data.roomCode, game);

            // Handle different draw types
            if (drawResult && drawResult.type === 'drawUntilColor') {
                // Notify about draw until color with animation data
                this.io.to(data.roomCode).emit('drawUntilColor', {
                    playerName: game.players.find(p => p.id === data.playerId).name,
                    playerId: data.playerId,
                    cards: drawResult.cards,
                    targetColor: drawResult.targetColor
                });
                console.log(`✅ ${this.getPlayerName(game, data.playerId)} drew until color: ${drawResult.targetColor}`);
            } else {
                // Notify other players
                this.io.to(data.roomCode).emit('cardDrawn', {
                    playerName: game.players.find(p => p.id === data.playerId).name,
                    playerId: data.playerId,
                    canPlay: false,
                    penaltyApplied: pendingBefore > 0,
                    penaltyCount: pendingBefore
                });

                if (pendingBefore > 0) {
                    console.log(`✅ ${this.getPlayerName(game, data.playerId)} drew penalty of ${pendingBefore} cards`);
                } else {
                    console.log(`✅ ${this.getPlayerName(game, data.playerId)} drew a card`);
                }
            }

            // After drawing, the server already advanced the turn; notify next player
            this.io.to(data.roomCode).emit('playerTurn', {
                playerId: game.currentPlayer.id,
                playerName: game.currentPlayer.name
            });

        } catch (error) {
            console.error(`❌ Error drawing card: ${error.message}`);
            socket.emit('error', { message: error.message });
        }
    }

    handleEndTurn(socket, data) {
        try {
            const game = this.gameManager.getGameByRoomCode(data.roomCode);
            if (!game) {
                socket.emit('error', { message: 'Game not found' });
                return;
            }

            console.log(`⏭️  ${this.getPlayerName(game, data.playerId)} ending turn`);

            const result = game.endTurn(data.playerId);

            // Update all players with new game state including their individual hands
            this.broadcastGameState(data.roomCode, game);

            // Notify next player's turn
            this.io.to(data.roomCode).emit('playerTurn', {
                playerId: game.currentPlayer.id,
                playerName: game.currentPlayer.name
            });

            console.log(`✅ ${this.getPlayerName(game, data.playerId)} ended turn`);
            console.log(`🔄 Next turn: ${game.currentPlayer.name}`);

        } catch (error) {
            console.error(`❌ Error ending turn: ${error.message}`);
            socket.emit('error', { message: error.message });
        }
    }

    handleSayUno(socket, data) {
        try {
            const game = this.gameManager.getGameByRoomCode(data.roomCode);
            if (!game) return;

            game.sayUno(data.playerId);

            this.io.to(data.roomCode).emit('unoCalled', {
                playerName: game.players.find(p => p.id === data.playerId).name
            });

            // Update game state for all players
            this.broadcastGameState(data.roomCode, game);

            console.log(`📢 ${this.getPlayerName(game, data.playerId)} called UNO!`);

        } catch (error) {
            console.error(`❌ Error calling UNO: ${error.message}`);
            socket.emit('error', { message: error.message });
        }
    }

    handleWildColor(socket, data) {
        try {
            const game = this.gameManager.getGameByRoomCode(data.roomCode);
            if (!game) return;

            console.log(`🎨 ${this.getPlayerName(game, data.playerId)} choosing wild color: ${data.color}`);

            game.handleWildColorChoice(data.color, data.playerId);

            // Broadcast updated game state after color choice
            this.broadcastGameState(data.roomCode, game);

            // Notify all players about the color choice
            this.io.to(data.roomCode).emit('wildColorChosen', {
                color: data.color,
                playerName: game.players.find(p => p.id === data.playerId).name
            });

            // Now advance to next player's turn (handled in game logic)
            this.io.to(data.roomCode).emit('playerTurn', {
                playerId: game.currentPlayer.id,
                playerName: game.currentPlayer.name
            });

            console.log(`✅ ${this.getPlayerName(game, data.playerId)} chose wild color: ${data.color}`);
            console.log(`🔄 Next turn: ${game.currentPlayer.name}`);

        } catch (error) {
            console.error(`❌ Error choosing wild color: ${error.message}`);
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

            console.log(`🔄 Game reset in room: ${data.roomCode}`);

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
                // Update all remaining players with new game state
                this.broadcastGameState(game.roomCode, game);

                // If game is still ongoing, notify whose turn it is
                if (game.players.length > 0 && !game.gameOver) {
                    this.io.to(game.roomCode).emit('playerTurn', {
                        playerId: game.currentPlayer.id,
                        playerName: game.currentPlayer.name
                    });
                }
            } else {
                this.updateLobby(game.roomCode);
            }

            // Check if game should end due to not enough players
            if (game.gameStarted && game.players.length < 2) {
                console.log(`🛑 Game ended in room ${game.roomCode} - not enough players`);
                game.gameOver = true;
                this.io.to(game.roomCode).emit('gameOver', {
                    winner: null,
                    reason: 'Not enough players'
                });
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

    // Helper method to get player name by ID
    getPlayerName(game, playerId) {
        const player = game.players.find(p => p.id === playerId);
        return player ? player.name : 'Unknown Player';
    }

    // Broadcast game state to all players in a room
    broadcastGameState(roomCode, game) {
        const publicGameState = game.getPublicGameState();
        
        game.players.forEach(player => {
            const playerSocket = this.io.sockets.sockets.get(player.id);
            if (playerSocket) {
                playerSocket.emit('gameStateUpdate', {
                    ...publicGameState,
                    playerHand: game.getPlayerHand(player.id)
                });
            }
        });
    }

    // Send error to specific socket
    sendError(socket, message) {
        console.error(`❌ Error for ${socket.id}: ${message}`);
        socket.emit('error', { message });
    }

    // Validate game and player
    validateGameAndPlayer(roomCode, playerId) {
        const game = this.gameManager.getGameByRoomCode(roomCode);
        if (!game) {
            return { valid: false, error: 'Game not found' };
        }

        const player = game.players.find(p => p.id === playerId);
        if (!player) {
            return { valid: false, error: 'Player not found in game' };
        }

        return { valid: true, game, player };
    }

    // Handle game state synchronization
    syncGameState(roomCode) {
        const game = this.gameManager.getGameByRoomCode(roomCode);
        if (game) {
            this.broadcastGameState(roomCode, game);
        }
    }

    // Force next turn (for recovery)
    forceNextTurn(roomCode) {
        try {
            const game = this.gameManager.getGameByRoomCode(roomCode);
            if (!game) return;

            game.forceNextTurn();
            
            // Broadcast updated state
            this.broadcastGameState(roomCode, game);
            
            // Notify turn change
            this.io.to(roomCode).emit('playerTurn', {
                playerId: game.currentPlayer.id,
                playerName: game.currentPlayer.name
            });

            console.log(`⚠️  Forced next turn in room: ${roomCode}`);
            
        } catch (error) {
            console.error(`❌ Error forcing next turn: ${error.message}`);
        }
    }

    // Get room statistics
    getRoomStats(roomCode) {
        const game = this.gameManager.getGameByRoomCode(roomCode);
        if (!game) return null;

        return {
            roomCode: game.roomCode,
            playerCount: game.players.length,
            gameStarted: game.gameStarted,
            gameOver: game.gameOver,
            currentPlayer: game.currentPlayer.name,
            deckCount: game.deck.length,
            discardCount: game.discardPile.length
        };
    }

    // Broadcast message to all players in room
    broadcastMessage(roomCode, message, type = 'info') {
        this.io.to(roomCode).emit('gameMessage', {
            message,
            type,
            timestamp: new Date().toISOString()
        });
    }

    // Handle player reconnection
    handleReconnect(socket, playerId, roomCode) {
        try {
            const game = this.gameManager.getGameByRoomCode(roomCode);
            if (!game) {
                socket.emit('reconnectError', { message: 'Game not found' });
                return;
            }

            const player = game.players.find(p => p.id === playerId);
            if (!player) {
                socket.emit('reconnectError', { message: 'Player not found in game' });
                return;
            }

            // Update player's socket ID
            player.id = socket.id;
            this.gameManager.playerGameMap.set(socket.id, roomCode);
            
            socket.join(roomCode);

            // Send current game state to reconnected player
            socket.emit('gameStateUpdate', {
                ...game.getPublicGameState(),
                playerHand: game.getPlayerHand(socket.id)
            });

            // Notify other players
            this.io.to(roomCode).emit('playerReconnected', {
                playerName: player.name
            });

            console.log(`🔗 ${player.name} reconnected to game: ${roomCode}`);

        } catch (error) {
            console.error(`❌ Error handling reconnect: ${error.message}`);
            socket.emit('reconnectError', { message: error.message });
        }
    }
}

module.exports = SocketHandler;