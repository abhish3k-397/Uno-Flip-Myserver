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
        this.pendingDrawCount = 0; // Accumulated draw penalty to be taken by next player unless stacked
        this.drawUntilColor = null; // For wilddrawcolor - draw until this color is found
        
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
            // The current side is tracked globally
        });

        // Number cards (0-9)
        lightColors.forEach((lc, i) => {
            const dc = darkColors[i];
            // One zero per color
            this.deck.push(makeCard({ color: lc, value: '0' }, { color: dc, value: '0' }));
            // Two of each 1-9 per color
            for (let n = 1; n <= 9; n++) {
                this.deck.push(makeCard({ color: lc, value: n.toString() }, { color: dc, value: n.toString() }));
                this.deck.push(makeCard({ color: lc, value: n.toString() }, { color: dc, value: n.toString() }));
            }
        });
        // Action cards (2 of each per color) including FLIP (color-specific)
        lightColors.forEach((lc, i) => {
            const dc = darkColors[i];
            const lightActions = ['skip', 'reverse', 'draw2', 'flip'];
            const darkActions = ['skipeveryone', 'reverse', 'draw5', 'flip'];
            lightActions.forEach((la, idx) => {
                const da = darkActions[idx];
                this.deck.push(makeCard({ color: lc, value: la }, { color: dc, value: da }));
                this.deck.push(makeCard({ color: lc, value: la }, { color: dc, value: da }));
            });
        });
        // Wilds (4 of each type). Note: FLIP is not wild; it's color-specific above
        for (let i = 0; i < 4; i++) {
            this.deck.push(makeCard({ color: 'wild', value: 'wild' }, { color: 'wild', value: 'wild' }));
            this.deck.push(makeCard({ color: 'wild', value: 'wilddraw4' }, { color: 'wild', value: 'wilddrawcolor' }));
        }

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
        // Place first card on discard pile (ensure it's not a wild on current side)
        let firstCard;
        do {
            firstCard = this.drawCard();
            const sideProps = this.currentSide === 'light' ? firstCard.light : firstCard.dark;
            if (sideProps.color !== 'wild') break;
        } while (true);

        this.discardPile.push(firstCard);
        this.currentPlayerIndex = Math.floor(Math.random() * this.players.length);
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
        this.handleSpecialCard({
            color: cardSideProps.color,
            value: cardSideProps.value
        });

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
        if (!['skip', 'reverse', 'draw2', 'skipeveryone', 'draw5'].includes(cardSideProps.value)) {
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

        const getSideProps = (c) => {
            if (!c) return null;
            if (c.light && c.dark) {
                const sideProps = this.currentSide === 'light' ? c.light : c.dark;
                return { color: sideProps.color, value: sideProps.value, side: this.currentSide };
            }
            // Already normalized
            return c;
        };

        const cardS = getSideProps(card);
        const topS = getSideProps(topCard);

        console.log(`🃏 Checking if ${cardS.color} ${cardS.value} can be played on ${topS.color} ${topS.value}`);

        // If there is a pending draw penalty, only allow stacking with draw cards
        if (this.pendingDrawCount > 0) {
            const isStackCard = (cardS.value === 'draw2' && this.currentSide === 'light') ||
                                (cardS.value === 'draw5' && this.currentSide === 'dark') ||
                                (cardS.value === 'wilddraw4' && this.currentSide === 'light') ||
                                (cardS.value === 'wilddrawcolor' && this.currentSide === 'dark');
            if (isStackCard) {
                console.log('✅ Stacking draw card allowed');
                return true;
            }
            console.log('❌ Must stack a draw card or take penalty');
            return false;
        }

        // Wild cards can always be played (both wild and flip)
        if (cardS.color === 'wild') {
            console.log('✅ Wild card can always be played');
            return true;
        }

        // Check if card matches the current game side
        if (cardS.side && cardS.side !== this.currentSide) {
            console.log(`❌ Card side mismatch: ${cardS.side} vs current ${this.currentSide}`);
            return false;
        }

        // Match color OR value (number/symbol)
        const colorMatch = cardS.color === topS.color;
        const valueMatch = cardS.value === topS.value;
        
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
                    this.nextTurn();
                }
                break;
            case 'reverse':
                this.direction *= -1;
                if (this.players.length === 2) {
                    // Reverse returns turn to the one who played it
                    // Do nothing, current player plays again
                }
                break;
            case 'draw2':
                // Start or add to stacking penalty, pass turn to next player to allow stacking
                this.pendingDrawCount += 2;
                this.nextTurn();
                break;
            case 'wilddraw4':
                // Wild draw 4 adds 4 to penalty and requires color choice
                this.pendingDrawCount += 4;
                // Don't advance turn yet - wait for color choice, then advance
                break;
            case 'wilddrawcolor':
                // Dark side wild draw color - draw until you get the chosen color
                // This is handled differently - no fixed penalty, but draw until color match
                // Don't advance turn yet - wait for color choice, then advance
                break;
            case 'skipeveryone':
                // Dark side skip everyone: all other players lose a turn, current player plays again
                // Do not advance turn; keep current player
                break;
            case 'draw5':
                // Start or add to stacking penalty for dark side, then pass turn
                this.pendingDrawCount += 5;
                this.nextTurn();
                break;
            case 'flip':
                this.flipGame();
                break;
            case 'wild':
                // Color choice will be handled by client and updateWildColor method
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
                // Set up draw until color for next player
                this.drawUntilColor = color;
            }
            
            // End wild choice state and advance turn (this passes penalty to next player)
            this.waitingForColorChoice = false;
            this.nextTurn();
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

        // Handle draw until color (wilddrawcolor effect)
        if (this.drawUntilColor) {
            const drawnCards = [];
            let drawnCard;
            do {
                drawnCard = this.drawCard();
                player.hand.push(drawnCard);
                drawnCards.push(drawnCard);
                
                // Check if the drawn card matches the target color on current side
                const cardSideProps = this.currentSide === 'light' ? drawnCard.light : drawnCard.dark;
                if (cardSideProps.color === this.drawUntilColor) {
                    console.log(`📥 Draw until color complete: ${player.name} drew ${drawnCards.length} cards until ${this.drawUntilColor}`);
                    break;
                }
            } while (drawnCard); // Continue until we find the color or deck runs out
            
            player.hasUno = player.hand.length === 1;
            this.drawUntilColor = null; // Reset the draw until color
            this.hasDrawnCard = true;
            this.nextTurn();
            return { type: 'drawUntilColor', cards: drawnCards, targetColor: this.drawUntilColor };
        }

        // If there is a pending draw penalty, the player must take it now
        if (this.pendingDrawCount > 0) {
            for (let i = 0; i < this.pendingDrawCount; i++) {
                const penaltyCard = this.drawCard();
                player.hand.push(penaltyCard);
            }
            player.hasUno = player.hand.length === 1;
            console.log(`📥 Penalty applied: ${player.name} drew ${this.pendingDrawCount} cards`);
            this.pendingDrawCount = 0;
            this.hasDrawnCard = true;
            // After taking penalty, turn ends and passes to next
            this.nextTurn();
            return null;
        }

        // Normal draw (no pending penalty)
        const card = this.drawCard();
        player.hand.push(card);
        player.hasUno = player.hand.length === 1;
        this.hasDrawnCard = true;

        // End the player's turn immediately after drawing (house rule)
        this.nextTurn();

        return card;
    }

    endTurn(playerId) {
        if (this.currentPlayer.id !== playerId) {
            throw new Error("It's not your turn");
        }

        // Check if player can play any card
        const player = this.currentPlayer;
        const topCard = this.discardPile[this.discardPile.length - 1];
        let canPlay = false;
        for (let card of player.hand) {
            if (this.canPlayCard(card, topCard)) {
                canPlay = true;
                break;
            }
        }
        // If player can play, do not end turn until they draw
        if (canPlay) {
            throw new Error("You must draw a card if you cannot play");
        }
        // Otherwise, end turn as normal
        this.nextTurn();
    }

    nextTurn() {
        this.currentPlayerIndex = (this.currentPlayerIndex + this.direction + this.players.length) % this.players.length;
        console.log(`↪️  Turn passed to: ${this.currentPlayer.name}`);
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
            side: this.currentSide,
            otherSide: {
                color: (this.currentSide === 'light' ? topCardRaw.dark.color : topCardRaw.light.color),
                value: (this.currentSide === 'light' ? topCardRaw.dark.value : topCardRaw.light.value)
            }
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
                side: this.currentSide
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
            console.log(`Top card: ${topCard.color} ${topCard.value} (${topCard.side} side)`);
        }
        console.log('=================');
    }
}

module.exports = GameManager;