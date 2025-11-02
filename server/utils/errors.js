/**
 * Custom error classes for better error handling
 */

class GameError extends Error {
    constructor(message, code = 'GAME_ERROR') {
        super(message);
        this.name = 'GameError';
        this.code = code;
        this.statusCode = 400;
    }
}

class ValidationError extends GameError {
    constructor(message) {
        super(message, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
    }
}

class NotFoundError extends GameError {
    constructor(message = 'Resource not found') {
        super(message, 'NOT_FOUND');
        this.name = 'NotFoundError';
        this.statusCode = 404;
    }
}

class UnauthorizedError extends GameError {
    constructor(message = 'Unauthorized') {
        super(message, 'UNAUTHORIZED');
        this.name = 'UnauthorizedError';
        this.statusCode = 403;
    }
}

class ConflictError extends GameError {
    constructor(message) {
        super(message, 'CONFLICT');
        this.name = 'ConflictError';
        this.statusCode = 409;
    }
}

/**
 * Error handler for socket events
 * @param {Error} error - Error to handle
 * @param {Socket} socket - Socket instance
 * @param {string} eventType - Type of event that failed
 */
function handleSocketError(error, socket, eventType = 'unknown') {
    const errorResponse = {
        message: error.message || 'An error occurred',
        code: error.code || 'UNKNOWN_ERROR',
        type: eventType,
        timestamp: new Date().toISOString()
    };

    // Log error with context
    console.error(`❌ Socket error [${eventType}]:`, {
        error: error.message,
        code: error.code,
        socketId: socket.id,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });

    // Send error to client
    socket.emit('error', errorResponse);

    // For critical errors, also emit specific error events
    if (error instanceof ValidationError) {
        socket.emit('validationError', errorResponse);
    } else if (error instanceof NotFoundError) {
        socket.emit('notFoundError', errorResponse);
    } else if (error instanceof UnauthorizedError) {
        socket.emit('unauthorizedError', errorResponse);
    }
}

/**
 * Error handler for HTTP routes
 * @param {Error} error - Error to handle
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Express next middleware
 */
function handleHttpError(error, req, res, next) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';

    // Log error
    console.error(`❌ HTTP error [${req.method} ${req.path}]:`, {
        error: message,
        code: error.code,
        statusCode: statusCode,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });

    res.status(statusCode).json({
        error: {
            message: message,
            code: error.code || 'INTERNAL_ERROR',
            timestamp: new Date().toISOString()
        }
    });
}

module.exports = {
    GameError,
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    ConflictError,
    handleSocketError,
    handleHttpError
};

