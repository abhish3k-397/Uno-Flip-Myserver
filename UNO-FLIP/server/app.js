const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const GameManager = require('./game');
const SocketHandler = require('./socket');

class UnoServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        this.gameManager = new GameManager();
        this.socketHandler = new SocketHandler(this.io, this.gameManager);
        
        this.setupExpress();
        this.setupRoutes();
    }

    setupExpress() {
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, '../public')));
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
        this.server.listen(port, '0.0.0.0', () => {
            console.log(`🚀 UNO Flip Server running on port ${port}`);
            console.log(`📱 Access the game at: http://localhost:${port}`);
        });
    }
}

// Start the server
const server = new UnoServer();
server.start(process.env.PORT || 3000);

module.exports = UnoServer;