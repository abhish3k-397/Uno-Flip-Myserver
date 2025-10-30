
class GameManager {
    constructor() {
        this.games = new Map(); // roomCode -> Game
        this.playerGameMap = new Map(); // playerId -> roomCode
    }

    generateRoomCode() {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }

    createGame(hostPlayer) {
        const roomCode = this.generateRoomCode();
        const game = new UnoGame(roomCode);
        
        game.addPlayer(hostPlayer);
        this.games.set(roomCode, game);
        this.playerGameMap.set(hostPlayer.id, roomCode);
        
        console.log(`🎮 Game created: ${roomCode} by ${hostPlayer.name}`);
        return game;
    }

    joinGame(roomCode, player) {
        const game = this.games.get(roomCode);
        if (!game) {
            throw new Error('Game not found');
        }

        if (game.players.length >= 6) {
            throw new Error('Game is full (max 6 players)');
        }

        if (game.gameStarted) {
            throw new Error('Game has already started');
        }

        game.addPlayer(player);
        this.playerGameMap.set(player.id, roomCode);
        
        console.log(`👤 ${player.name} joined game: ${roomCode}`);
        return game;
    }

    getGameByRoomCode(roomCode) {
        return this.games.get(roomCode);
    }

    getGameByPlayerId(playerId) {
        const roomCode = this.playerGameMap.get(playerId);
        return roomCode ? this.games.get(roomCode) : null;
    }

    removePlayer(playerId) {
        const roomCode = this.playerGameMap.get(playerId);
        if (!roomCode) return null;

        const game = this.games.get(roomCode);
        if (!game) return null;

        const player = game.removePlayer(playerId);
        this.playerGameMap.delete(playerId);

        // Clean up empty games
        if (game.players.length === 0) {
            this.games.delete(roomCode);
            console.log(`🗑️  Game ${roomCode} deleted (no players)`);
        }

        return { game, player };
    }

    getActiveGames() {
        return Array.from(this.games.entries()).map(([roomCode, game]) => ({
            roomCode,
            playerCount: game.players.length,
            gameStarted: game.gameStarted
        }));
    }
}

class UnoGame {
    constructor(roomCode) {
        this.roomCode = roomCode;
        this.players = [];
        this.deck = [];
        this.discardPile = [];
        this.currentSide = 'light';
        this.currentPlayerIndex = 0;
        this.direction = 1;
        this.gameStarted = false;
        this.gameOver = false;
        this.waitingForColorChoice = false;
        this.hasDrawnCard = false;
        this.pendingDrawCount = 0;
        this.drawUntilColor = null;
        
        this.initializeDeck();
    }

    // Deck Management
    initializeDeck() {
        this.deck = [];
        // Definitions for both sides
        const lightColors = ['red', 'blue', 'green', 'yellow'];
        const darkColors = ['teal', 'orange', 'pink', 'purple'];

        // Helper to create a double-sided card
        const makeCard = (light, dark) => ({
            id: Math.random().toString(36).substr(2, 9),
            light,
            dark,
        });

        // Number cards (1-9) — NOTE: 0 card removed for Uno Flip variant
        lightColors.forEach((lc, i) => {
            const dc = darkColors[i];
            // Two of each 1-9 per color
            for (let n = 1; n <= 9; n++) {
                this.deck.push(makeCard({ color: lc, value: n.toString() }, { color: dc, value: n.toString() }));
                this.deck.push(makeCard({ color: lc, value: n.toString() }, { color: dc, value: n.toString() }));
            }
        });

        // Action cards (2 of each per color) including FLIP
        lightColors.forEach((lc, i) => {
            const dc = darkColors[i];
            const lightActions = ['skip', 'reverse', 'draw1', 'flip'];
            const darkActions = ['skipeveryone', 'reverse', 'draw5', 'flip'];
            
            lightActions.forEach((la, idx) => {
                const da = darkActions[idx];
                this.deck.push(makeCard({ color: lc, value: la }, { color: dc, value: da }));
                this.deck.push(makeCard({ color: lc, value: la }, { color: dc, value: da }));
            });
        });

        // Wilds (4 of each type)
        for (let i = 0; i < 4; i++) {
            this.deck.push(makeCard({ color: 'wild', value: 'wild' }, { color: 'wild', value: 'wild' }));
            this.deck.push(makeCard({ color: 'wild', value: 'wild' }, { color: 'wild', value: 'wilddrawcolor' }));
        }

        this.shuffleDeck();
        console.log(`🃏 Deck initialized with ${this.deck.length} cards`);
    }

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    // Player Management
    addPlayer(playerData) {
        const player = {
            id: playerData.id,
            name: playerData.name,
            hand: [],
            hasUno: false,
            isHost: this.players.length === 0
        };
        this.players.push(player);
        console.log(`👤 Player ${player.name} added to game ${this.roomCode}`);
        return player;
    }

