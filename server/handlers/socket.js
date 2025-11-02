const rateLimiter = require('../utils/rateLimiter');
const Validator = require('../utils/validator');
const Sanitizer = require('../utils/sanitizer');
const { handleSocketError, ValidationError, NotFoundError, UnauthorizedError } = require('../utils/errors');

class SocketHandler {
    constructor(io, gameManager) {
        this.io = io;
        this.gameManager = gameManager;
        // Track socket event listeners for cleanup
        this.socketHandlers = new Map();
        this.setupSocketHandlers();
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`🔗 Player connected: ${socket.id}`);

            // Store handlers for cleanup
            const handlers = [];

            // Wrapper to add rate limiting and error handling
            const wrapHandler = (eventType, handler) => {
                return (data) => {
                    // Rate limiting
                    const rateLimit = rateLimiter.check(socket.id, eventType);
                    if (!rateLimit.allowed) {
                        socket.emit('error', {
                            message: 'Too many requests. Please slow down.',
                            code: 'RATE_LIMIT_EXCEEDED',
                            resetAt: rateLimit.resetAt
                        });
                        return;
                    }

                    // Wrap handler with error handling
                    try {
                        handler(data);
                    } catch (error) {
                        handleSocketError(error, socket, eventType);
                    }
                };
            };

            // Lobby events
            const createGameHandler = wrapHandler('createGame', (data) => this.handleCreateGame(socket, data));
            socket.on('createGame', createGameHandler);
            handlers.push({ event: 'createGame', handler: createGameHandler });

            const joinGameHandler = wrapHandler('joinGame', (data) => this.handleJoinGame(socket, data));
            socket.on('joinGame', joinGameHandler);
            handlers.push({ event: 'joinGame', handler: joinGameHandler });

            const startGameHandler = wrapHandler('startGame', (data) => this.handleStartGame(socket, data));
            socket.on('startGame', startGameHandler);
            handlers.push({ event: 'startGame', handler: startGameHandler });

            // Game events
            const playCardHandler = wrapHandler('playCard', (data) => this.handlePlayCard(socket, data));
            socket.on('playCard', playCardHandler);
            handlers.push({ event: 'playCard', handler: playCardHandler });

            const drawCardHandler = wrapHandler('drawCard', (data) => this.handleDrawCard(socket, data));
            socket.on('drawCard', drawCardHandler);
            handlers.push({ event: 'drawCard', handler: drawCardHandler });

            const sayUnoHandler = wrapHandler('sayUno', (data) => this.handleSayUno(socket, data));
            socket.on('sayUno', sayUnoHandler);
            handlers.push({ event: 'sayUno', handler: sayUnoHandler });

            const chooseWildColorHandler = wrapHandler('chooseWildColor', (data) => this.handleWildColor(socket, data));
            socket.on('chooseWildColor', chooseWildColorHandler);
            handlers.push({ event: 'chooseWildColor', handler: chooseWildColorHandler });

            const playAgainHandler = wrapHandler('playAgain', (data) => this.handlePlayAgain(socket, data));
            socket.on('playAgain', playAgainHandler);
            handlers.push({ event: 'playAgain', handler: playAgainHandler });

            const endTurnHandler = wrapHandler('endTurn', (data) => this.handleEndTurn(socket, data));
            socket.on('endTurn', endTurnHandler);
            handlers.push({ event: 'endTurn', handler: endTurnHandler });

            // Chat events
            const chatMessageHandler = wrapHandler('chatMessage', (data) => this.handleChatMessage(socket, data));
            socket.on('chatMessage', chatMessageHandler);
            handlers.push({ event: 'chatMessage', handler: chatMessageHandler });

            // Store handlers for cleanup
            this.socketHandlers.set(socket.id, handlers);

