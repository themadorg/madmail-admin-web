const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { URL } = require('url');

// Debug mode: only log proxy details when --debug is passed
const DEBUG = process.argv.includes('--debug');
function debug(...args) { if (DEBUG) console.log(...args); }
function debugErr(...args) { if (DEBUG) console.error(...args); }

// Path to the SvelteKit static build output
const BUILD_DIR = path.join(__dirname, '..', 'build');

// MIME types for serving static files
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.webp': 'image/webp',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.webmanifest': 'application/manifest+json',
};

// --- In-app API proxy ---
// Accepts POST to /__proxy with JSON body: { targetUrl: string, payload: object }
// Forwards `payload` to `targetUrl` using Node.js http/https (bypasses CORS + self-signed certs)
// Returns the upstream response back to the renderer.
function handleProxy(req, res) {
    debug('[PROXY] ← incoming request from renderer');
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
        debug('[PROXY] raw body:', body.substring(0, 500));
        let parsed;
        try {
            parsed = JSON.parse(body);
        } catch (e) {
            debugErr('[PROXY] JSON parse error:', e.message);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON in proxy request' }));
            return;
        }

        const { targetUrl, payload } = parsed;
        debug('[PROXY] targetUrl:', targetUrl);

        if (!targetUrl) {
            debugErr('[PROXY] missing targetUrl');
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing targetUrl' }));
            return;
        }

        let target;
        try {
            target = new URL(targetUrl);
        } catch {
            debugErr('[PROXY] invalid targetUrl:', targetUrl);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid targetUrl' }));
            return;
        }

        const payloadStr = JSON.stringify(payload ?? {});
        const isHttps = target.protocol === 'https:';
        const transport = isHttps ? https : http;

        debug('[PROXY] → forwarding to:', target.hostname + ':' + (target.port || (isHttps ? 443 : 80)) + target.pathname);

        const proxyReq = transport.request(
            {
                hostname: target.hostname,
                port: target.port || (isHttps ? 443 : 80),
                path: target.pathname + target.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payloadStr),
                },
                rejectUnauthorized: false,
                timeout: 30000,
            },
            (proxyRes) => {
                debug('[PROXY] ← upstream status:', proxyRes.statusCode);
                if (DEBUG) {
                    // In debug mode, collect body for logging before sending
                    let responseBody = '';
                    proxyRes.on('data', (chunk) => { responseBody += chunk; });
                    proxyRes.on('end', () => {
                        debug('[PROXY] ← upstream body:', responseBody.substring(0, 500));
                        res.writeHead(proxyRes.statusCode || 502, {
                            'Content-Type': proxyRes.headers['content-type'] || 'application/json',
                        });
                        res.end(responseBody);
                    });
                } else {
                    // In normal mode, pipe directly for efficiency
                    res.writeHead(proxyRes.statusCode || 502, {
                        'Content-Type': proxyRes.headers['content-type'] || 'application/json',
                    });
                    proxyRes.pipe(res);
                }
            }
        );

        proxyReq.on('error', (err) => {
            debugErr('[PROXY] ✗ error:', err.message);
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Proxy error: ${err.message}` }));
        });

        proxyReq.on('timeout', () => {
            debugErr('[PROXY] ✗ timeout after 30s');
            proxyReq.destroy();
            res.writeHead(504, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Proxy timeout' }));
        });

        proxyReq.write(payloadStr);
        proxyReq.end();
    });
}

// Simple static file server — serves the SvelteKit build exactly like a web server
function startStaticServer() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

            // --- Proxy endpoint: intercept /__proxy ---
            if (pathname === '/__proxy' && req.method === 'POST') {
                handleProxy(req, res);
                return;
            }

            // Resolve file path
            let filePath = path.join(BUILD_DIR, pathname);

            // Security: prevent directory traversal
            if (!path.resolve(filePath).startsWith(path.resolve(BUILD_DIR))) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }

            // Directory → try index.html
            if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
                filePath = path.join(filePath, 'index.html');
            }

            // If file exists, serve it
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                const ext = path.extname(filePath).toLowerCase();
                const mime = MIME_TYPES[ext] || 'application/octet-stream';
                const content = fs.readFileSync(filePath);
                res.writeHead(200, { 'Content-Type': mime });
                res.end(content);
                return;
            }

            // SPA fallback — serve index.html for client-side routing
            const indexPath = path.join(BUILD_DIR, 'index.html');
            if (fs.existsSync(indexPath)) {
                const content = fs.readFileSync(indexPath);
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(content);
                return;
            }

            res.writeHead(404);
            res.end('Not Found');
        });

        // Listen on a random available port on localhost only
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            resolve({ server, port });
        });
    });
}

let serverInstance = null;

async function createWindow(port) {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: '#111113',
        icon: path.join(__dirname, '..', 'static', 'icon-512.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
        autoHideMenuBar: true,
        show: false,
    });

    // Load from the local HTTP server — all paths work exactly like on the web
    win.loadURL(`http://127.0.0.1:${port}/`);

    win.once('ready-to-show', () => {
        win.show();
    });

    // Open external links in the default browser
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (!url.startsWith(`http://127.0.0.1:${port}`)) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

    win.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith(`http://127.0.0.1:${port}`)) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });
}

app.whenReady().then(async () => {
    const { server, port } = await startStaticServer();
    serverInstance = server;

    // Allow self-signed / untrusted certificates for API connections
    // (Madmail servers may use self-signed certs)
    app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
        event.preventDefault();
        callback(true);
    });

    await createWindow(port);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow(port);
        }
    });
});

app.on('window-all-closed', () => {
    if (serverInstance) {
        serverInstance.close();
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
