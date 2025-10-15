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
        this.hasDrawnCard = false; // Track if current player has drawn a card
        this.waitingForColorChoice = false; // Track if waiting for wild card color choice
        
        this.initializeDeck();
    }

    // Deck Management
    initializeDeck() {
        this.deck = [];
        const sides = ['light', 'dark'];
        
        sides.forEach(side => {
            // Number cards (0-9)
            ['red', 'blue', 'green', 'yellow'].forEach(color => {
                // One zero per color
                this.deck.push(this.createCard(color, '0', side));
                
                // Two of each 1-9 per color
                for (let i = 1; i <= 9; i++) {
                    this.deck.push(this.createCard(color, i.toString(), side));
                    this.deck.push(this.createCard(color, i.toString(), side));
                }
            });

            // Action cards (2 of each per color)
            ['red', 'blue', 'green', 'yellow'].forEach(color => {
                ['skip', 'reverse', 'draw2'].forEach(type => {
                    this.deck.push(this.createCard(color, type, side));
                    this.deck.push(this.createCard(color, type, side));
                });
            });

            // Wild cards (4 of each type)
            for (let i = 0; i < 4; i++) {
                this.deck.push(this.createCard('wild', 'wild', side));
                this.deck.push(this.createCard('wild', 'flip', side));
            }
        });

        this.shuffleDeck();
    }

    createCard(color, value, side) {
        return {
            id: Math.random().toString(36).substr(2, 9),
            color: color,
            value: value,
            side: side
        };
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
        this.hasDrawnCard = false;
        this.waitingForColorChoice = false;
        this.dealCards();
        this.startFirstTurn();
        
        console.log(`🎲 Game started in room: ${this.roomCode}`);
    }

    dealCards() {
        this.players.forEach(player => {
            player.hand = [];
            player.hasUno = false;
            for (let i = 0; i < 7; i++) {
                player.hand.push(this.drawCard());
            }
        });
    }

    startFirstTurn() {
        // Place first card on discard pile (make sure it's not a wild card or special card)
        let firstCard;
        do {
            firstCard = this.drawCard();
        } while (firstCard.color === 'wild' || ['wild', 'flip', 'draw2', 'skip', 'reverse'].includes(firstCard.value));

        this.discardPile.push(firstCard);
        this.currentPlayerIndex = Math.floor(Math.random() * this.players.length);
        this.hasDrawnCard = false;
        this.waitingForColorChoice = false;
        
        console.log(`🃏 First card: ${firstCard.color} ${firstCard.value}`);
        console.log(`🎯 First turn: ${this.currentPlayer.name}`);
    }

    drawCard() {
        if (this.deck.length === 0) {
            this.reshuffleDiscardPile();
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

        const card = player.hand[cardIndex];
        const topCard = this.discardPile[this.discardPile.length - 1];

        console.log(`🎯 Player ${player.name} trying to play ${card.color} ${card.value} on ${topCard.color} ${topCard.value}`);

        if (!this.canPlayCard(card, topCard)) {
            throw new Error(`Cannot play this card - must match color (${topCard.color}) or value (${topCard.value})`);
        }

        // Remove card from player's hand
        const playedCard = player.hand.splice(cardIndex, 1)[0];
        player.hasUno = player.hand.length === 1;
        
        // Add to discard pile
        this.discardPile.push(playedCard);

        // Reset drawn card state
        this.hasDrawnCard = false;

        console.log(`✅ ${player.name} successfully played ${playedCard.color} ${playedCard.value}`);

        // Handle special cards
        this.handleSpecialCard(playedCard);

        // Check for win
        if (player.hand.length === 0) {
            this.gameOver = true;
            return { 
                success: true, 
                gameOver: true, 
                winner: player, 
                playedCard: playedCard,
                requiresColorChoice: false
            };
        }

        // For wild cards, we need to wait for color choice before moving to next turn
        if (playedCard.color === 'wild' && playedCard.value === 'wild') {
            this.waitingForColorChoice = true;
            return { 
                success: true, 
                gameOver: false, 
                playedCard: playedCard,
                requiresColorChoice: true
            };
        }

        // Move to next turn if not already handled by special card
        // FIXED: Reverse card in 3+ players should NOT give another turn to current player
        if (!['skip', 'reverse', 'draw2'].includes(playedCard.value)) {
            this.nextTurn();
        } else if (playedCard.value === 'reverse' && this.players.length === 2) {
            // Only in 2-player mode, reverse acts as skip (current player plays again)
            // Do nothing - current player keeps turn
        } else {
            // For skip, draw2, and reverse in 3+ players, move to next turn
            this.nextTurn();
        }

        return { 
            success: true, 
            gameOver: false, 
            playedCard: playedCard,
            requiresColorChoice: false
        };
    }

    canPlayCard(card, topCard) {
        if (!card || !topCard) {
            console.log('❌ Missing card or top card');
            return false;
        }
        
        console.log(`🃏 Checking if ${card.color} ${card.value} can be played on ${topCard.color} ${topCard.value}`);
        
        // Wild cards can always be played (both wild and flip)
        if (card.color === 'wild') {
            console.log('✅ Wild card can always be played');
            return true;
        }
        
        // Check if card matches the current game side
        if (card.side !== this.currentSide) {
            console.log(`❌ Card side mismatch: ${card.side} vs current ${this.currentSide}`);
            return false;
        }
        
        // Match color OR value (number/symbol)
        const colorMatch = card.color === topCard.color;
        const valueMatch = card.value === topCard.value;
        
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

        console.log(`🃏 Handling special card: ${card.color} ${card.value}`);

        switch (card.value) {
            case 'skip':
                console.log(`⏭️  Skipping next player`);
                // Skip is handled in playCard method - turn advances
                break;
            case 'reverse':
                this.direction *= -1;
                console.log(`🔄 Reversing direction to: ${this.direction}`);
                // FIXED: Reverse behavior is now handled in playCard method
                // In 2-player: current player keeps turn (acts as skip)
                // In 3+ players: turn advances to previous player
                break;
            case 'draw2':
                this.nextTurn();
                const nextPlayer = this.players[this.currentPlayerIndex];
                console.log(`➕2 Drawing 2 cards for ${nextPlayer.name}`);
                for (let i = 0; i < 2; i++) {
                    nextPlayer.hand.push(this.drawCard());
                }
                nextPlayer.hasUno = nextPlayer.hand.length === 1;
                this.nextTurn();
                break;
            case 'flip':
                console.log(`🔄 Flipping game to ${this.currentSide === 'light' ? 'dark' : 'light'} side`);
                this.flipGame();
                break;
            case 'wild':
                console.log(`🎨 Wild card played - color choice needed`);
                // Color choice handled separately
                break;
        }
    }

    handleWildColorChoice(color, playerId) {
        if (!this.waitingForColorChoice) {
            throw new Error('No wild card waiting for color choice');
        }

        const player = this.players.find(p => p.id === playerId);
        if (!player) {
            throw new Error('Player not found');
        }

        if (this.currentPlayer.id !== playerId) {
            throw new Error("It's not your turn");
        }

        const topCard = this.discardPile[this.discardPile.length - 1];
        if (topCard && topCard.color === 'wild') {
            topCard.color = color;
            this.waitingForColorChoice = false;
            
            // After wild card color is chosen, move to next turn
            this.nextTurn();
            
            console.log(`🎨 ${player.name} chose wild color: ${color}`);
        }
    }

    flipGame() {
        this.currentSide = this.currentSide === 'light' ? 'dark' : 'light';
        console.log(`🔄 Game flipped to ${this.currentSide} side`);
        
        // Flip all cards in discard pile and deck
        [...this.discardPile, ...this.deck].forEach(card => {
            card.side = this.currentSide;
        });
    }

    drawCardForPlayer(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) {
            throw new Error('Player not found');
        }

        if (this.currentPlayer.id !== playerId) {
            throw new Error("It's not your turn");
        }

        // If player has already drawn a card this turn, they must play it or end turn
        if (this.hasDrawnCard) {
            throw new Error('You have already drawn a card this turn. Play it or end your turn.');
        }

        const card = this.drawCard();
        player.hand.push(card);
        player.hasUno = player.hand.length === 1;
        
        // Mark that player has drawn a card this turn
        this.hasDrawnCard = true;

        console.log(`📥 ${player.name} drew a card`);

        // Check if the drawn card is playable
        const topCard = this.discardPile[this.discardPile.length - 1];
        const isPlayable = this.canPlayCard(card, topCard);
        
        return { card, isPlayable };
    }

    endTurn(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) {
            throw new Error('Player not found');
        }

        if (this.currentPlayer.id !== playerId) {
            throw new Error("It's not your turn");
        }

        // Player can only end turn if they have drawn a card but cannot play it
        if (!this.hasDrawnCard) {
            throw new Error('You must draw a card before ending your turn');
        }

        if (this.waitingForColorChoice) {
            throw new Error('Please choose a color for your wild card first');
        }

        // Reset drawn card state and move to next player
        this.hasDrawnCard = false;
        this.nextTurn();
        
        console.log(`⏭️  ${player.name} ended turn`);
        
        return { success: true };
    }

    nextTurn() {
        this.hasDrawnCard = false;
        this.waitingForColorChoice = false;
        
        // FIXED: Calculate next player index considering direction
        let nextIndex = (this.currentPlayerIndex + this.direction) % this.players.length;
        
        // Handle negative indices (when direction is -1)
        if (nextIndex < 0) {
            nextIndex = this.players.length - 1;
        }
        
        this.currentPlayerIndex = nextIndex;
        console.log(`↪️  Turn passed to: ${this.currentPlayer.name} (direction: ${this.direction})`);
    }

    sayUno(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (player) {
            player.hasUno = true;
            console.log(`📢 ${player.name} called UNO!`);
        }
    }

    // Check if player has any playable cards
    hasPlayableCards(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) return false;

        const topCard = this.discardPile[this.discardPile.length - 1];
        if (!topCard) return true; // No top card, any card can be played

        return player.hand.some(card => this.canPlayCard(card, topCard));
    }

    // Getters
    get currentPlayer() {
        return this.players[this.currentPlayerIndex];
    }

    get gameState() {
        const topCard = this.discardPile.length > 0 ? this.discardPile[this.discardPile.length - 1] : null;
        
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
            hasDrawnCard: this.hasDrawnCard,
            waitingForColorChoice: this.waitingForColorChoice
        };
    }

    getPublicGameState() {
        return this.gameState;
    }

    getPlayerHand(playerId) {
        const player = this.players.find(p => p.id === playerId);
        return player ? player.hand : [];
    }

    // Debug methods
    printGameState() {
        console.log('=== GAME STATE ===');
        console.log(`Room: ${this.roomCode}, Side: ${this.currentSide}, Turn: ${this.currentPlayer.name}`);
        console.log(`Players: ${this.players.map(p => `${p.name} (${p.hand.length} cards)`).join(', ')}`);
        console.log(`Deck: ${this.deck.length} cards, Discard: ${this.discardPile.length} cards`);
        console.log(`Has Drawn Card: ${this.hasDrawnCard}, Waiting for Color: ${this.waitingForColorChoice}`);
        if (this.discardPile.length > 0) {
            const topCard = this.discardPile[this.discardPile.length - 1];
            console.log(`Top card: ${topCard.color} ${topCard.value} (${topCard.side} side)`);
        }
        console.log('=================');
    }

    // Get playable cards for a player (for AI or debugging)
    getPlayableCards(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) return [];

        const topCard = this.discardPile[this.discardPile.length - 1];
        if (!topCard) return player.hand; // Any card can be played if no top card

        return player.hand.filter(card => this.canPlayCard(card, topCard));
    }

    // Force next turn (for testing or error recovery)
    forceNextTurn() {
        console.log(`⚠️  Forcing next turn`);
        this.hasDrawnCard = false;
        this.waitingForColorChoice = false;
        this.nextTurn();
    }
}

module.exports = GameManager;