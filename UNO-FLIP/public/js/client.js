class UnoClient {
    constructor() {
        this.socket = null;
        this.playerId = null;
        this.playerName = null;
        this.roomCode = null;
        this.isMyTurn = false;
        this.hasDrawnCard = false;
        this.waitingForColorChoice = false;
        this.currentWildCardIndex = null;
        
        this.initializeEventListeners();
        this.initializeColorModal();
        this.currentSide = 'light';
    }

    initializeEventListeners() {
        // Lobby events
        document.getElementById('createGame').addEventListener('click', () => this.createGame());
        document.getElementById('joinGame').addEventListener('click', () => this.joinGame());
        document.getElementById('sayUno').addEventListener('click', () => this.sayUno());
        document.getElementById('flipDeck').addEventListener('click', () => this.flipDeck());
        // End Turn button removed; draw auto-ends turn
        document.getElementById('playAgain').addEventListener('click', () => this.playAgain());

        // Draw pile click event
        document.getElementById('drawPile').addEventListener('click', () => this.drawCard());

        // Enter key support for inputs
        document.getElementById('playerName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createGame();
        });
        document.getElementById('roomCode').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinGame();
        });
    }

    initializeColorModal() {
        // Color modal event listeners
        const colorModal = document.getElementById('colorModal');
        if (colorModal) {
            const setOptions = (side) => {
                const colors = side === 'dark' ? ['teal','orange','pink','purple'] : ['red','blue','green','yellow'];
                const labels = {
                    red: 'Red', blue: 'Blue', green: 'Green', yellow: 'Yellow',
                    teal: 'Teal', orange: 'Orange', pink: 'Pink', purple: 'Purple'
                };
                const container = colorModal.querySelector('.color-options');
                if (!container) return;
                container.innerHTML = '';
                colors.forEach(c => {
                    const btn = document.createElement('button');
                    btn.className = `color-option ${c}`;
                    btn.setAttribute('data-color', c);
                    btn.innerHTML = `<div class="color-swatch"></div>${labels[c]}`;
                    btn.addEventListener('click', (e) => {
                        const color = e.currentTarget.getAttribute('data-color');
                        this.chooseWildColor(color);
                    });
                    container.appendChild(btn);
                });
            };

            // Initialize options for light by default
            setOptions('light');
            this.setWildColorOptions = setOptions;

            const cancelBtn = colorModal.querySelector('#cancelColor');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    this.hideColorModal();
                    this.showMessage('Wild card play cancelled', 'info');
                });
            }
        }
    }

    connectToServer() {
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connected to server with ID:', this.socket.id);
            this.playerId = this.socket.id;
        });

        this.setupSocketListeners();
    }

    setupSocketListeners() {
        // Connection events
        this.socket.on('disconnect', () => {
            this.showMessage('Disconnected from server', 'error');
        });

        this.socket.on('error', (data) => {
            console.error('Server error:', data.message);
            this.showMessage(data.message, 'error');
        });

        // Lobby events
        this.socket.on('lobbyUpdate', (data) => this.updateLobby(data));
        this.socket.on('gameCreated', (data) => this.onGameCreated(data));
        this.socket.on('joinSuccess', (data) => this.onJoinSuccess(data));
        this.socket.on('joinError', (data) => this.showMessage(data.message, 'error'));

        // Game events
        this.socket.on('gameStart', (data) => this.onGameStart(data));
        this.socket.on('gameStateUpdate', (data) => this.updateGameState(data));
        this.socket.on('playerTurn', (data) => this.onPlayerTurn(data));
        this.socket.on('cardPlayed', (data) => this.onCardPlayed(data));
        this.socket.on('cardDrawn', (data) => this.onCardDrawn(data));
        this.socket.on('unoCalled', (data) => this.onUnoCalled(data));
        this.socket.on('gameFlipped', (data) => this.onGameFlipped(data));
        this.socket.on('gameOver', (data) => this.onGameOver(data));
        this.socket.on('playerLeft', (data) => this.onPlayerLeft(data));
        this.socket.on('wildColorChosen', (data) => this.onWildColorChosen(data));
        this.socket.on('returnToLobby', () => this.returnToLobby());

        // New events for UNO rules
        this.socket.on('chooseColor', (data) => this.onChooseColor(data));
        this.socket.on('drawnCardPlayable', (data) => this.onDrawnCardPlayable(data));
        this.socket.on('gameMessage', (data) => this.onGameMessage(data));
        this.socket.on('drawUntilColor', (data) => this.onDrawUntilColor(data));
    }

    // Lobby Methods
    createGame() {
        const playerName = document.getElementById('playerName').value.trim();
        if (!playerName) {
            this.showMessage('Please enter your name', 'error');
            return;
        }

        this.playerName = playerName;
        this.connectToServer();
        
        // Small delay to ensure connection is established
        setTimeout(() => {
            this.socket.emit('createGame', {
                playerName: playerName,
                playerId: this.playerId
            });
        }, 100);
    }

    joinGame() {
        const playerName = document.getElementById('playerName').value.trim();
        const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();

        if (!playerName) {
            this.showMessage('Please enter your name', 'error');
            return;
        }

        if (!roomCode) {
            this.showMessage('Please enter a room code', 'error');
            return;
        }

        this.playerName = playerName;
        this.connectToServer();

        // Small delay to ensure connection is established
        setTimeout(() => {
            this.socket.emit('joinGame', {
                playerName: playerName,
                roomCode: roomCode,
                playerId: this.playerId
            });
        }, 100);
    }

    onGameCreated(data) {
        this.roomCode = data.roomCode;
        this.showMessage(`Game created! Room code: ${data.roomCode}`, 'success');
        document.getElementById('roomIdDisplay').textContent = data.roomCode;
        this.updateLobby(data);
    }

    onJoinSuccess(data) {
        this.roomCode = data.roomCode;
        this.showMessage(`Joined game: ${data.roomCode}`, 'success');
        document.getElementById('roomIdDisplay').textContent = data.roomCode;
        this.updateLobby(data);
    }

    updateLobby(data) {
        const playersContainer = document.getElementById('playersContainer');
        const playerCount = document.getElementById('playerCount');
        const roomInfo = document.getElementById('roomInfo');
        
        if (!playersContainer) return;

        playersContainer.innerHTML = '';

        if (!data.players || !Array.isArray(data.players)) {
            console.warn('Invalid players data:', data.players);
            return;
        }

        // Update player count
        if (playerCount) {
            playerCount.textContent = data.players.length;
        }

        // Update room info
        if (roomInfo) {
            if (this.roomCode) {
                roomInfo.innerHTML = `<strong>Room:</strong> ${this.roomCode}`;
            } else {
                roomInfo.innerHTML = `<span>No active room</span>`;
            }
        }

        if (data.players.length === 0) {
            playersContainer.innerHTML = `
                <div class="empty-state">
                    <p>No players yet</p>
                    <p class="hint">Create or join a game to start playing!</p>
                </div>
            `;
            return;
        }

        data.players.forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.className = `player-item ${player.isHost ? 'host' : ''}`;
            playerElement.innerHTML = `
                <div class="player-name">${player.name}</div>
                <div class="player-badge">
                    ${player.isHost ? '<span class="host-badge">👑 Host</span>' : ''}
                    ${player.id === this.playerId ? '<span class="you-badge">👤 You</span>' : ''}
                </div>
            `;
            playersContainer.appendChild(playerElement);
        });

        // Show start game button if we're the host and have enough players
        if (data.players && data.players.length >= 2 && data.players[0].id === this.playerId) {
            this.showStartGameButton();
        }
    }

    showStartGameButton() {
        // Remove existing start button if any
        const existingButton = document.getElementById('startGameBtn');
        if (existingButton) existingButton.remove();

        const startButton = document.createElement('button');
        startButton.id = 'startGameBtn';
        startButton.className = 'btn btn-success';
        startButton.innerHTML = '🚀 Start Game';
        startButton.onclick = () => this.startGame();
        startButton.style.marginTop = '15px';
        startButton.style.width = '100%';
        
        const lobbyControls = document.querySelector('.lobby-controls');
        if (lobbyControls) {
            lobbyControls.appendChild(startButton);
        }
    }

    startGame() {
        if (!this.roomCode) {
            this.showMessage('No room code available', 'error');
            return;
        }

        this.socket.emit('startGame', { roomCode: this.roomCode });
    }

    // Game Methods
    onGameStart(data) {
        console.log('Game starting with data:', data);
        this.switchScreen('game');
        this.updateGameState(data);
        this.showMessage('Game started! Good luck!', 'success');
    }

    updateGameState(data) {
        if (!data) {
            console.error('No game state data received');
            return;
        }

        // Set turn-related flags BEFORE rendering UI so playability is correct
        this.isMyTurn = data.currentPlayerId === this.playerId;
        this.hasDrawnCard = data.hasDrawnCard || false;
        this.waitingForColorChoice = data.waitingForColorChoice || false;

        // Update game info
        document.getElementById('currentSide').textContent = data.currentSide ? 
            data.currentSide.charAt(0).toUpperCase() + data.currentSide.slice(1) : 'Light';
        document.getElementById('currentSide').className = `value side-${data.currentSide || 'light'}`;
        this.currentSide = data.currentSide || 'light';
        
        document.getElementById('currentPlayerName').textContent = data.currentPlayerName || 'Unknown';
        document.getElementById('deckCount').textContent = data.deckCount || 0;
        document.getElementById('deckCountBadge').textContent = data.deckCount || 0;
        
        // Update player's hand (handle undefined)
        this.updatePlayerHand(data.playerHand || []);
        
        // Update opponents
        this.updateOpponents(data.players || [], data.currentPlayerIndex || 0);
        
        // Update discard pile
        this.updateDiscardPile(data.topCard);
        
        // Update turn indicator
        this.updateTurnIndicator();

        // Update UNO status
        this.updateUnoStatus(data);
    }

    updatePlayerHand(hand) {
        const handContainer = document.getElementById('playerHand');
        const cardCount = document.getElementById('playerCardCount');
        
        if (!handContainer || !cardCount) return;

        handContainer.innerHTML = '';
        cardCount.textContent = hand ? hand.length : 0;

        if (!hand || !Array.isArray(hand)) {
            console.warn('Invalid hand data received:', hand);
            const noCardsMsg = document.createElement('div');
            noCardsMsg.className = 'empty-hand';
            noCardsMsg.innerHTML = '<p>No cards in hand</p>';
            handContainer.appendChild(noCardsMsg);
            return;
        }

        if (hand.length === 0) {
            const emptyHand = document.createElement('div');
            emptyHand.className = 'empty-hand';
            emptyHand.innerHTML = '<p>🎉 No cards left! Call UNO if you have one card!</p>';
            handContainer.appendChild(emptyHand);
            return;
        }

        hand.forEach((card, index) => {
            const cardElement = this.createCardElement(card, index, this.isMyTurn);
            handContainer.appendChild(cardElement);
        });
    }

    updateOpponents(players, currentPlayerIndex) {
        const opponentsArea = document.getElementById('opponentsArea');
        if (!opponentsArea) return;

        opponentsArea.innerHTML = '';

        if (!players || !Array.isArray(players)) {
            console.warn('Invalid players data for opponents:', players);
            opponentsArea.innerHTML = `
                <div class="opponents-placeholder">
                    <p>Other players will appear here</p>
                </div>
            `;
            return;
        }

        const otherPlayers = players.filter(player => player.id !== this.playerId);

        if (otherPlayers.length === 0) {
            opponentsArea.innerHTML = `
                <div class="opponents-placeholder">
                    <p>Waiting for other players to join...</p>
                </div>
            `;
            return;
        }

        otherPlayers.forEach((player, index) => {
            const opponentElement = document.createElement('div');
            opponentElement.className = `opponent ${index === currentPlayerIndex ? 'current-turn' : ''}`;
            
            opponentElement.innerHTML = `
                <div class="opponent-name">${player.name}</div>
                <div class="opponent-cards">Cards: ${player.handCount || 0}</div>
                ${player.hasUno ? '<div class="uno-indicator">📢 UNO!</div>' : ''}
                ${player.isHost ? '<div class="host-indicator">👑 Host</div>' : ''}
                ${player.id === this.playerId ? '<div class="you-indicator">👤 You</div>' : ''}
            `;
            
            opponentsArea.appendChild(opponentElement);
        });
    }

    updateDiscardPile(topCard) {
        const discardPile = document.getElementById('discardPile');
        const currentTopCard = document.getElementById('currentTopCard');
        
        if (!discardPile) return;

        if (topCard) {
            discardPile.className = `card discard card-${topCard.color}`;
            discardPile.innerHTML = `
                <div class="card-content">
                    <div class="card-value">${this.getCardDisplayValue(topCard)}</div>
                    ${topCard.side ? `<div class="card-side">${topCard.side.charAt(0).toUpperCase()}</div>` : ''}
                </div>
            `;
            discardPile.title = `${topCard.color} ${topCard.value} (${topCard.side} side)`;
            
            // Update the current top card display
            if (currentTopCard) {
                currentTopCard.textContent = `${topCard.color} ${topCard.value}`;
                currentTopCard.className = `value card-color-${topCard.color}`;
            }
        } else {
            discardPile.className = 'card discard';
            discardPile.innerHTML = `
                <div class="card-content">
                    <div class="card-start">START</div>
                </div>
            `;
            discardPile.title = 'Starting card';
            
            if (currentTopCard) {
                currentTopCard.textContent = 'None';
                currentTopCard.className = 'value';
            }
        }
    }

    updateTurnIndicator() {
        const endTurnButton = null; // End Turn removed
        const sayUnoButton = document.getElementById('sayUno');
        const drawPile = document.getElementById('drawPile');
        const turnInstruction = document.getElementById('turnInstruction');
        
        if (!sayUnoButton || !drawPile) return;

        if (this.isMyTurn) {
            // Enable draw pile
            drawPile.style.cursor = 'pointer';
            drawPile.style.opacity = '1';
            drawPile.classList.add('active');
            
            // Enable UNO button if player has 2 cards
            const handCount = document.getElementById('playerCardCount').textContent;
            sayUnoButton.disabled = parseInt(handCount) !== 2;
            
            if (this.waitingForColorChoice) {
                if (turnInstruction) turnInstruction.textContent = 'Choose a color for your wild card';
                this.showMessage('Choose a color for your wild card!', 'info');
            } else if (this.hasDrawnCard) {
                if (turnInstruction) turnInstruction.textContent = 'You drew a card. Turn passed.';
            } else {
                if (turnInstruction) turnInstruction.textContent = 'Play a card or draw from the deck';
            }
            
            document.body.classList.add('my-turn');
        } else {
            // Not player's turn
            drawPile.style.cursor = 'not-allowed';
            drawPile.style.opacity = '0.6';
            drawPile.classList.remove('active');
            sayUnoButton.disabled = true;
            if (turnInstruction) turnInstruction.textContent = `Waiting for ${document.getElementById('currentPlayerName').textContent}`;
            document.body.classList.remove('my-turn');
        }
    }

    updateUnoStatus(data) {
        const unoStatus = document.getElementById('unoStatus');
        if (!unoStatus) return;

        const currentPlayer = data.players?.find(p => p.id === this.playerId);
        if (currentPlayer) {
            if (currentPlayer.hasUno) {
                unoStatus.textContent = '📢 UNO!';
                unoStatus.style.color = '#ffd700';
            } else {
                unoStatus.textContent = '';
            }
        }
    }

    createCardElement(card, index, isPlayable = false) {
        const cardElement = document.createElement('div');
        cardElement.className = `hand-card card-${card.color} ${isPlayable ? 'playable' : ''}`;
        
        cardElement.innerHTML = `
            <div class="card-content">
                <div class="card-value">${this.getCardDisplayValue(card)}</div>
                ${card.side ? `<div class="card-side">${card.side.charAt(0).toUpperCase()}</div>` : ''}
            </div>
        `;
        
        cardElement.title = `${card.color} ${card.value} (${card.side} side)`;
        
        if (isPlayable && !this.waitingForColorChoice) {
            cardElement.addEventListener('click', () => this.playCard(index, card));
        } else {
            cardElement.style.cursor = 'default';
            cardElement.style.opacity = '0.7';
        }
        
        return cardElement;
    }

    getCardDisplayValue(card) {
        if (!card || !card.value) return '?';
        
        if (card.value === 'wild') return 'WILD';
        if (card.value === 'flip') return 'FLIP';
        if (card.value === 'skip') return 'SKIP';
        if (card.value === 'reverse') return 'REV';
        if (card.value === 'draw2') return '+2';
        return card.value;
    }

    // Game Actions
    playCard(cardIndex, card) {
        if (!this.isMyTurn) {
            this.showMessage("It's not your turn!", 'error');
            return;
        }

        if (this.waitingForColorChoice) {
            this.showMessage("Please choose a color for your wild card first!", 'warning');
            return;
        }

        if (!this.roomCode) {
            this.showMessage('Not in a game room', 'error');
            return;
        }

        console.log(`🎯 Attempting to play ${card.color} ${card.value} at index ${cardIndex}`);

        this.socket.emit('playCard', {
            roomCode: this.roomCode,
            cardIndex: cardIndex,
            playerId: this.playerId
        });
    }

    drawCard() {
        if (!this.isMyTurn) {
            this.showMessage("It's not your turn!", 'error');
            return;
        }

        if (this.hasDrawnCard) {
            this.showMessage("You already drew a card this turn. Play it or end your turn.", 'warning');
            return;
        }

        if (this.waitingForColorChoice) {
            this.showMessage("Please choose a color for your wild card first!", 'warning');
            return;
        }

        if (!this.roomCode) {
            this.showMessage('Not in a game room', 'error');
            return;
        }

        console.log('Drawing a card');

        this.socket.emit('drawCard', {
            roomCode: this.roomCode,
            playerId: this.playerId
        });
    }

    // endTurn removed; draw auto-ends the turn

    sayUno() {
        if (!this.roomCode) {
            this.showMessage('Not in a game room', 'error');
            return;
        }

        const handCount = document.getElementById('playerCardCount').textContent;
        if (parseInt(handCount) !== 2) {
            this.showMessage("You can only call UNO when you have 2 cards!", 'warning');
            return;
        }

        console.log('Calling UNO!');

        this.socket.emit('sayUno', {
            roomCode: this.roomCode,
            playerId: this.playerId
        });
    }

    flipDeck() {
        // This would be handled by playing a FLIP card in UNO Flip
        this.showMessage('Play a FLIP card to flip the game!', 'info');
    }

    chooseWildColor(color) {
        if (!this.roomCode) {
            this.showMessage('Not in a game room', 'error');
            return;
        }

        console.log(`Choosing wild color: ${color}`);

        this.socket.emit('chooseWildColor', {
            roomCode: this.roomCode,
            playerId: this.playerId,
            color: color
        });
        
        this.hideColorModal();
        this.showMessage(`You chose ${color}`, 'info');
    }

    // Event Handlers for new events
    onChooseColor(data) {
        this.showMessage('Choose a color for your wild card!', 'info');
        this.showColorModal();
    }

    onDrawnCardPlayable(data) {
        this.showMessage('You drew a playable card! You can play it or end your turn.', 'info');
    }

    onGameMessage(data) {
        this.showMessage(data.message, data.type || 'info');
    }

    onDrawUntilColor(data) {
        if (data.playerId === this.playerId) {
            // Show animation for the player who drew
            this.animateDrawUntilColor(data.cards, data.targetColor);
            this.showMessage(`You drew ${data.cards.length} cards until you got ${data.targetColor}!`, 'info');
        } else {
            // Show message for other players
            this.showMessage(`${data.playerName} drew until they got a ${data.targetColor} card`, 'info');
        }
    }

    animateDrawUntilColor(cards, targetColor) {
        // Create animation container if it doesn't exist
        let animationContainer = document.getElementById('drawAnimationContainer');
        if (!animationContainer) {
            animationContainer = document.createElement('div');
            animationContainer.id = 'drawAnimationContainer';
            animationContainer.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 2000;
                background: rgba(0, 0, 0, 0.8);
                padding: 20px;
                border-radius: 10px;
                color: white;
                text-align: center;
            `;
            document.body.appendChild(animationContainer);
        }

        animationContainer.innerHTML = `
            <h3>Drawing until ${targetColor}...</h3>
            <div id="drawingCards" style="display: flex; gap: 10px; justify-content: center; margin: 20px 0;"></div>
            <p id="drawProgress">Drawing card 1 of ${cards.length}...</p>
        `;

        const drawingCards = document.getElementById('drawingCards');
        const drawProgress = document.getElementById('drawProgress');

        // Animate each card being drawn
        cards.forEach((card, index) => {
            setTimeout(() => {
                const cardElement = document.createElement('div');
                cardElement.className = `card card-${card.color || 'wild'}`;
                cardElement.style.cssText = `
                    width: 60px;
                    height: 90px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    animation: drawCard 0.5s ease-in-out;
                `;
                cardElement.textContent = this.getCardDisplayValue(card);
                drawingCards.appendChild(cardElement);
                
                drawProgress.textContent = `Drawing card ${index + 1} of ${cards.length}...`;
                
                if (index === cards.length - 1) {
                    setTimeout(() => {
                        animationContainer.remove();
                        this.showMessage(`Found ${targetColor} card!`, 'success');
                    }, 1000);
                }
            }, index * 500); // 500ms delay between each card
        });

        // Add CSS animation for card drawing
        if (!document.getElementById('drawCardAnimation')) {
            const style = document.createElement('style');
            style.id = 'drawCardAnimation';
            style.textContent = `
                @keyframes drawCard {
                    0% { 
                        transform: translateY(-100px) rotate(-10deg); 
                        opacity: 0; 
                    }
                    50% { 
                        transform: translateY(-50px) rotate(5deg); 
                        opacity: 0.7; 
                    }
                    100% { 
                        transform: translateY(0) rotate(0deg); 
                        opacity: 1; 
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Color Modal Methods
    showColorModal() {
        const modal = document.getElementById('colorModal');
        if (modal) {
            // Rebuild options based on current side
            const side = (this.currentSide || 'light') === 'dark' ? 'dark' : 'light';
            if (typeof this.setWildColorOptions === 'function') {
                this.setWildColorOptions(side);
            }
            modal.classList.add('active');
        }
    }

    hideColorModal() {
        const modal = document.getElementById('colorModal');
        if (modal) {
            modal.classList.remove('active');
        }
        this.waitingForColorChoice = false;
    }

    // Existing Event Handlers (updated)
    onPlayerTurn(data) {
        this.isMyTurn = data.playerId === this.playerId;
        this.hasDrawnCard = false; // Reset drawn card state on new turn
        this.waitingForColorChoice = false; // Reset color choice state
        this.updateTurnIndicator();
        
        if (data.playerId === this.playerId) {
            this.showMessage('Your turn! Play a matching card or draw from deck.', 'success');
        } else {
            this.showMessage(`${data.playerName}'s turn`, 'info');
        }
    }

    onCardPlayed(data) {
        if (data.playerName !== this.playerName) {
            if (data.waitingForColor) {
                this.showMessage(`${data.playerName} played a wild card and is choosing color...`, 'info');
            } else {
                this.showMessage(`${data.playerName} played a card`, 'info');
            }
        }
    }

    onCardDrawn(data) {
        // Update local state if it's our draw
        if (data.playerId === this.playerId) {
            this.hasDrawnCard = true;
            if (data.canPlay) {
                this.showMessage('You drew a playable card! You can play it or end your turn.', 'info');
            } else {
                this.showMessage('You drew a card. Play it or end your turn.', 'info');
            }
            this.updateTurnIndicator(); // Refresh UI
        } else {
            this.showMessage(`${data.playerName} drew a card`, 'info');
        }
    }

    onUnoCalled(data) {
        this.showMessage(`${data.playerName} says UNO!`, 'success');
    }

    onGameFlipped(data) {
        this.showMessage(`Game flipped to ${data.newSide} side!`, 'warning');
    }

    onWildColorChosen(data) {
        this.showMessage(`${data.playerName} chose ${data.color}`, 'info');
    }

    onGameOver(data) {
        this.switchScreen('gameOver');
        const winnerMessage = document.getElementById('winnerMessage');
        if (winnerMessage && data.winner) {
            winnerMessage.textContent = `${data.winner.name} wins the game!`;
        }
        this.showMessage(`Game over! ${data.winner.name} wins!`, 'success');
        
        // Reset game state
        this.isMyTurn = false;
        this.hasDrawnCard = false;
        this.waitingForColorChoice = false;
    }

    onPlayerLeft(data) {
        this.showMessage(`${data.playerName} left the game`, 'warning');
    }

    returnToLobby() {
        this.switchScreen('lobby');
        this.showMessage('Returned to lobby', 'info');
        
        // Reset game state
        this.isMyTurn = false;
        this.hasDrawnCard = false;
        this.waitingForColorChoice = false;
        
        // Clear any modals
        this.hideColorModal();
    }

    playAgain() {
        if (!this.roomCode) {
            this.showMessage('Not in a game room', 'error');
            return;
        }

        this.socket.emit('playAgain', {
            roomCode: this.roomCode,
            playerId: this.playerId
        });
    }

    // Utility Methods
    switchScreen(screenName) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Show target screen
        const targetScreen = document.getElementById(screenName);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }

        // Remove any color choice dialogs
        this.hideColorModal();
    }

    showMessage(message, type = 'info') {
        console.log(`[${type}] ${message}`);
        
        // Create or get message container
        let messageContainer = document.getElementById('messageContainer');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.id = 'messageContainer';
            messageContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
                max-width: 300px;
            `;
            document.body.appendChild(messageContainer);
        }

        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = `message message-${type}`;
        messageElement.textContent = message;
        messageElement.style.cssText = `
            padding: 12px 16px;
            margin: 8px 0;
            border-radius: 8px;
            color: white;
            font-weight: bold;
            background: ${this.getMessageColor(type)};
            animation: slideInRight 0.3s ease;
            box-shadow: var(--shadow);
            border-left: 4px solid ${this.getMessageBorderColor(type)};
        `;

        messageContainer.appendChild(messageElement);

        // Remove message after 4 seconds
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, 4000);
    }

    getMessageColor(type) {
        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            warning: '#ff9800',
            info: '#2196F3'
        };
        return colors[type] || colors.info;
    }

    getMessageBorderColor(type) {
        const colors = {
            success: '#388E3C',
            error: '#D32F2F',
            warning: '#F57C00',
            info: '#1976D2'
        };
        return colors[type] || colors.info;
    }

    // Debug method to show current state
    debugState() {
        console.log('=== CLIENT STATE ===');
        console.log(`Player: ${this.playerName} (${this.playerId})`);
        console.log(`Room: ${this.roomCode}`);
        console.log(`My Turn: ${this.isMyTurn}`);
        console.log(`Has Drawn: ${this.hasDrawnCard}`);
        console.log(`Waiting for Color: ${this.waitingForColorChoice}`);
        
        // Add card matching debug
        this.debugCardMatching();
        console.log('===================');
    }

    // Add this method to help debug card matching
    debugCardMatching() {
        const game = window.game; // Reference to the game instance if available
        if (!game) {
            console.log('Game instance not available');
            return;
        }

        const topCard = game.discardPile[game.discardPile.length - 1];
        const playerHand = game.getPlayerHand(this.playerId);
        
        console.log('=== CARD MATCHING DEBUG ===');
        console.log(`Top card: ${topCard.color} ${topCard.value}`);
        console.log('Your hand:');
        
        playerHand.forEach((card, index) => {
            const canPlay = game.canPlayCard(card, topCard);
            console.log(`[${index}] ${card.color} ${card.value} - Playable: ${canPlay}`);
        });
        console.log('==========================');
    }
}

// Add CSS animations for messages and other elements
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }
    
    .my-turn .player-area {
        border: 3px solid #4CAF50;
        border-radius: 10px;
        padding: 10px;
        background: rgba(76, 175, 80, 0.1);
    }
    
    .current-turn {
        border: 2px solid #FFD700 !important;
        animation: pulse 2s infinite;
    }
    
    .uno-indicator {
        color: #FFD700;
        font-weight: bold;
        animation: blink 1s infinite;
        margin-top: 5px;
    }
    
    .host-indicator, .you-indicator {
        margin-top: 5px;
        font-size: 0.9em;
        padding: 2px 6px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.2);
    }
    
    .host-badge, .you-badge {
        font-size: 0.8em;
        padding: 2px 6px;
        border-radius: 10px;
        background: rgba(255, 215, 0, 0.2);
    }
    
    @keyframes blink {
        50% { opacity: 0.5; }
    }
    
    .playable {
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .playable:hover {
        transform: translateY(-10px) scale(1.05);
        box-shadow: 0 8px 15px rgba(0, 0, 0, 0.3);
    }
    
    .card-wild {
        background: linear-gradient(135deg, #2f3640, #7f8fa6) !important;
        color: white;
    }
    
    .card-red { background: linear-gradient(135deg, #ff6b6b, #c23616) !important; color: white; }
    .card-blue { background: linear-gradient(135deg, #4834d4, #0652DD) !important; color: white; }
    .card-green { background: linear-gradient(135deg, #00d2d3, #009432) !important; color: white; }
    .card-yellow { background: linear-gradient(135deg, #fbc531, #e1b12c) !important; color: black; }
    
    /* Improve card text visibility */
    .hand-card, .card {
        font-weight: bold;
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        word-break: break-word;
        padding: 5px;
    }
    
    .card-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
    }
    
    .card-value {
        font-size: 1.1em;
        font-weight: 800;
    }
    
    .card-side {
        font-size: 0.7em;
        opacity: 0.8;
        background: rgba(0, 0, 0, 0.2);
        padding: 1px 4px;
        border-radius: 3px;
    }
    
    /* Turn instruction styling */
    .turn-instruction {
        padding: 10px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 5px;
        font-size: 14px;
        text-align: center;
        margin-top: 10px;
        min-height: 20px;
    }
    
    .deck.active {
        animation: pulse 1.5s infinite;
        cursor: pointer;
    }
    
    /* Improve button states */
    .game-controls button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none !important;
    }
    
    .game-controls button:not(:disabled):hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    }
    
    /* Player badges in lobby */
    .player-badge {
        display: flex;
        gap: 5px;
        font-size: 0.8em;
    }
    
    .host-badge {
        background: rgba(255, 215, 0, 0.2);
        color: #ffd700;
    }
    
    .you-badge {
        background: rgba(76, 175, 80, 0.2);
        color: #4CAF50;
    }
    
    /* Responsive improvements */
    @media (max-width: 768px) {
        #messageContainer {
            top: 10px;
            right: 10px;
            left: 10px;
            max-width: none;
        }
        
        .message {
            font-size: 14px;
            padding: 10px 12px;
        }
        
        .color-option {
            padding: 15px 10px !important;
            font-size: 12px;
        }
    }
`;
document.head.appendChild(style);

// Initialize the client when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.unoClient = new UnoClient();
    console.log('UNO Flip client initialized');
    
    // Add debug helper to global scope
    window.debugUno = () => {
        if (window.unoClient) {
            window.unoClient.debugState();
        }
    };
});