    removePlayer(playerId) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) return null;

        const player = this.players[playerIndex];
        
        // Return player's cards to deck
        this.deck.push(...player.hand);
        this.shuffleDeck();
        
        this.players.splice(playerIndex, 1);

        // Adjust current player index if needed
        if (this.gameStarted) {
            if (playerIndex < this.currentPlayerIndex) {
                this.currentPlayerIndex--;
            }
            if (this.currentPlayerIndex >= this.players.length) {
                this.currentPlayerIndex = 0;
            }
            
            // If it was the current player's turn, move to next player
            if (playerIndex === this.currentPlayerIndex) {
                this.nextTurn();
            }
        }

        return player;
    }

    // Game Flow
    startGame() {
        if (this.players.length < 2) {
            throw new Error('Need at least 2 players to start');
        }

        if (this.gameStarted) {
            throw new Error('Game has already started');
        }

        this.gameStarted = true;
        this.gameOver = false;
        this.dealCards();
        this.startFirstTurn();
        
        console.log(`🎲 Game started in room: ${this.roomCode}`);
    }

    dealCards() {
        this.players.forEach(player => {
            player.hand = [];
            player.hasUno = false;
            for (let i = 0; i < 7; i++) {
                const card = this.drawCard();
                if (card) {
                    player.hand.push(card);
                }
            }
            console.log(`🎴 Dealt ${player.hand.length} cards to ${player.name}`);
        });
    }

    startFirstTurn() {
        // Place first card on discard pile (ensure it's not a wild on current side)
        let firstCard;
        let attempts = 0;
        do {
            firstCard = this.drawCard();
            if (!firstCard) break;
            
            const sideProps = this.currentSide === 'light' ? firstCard.light : firstCard.dark;
            if (sideProps.color !== 'wild') break;
            
            // If it's a wild card, put it back and draw again
            this.deck.unshift(firstCard);
            attempts++;
        } while (attempts < 10);

        if (firstCard) {
            this.discardPile.push(firstCard);
            console.log(`🃏 First card: ${this.currentSide === 'light' ? firstCard.light.color : firstCard.dark.color} ${this.currentSide === 'light' ? firstCard.light.value : firstCard.dark.value}`);
        }

        this.currentPlayerIndex = Math.floor(Math.random() * this.players.length);
        console.log(`🎯 First turn: ${this.currentPlayer.name}`);
    }

    drawCard() {
        if (this.deck.length === 0) {
            console.log('🃏 Deck empty, attempting to reshuffle...');
            try {
                this.reshuffleDiscardPile();
            } catch (error) {
                console.error('❌ Cannot reshuffle discard pile:', error.message);
                return null;
            }
        }
        
        if (this.deck.length === 0) {
            console.error('❌ No cards available in deck');
            return null;
        }
        
        return this.deck.pop();
    }

    reshuffleDiscardPile() {
        if (this.discardPile.length <= 1) {
            throw new Error('Not enough cards to reshuffle');
        }

        const topCard = this.discardPile.pop();
        this.deck = [...this.discardPile];
        this.shuffleDeck();
        this.discardPile = [topCard];
        console.log(`🃏 Reshuffled discard pile. Deck now has ${this.deck.length} cards`);
    }

    // Game Actions
    playCard(playerId, cardIndex) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) {
            throw new Error('Player not found');
        }

        if (this.currentPlayer.id !== playerId) {
            throw new Error("It's not your turn");
        }

        if (this.waitingForColorChoice) {
            throw new Error('Please choose a color for your wild card first');
        }

        if (cardIndex < 0 || cardIndex >= player.hand.length) {
            throw new Error('Invalid card index');
        }

        const rawCard = player.hand[cardIndex];
        const rawTopCard = this.discardPile[this.discardPile.length - 1];

        const cardSideProps = this.currentSide === 'light' ? rawCard.light : rawCard.dark;
        const topCardSideProps = this.currentSide === 'light' ? rawTopCard.light : rawTopCard.dark;

        console.log(`🎯 Player ${player.name} trying to play ${cardSideProps.color} ${cardSideProps.value} on ${topCardSideProps.color} ${topCardSideProps.value}`);

        if (!this.canPlayCard(rawCard, rawTopCard)) {
            throw new Error(`Cannot play this card - must match color (${topCardSideProps.color}) or value (${topCardSideProps.value})`);
        }

        // Remove card from player's hand
        const playedCard = player.hand.splice(cardIndex, 1)[0];
        player.hasUno = player.hand.length === 1;
        
        // Add to discard pile
        this.discardPile.push(playedCard);

        // Reset drawn card state
        this.hasDrawnCard = false;

        console.log(`✅ ${player.name} successfully played ${cardSideProps.color} ${cardSideProps.value}`);

        // Handle special cards
        this.handleSpecialCard(cardSideProps);

        // Check for win
        if (player.hand.length === 0) {
            this.gameOver = true;
            return { 
                success: true, 
                gameOver: true, 
                winner: player, 
                playedCard: { color: cardSideProps.color, value: cardSideProps.value, side: this.currentSide },
                requiresColorChoice: false
            };
        }

        // For wild-colored cards (except FLIP), wait for color choice before moving to next turn
        if (cardSideProps.color === 'wild' && cardSideProps.value !== 'flip') {
            this.waitingForColorChoice = true;
            return { 
                success: true, 
                gameOver: false, 
                playedCard: { color: cardSideProps.color, value: cardSideProps.value, side: this.currentSide },
                requiresColorChoice: true
            };
        }

        // Move to next turn if not already handled by special card
        if (!['skip', 'reverse', 'draw1', 'skipeveryone', 'draw5'].includes(cardSideProps.value)) {
            this.nextTurn();
        } else if (cardSideProps.value === 'reverse' && this.players.length === 2) {
            // Only in 2-player mode, reverse acts as skip (current player plays again)
            // Do nothing - current player keeps turn
        } else if (cardSideProps.value === 'skipeveryone') {
            // Dark side skip everyone: current player plays again
            // Do nothing - current player keeps turn
        } else {
            // For skip, draw2, draw5, and reverse in 3+ players, move to next turn
            this.nextTurn();
        }

        return { 
            success: true, 
            gameOver: false, 
            playedCard: { color: cardSideProps.color, value: cardSideProps.value, side: this.currentSide },
            requiresColorChoice: false
        };
    }

    canPlayCard(card, topCard) {
        if (!card || !topCard) {
            console.log('❌ Missing card or top card');
            return false;
        }

        const cardSideProps = this.currentSide === 'light' ? card.light : card.dark;
        const topCardSideProps = this.currentSide === 'light' ? topCard.light : topCard.dark;

        console.log(`🃏 Checking if ${cardSideProps.color} ${cardSideProps.value} can be played on ${topCardSideProps.color} ${topCardSideProps.value}`);

        // If there is a pending draw penalty, only allow stacking with draw cards
        if (this.pendingDrawCount > 0) {
            const isStackCard = (cardSideProps.value === 'draw1' && this.currentSide === 'light') ||
                                (cardSideProps.value === 'draw5' && this.currentSide === 'dark') ||
                                (cardSideProps.value === 'wilddrawcolor' && this.currentSide === 'dark');
            if (isStackCard) {
                console.log('✅ Stacking draw card allowed');
                return true;
            }
            console.log('❌ Must stack a draw card or take penalty');
            return false;
        }

        // Wild cards can always be played (both wild and flip)
        if (cardSideProps.color === 'wild') {
            console.log('✅ Wild card can always be played');
            return true;
        }

        // Match color OR value (number/symbol)
        const colorMatch = cardSideProps.color === topCardSideProps.color;
        const valueMatch = cardSideProps.value === topCardSideProps.value;
        
        console.log(`🔍 Color match: ${colorMatch}, Value match: ${valueMatch}`);
        
        if (colorMatch || valueMatch) {
            console.log('✅ Card can be played - matches color or value');
            return true;
        }
        
        console.log('❌ Card cannot be played - no match found');
        return false;
    }

    handleSpecialCard(card) {
        if (!card) return;

        switch (card.value) {
            case 'skip':
                if (this.players.length === 2) {
                    // Skip returns turn to the one who played it
                    // Do nothing, current player plays again
                } else {
                    // Skip advances turn (handled in playCard)
                }
                break;
            case 'reverse':
                this.direction *= -1;
                break;
            case 'draw1':
                this.pendingDrawCount += 1;
                break;
            case 'wilddrawcolor':
                // Dark side wild draw color - handled in handleWildColorChoice
                break;
            case 'skipeveryone':
                // Dark side skip everyone: all other players lose a turn, current player plays again
                break;
            case 'draw5':
                this.pendingDrawCount += 5;
                break;
            case 'flip':
                this.flipGame();
                break;
        }
    }

    handleWildColorChoice(color) {
        const topCard = this.discardPile[this.discardPile.length - 1];
        if (!topCard) return;

        // Resolve side props for the current side
        const sideProps = this.currentSide === 'light' ? topCard.light : topCard.dark;

        // Only allow setting color if the top card is a wild variant
        if (sideProps && sideProps.color === 'wild') {
            sideProps.color = color;
            
            // Handle special case for wilddrawcolor (draw until color)
            if (sideProps.value === 'wilddrawcolor') {
                this.drawUntilColor = color;
            }
            
            // End wild choice state and advance turn
            this.waitingForColorChoice = false;
            this.nextTurn();
        }
    }

    flipGame() {
        this.currentSide = this.currentSide === 'light' ? 'dark' : 'light';
        console.log(`🔄 Game flipped to ${this.currentSide} side`);
    }

    drawCardForPlayer(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) {
            throw new Error('Player not found');
        }

        if (this.currentPlayer.id !== playerId) {
            throw new Error("It's not your turn");
        }

        // Handle draw until color (wilddrawcolor effect)
        if (this.drawUntilColor) {
            const drawnCards = [];
            let drawnCard;
            do {
                drawnCard = this.drawCard();
                if (!drawnCard) break;
                
                player.hand.push(drawnCard);
                drawnCards.push(drawnCard);
                
                // Check if the drawn card matches the target color on current side
                const cardSideProps = this.currentSide === 'light' ? drawnCard.light : drawnCard.dark;
                if (cardSideProps.color === this.drawUntilColor) {
                    console.log(`📥 Draw until color complete: ${player.name} drew ${drawnCards.length} cards until ${this.drawUntilColor}`);
                    break;
                }
            } while (drawnCard);
            
            player.hasUno = player.hand.length === 1;
            this.drawUntilColor = null;
            this.hasDrawnCard = true;
            this.nextTurn();
            return { type: 'drawUntilColor', cards: drawnCards, targetColor: this.drawUntilColor };
        }

        // If there is a pending draw penalty, the player must take it now
        if (this.pendingDrawCount > 0) {
            for (let i = 0; i < this.pendingDrawCount; i++) {
                const penaltyCard = this.drawCard();
                if (penaltyCard) {
                    player.hand.push(penaltyCard);
                }
            }
            player.hasUno = player.hand.length === 1;
            console.log(`📥 Penalty applied: ${player.name} drew ${this.pendingDrawCount} cards`);
            this.pendingDrawCount = 0;
            this.hasDrawnCard = true;
            this.nextTurn();
            return null;
        }

        // Normal draw (no pending penalty)
        const card = this.drawCard();
        if (card) {
            player.hand.push(card);
            player.hasUno = player.hand.length === 1;
            this.hasDrawnCard = true;
        }

        return card;
    }

    nextTurn() {
        // Calculate next player index considering direction
        let nextIndex = (this.currentPlayerIndex + this.direction) % this.players.length;
        
        // Handle negative indices (when direction is -1)
        if (nextIndex < 0) {
            nextIndex = this.players.length - 1;
        }
        
        this.currentPlayerIndex = nextIndex;
        this.hasDrawnCard = false;
        console.log(`↪️  Turn passed to: ${this.currentPlayer.name} (direction: ${this.direction})`);
    }

    sayUno(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (player) {
            player.hasUno = true;
            console.log(`📢 ${player.name} called UNO!`);
        }
    }

    // Getters
    get currentPlayer() {
        return this.players[this.currentPlayerIndex];
    }

    get gameState() {
        const topCardRaw = this.discardPile.length > 0 ? this.discardPile[this.discardPile.length - 1] : null;
        const topCard = topCardRaw ? {
            color: (this.currentSide === 'light' ? topCardRaw.light.color : topCardRaw.dark.color),
            value: (this.currentSide === 'light' ? topCardRaw.light.value : topCardRaw.dark.value),
            side: this.currentSide
        } : null;
        
        return {
            players: this.players.map(player => ({
                id: player.id,
                name: player.name,
                handCount: player.hand.length,
                hasUno: player.hasUno,
                isCurrentPlayer: player.id === this.currentPlayer.id,
                isHost: player.isHost
            })),
            currentPlayerId: this.currentPlayer.id,
            currentPlayerName: this.currentPlayer.name,
            currentPlayerIndex: this.currentPlayerIndex,
            currentSide: this.currentSide,
            topCard: topCard,
            deckCount: this.deck.length,
            direction: this.direction,
            gameStarted: this.gameStarted,
            gameOver: this.gameOver,
            roomCode: this.roomCode,
            waitingForColorChoice: this.waitingForColorChoice,
            hasDrawnCard: this.hasDrawnCard,
            pendingDrawCount: this.pendingDrawCount,
            drawUntilColor: this.drawUntilColor
        };
    }

    getPublicGameState() {
        return this.gameState;
    }

    getPlayerHand(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) return [];
        
        // Map double-sided cards to current side
        return player.hand.map(card => {
            const sideProps = this.currentSide === 'light' ? card.light : card.dark;
            return {
                color: sideProps.color,
                value: sideProps.value,
                side: this.currentSide,
                id: card.id
            };
        });
    }

    // Debug methods
    printGameState() {
        console.log('=== GAME STATE ===');
        console.log(`Room: ${this.roomCode}, Side: ${this.currentSide}, Turn: ${this.currentPlayer.name}`);
        console.log(`Players: ${this.players.map(p => `${p.name} (${p.hand.length} cards)`).join(', ')}`);
        console.log(`Deck: ${this.deck.length} cards, Discard: ${this.discardPile.length} cards`);
        if (this.discardPile.length > 0) {
            const topCard = this.discardPile[this.discardPile.length - 1];
            const sideProps = this.currentSide === 'light' ? topCard.light : topCard.dark;
            console.log(`Top card: ${sideProps.color} ${sideProps.value}`);
        }
        console.log('=================');
    }
}

module.exports = GameManager;
