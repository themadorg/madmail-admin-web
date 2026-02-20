const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

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

// Simple static file server — serves the SvelteKit build exactly like a web server
function startStaticServer() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

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
