/**
 * Game constants and configuration
 */

module.exports = {
    // Player limits
    MIN_PLAYERS: 2,
    MAX_PLAYERS: 6,
    
    // Card constants
    INITIAL_HAND_SIZE: 7,
    
    // Room code
    ROOM_CODE_LENGTH: 6,
    ROOM_CODE_CHARACTERS: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    
    // Game sides
    GAME_SIDES: {
        LIGHT: 'light',
        DARK: 'dark'
    },
    
    // Light side colors
    LIGHT_COLORS: ['red', 'blue', 'green', 'yellow'],
    
    // Dark side colors
    DARK_COLORS: ['teal', 'orange', 'pink', 'purple'],
    
    // Action cards
    LIGHT_ACTIONS: ['skip', 'reverse', 'draw1', 'flip'],
    DARK_ACTIONS: ['skipeveryone', 'reverse', 'draw5', 'flip'],
    
    // Card values
    NUMBER_CARDS: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
    
    // Input limits
    MAX_PLAYER_NAME_LENGTH: 20,
    MIN_PLAYER_NAME_LENGTH: 2,
    MAX_CHAT_MESSAGE_LENGTH: 500,
    
    // Deck configuration
    CARDS_PER_NUMBER: 2, // Two of each number card per color
    CARDS_PER_ACTION: 2, // Two of each action card per color
    WILD_CARDS_COUNT: 4, // Four of each wild type
};

