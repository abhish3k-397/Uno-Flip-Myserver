const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const compression = require('compression');

const GameManager = require('./game');
const SocketHandler = require('./socket');
const config = require('./config');

class UnoServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
            }
        });
        
        this.gameManager = new GameManager();
        this.socketHandler = new SocketHandler(this.io, this.gameManager);
        
        this.setupExpress();
        this.setupRoutes();
    }

    setupExpress() {
        this.app.use(express.json());
        // gzip compression
        this.app.use(compression());
        // Static assets with caching
        this.app.use(express.static(path.join(__dirname, '../public'), {
            setHeaders: (res, filePath) => {
                const ext = path.extname(filePath).toLowerCase();
                if (ext === '.html') {
                    res.setHeader('Cache-Control', 'no-cache');
                } else if (ext === '.js' || ext === '.css') {
                    res.setHeader('Cache-Control', 'no-cache'); // 7 days
                } else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.gif' || ext === '.webp' || ext === '.svg') {
                    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
                }
            }
        }));
    }

    setupRoutes() {
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });

        this.app.get('/api/games', (req, res) => {
            const games = this.gameManager.getActiveGames();
            res.json({ games });
        });

        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({ status: 'OK', timestamp: new Date().toISOString() });
        });
    }

    start(port = 3000) {
        this.app.set('trust proxy', 1);
        this.server.listen(port, '0.0.0.0', () => {
            console.log(`🚀 UNO Flip Server running on port ${port}`);
            console.log(`📱 Access the game at: http://localhost:${port}`);
        });
    }
}

// Start the server
const server = new UnoServer();
server.start(config.port);

module.exports = UnoServer;