            // Disconnection
            const disconnectHandler = () => this.handleDisconnect(socket);
            socket.on('disconnect', disconnectHandler);
            handlers.push({ event: 'disconnect', handler: disconnectHandler });
        });
    }

    // Lobby Handlers
    handleCreateGame(socket, data) {
        // Validate and sanitize input
        const nameValidation = Validator.validatePlayerName(data?.playerName);
        if (!nameValidation.valid) {
            throw new ValidationError(nameValidation.error);
        }

        const game = this.gameManager.createGame({
            id: socket.id,
            name: Sanitizer.sanitizePlayerName(nameValidation.sanitized)
        });

        socket.join(game.roomCode);
        
        socket.emit('gameCreated', {
            roomCode: game.roomCode,
            players: game.players
        });

        this.updateLobby(game.roomCode);
        
        console.log(`🎮 Game created: ${game.roomCode} by ${game.players[0].name}`);
    }

    handleJoinGame(socket, data) {
        // Validate and sanitize inputs
        const nameValidation = Validator.validatePlayerName(data?.playerName);
        if (!nameValidation.valid) {
            throw new ValidationError(nameValidation.error);
        }

        const roomCodeValidation = Validator.validateRoomCode(data?.roomCode);
        if (!roomCodeValidation.valid) {
            throw new ValidationError(roomCodeValidation.error);
        }

        const game = this.gameManager.joinGame(roomCodeValidation.sanitized, {
            id: socket.id,
            name: Sanitizer.sanitizePlayerName(nameValidation.sanitized)
        });

        socket.join(game.roomCode);
        
        socket.emit('joinSuccess', {
            roomCode: game.roomCode,
            players: game.players
        });

        this.updateLobby(game.roomCode);
        
        console.log(`👤 ${game.players.find(p => p.id === socket.id)?.name} joined game: ${game.roomCode}`);
    }

    handleStartGame(socket, data) {
        const roomCodeValidation = Validator.validateRoomCode(data?.roomCode);
        if (!roomCodeValidation.valid) {
            throw new ValidationError(roomCodeValidation.error);
        }

        const game = this.gameManager.getGameByRoomCode(roomCodeValidation.sanitized);
        if (!game) {
            throw new NotFoundError('Game not found');
        }

        // Only host can start the game
        if (game.players[0].id !== socket.id) {
            throw new UnauthorizedError('Only the host can start the game');
        }

        console.log(`🎲 Starting game in room: ${game.roomCode}`);
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
        this.io.to(game.roomCode).emit('playerTurn', {
            playerId: game.currentPlayer.id,
            playerName: game.currentPlayer.name
        });

        console.log(`🎲 Game started successfully in room: ${game.roomCode}`);
        console.log(`🔄 First turn: ${game.currentPlayer.name}`);
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

    handleChatMessage(socket, data) {
        const roomCodeValidation = Validator.validateRoomCode(data?.roomCode);
        if (!roomCodeValidation.valid) {
            throw new ValidationError(roomCodeValidation.error);
        }

        const messageValidation = Validator.validateChatMessage(data?.message);
        if (!messageValidation.valid) {
            throw new ValidationError(messageValidation.error);
        }

        const game = this.gameManager.getGameByRoomCode(roomCodeValidation.sanitized);
        if (!game) {
            throw new NotFoundError('Game not found');
        }

        // Verify player is in the game
        const player = game.players.find(p => p.id === socket.id);
        if (!player) {
            throw new UnauthorizedError('You are not in this game');
        }

        // Sanitize message
        const sanitizedMessage = Sanitizer.sanitizeChatMessage(messageValidation.sanitized);

        // Broadcast chat message to all players in the room
        this.io.to(roomCodeValidation.sanitized).emit('chatMessage', {
            playerId: socket.id,
            playerName: Sanitizer.escapeHtml(player.name),
            message: sanitizedMessage,
            timestamp: Date.now()
        });

        console.log(`💬 ${player.name} sent a chat message in room ${game.roomCode}`);
    }

    handleDisconnect(socket) {
        console.log(`🔌 Player disconnected: ${socket.id}`);

        // Clean up rate limiter
        rateLimiter.reset(socket.id);

        // Remove all event listeners to prevent memory leaks
        const handlers = this.socketHandlers.get(socket.id);
        if (handlers) {
            handlers.forEach(({ event, handler }) => {
                socket.removeListener(event, handler);
            });
            this.socketHandlers.delete(socket.id);
        }

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
