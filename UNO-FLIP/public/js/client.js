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
        this.currentSide = 'light';
        this.gameStartTime = null;
        
        this.initializeEventListeners();
        this.initializeColorModal();
        this.addCardStyles();
    }

    addCardStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .card-deal-animation {
                animation: dealCard 0.6s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            @keyframes dealCard {
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
            
            .card-play-animation {
                animation: playCard 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
            }
            
            @keyframes playCard {
                0% {
                    transform: translateY(0) scale(1) rotate(0deg);
                    opacity: 1;
                    z-index: 1000;
                }
                50% {
                    transform: translateY(-150px) scale(1.2) rotate(5deg);
                    opacity: 0.8;
                }
                100% {
                    transform: translateY(-300px) scale(0.8) rotate(10deg);
                    opacity: 0;
                    z-index: 1000;
                }
            }
            
            .draw-animation {
                animation: drawCard 1s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            @keyframes drawCard {
                0% {
                    transform: translateX(0) translateY(0) rotate(0deg);
                    opacity: 1;
                }
                50% {
                    transform: translateX(-50px) translateY(-100px) rotate(-10deg);
                    opacity: 0.8;
                }
                100% {
                    transform: translateX(0) translateY(0) rotate(0deg);
                    opacity: 1;
                }
            }
            
            .glow-effect {
                animation: glowPulse 2s infinite;
            }
            
            @keyframes glowPulse {
                0%, 100% {
                    box-shadow: 0 0 20px rgba(255, 215, 0, 0.6);
                }
                50% {
                    box-shadow: 0 0 40px rgba(255, 215, 0, 0.9);
                }
            }
            
            .uno-call-animation {
                animation: unoCall 0.5s ease-in-out 3;
            }
            
            @keyframes unoCall {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
            
            .flip-animation {
                animation: cardFlip 0.6s ease-in-out;
            }
            
            @keyframes cardFlip {
                0% { transform: rotateY(0deg); }
                50% { transform: rotateY(90deg); }
                100% { transform: rotateY(0deg); }
            }
        `;
        document.head.appendChild(style);
    }

    initializeEventListeners() {
        // Lobby events
        document.getElementById('createGame').addEventListener('click', () => this.createGame());
        document.getElementById('joinGame').addEventListener('click', () => this.joinGame());
        document.getElementById('sayUno').addEventListener('click', () => this.sayUno());
        document.getElementById('flipDeck').addEventListener('click', () => this.showFlipInfo());
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
                    this.showMessage('Wild card play cancelled', 'warning');
                });
            }
        }
    }

    connectToServer() {
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connected to server with ID:', this.socket.id);
            this.playerId = this.socket.id;
            this.showMessage('Connected to game server!', 'success');
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

        // Special events
        this.socket.on('chooseColor', (data) => this.onChooseColor(data));
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
        this.showMessage(`🎮 Game created! Room code: ${data.roomCode}`, 'success');
        document.getElementById('roomIdDisplay').textContent = data.roomCode;
        this.updateLobby(data);
    }

    onJoinSuccess(data) {
        this.roomCode = data.roomCode;
        this.showMessage(`🔗 Joined game: ${data.roomCode}`, 'success');
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
                roomInfo.innerHTML = `<i class="fas fa-hashtag"></i><strong>Room:</strong> ${this.roomCode}`;
            } else {
                roomInfo.innerHTML = `<i class="fas fa-hashtag"></i><span>No active room</span>`;
            }
        }

        if (data.players.length === 0) {
            playersContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">👥</div>
                    <p>No players yet</p>
                    <p class="hint">Create or join a game to start playing!</p>
                </div>
            `;
            return;
        }

        data.players.forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.className = `player-item ${player.isHost ? 'host' : ''}`;
            
            const badges = [];
            if (player.isHost) badges.push('<span class="host-badge">👑 Host</span>');
            if (player.id === this.playerId) badges.push('<span class="you-badge">👤 You</span>');
            
            playerElement.innerHTML = `
                <div class="player-info-main">
                    <div class="player-name">${player.name}</div>
                    <div class="player-cards">${player.handCount || 0} cards</div>
                </div>
                <div class="player-badge">
                    ${badges.join('')}
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
        const existingButton = document.getElementById('startGameBtn');
        if (existingButton) existingButton.remove();

        const startButton = document.createElement('button');
        startButton.id = 'startGameBtn';
        startButton.className = 'btn btn-success glow';
        startButton.innerHTML = '<i class="fas fa-rocket"></i> Start Game';
        startButton.onclick = () => this.startGame();
        startButton.style.marginTop = '20px';
        startButton.style.width = '100%';
        startButton.style.padding = '16px';
        
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
        this.showMessage('Starting game...', 'info');
    }

    // Game Methods
    onGameStart(data) {
        console.log('Game starting with data:', data);
        this.gameStartTime = new Date();
        this.switchScreen('game');
        this.updateGameState(data);
        this.showMessage('🎲 Game started! Good luck!', 'success');
        
        // Add initial animation to cards
        setTimeout(() => {
            const cards = document.querySelectorAll('.hand-card');
            cards.forEach((card, index) => {
                card.style.animationDelay = `${index * 0.1}s`;
                card.classList.add('card-deal-animation');
            });
        }, 100);
    }

    updateGameState(data) {
        if (!data) {
            console.error('No game state data received');
            return;
        }

        // Set turn-related flags BEFORE rendering UI
        this.isMyTurn = data.currentPlayerId === this.playerId;
        this.hasDrawnCard = data.hasDrawnCard || false;
        this.waitingForColorChoice = data.waitingForColorChoice || false;

        // Update game info
        const currentSideElement = document.getElementById('currentSide');
        if (currentSideElement) {
            currentSideElement.textContent = data.currentSide ? 
                data.currentSide.charAt(0).toUpperCase() + data.currentSide.slice(1) : 'Light';
            currentSideElement.className = `value side-${data.currentSide || 'light'}`;
            currentSideElement.innerHTML = data.currentSide === 'dark' ? 
                '<i class="fas fa-moon"></i> Dark' : '<i class="fas fa-sun"></i> Light';
        }
        this.currentSide = data.currentSide || 'light';
        
        document.getElementById('currentPlayerName').textContent = data.currentPlayerName || 'Unknown';
        document.getElementById('deckCount').textContent = data.deckCount || 0;
        document.getElementById('deckCountBadge').textContent = data.deckCount || 0;
        
        // Update player's hand
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
            noCardsMsg.innerHTML = `
                <div class="empty-icon">🎴</div>
                <p>No cards in hand</p>
            `;
            handContainer.appendChild(noCardsMsg);
            return;
        }

        if (hand.length === 0) {
            const emptyHand = document.createElement('div');
            emptyHand.className = 'empty-hand';
            emptyHand.innerHTML = `
                <div class="empty-icon">🎉</div>
                <p>No cards left! Call UNO!</p>
            `;
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
                    <div class="placeholder-icon">👥</div>
                    <p>Other players will appear here</p>
                </div>
            `;
            return;
        }

        const otherPlayers = players.filter(player => player.id !== this.playerId);

        if (otherPlayers.length === 0) {
            opponentsArea.innerHTML = `
                <div class="opponents-placeholder">
                    <div class="placeholder-icon">👥</div>
                    <p>Waiting for other players to join...</p>
                </div>
            `;
            return;
        }

        otherPlayers.forEach((player, index) => {
            const opponentElement = document.createElement('div');
            opponentElement.className = `opponent ${player.id === players[currentPlayerIndex]?.id ? 'current-turn' : ''}`;
            
            const indicators = [];
            if (player.hasUno) indicators.push('<div class="uno-indicator">📢 UNO!</div>');
            if (player.isHost) indicators.push('<div class="host-indicator">👑 Host</div>');
            
            opponentElement.innerHTML = `
                <div class="opponent-name">${player.name}</div>
                <div class="opponent-cards">${player.handCount || 0} cards</div>
                ${indicators.join('')}
            `;
            
            opponentsArea.appendChild(opponentElement);
        });
    }

    updateDiscardPile(topCard) {
        const discardPile = document.getElementById('discardPile');
        const currentTopCard = document.getElementById('currentTopCard');
        
        if (!discardPile) return;

        if (topCard) {
            // Remove any existing color classes and set base classes
            discardPile.className = 'uno-card discard-card';
            // Add the correct color class
            discardPile.classList.add(topCard.color);
            
            const displayValue = this.getCardDisplayValue(topCard);
            const symbol = this.getCardSymbol(topCard);
            
            discardPile.innerHTML = `
                <div class="card-content">
                    ${symbol ? `<div class="card-symbol">${symbol}</div>` : ''}
                    <div class="card-value">${displayValue}</div>
                    ${topCard.side ? `<div class="card-side">${topCard.side.charAt(0).toUpperCase()}</div>` : ''}
                </div>
            `;
            discardPile.title = `${topCard.color} ${topCard.value} (${topCard.side} side)`;
            
            // Update the current top card display
            if (currentTopCard) {
                // Remove any existing color classes from current top card
                currentTopCard.className = 'uno-card';
                // Add the correct color class
                currentTopCard.classList.add(topCard.color);
                
                currentTopCard.innerHTML = `
                    <div class="card-content">
                        ${symbol ? `<div class="card-symbol">${symbol}</div>` : ''}
                        <div class="card-value">${displayValue}</div>
                    </div>
                `;
            }
        } else {
            // Reset to default state when no top card
            discardPile.className = 'uno-card discard-card';
            discardPile.innerHTML = `
                <div class="card-start">
                    <i class="fas fa-play"></i>
                </div>
            `;
            discardPile.title = 'Starting card';
            
            if (currentTopCard) {
                currentTopCard.className = 'current-card';
                currentTopCard.innerHTML = `
                    <div class="card-placeholder">
                        <i class="fas fa-play-circle"></i>
                        <span>Start Game</span>
                    </div>
                `;
            }
        }
    }

    updateTurnIndicator() {
        const sayUnoButton = document.getElementById('sayUno');
        const drawPile = document.getElementById('drawPile');
        const turnInstruction = document.getElementById('turnInstruction');
        
        if (!sayUnoButton || !drawPile) return;

        if (this.isMyTurn) {
            // Enable draw pile
            drawPile.style.cursor = 'pointer';
            drawPile.style.opacity = '1';
            drawPile.classList.add('glow-effect');
            
            // Enable UNO button if player has 2 cards
            const handCount = document.getElementById('playerCardCount').textContent;
            sayUnoButton.disabled = parseInt(handCount) !== 2;
            if (!sayUnoButton.disabled) {
                sayUnoButton.classList.add('glow');
            } else {
                sayUnoButton.classList.remove('glow');
            }
            
            if (this.waitingForColorChoice) {
                if (turnInstruction) turnInstruction.innerHTML = '<i class="fas fa-palette"></i><span>Choose a color for your wild card</span>';
            } else if (this.hasDrawnCard) {
                if (turnInstruction) turnInstruction.innerHTML = '<i class="fas fa-hand-paper"></i><span>You drew a card. Play it or turn ends.</span>';
            } else {
                if (turnInstruction) turnInstruction.innerHTML = '<i class="fas fa-gamepad"></i><span>Play a card or draw from the deck</span>';
            }
            
            document.body.classList.add('my-turn');
        } else {
            // Not player's turn
            drawPile.style.cursor = 'not-allowed';
            drawPile.style.opacity = '0.6';
            drawPile.classList.remove('glow-effect');
            sayUnoButton.disabled = true;
            sayUnoButton.classList.remove('glow');
            if (turnInstruction) turnInstruction.innerHTML = `<i class="fas fa-clock"></i><span>Waiting for ${document.getElementById('currentPlayerName').textContent}</span>`;
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
                unoStatus.classList.add('glow-effect');
            } else {
                unoStatus.textContent = '';
                unoStatus.classList.remove('glow-effect');
            }
        }
    }

    createCardElement(card, index, isPlayable = false) {
        const cardElement = document.createElement('div');
        cardElement.className = `hand-card ${card.color} ${isPlayable ? 'playable' : ''}`;
        
        const displayValue = this.getCardDisplayValue(card);
        const symbol = this.getCardSymbol(card);
        
        cardElement.innerHTML = `
            <div class="card-content">
                ${symbol ? `<div class="card-symbol">${symbol}</div>` : ''}
                <div class="card-value">${displayValue}</div>
                ${card.side ? `<div class="card-side">${card.side.charAt(0).toUpperCase()}</div>` : ''}
            </div>
        `;
        
        cardElement.title = `${card.color} ${card.value} (${card.side} side)`;
        
        if (isPlayable && !this.waitingForColorChoice) {
            cardElement.style.cursor = 'pointer';
            cardElement.addEventListener('click', () => this.playCardWithAnimation(index, card));
        } else {
            cardElement.style.cursor = 'default';
            cardElement.style.opacity = '0.6';
        }
        
        return cardElement;
    }

    getCardSymbol(card) {
        if (!card || !card.value) return '';
        
        const symbols = {
            'skip': '⏭️',
            'reverse': '🔄',
            'draw2': '+2',
            'draw5': '+5',
            'wild': '🌈',
            'wilddraw4': 'W+4',
            'wilddrawcolor': 'W+Color',
            'flip': '🃏',
            'skipeveryone': '⏩'
        };
        
        return symbols[card.value] || '';
    }

    getCardDisplayValue(card) {
        if (!card || !card.value) return '?';
        
        if (card.value === 'wild') return 'WILD';
        if (card.value === 'flip') return 'FLIP';
        if (card.value === 'skip') return 'SKIP';
        if (card.value === 'reverse') return 'REV';
        if (card.value === 'draw2') return '+2';
        if (card.value === 'draw5') return '+5';
        if (card.value === 'wilddraw4') return 'W+4';
        if (card.value === 'wilddrawcolor') return 'W+Color';
        if (card.value === 'skipeveryone') return 'SKIP ALL';
        return card.value;
    }

    // Game Actions with Animations
    playCardWithAnimation(cardIndex, card) {
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

        console.log(`🎯 Playing ${card.color} ${card.value} at index ${cardIndex}`);

        // Animate card playing
        const cardElement = document.querySelectorAll('.hand-card')[cardIndex];
        if (cardElement) {
            cardElement.classList.add('card-play-animation');
            
            // Send play command after animation starts
            setTimeout(() => {
                this.socket.emit('playCard', {
                    roomCode: this.roomCode,
                    cardIndex: cardIndex,
                    playerId: this.playerId
                });
            }, 300);
        } else {
            // Fallback without animation
            this.socket.emit('playCard', {
                roomCode: this.roomCode,
                cardIndex: cardIndex,
                playerId: this.playerId
            });
        }
    }

    drawCard() {
        if (!this.isMyTurn) {
            this.showMessage("It's not your turn!", 'error');
            return;
        }

        if (this.hasDrawnCard) {
            this.showMessage("You already drew a card this turn.", 'warning');
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

        // Animate draw pile
        const drawPile = document.getElementById('drawPile');
        if (drawPile) {
            drawPile.classList.add('draw-animation');
            setTimeout(() => drawPile.classList.remove('draw-animation'), 1000);
        }

        this.socket.emit('drawCard', {
            roomCode: this.roomCode,
            playerId: this.playerId
        });
    }

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

        // Animate UNO button
        const unoButton = document.getElementById('sayUno');
        if (unoButton) {
            unoButton.classList.add('uno-call-animation');
            setTimeout(() => unoButton.classList.remove('uno-call-animation'), 1500);
        }

        this.socket.emit('sayUno', {
            roomCode: this.roomCode,
            playerId: this.playerId
        });
    }

    showFlipInfo() {
        this.showMessage(`The game is currently on the ${this.currentSide} side. Play a FLIP card to switch sides!`, 'info');
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

    // Event Handlers
    onChooseColor(data) {
        this.showMessage('Choose a color for your wild card!', 'info');
        this.showColorModal();
    }

    onGameMessage(data) {
        this.showMessage(data.message, data.type || 'info');
    }

    onDrawUntilColor(data) {
        if (data.playerId === this.playerId) {
            this.showMessage(`You drew ${data.cards.length} cards until you got ${data.targetColor}!`, 'info');
        } else {
            this.showMessage(`${data.playerName} drew until they got a ${data.targetColor} card`, 'info');
        }
    }

    onPlayerTurn(data) {
        this.isMyTurn = data.playerId === this.playerId;
        this.hasDrawnCard = false;
        this.waitingForColorChoice = false;
        this.updateTurnIndicator();
        
        if (data.playerId === this.playerId) {
            this.showMessage('🎯 Your turn! Play a matching card or draw from deck.', 'success');
        } else {
            this.showMessage(`⏳ ${data.playerName}'s turn`, 'info');
        }
    }

    onCardPlayed(data) {
        if (data.playerName !== this.playerName) {
            if (data.waitingForColor) {
                this.showMessage(`${data.playerName} played a wild card and is choosing color...`, 'info');
            } else {
                this.showMessage(`${data.playerName} played a ${data.card.color} ${data.card.value}`, 'info');
            }
        }
    }

    onCardDrawn(data) {
        if (data.playerId === this.playerId) {
            this.hasDrawnCard = true;
            if (data.penaltyApplied) {
                this.showMessage(`You drew ${data.penaltyCount} penalty cards!`, 'warning');
            } else {
                this.showMessage('You drew a card', 'info');
            }
            this.updateTurnIndicator();
        } else {
            if (data.penaltyApplied) {
                this.showMessage(`${data.playerName} drew ${data.penaltyCount} penalty cards!`, 'info');
            } else {
                this.showMessage(`${data.playerName} drew a card`, 'info');
            }
        }
    }

    onUnoCalled(data) {
        this.showMessage(`📢 ${data.playerName} says UNO!`, 'success');
        
        // Add visual effect to UNO call
        const unoElements = document.querySelectorAll('.uno-indicator');
        unoElements.forEach(el => {
            el.classList.add('uno-call-animation');
            setTimeout(() => el.classList.remove('uno-call-animation'), 1500);
        });
    }

    onGameFlipped(data) {
        this.showMessage(`🔄 Game flipped to ${data.newSide} side!`, 'warning');
        
        // Add flip animation to cards
        const cards = document.querySelectorAll('.hand-card, .uno-card');
        cards.forEach(card => {
            card.classList.add('flip-animation');
            setTimeout(() => card.classList.remove('flip-animation'), 600);
        });
    }

    onWildColorChosen(data) {
        this.showMessage(`${data.playerName} chose ${data.color}`, 'info');
    }

    onGameOver(data) {
        this.switchScreen('gameOver');
        
        const winnerMessage = document.getElementById('winnerMessage');
        if (winnerMessage) {
            if (data.winner) {
                winnerMessage.textContent = `🎉 ${data.winner.name} wins the game!`;
                if (data.winner.id === this.playerId) {
                    this.showMessage('🏆 Congratulations! You won the game!', 'success');
                } else {
                    this.showMessage(`🥈 ${data.winner.name} won the game. Better luck next time!`, 'info');
                }
            } else {
                winnerMessage.textContent = 'Game ended!';
            }
        }
        
        // Calculate game statistics
        this.updateGameStats();
        
        // Reset game state
        this.isMyTurn = false;
        this.hasDrawnCard = false;
        this.waitingForColorChoice = false;
    }

    updateGameStats() {
        const duration = this.gameStartTime ? Math.round((new Date() - this.gameStartTime) / 60000) : 0;
        document.getElementById('statDuration').textContent = `${duration}m`;
        
        // These would ideally come from server data
        document.getElementById('statPlayers').textContent = '?';
        document.getElementById('statCards').textContent = '?';
    }

    onPlayerLeft(data) {
        this.showMessage(`👋 ${data.playerName} left the game`, 'warning');
    }

    returnToLobby() {
        this.switchScreen('lobby');
        this.showMessage('Returned to lobby', 'info');
        
        // Reset game state
        this.isMyTurn = false;
        this.hasDrawnCard = false;
        this.waitingForColorChoice = false;
        this.gameStartTime = null;
        
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
        
        this.showMessage('Starting new game...', 'info');
    }

    // Color Modal Methods
    showColorModal() {
        const modal = document.getElementById('colorModal');
        if (modal) {
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

    // Utility Methods
    switchScreen(screenName) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        const targetScreen = document.getElementById(screenName);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }

        this.hideColorModal();
    }

    showMessage(message, type = 'info') {
        console.log(`[${type}] ${message}`);
        
        const notificationContainer = document.getElementById('notificationContainer');
        if (!notificationContainer) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        
        notification.innerHTML = `
            <i class="${icons[type] || icons.info}"></i>
            <span>${message}</span>
        `;

        notificationContainer.appendChild(notification);

        // Remove notification after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideInRight 0.4s reverse';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 400);
            }
        }, 5000);
    }

    // Debug method
    debugState() {
        console.log('=== CLIENT STATE ===');
        console.log(`Player: ${this.playerName} (${this.playerId})`);
        console.log(`Room: ${this.roomCode}`);
        console.log(`My Turn: ${this.isMyTurn}`);
        console.log(`Has Drawn: ${this.hasDrawnCard}`);
        console.log(`Waiting for Color: ${this.waitingForColorChoice}`);
        console.log(`Current Side: ${this.currentSide}`);
        console.log('===================');
    }
}

// Initialize the client when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.unoClient = new UnoClient();
    console.log('🎮 UNO Flip client initialized with enhanced UI');
    
    // Add debug helper to global scope
    window.debugUno = () => {
        if (window.unoClient) {
            window.unoClient.debugState();
        }
    };
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'd' || e.key === 'D') {
            window.debugUno();
        }
    });
});