'use strict';

function parseAllowedOrigins(value) {
    if (!value) return [];
    return value
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
}

const config = {
    port: parseInt(process.env.PORT, 10) || 3000,
    allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS || ''),
};

module.exports = config;


