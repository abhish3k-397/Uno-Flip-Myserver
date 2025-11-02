/**
 * Input sanitization utilities to prevent XSS and injection attacks
 */

class Sanitizer {
    /**
     * Escapes HTML special characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    static escapeHtml(text) {
        if (typeof text !== 'string') {
            return String(text);
        }

        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };

        return text.replace(/[&<>"']/g, (m) => map[m]);
    }

    /**
     * Sanitizes player name - removes potentially dangerous characters
     * @param {string} name - Name to sanitize
     * @returns {string} Sanitized name
     */
    static sanitizePlayerName(name) {
        if (typeof name !== 'string') {
            return '';
        }

        return name
            .trim()
            .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Remove special chars
            .substring(0, 20); // Max length
    }

    /**
     * Sanitizes room code - ensures uppercase alphanumeric
     * @param {string} code - Room code to sanitize
     * @returns {string} Sanitized code
     */
    static sanitizeRoomCode(code) {
        if (typeof code !== 'string') {
            return '';
        }

        return code
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '') // Remove non-alphanumeric
            .substring(0, 6); // Max length
    }

    /**
     * Sanitizes chat message - removes control characters but preserves content
     * @param {string} message - Message to sanitize
     * @returns {string} Sanitized message
     */
    static sanitizeChatMessage(message) {
        if (typeof message !== 'string') {
            return '';
        }

        return message
            .trim()
            .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
            .substring(0, 500); // Max length
    }

    /**
     * Sanitizes any user input object
     * @param {object} data - Data object to sanitize
     * @param {Array<string>} fields - Fields to sanitize
     * @returns {object} Sanitized data
     */
    static sanitizeObject(data, fields) {
        if (!data || typeof data !== 'object') {
            return {};
        }

        const sanitized = { ...data };

        fields.forEach(field => {
            if (sanitized[field] && typeof sanitized[field] === 'string') {
                sanitized[field] = this.escapeHtml(sanitized[field]);
            }
        });

        return sanitized;
    }
}

module.exports = Sanitizer;

