/**
 * Rate limiting utilities to prevent abuse
 */

class RateLimiter {
    constructor() {
        // Store: socketId -> { event: count, timestamp }
        this.requests = new Map();
        
        // Configuration
        this.limits = {
            'playCard': { max: 10, window: 60000 }, // 10 per minute
            'drawCard': { max: 20, window: 60000 }, // 20 per minute
            'chatMessage': { max: 30, window: 60000 }, // 30 per minute
            'sayUno': { max: 5, window: 60000 }, // 5 per minute
            'createGame': { max: 5, window: 300000 }, // 5 per 5 minutes
            'joinGame': { max: 10, window: 60000 }, // 10 per minute
        };

        // Cleanup old entries every 5 minutes
        setInterval(() => this.cleanup(), 300000);
    }

    /**
     * Check if a request should be allowed
     * @param {string} socketId - Socket ID
     * @param {string} eventType - Event type
     * @returns {object} { allowed: boolean, remaining: number, resetAt: number }
     */
    check(socketId, eventType) {
        const key = `${socketId}:${eventType}`;
        const limit = this.limits[eventType];
        
        // No limit configured for this event type
        if (!limit) {
            return { allowed: true, remaining: Infinity, resetAt: null };
        }

        const now = Date.now();
        const record = this.requests.get(key);

        // First request or window expired
        if (!record || (now - record.timestamp) > limit.window) {
            this.requests.set(key, {
                count: 1,
                timestamp: now
            });
            
            return {
                allowed: true,
                remaining: limit.max - 1,
                resetAt: now + limit.window
            };
        }

        // Check if limit exceeded
        if (record.count >= limit.max) {
            return {
                allowed: false,
                remaining: 0,
                resetAt: record.timestamp + limit.window
            };
        }

        // Increment counter
        record.count++;
        this.requests.set(key, record);

        return {
            allowed: true,
            remaining: limit.max - record.count,
            resetAt: record.timestamp + limit.window
        };
    }

    /**
     * Remove old entries to prevent memory leaks
     */
    cleanup() {
        const now = Date.now();
        const keysToDelete = [];

        for (const [key, record] of this.requests.entries()) {
            // Find the event type to get its window
            const eventType = key.split(':')[1];
            const limit = this.limits[eventType];
            
            if (limit && (now - record.timestamp) > limit.window) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.requests.delete(key));
        
        if (keysToDelete.length > 0) {
            console.log(`🧹 Cleaned up ${keysToDelete.length} rate limit entries`);
        }
    }

    /**
     * Reset rate limit for a socket (useful on disconnect)
     * @param {string} socketId - Socket ID
     */
    reset(socketId) {
        const keysToDelete = [];
        
        for (const key of this.requests.keys()) {
            if (key.startsWith(`${socketId}:`)) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.requests.delete(key));
    }

    /**
     * Get current rate limit status
     * @param {string} socketId - Socket ID
     * @param {string} eventType - Event type
     * @returns {object} Rate limit status
     */
    getStatus(socketId, eventType) {
        return this.check(socketId, eventType);
    }
}

// Export singleton instance
module.exports = new RateLimiter();

