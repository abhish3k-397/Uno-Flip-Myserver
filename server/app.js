const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const compression = require('compression');
const crypto = require('crypto');
const fs = require('fs');

const GameManager = require('./core/game');
const SocketHandler = require('./handlers/socket');
const config = require('./config');
const { handleHttpError } = require('./utils/errors');

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
        this.app.get('/', (req, res) => {
            const htmlPath = path.join(__dirname, '../public/index.html');
            
            // If bundle hash is available, inject it into HTML for cache busting
            if (this.bundleHash) {
                fs.readFile(htmlPath, 'utf8', (err, data) => {
                    if (err) {
                        return res.status(500).send('Error loading page');
                    }
                    
                    // Inject version query string into bundle.js reference
                    const versionedHtml = data.replace(
                        /src="js\/bundle\.js"/g,
                        `src="js/bundle.js?v=${this.bundleHash}"`
                    );
                    
                    res.setHeader('Content-Type', 'text/html');
                    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
                    res.send(versionedHtml);
                });
            } else {
                res.sendFile(htmlPath);
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

        // Error handling middleware (must be last)
        this.app.use(handleHttpError);
    }

    start() {
        const port = config.port;
        this.app.set('trust proxy', 1);
        this.server.listen(port, '0.0.0.0', () => {
            console.log(`🚀 UNO Flip Server running on port ${port}`);
            console.log(`📱 Access the game at: http://localhost:${port}`);
        });
    }
}

// Start the server
const server = new UnoServer();
server.start();

module.exports = UnoServer;
