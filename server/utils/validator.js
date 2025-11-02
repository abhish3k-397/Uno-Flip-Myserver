/**
 * Input validation utilities
 */

class Validator {
    /**
     * Validates and sanitizes player name
     * @param {string} name - Player name to validate
     * @returns {object} { valid: boolean, sanitized: string, error: string }
     */
    static validatePlayerName(name) {
        if (!name || typeof name !== 'string') {
            return { valid: false, sanitized: '', error: 'Player name is required' };
        }

        const trimmed = name.trim();
        
        if (trimmed.length === 0) {
            return { valid: false, sanitized: '', error: 'Player name cannot be empty' };
        }

        if (trimmed.length < 2) {
            return { valid: false, sanitized: '', error: 'Player name must be at least 2 characters' };
        }

        if (trimmed.length > 20) {
            return { valid: false, sanitized: '', error: 'Player name must be 20 characters or less' };
        }

        // Allow alphanumeric, spaces, hyphens, underscores
        const sanitized = trimmed.replace(/[^a-zA-Z0-9\s\-_]/g, '');
        
        if (sanitized.length < 2) {
            return { valid: false, sanitized: '', error: 'Player name contains invalid characters' };
        }

        return { valid: true, sanitized: sanitized, error: null };
    }

    /**
     * Validates room code
     * @param {string} roomCode - Room code to validate
     * @returns {object} { valid: boolean, sanitized: string, error: string }
     */
    static validateRoomCode(roomCode) {
        if (!roomCode || typeof roomCode !== 'string') {
            return { valid: false, sanitized: '', error: 'Room code is required' };
        }

        const trimmed = roomCode.trim().toUpperCase();
        
        if (trimmed.length !== 6) {
            return { valid: false, sanitized: '', error: 'Room code must be 6 characters' };
        }

        // Only alphanumeric
        if (!/^[A-Z0-9]{6}$/.test(trimmed)) {
            return { valid: false, sanitized: '', error: 'Room code must contain only letters and numbers' };
        }

        return { valid: true, sanitized: trimmed, error: null };
    }

    /**
     * Validates chat message
     * @param {string} message - Chat message to validate
     * @returns {object} { valid: boolean, sanitized: string, error: string }
     */
    static validateChatMessage(message) {
        if (!message || typeof message !== 'string') {
            return { valid: false, sanitized: '', error: 'Message is required' };
        }

        const trimmed = message.trim();
        
        if (trimmed.length === 0) {
            return { valid: false, sanitized: '', error: 'Message cannot be empty' };
        }

        if (trimmed.length > 500) {
            return { valid: false, sanitized: '', error: 'Message must be 500 characters or less' };
        }

        // Basic sanitization - remove control characters but allow most unicode
        const sanitized = trimmed.replace(/[\x00-\x1F\x7F]/g, '');
        
        return { valid: true, sanitized: sanitized, error: null };
    }

    /**
     * Validates card index
     * @param {number} index - Card index to validate
     * @param {number} handSize - Size of player's hand
     * @returns {object} { valid: boolean, error: string }
     */
    static validateCardIndex(index, handSize) {
        if (typeof index !== 'number' || isNaN(index)) {
            return { valid: false, error: 'Card index must be a number' };
        }

        if (index < 0) {
            return { valid: false, error: 'Card index cannot be negative' };
        }

        if (index >= handSize) {
            return { valid: false, error: 'Card index out of range' };
        }

        return { valid: true, error: null };
    }

    /**
     * Validates wild color choice
     * @param {string} color - Color to validate
     * @param {string} currentSide - Current game side ('light' or 'dark')
     * @returns {object} { valid: boolean, error: string }
     */
    static validateWildColor(color, currentSide) {
        const lightColors = ['red', 'blue', 'green', 'yellow'];
        const darkColors = ['teal', 'orange', 'pink', 'purple'];
        const allowedColors = currentSide === 'dark' ? darkColors : lightColors;

        if (!color || typeof color !== 'string') {
            return { valid: false, error: 'Color is required' };
        }

        const normalizedColor = color.toLowerCase().trim();

        if (!allowedColors.includes(normalizedColor)) {
            return { 
                valid: false, 
                error: `Color must be one of: ${allowedColors.join(', ')}` 
            };
        }

        return { valid: true, error: null };
    }
}

module.exports = Validator;

