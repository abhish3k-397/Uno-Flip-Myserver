const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const compression = require('compression');
const crypto = require('crypto');
const fs = require('fs');

const GameManager = require('./game');
const SocketHandler = require('./socket');

class UnoServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server);
        
        this.gameManager = new GameManager();
        this.socketHandler = new SocketHandler(this.io, this.gameManager);
        
        this.setupExpress();
        this.setupRoutes();
    }

    setupExpress() {
        this.app.use(express.json());
        // gzip compression
        this.app.use(compression());
        
        // Calculate bundle hash for cache invalidation (do once at startup)
        const bundlePath = path.join(__dirname, '../public/js/bundle.js');
        let bundleHash = null;
        try {
            if (fs.existsSync(bundlePath)) {
                const bundleContent = fs.readFileSync(bundlePath);
                bundleHash = crypto.createHash('md5').update(bundleContent).digest('hex').substring(0, 8);
            }
        } catch (err) {
            console.warn('Could not calculate bundle hash:', err.message);
        }
        
        // Static assets with caching and ETags for cache invalidation
        this.app.use(express.static(path.join(__dirname, '../public'), {
            etag: true, // Enable ETag support
            lastModified: true,
            setHeaders: (res, filePath) => {
                const ext = path.extname(filePath).toLowerCase();
                const fileName = path.basename(filePath);
                
                if (ext === '.html') {
                    // HTML: no cache, must revalidate
                    res.setHeader('Cache-Control', 'no-cache, must-revalidate, proxy-revalidate');
                    res.setHeader('Pragma', 'no-cache');
                    res.setHeader('Expires', '0');
                } else if (ext === '.js') {
                    // JS: cache with versioning via ETag and max-age
                    // Add version hint for bundle.js
                    if (fileName === 'bundle.js' && bundleHash) {
                        res.setHeader('X-Bundle-Version', bundleHash);
                    }
                    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year (safe due to ETag)
                } else if (ext === '.css') {
                    // CSS: cache with ETag
                    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
                } else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.gif' || ext === '.webp' || ext === '.svg') {
                    // Images: long cache with immutable
                    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
                }
            }
        }));
        
        // Store bundle hash for later use
        this.bundleHash = bundleHash;
    }

    setupRoutes() {
        // Helper function to serve HTML with bundle versioning
        const serveHtml = (res, roomCode = null) => {
            const htmlPath = path.join(__dirname, '../public/index.html');
            
            if (this.bundleHash) {
                fs.readFile(htmlPath, 'utf8', (err, data) => {
                    if (err) {
                        return res.status(500).send('Error loading page');
                    }
                    
                    // Inject version query string into bundle.js reference
                    let versionedHtml = data.replace(
                        /src="js\/bundle\.js"/g,
                        `src="js/bundle.js?v=${this.bundleHash}"`
                    );
                    
                    // Inject room code into page if provided
                    if (roomCode) {
                        // Try to find the bundle.js script tag and inject before it
                        const scriptPattern = /(<script[^>]*src="js\/bundle\.js[^"]*"[^>]*><\/script>)/i;
                        if (scriptPattern.test(versionedHtml)) {
                            versionedHtml = versionedHtml.replace(
                                scriptPattern,
                                `<script>window.__INITIAL_ROOM_CODE__ = '${roomCode}';</script>\n    $1`
                            );
                        } else {
                            // Fallback: inject in head if script tag pattern not found
                            versionedHtml = versionedHtml.replace(
                                '</head>',
                                `<script>window.__INITIAL_ROOM_CODE__ = '${roomCode}';</script>\n    </head>`
                            );
                        }
                    }
                    
                    res.setHeader('Content-Type', 'text/html');
                    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
                    res.send(versionedHtml);
                });
            } else {
                // Without bundle hash, still inject room code if needed
                if (roomCode) {
                    fs.readFile(htmlPath, 'utf8', (err, data) => {
                        if (err) {
                            return res.status(500).send('Error loading page');
                        }
                        // Try to find the bundle.js script tag and inject before it
                        const scriptPattern = /(<script[^>]*src="js\/bundle\.js"[^>]*><\/script>)/i;
                        let modifiedHtml = data;
                        if (scriptPattern.test(modifiedHtml)) {
                            modifiedHtml = modifiedHtml.replace(
                                scriptPattern,
                                `<script>window.__INITIAL_ROOM_CODE__ = '${roomCode}';</script>\n    $1`
                            );
                        } else {
                            // Fallback: inject in head if script tag pattern not found
                            modifiedHtml = modifiedHtml.replace(
                                '</head>',
                                `<script>window.__INITIAL_ROOM_CODE__ = '${roomCode}';</script>\n    </head>`
                            );
                        }
                        res.setHeader('Content-Type', 'text/html');
                        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
                        res.send(modifiedHtml);
                    });
                } else {
                    res.sendFile(htmlPath);
                }
            }
        };

        // Root route - for creating new games
        this.app.get('/', (req, res) => {
            serveHtml(res);
        });

        // Room route - for joining existing games via URL
        this.app.get('/room/:roomCode', (req, res) => {
            const roomCode = req.params.roomCode.trim().toUpperCase();
            
            // Validate room code format
            if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
                return res.redirect('/');
            }
            
            // Serve HTML with room code context
            serveHtml(res, roomCode);
        });

        // API endpoint to check if room exists
        this.app.get('/api/room/:roomCode', (req, res) => {
            const roomCode = req.params.roomCode.trim().toUpperCase();
            
            if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
                return res.status(400).json({ 
                    exists: false, 
                    error: 'Invalid room code format' 
                });
            }
            
            const game = this.gameManager.getGameByRoomCode(roomCode);
            if (game) {
                res.json({ 
                    exists: true, 
                    roomCode: roomCode,
                    playerCount: game.players.length,
                    maxPlayers: 6,
                    gameStarted: game.gameStarted || false
                });
            } else {
                res.json({ 
                    exists: false, 
                    roomCode: roomCode 
                });
            }
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

    start() {
        this.app.set('trust proxy', 1);
        this.server.listen(() => {
            console.log(`🚀 UNO Flip Server running`);
        });
    }
}

// Start the server
const server = new UnoServer();
server.start();

module.exports = UnoServer;
