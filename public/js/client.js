class UnoClient {
    constructor() {
        this.socket = null;
        this.playerId = null;
        this.playerName = null;
        this.roomCode = null;
        this.isMyTurn = false;
        this.hasDrawnCard = false;
        this.waitingForColorChoice = false;
    this.pendingPlay = null; // { index, card }
        this.currentWildCardIndex = null;
        this.currentSide = 'light';
        this.gameStartTime = null;
        this.handLayout = 'flat'; // 'flat' | 'fan'
        this.currentHand = [];
        
        // Card image mapping - UPDATED with your image structure
        this.cardImages = this.initializeCardImages();

        this.initializeEventListeners();
        this.initializeColorModal();
        this.addCardStyles();
        this.createActionButtons();
        this.initializeChat();
    }

    showRules() {
        const rulesModal = document.getElementById('rulesModal');
        if (rulesModal) {
            rulesModal.style.display = 'flex';
            setTimeout(() => {
                rulesModal.classList.add('show');
            }, 10);
        }
    }

    hideRules() {
        const rulesModal = document.getElementById('rulesModal');
        if (rulesModal) {
            rulesModal.classList.remove('show');
            setTimeout(() => {
                rulesModal.style.display = 'none';
            }, 300);
        }
    }

    createActionButtons() {
        // End Turn Button
        const playerArea = document.querySelector('.player-area');
        if (playerArea && !document.getElementById('endTurn')) {
            const endBtn = document.createElement('button');
            endBtn.id = 'endTurn';
            endBtn.className = 'btn btn-secondary';
            endBtn.innerHTML = '<i class="fas fa-forward"></i> End Turn';
            endBtn.disabled = true;
            playerArea.appendChild(endBtn);
            endBtn.addEventListener('click', () => this.endTurn());
            this.endTurnButton = endBtn;
        }

        // UNO Button
        if (playerArea && !document.getElementById('sayUno')) {
            const unoBtn = document.createElement('button');
            unoBtn.id = 'sayUno';
            unoBtn.className = 'btn btn-uno glow';
            unoBtn.innerHTML = '<i class="fas fa-bullhorn"></i> UNO!';
            unoBtn.disabled = true;
            playerArea.appendChild(unoBtn);
            unoBtn.addEventListener('click', () => this.sayUno());
        }

        // Rules Button
        const topBarRight = document.querySelector('.topbar-right');
        if (topBarRight && !document.getElementById('rulesBtn')) {
            const rulesBtn = document.createElement('button');
            rulesBtn.id = 'rulesBtn';
            rulesBtn.className = 'icon-btn';
            rulesBtn.innerHTML = '<i class="fas fa-info-circle"></i>';
            rulesBtn.title = 'Show Rules';
            topBarRight.insertBefore(rulesBtn, topBarRight.firstChild);
            rulesBtn.addEventListener('click', () => this.showRules());
        }

        // Hand layout toggle
        const header = document.querySelector('.player-header');
        const existingToggle = document.getElementById('handLayoutToggle');
        if (existingToggle && !existingToggle._bound) {
            existingToggle.addEventListener('click', () => {
                this.handLayout = this.handLayout === 'flat' ? 'fan' : 'flat';
                this.updatePlayerHand(this.currentHand || []);
            });
            existingToggle._bound = true;
        } else if (header && !existingToggle) {
            const controls = document.createElement('div');
            controls.className = 'hand-controls';
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'handLayoutToggle';
            toggleBtn.className = 'icon-btn';
            toggleBtn.title = 'Toggle hand layout';
            toggleBtn.setAttribute('aria-label', 'Toggle hand layout');
            toggleBtn.innerHTML = '<i class="fas fa-layer-group"></i>';
            controls.appendChild(toggleBtn);
            header.appendChild(controls);
            toggleBtn.addEventListener('click', () => {
                this.handLayout = this.handLayout === 'flat' ? 'fan' : 'flat';
                this.updatePlayerHand(this.currentHand || []);
            });
            toggleBtn._bound = true;
        }
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
        document.getElementById('playAgain').addEventListener('click', () => this.playAgain());

        // Minimal theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const applyTheme = (theme) => {
                if (theme === 'dark') {
                    document.body.setAttribute('data-theme', 'dark');
                    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
                } else {
                    document.body.removeAttribute('data-theme');
                    themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
                }
            };
            const saved = localStorage.getItem('uno.theme');
            applyTheme(saved || 'light');
            themeToggle.addEventListener('click', () => {
                const next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                localStorage.setItem('uno.theme', next);
                applyTheme(next);
            });
        }

        // Draw pile click event
        document.getElementById('drawPile').addEventListener('click', () => this.drawCard());

        // Enter key support for inputs
        document.getElementById('playerName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createGame();
        });
        document.getElementById('roomCode').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinGame();
        });

        // Rules modal close button
        document.getElementById('closeRules').addEventListener('click', () => this.hideRules());

        // Global keyboard shortcuts (game screen)
        document.addEventListener('keydown', (e) => {
            // Alt+E to toggle chat - this should be a global shortcut
            if (e.altKey && (e.key === 'e' || e.key === 'E')) {
                // We prevent default to stop the browser's default Alt+E behavior (e.g., opening a menu)
                e.preventDefault();
                this.toggleChat();
                // We return here because no other action should be taken for this shortcut
                return;
            }

            // Ignore other key events when typing into inputs or modals
            const tag = (document.activeElement && document.activeElement.tagName) || '';
            if (tag === 'INPUT' || tag === 'TEXTAREA') {
                // Allow Enter in chat input to send a message
                if (tag === 'INPUT' && e.key === 'Enter' && document.activeElement.id === 'chatInput') {
                    e.preventDefault();
                    this.sendChatMessage();
                }
                // For any other key in an input, we do nothing more.
                return;
            }

            const gameScreen = document.getElementById('game');
            const gameActive = gameScreen && gameScreen.classList.contains('active');
            if (!gameActive) return;


            // K to draw card
            if (e.key === 'k' || e.key === 'K') {
                e.preventDefault();
                if (this.isMyTurn && !this.waitingForColorChoice && !this.hasDrawnCard) {
                    this.drawCard();
                }
            }
            // Enter to end turn
            if (e.key === 'Enter') {
                e.preventDefault();
                if (this.isMyTurn && !this.waitingForColorChoice) {
                    this.endTurn();
                }
            }
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

            // Make modal persistent: disable closing via outside click or Escape
            colorModal.addEventListener('click', (e) => {
                // Prevent backdrop clicks from closing
                if (e.target === colorModal) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            });

            document.addEventListener('keydown', (e) => {
                if (this.waitingForColorChoice && (e.key === 'Escape' || e.key === 'Esc')) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            });
        }
    }

    // UPDATED: Complete card image mapping based on your actual file names
    initializeCardImages() {
        const basePath = '/images/';
        
        // Helper function to generate image mappings for a color
        const generateColorMappings = (color, isDark = false) => {
            const mappings = {};
            const numberWords = ['zero','one','two','three','four','five','six','seven','eight','nine'];

            // Number cards (zero - nine) — keys use word names like 'one', 'two'
            for (let i = 0; i <= 9; i++) {
                mappings[`${color}_${numberWords[i]}`] = `${basePath}${color}_${numberWords[i]}.webp`;
            }

            // Action cards
            if (isDark) {
                // Dark side actions (naming uses words like plus_five / skip_everyone)
                mappings[`${color}_skipeveryone`] = `${basePath}${color}_skip_everyone.webp`;
                mappings[`${color}_draw5`] = `${basePath}${color}_plus_five.webp`;
                mappings[`${color}_reverse`] = `${basePath}${color}_reverse.webp`;
                mappings[`${color}_flip`] = `${basePath}${color}_flip.webp`;
            } else {
                // Light side actions
                mappings[`${color}_skip`] = `${basePath}${color}_skip.webp`;
                mappings[`${color}_reverse`] = `${basePath}${color}_reverse.webp`;
                // Uno Flip light side uses Draw 1 instead of Draw 2
                mappings[`${color}_draw1`] = `${basePath}${color}_plus_one.webp`;
                mappings[`${color}_flip`] = `${basePath}${color}_flip.webp`;
            }

            return mappings;
        };

        // Generate mappings for all colors
        const imageMappings = {
            // Card back (support both dashed and underscored names)
            'card-back': `${basePath}card_back.webp`,
            'card_back': `${basePath}card_back.webp`,

            // Light side colors
            ...generateColorMappings('red'),
            ...generateColorMappings('blue'),
            ...generateColorMappings('green'),
            ...generateColorMappings('yellow'),

            // Dark side colors
            ...generateColorMappings('teal', true),
            ...generateColorMappings('orange', true),
            ...generateColorMappings('pink', true),
            ...generateColorMappings('purple', true),

            // Wild cards
            // plain wild has different images on light vs dark side
            'wild_light': `${basePath}wild_light.webp`,
            'wild_dark': `${basePath}wild_dark.webp`,
            // Colored wild variants for light side (these will be used when a wild is chosen to a color)
            'wild_red': `${basePath}wild_red.webp`,
            'wild_blue': `${basePath}wild_blue.webp`,
            'wild_green': `${basePath}wild_green.webp`,
            'wild_yellow': `${basePath}wild_yellow.webp`,
            // Color-specific WILD +2 images (preferred if available)
            'wild_red_plus2': `${basePath}wild_red_plus2.webp`,
            'wild_blue_plus2': `${basePath}wild_blue_plus2.webp`,
            'wild_green_plus2': `${basePath}wild_green_plus2.webp`,
            'wild_yellow_plus2': `${basePath}wild_yellow_plus2.webp`,
            // Color-specific draw-until images for dark side
            'draw_untill_teal': `${basePath}draw_untill_teal.webp`,
            'draw_untill_orange': `${basePath}draw_untill_orange.webp`,
            'draw_untill_pink': `${basePath}draw_untill_pink.webp`,
            'draw_untill_purple': `${basePath}draw_untill_purple.webp`,
            // Colored wild variants for dark side (map to dark palette colors)
            'wild_purple': `${basePath}wild_purple.webp`,
            'wild_teal': `${basePath}wild_teal.webp`,
            'wild_orange': `${basePath}wild_orange.webp`,
            'wild_pink': `${basePath}wild_pink.webp`,
            'wild_wilddraw2': `${basePath}wild_draw_two.webp`,
            'wild_wilddrawcolor': `${basePath}draw_until.webp`,
            // Special image to show when a wild-draw-until (wilddrawcolor) has a chosen color
            'wild_drawuntill': `${basePath}draw_until.webp`,

            // Default fallback
            'default': `${basePath}wild_light.webp`
        };

        console.log('Card images initialized with word names:', imageMappings);
        return imageMappings;
    }

    // UPDATED: Get the correct image for a card based on color, value, and side
    getCardImage(card) {
        if (!card) return this.cardImages.default;

        const { color, value, side } = card;

        // If server provided a chosenColor on the top card, prefer that color-specific wild image
        // Special-cases:
        // - wilddraw2: try wild_{color}_plus2.webp first, then fallback to generic per-color wild image, then generic draw_two
        // - wilddrawcolor: show dedicated draw-until image if available
        if (card.chosenColor) {
            if (value === 'wilddraw2') {
                const plus2Key = `wild_${card.chosenColor}_plus2`;
                if (this.cardImages[plus2Key]) return this.cardImages[plus2Key];
                const colorWildKey = `wild_${card.chosenColor}`;
                if (this.cardImages[colorWildKey]) return this.cardImages[colorWildKey];
                if (this.cardImages['wild_wilddraw2']) return this.cardImages['wild_wilddraw2'];
            }
            if (value === 'wilddrawcolor') {
                const untilKey = `draw_untill_${card.chosenColor}`;
                if (this.cardImages[untilKey]) return this.cardImages[untilKey];
                if (this.cardImages['wild_drawuntill']) return this.cardImages['wild_drawuntill'];
            }
            const chosenKey = `wild_${card.chosenColor}`;
            if (this.cardImages[chosenKey]) return this.cardImages[chosenKey];
        }

        // Handle wild cards specially
        if (color === 'wild') {
            // Plain wild uses side-specific images
            if (value === 'wild') {
                const sideKey = side === 'dark' ? 'wild_dark' : 'wild_light';
                return this.cardImages[sideKey] || this.cardImages.default;
            }
            // Other wild variants (wilddraw2, wilddrawcolor) use their own keys
            const wildKey = `wild_${value}`;
            if (this.cardImages[wildKey]) {
                return this.cardImages[wildKey];
            }
        }

        // Convert numeric values to word names (0-9)
        const numberWords = ['zero','one','two','three','four','five','six','seven','eight','nine'];
        let lookupValue = value;
        if (!isNaN(value) && parseInt(value) >= 0 && parseInt(value) <= 9) {
            lookupValue = numberWords[parseInt(value)];
        }

        // Determine image key
        let imageKey = `${color}_${lookupValue}`;

        // For dark side, some colors map to dark color names (teal, orange, pink, purple)
        if (side === 'dark') {
            // mapping of light->dark color names if needed by assets
            const darkMap = { red: 'teal', blue: 'orange', green: 'pink', yellow: 'purple' };
            const mappedColor = darkMap[color] || color;
            imageKey = `${mappedColor}_${lookupValue}`;
        }

        // If the card represents a wild that has a chosen color (e.g., when rendering top discard),
        // the server will set card.chosenColor. If present, and the chosenColor maps to a wild_[color] image,
        // prefer that image (respecting side mapping: light chosenColor will be red/blue/green/yellow, dark will be teal/orange/pink/purple).
        if (color === 'wild' && card.chosenColor) {
            const chosenKey = `wild_${card.chosenColor}`;
            if (this.cardImages[chosenKey]) return this.cardImages[chosenKey];
        }

        // Check if we have a direct mapping for this imageKey
        let imagePath = this.cardImages[imageKey];
        
        // If not found, try fallback for action cards (draw1/draw5 use specific keys)
        if (!imagePath && (lookupValue === 'draw1' || lookupValue === 'draw5')) {
            // The mapping already uses draw1/draw5 keys, so imageKey should work
            // But if it doesn't, try the raw value
            const fallbackKey = `${color}_${value}`;
            imagePath = this.cardImages[fallbackKey];
        }

        // Final fallback: try raw value key if still not found
        if (!imagePath && color !== 'wild') {
            const fallbackKey = `${color}_${value}`;
            imagePath = this.cardImages[fallbackKey];
        }

        // Return found image or default
        return imagePath || this.cardImages.default;
    }

    // Debug helper to verify mapping
    debugCardImages() {
        console.log('=== CARD IMAGE DEBUG ===');
        const testCards = [
            { color: 'red', value: '1', side: 'light' },
            { color: 'blue', value: '5', side: 'light' },
            { color: 'green', value: 'skip', side: 'light' },
            { color: 'teal', value: '3', side: 'dark' },
            { color: 'purple', value: 'draw5', side: 'dark' },
            { color: 'red', value: 'draw1', side: 'light' },
            { color: 'wild', value: 'wild', side: 'light' }
        ];
        testCards.forEach(card => {
            const imagePath = this.getCardImage(card);
            console.log(`🎴 ${card.color} ${card.value} (${card.side}) -> ${imagePath}`);
        });
        console.log('=== END DEBUG ===');
    }

    // Debug helper: log top discard card info (including chosenColor) for verification
    logTopCardInfo() {
        // This expects the latest game state to have been applied via updateGameState
        const discardPileState = document.getElementById('discardPile');
        if (!discardPileState) {
            console.warn('No discardPile element found');
            return;
        }
        console.log('DOM discardPile element:', discardPileState);
        // If server included chosenColor it will be visible in title or as a class
        console.log('Classes:', discardPileState.className);
        console.log('Background-image inline style:', discardPileState.style.getPropertyValue('background-image'));
    }

    // Force-set card background using inline styles with higher specificity
    setCardBackground(element, imagePath) {
        if (!element) return;
        try {
            // Use setProperty to include '!important' so it overrides CSS gradients
            element.style.setProperty('background-image', `url('${imagePath}')`, 'important');
            element.style.setProperty('background-size', 'cover', 'important');
            element.style.setProperty('background-position', 'center', 'important');
            element.style.setProperty('background-repeat', 'no-repeat', 'important');
        } catch (e) {
            // fallback to direct assignments
            element.style.backgroundImage = `url('${imagePath}')`;
            element.style.backgroundSize = 'cover';
            element.style.backgroundPosition = 'center';
            element.style.backgroundRepeat = 'no-repeat';
        }
    }

    // UPDATED: Get display value for cards
    getCardDisplayValue(card) {
        if (!card || !card.value) return '?';
        
        const displayMap = {
            'wild': 'WILD',
            'flip': 'FLIP',
            'skip': 'SKIP',
            'reverse': 'REV',
            'draw1': '+1',
            'draw5': '+5',
            'wilddraw2': 'W+2',
            'wilddrawcolor': 'W+Color',
            'skipeveryone': 'SKIP ALL',
            '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
            '5': '5', '6': '6', '7': '7', '8': '8', '9': '9'
        };
        
        return displayMap[card.value] || card.value;
    }

    // UPDATED: Create card element with proper image
    createCardElement(card, index, isPlayable = false) {
        const cardElement = document.createElement('div');
        cardElement.className = `hand-card ${card.color} ${isPlayable ? 'playable' : ''}`;
        
        // Set card background image (use helper to set with !important)
        const cardImage = this.getCardImage(card);
        if (cardImage) {
            this.setCardBackground(cardElement, cardImage);
            cardElement.classList.add('image-card');
            // Debug logging (remove after testing)
            if (index === 0) {
                console.log('Card image debug:', {
                    card: card,
                    imageKey: `${card.color}_${card.value}`,
                    cardImage: cardImage,
                    side: card.side
                });
            }
        } else {
            // ensure fallback to color styles if no image
            cardElement.classList.remove('image-card');
            cardElement.style.removeProperty('background-image');
            console.warn('No image found for card:', card);
        }

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

    // UPDATED: Update discard pile with proper images
    updateDiscardPile(topCard) {
        const discardPile = document.getElementById('discardPile');
        
        if (!discardPile) return;

        if (topCard) {
            // Remove any existing color classes and set base classes
            discardPile.className = 'uno-card discard-card';
            // Add the correct color class (use chosenColor if provided for wilds)
            const visualColor = topCard.chosenColor || topCard.color;
            discardPile.classList.add(visualColor);

            // Set card image
            const cardImage = this.getCardImage(topCard);
            if (cardImage && cardImage !== this.cardImages.default) {
                this.setCardBackground(discardPile, cardImage);
                discardPile.classList.add('image-card');
            } else {
                discardPile.classList.remove('image-card');
                discardPile.style.removeProperty('background-image');
            }

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

        } else {
            // Reset to default state when no top card
            discardPile.className = 'uno-card discard-card';
            discardPile.style.backgroundImage = '';
            discardPile.innerHTML = `
                <div class="card-start">
                    <i class="fas fa-play"></i>
                </div>
            `;
            discardPile.title = 'Starting card';
        }
    }

    // Rest of the methods remain the same...
    getCardSymbol(card) {
        if (!card || !card.value) return '';
        
        const symbols = {
            'skip': '⏭️',
            'reverse': '🔄',
            'draw1': '+1',
            'draw5': '+5',
            'wilddraw2': 'W+2',
            'wild': '🌈',
            'wilddrawcolor': 'W+Color',
            'flip': '🃏',
            'skipeveryone': '⏩'
        };
        
        return symbols[card.value] || '';
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

        // Server error handler - also revert any pending UI play
        this.socket.on('error', (data) => {
            console.error('Server error:', data.message);
            this.showMessage(data.message, 'error');
            // If we have a pending play (client removed visually), revert UI to server's authoritative state
            if (this.pendingPlay) {
                this.pendingPlay = null;
                // Re-render using last known game state
                if (this.lastGameState) this.updateGameState(this.lastGameState);
            }
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

        // Chat events
        this.socket.on('chatMessage', (data) => this.onChatMessage(data));
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
        if (data.players && data.players.length >= 1 && data.players[0].id === this.playerId) {
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
        console.log('🎲 Game starting with data:', data);
        this.gameStartTime = new Date();
        this.switchScreen('game'); // Make sure this is 'game' not 'gameScreen'
        console.log('🖥️ Switched to game screen');
        this.updateGameState(data);
        this.showMessage('🎲 Game started! Good luck!', 'success');

        // Enter fullscreen mode
        this.enterFullscreen();

        // Debug: Check if game screen is visible
        const gameScreen = document.getElementById('game');
        console.log('🎯 Game screen element:', gameScreen);
        console.log('🎯 Game screen has active class:', gameScreen.classList.contains('active'));

        // Add initial animation to cards
        setTimeout(() => {
            const cards = document.querySelectorAll('.hand-card');
            cards.forEach((card, index) => {
                card.style.animationDelay = `${index * 0.1}s`;
                card.classList.add('card-deal-animation');
            });
        }, 100);
    }

    enterFullscreen() {
        const element = document.documentElement;
        if (element.requestFullscreen) {
            element.requestFullscreen().catch(err => {
                console.log('Fullscreen request denied:', err);
            });
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
        }
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
    // Keep last game state for client-side playability checks
    this.lastGameState = data;
    // Clear any pending play when we receive authoritative state
    this.pendingPlay = null;
        
        this.updatePlayerTurnList(data.players, data.currentPlayerId);
        document.getElementById('deckCount').textContent = data.deckCount || 0;
        document.getElementById('deckCountBadge').textContent = data.deckCount || 0;
        
        // Update player's hand
    this.updatePlayerHand(data.playerHand || []);
        
        // Update floating background cards
        this.updateFloatingCards(data.currentSide || 'light');
        
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

        this.currentHand = Array.isArray(hand) ? hand.slice() : [];

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

        // Determine current top card for playability checks
        const topCard = this.lastGameState ? this.lastGameState.topCard : null;

        // Apply layout class
        handContainer.classList.toggle('fan', this.handLayout === 'fan');

        if (this.handLayout === 'fan') {
            const n = hand.length;
            const spreadDeg = 60; // arc total
            const start = -spreadDeg / 2;
            const stepDeg = n > 1 ? spreadDeg / (n - 1) : 0;
            hand.forEach((card, i) => {
                const playable = this.isMyTurn && this.clientCanPlay(card, topCard);
                const el = this.createCardElement(card, i, playable);
                const angle = start + stepDeg * i;
                el.style.removeProperty('position');
                el.style.removeProperty('left');
                el.style.removeProperty('bottom');
                el.style.setProperty('--rot', angle + 'deg');
                el.style.zIndex = (i + 1).toString(); // back-to-front order
                el.style.margin = '0 -40px';
                handContainer.appendChild(el);
            });
        } else {
            hand.forEach((card, index) => {
                const playable = this.isMyTurn && this.clientCanPlay(card, topCard);
                const cardElement = this.createCardElement(card, index, playable);
                handContainer.appendChild(cardElement);
            });
        }
    }

    // Client-side playability check using the same rules as server: match color/value or wilds
    clientCanPlay(card, topCard) {
        if (!card || !topCard) return false;

        // If draw-until is active, no plays are allowed; player must draw
        if (this.lastGameState?.drawUntilColor) {
            return false;
        }

        // If there is a pending draw penalty, only the same draw type can be stacked
        const pendingCount = this.lastGameState?.pendingDrawCount || 0;
        const pendingType = this.lastGameState?.pendingDrawType || null;
        if (pendingCount > 0) {
            return card.value === pendingType;
        }

        // If top card is a wild with chosenColor, it behaves like that color for matching
        const topColor = topCard.chosenColor || topCard.color;
        if (card.color === 'wild') return true; // wild can always be played (when no pending penalty)
        if (card.color === topColor) return true;
        if (card.value === topCard.value) return true;
        return false;
    }

    updatePlayerTurnList(players, currentPlayerId) {
        const playerTurnList = document.getElementById('player-turn-list');
        if (!playerTurnList) return;

        playerTurnList.innerHTML = ''; // Clear the list

        if (players && players.length > 0) {
            players.forEach((player, index) => {
                const playerSpan = document.createElement('span');
                playerSpan.innerHTML = `${player.name}: <span class="value">${player.handCount}</span>`;

                if (player.id === currentPlayerId) {
                    playerSpan.classList.add('current-turn');
                }

                playerTurnList.appendChild(playerSpan);

                if (index < players.length - 1) {
                    const separator = document.createElement('span');
                    separator.className = 'separator';
                    separator.textContent = '|';
                    playerTurnList.appendChild(separator);
                }
            });
        }
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

    updateFloatingCards(currentSide) {
        // Remove old opponent update method - floating cards instead
        const floatingCards = document.querySelectorAll('.floating-card');
        
        if (floatingCards.length === 0) return;
        
        // Define card pools for each side
        const lightSideCards = [
            'red_one', 'red_five', 'red_seven',
            'blue_two', 'blue_four', 'blue_eight',
            'green_three', 'green_six', 'green_nine',
            'yellow_zero', 'yellow_one', 'yellow_flip'
        ];
        
        const darkSideCards = [
            'teal_one', 'teal_five', 'teal_seven',
            'orange_two', 'orange_four', 'orange_eight',
            'pink_three', 'pink_six', 'pink_nine',
            'purple_zero', 'purple_one', 'purple_flip'
        ];
        
        const cardPool = currentSide === 'dark' ? darkSideCards : lightSideCards;
        
        // Apply random cards from the appropriate pool to each floating card
        floatingCards.forEach(card => {
            const randomCard = cardPool[Math.floor(Math.random() * cardPool.length)];
            const imagePath = this.cardImages[randomCard] || this.cardImages.default;
            
            // Apply the card image
            card.style.backgroundImage = `url('${imagePath}')`;
            card.style.backgroundSize = 'cover';
            card.style.backgroundPosition = 'center';
            card.style.backgroundRepeat = 'no-repeat';
            
            // Remove any gradient background that was previously applied
            card.classList.add('floating-card-image');
        });
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
                if (turnInstruction) turnInstruction.innerHTML = '<i class="fas fa-hand-paper"></i><span>You drew a card. Play it or end your turn.</span>';
                // New rule: after drawing, player may end turn even if they can play
                if (this.endTurnButton) {
                    this.endTurnButton.disabled = false;
                }
            } else {
                if (turnInstruction) turnInstruction.innerHTML = '<i class="fas fa-gamepad"></i><span>Play a card or draw from the deck</span>';
                // Ensure End Turn is disabled at the start of each new turn until a draw occurs
                if (this.endTurnButton) {
                    this.endTurnButton.disabled = true;
                }
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
            // disable End Turn when not our turn
            if (this.endTurnButton) this.endTurnButton.disabled = true;
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

    // Mark as pending so the UI doesn't remove it immediately. We'll remove it when server confirms.
    this.pendingPlay = { index: cardIndex, card };
    // Add a visual pending class to the card element
    const cardEls = document.querySelectorAll('.hand-card');
    const playingEl = cardEls[cardIndex];
    if (playingEl) playingEl.classList.add('pending-play');

        // Animate card playing
        if (playingEl) {
            playingEl.classList.add('card-play-animation');
            
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

    endTurn() {
        if (!this.roomCode) {
            this.showMessage('Not in a game room', 'error');
            return;
        }
        if (!this.isMyTurn) {
            this.showMessage("It's not your turn!", 'error');
            return;
        }

        this.socket.emit('endTurn', {
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
        this.showMessage(`Drawing until ${data.color} card...`, 'info');
    }

    onPlayerTurn(data) {
        this.isMyTurn = data.playerId === this.playerId;
        this.hasDrawnCard = false;
        this.waitingForColorChoice = false;
        
        this.showMessage(`🎲 ${data.playerName}'s turn`, 'info');
        this.updateTurnIndicator();
    }

    onCardPlayed(data) {
        const playerName = data.playerName || 'Unknown';
        const cardValue = data.card ? `${data.card.color} ${data.card.value}` : 'a card';
        
        this.showMessage(`🎴 ${playerName} played ${cardValue}`, 'info');
        
        // Update the discard pile with animation
        const discardPile = document.getElementById('discardPile');
        if (discardPile && data.card) {
            discardPile.classList.add('flip-animation');
            setTimeout(() => {
                discardPile.classList.remove('flip-animation');
                // If the played card is a FLIP, the server's gameStateUpdate already sent the correct top card for the newly active side.
                // Avoid overriding it with the raw flip card which can cause the visual to stay on the wrong side until the next state update.
                if (data.card.value !== 'flip') {
                    this.updateDiscardPile(data.card);
                }
            }, 300);
        }
    }

    onCardDrawn(data) {
        const playerName = data.playerName || 'Unknown';
        this.showMessage(`🃏 ${playerName} drew a card`, 'info');
        
        // Update hand with animation for our own cards
        if (data.playerId === this.playerId) {
            this.hasDrawnCard = true;
            // If server provided the specific drawn card (voluntary draw), keep a reference so UI/UX can highlight it
            if (data.card) {
                this.lastDrawnCard = data.card;
            } else {
                this.lastDrawnCard = null;
            }
            this.updateTurnIndicator();
        }
    }

    onUnoCalled(data) {
        this.showMessage(`📢 ${data.playerName} called UNO!`, 'success');
        
        // Animate UNO call
        const unoStatus = document.getElementById('unoStatus');
        if (unoStatus) {
            unoStatus.classList.add('uno-call-animation');
            setTimeout(() => unoStatus.classList.remove('uno-call-animation'), 1500);
        }
    }

    onGameFlipped(data) {
        this.currentSide = data.newSide;
        this.showMessage(`🃏 The game flipped to the ${data.newSide} side!`, 'warning');
        
        // Animate the entire game board
        document.body.classList.add('flip-animation');
        setTimeout(() => document.body.classList.remove('flip-animation'), 600);
        
        // Update floating cards to match the new side
        this.updateFloatingCards(data.newSide);
        
        // Update side indicator
        const sideElement = document.getElementById('currentSide');
        if (sideElement) {
            sideElement.innerHTML = data.newSide === 'dark' ? 
                '<i class="fas fa-moon"></i> Dark' : '<i class="fas fa-sun"></i> Light';
            sideElement.className = `value side-${data.newSide}`;
        }
    }

    onGameOver(data) {
        const winnerName = data.winnerName || 'Unknown';
        const gameDuration = this.gameStartTime ? 
            Math.round((new Date() - this.gameStartTime) / 1000) : 0;
        
        this.showMessage(`🏆 ${winnerName} wins the game! (${gameDuration}s)`, 'success');
        
        // Show game over screen
        this.switchScreen('gameOver');
        
        // Update winner message (match DOM id)
        const winnerMsg = document.getElementById('winnerMessage');
        if (winnerMsg) {
            winnerMsg.textContent = `Winner: ${winnerName}`;
        }

        // Update game stats (match DOM ids)
        const totalPlayers = this.lastGameState?.players?.length || 0;
        const durationEl = document.getElementById('statDuration');
        const playersEl = document.getElementById('statPlayers');
        const cardsEl = document.getElementById('statCards');
        if (durationEl) durationEl.textContent = `${Math.max(1, Math.round(gameDuration/60))}m`;
        if (playersEl) playersEl.textContent = `${totalPlayers}`;
        // cards played not tracked; clear or leave default
        if (cardsEl) cardsEl.textContent = `${this.cardsPlayed || 0}`;
    }

    onPlayerLeft(data) {
        this.showMessage(`👋 ${data.playerName} left the game`, 'warning');
    }

    onWildColorChosen(data) {
        this.showMessage(`🎨 ${data.playerName} chose ${data.color}`, 'info');
        this.waitingForColorChoice = false;
    }

    // UI Methods
    showMessage(message, type = 'info') {
        const messageDiv = document.getElementById('gameMessage');
        if (!messageDiv) return;

        // Clear existing classes
        messageDiv.className = 'game-message';
        
        // Add type-specific class
        messageDiv.classList.add(type);
        
        // Set message content
        messageDiv.innerHTML = `
            <div class="message-content">
                <i class="fas fa-${this.getMessageIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;
        
        // Show message
        messageDiv.style.display = 'block';
        messageDiv.classList.add('show');
        
        // Auto-hide after 5 seconds for info messages
        if (type === 'info') {
            setTimeout(() => {
                messageDiv.classList.remove('show');
                setTimeout(() => {
                    messageDiv.style.display = 'none';
                }, 300);
            }, 5000);
        }
    }

    getMessageIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    showColorModal() {
        const colorModal = document.getElementById('colorModal');
        if (colorModal) {
            // Update color options based on current side
            if (this.setWildColorOptions) {
                this.setWildColorOptions(this.currentSide);
            }
            
            colorModal.style.display = 'flex';
            setTimeout(() => {
                colorModal.classList.add('show');
            }, 10);
        }
    }

    hideColorModal() {
        const colorModal = document.getElementById('colorModal');
        if (colorModal) {
            colorModal.classList.remove('show');
            setTimeout(() => {
                colorModal.style.display = 'none';
            }, 300);
        }
    }

    switchScreen(screenName) {
        // Hide all screens
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => {
            screen.classList.remove('active');
        });

        // Show target screen - Use the actual element IDs from your HTML
        const targetScreen = document.getElementById(screenName);
        if (targetScreen) {
            targetScreen.classList.add('active');
        } else {
            console.error(`Screen not found: ${screenName}`);
        }

        // Special handling for game screen
        if (screenName === 'game') {
            document.body.classList.add('game-active');
        } else {
            document.body.classList.remove('game-active');
        }
    }

    returnToLobby(preserveRoom = true) {
        this.switchScreen('lobby');
        this.isMyTurn = false;
        this.hasDrawnCard = false;
        this.waitingForColorChoice = false;
        this.currentWildCardIndex = null;
        this.currentSide = 'light';
        // Preserve room association by default so host can start again
        const roomIdEl = document.getElementById('roomIdDisplay');
        if (!preserveRoom) {
            this.roomCode = null;
            if (roomIdEl) roomIdEl.textContent = '-----';
        } else {
            if (roomIdEl && this.roomCode) roomIdEl.textContent = this.roomCode;
        }
        // Reset UI elements specific to game view
        const handEl = document.getElementById('playerHand');
        const discardEl = document.getElementById('discardPile');
        if (handEl) handEl.innerHTML = '';
        if (discardEl) discardEl.innerHTML = '<div class="card-start"><i class="fas fa-play"></i></div>';
        this.showMessage('Returned to lobby', 'info');
    }

    playAgain() {
        if (this.socket && this.roomCode) {
            this.socket.emit('playAgain', { roomCode: this.roomCode });
        }
        // UI feedback; the server will emit 'returnToLobby'
        this.showMessage('Resetting game...', 'info');
    }

    // Chat Methods
    initializeChat() {
        this.chatExpanded = false;
        const chatWindow = document.getElementById('chatWindow');
        const chatHeader = document.getElementById('chatHeader');
        const chatToggleBtn = document.getElementById('chatToggleBtn');
        const chatInput = document.getElementById('chatInput');
        const chatSendBtn = document.getElementById('chatSendBtn');

        if (!chatWindow) {
            console.warn('Chat window not found in DOM');
            return;
        }

        console.log('Chat initialized successfully');

        // Toggle chat on header click
        if (chatHeader) {
            chatHeader.addEventListener('click', () => this.toggleChat());
        }

        // Toggle button
        if (chatToggleBtn) {
            chatToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleChat();
            });
        }

        // Send button
        if (chatSendBtn) {
            chatSendBtn.addEventListener('click', () => this.sendChatMessage());
        }

        // Enter key to send (handled in keyboard listener)
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendChatMessage();
                }
            });
        }

        // Add ESC key listener to collapse chat
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                if (this.chatExpanded) {
                    this.toggleChat();
                }
            }
        });
    }

    toggleChat() {
        const chatWindow = document.getElementById('chatWindow');
        if (!chatWindow) return;

        this.chatExpanded = !this.chatExpanded;
        
        if (this.chatExpanded) {
            chatWindow.classList.add('expanded');
            // Focus on input when expanded
            const chatInput = document.getElementById('chatInput');
            if (chatInput) {
                setTimeout(() => chatInput.focus(), 100);
            }
            // Clear new message indicator
            chatWindow.classList.remove('has-new-message');
        } else {
            chatWindow.classList.remove('expanded');
        }
    }

    sendChatMessage() {
        const chatInput = document.getElementById('chatInput');
        if (!chatInput) {
            console.error('Chat input not found');
            return;
        }
        if (!this.socket) {
            console.error('Socket not connected');
            return;
        }
        if (!this.roomCode) {
            console.error('No room code available');
            return;
        }

        const message = chatInput.value.trim();
        if (!message) return;

        console.log('Sending chat message:', { roomCode: this.roomCode, playerName: this.playerName, message });

        // Emit chat message to server
        this.socket.emit('chatMessage', {
            roomCode: this.roomCode,
            playerId: this.playerId,
            playerName: this.playerName,
            message: message
        });

        // Clear input
        chatInput.value = '';
    }

    onChatMessage(data) {
        console.log('Received chat message:', data);
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) {
            console.error('Chat messages container not found');
            return;
        }

        // Create message element
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${data.playerId === this.playerId ? 'own' : 'other'}`;
        
        const timestamp = new Date(data.timestamp || Date.now());
        const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        messageDiv.innerHTML = `
            <div class="sender">${data.playerName || 'Unknown'}</div>
            <div class="text">${this.escapeHtml(data.message)}</div>
            <div class="timestamp">${timeString}</div>
        `;

        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Show new message indicator if chat is minimized
        const chatWindow = document.getElementById('chatWindow');
        if (chatWindow && !chatWindow.classList.contains('expanded')) {
            chatWindow.classList.add('has-new-message');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the game client when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.unoClient = new UnoClient();
});
