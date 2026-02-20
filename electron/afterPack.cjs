const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// afterPack hook — runs after electron-builder packages the app but before archiving
// Strips unnecessary files and debug symbols to reduce the final binary size
module.exports = async function afterPack(context) {
    const appOutDir = context.appOutDir;
    const platform = context.electronPlatformName;

    if (platform === 'linux') {
        // Strip debug symbols from the Electron binary
        const binaryName = context.packager.executableName;
        const binaryPath = path.join(appOutDir, binaryName);
        if (fs.existsSync(binaryPath)) {
            try {
                execSync(`strip --strip-debug "${binaryPath}"`, { stdio: 'pipe' });
                console.log(`  • stripped debug symbols from ${binaryName}`);
            } catch (e) {
                console.log(`  • strip not available, skipping (${e.message})`);
            }
        }

        // Strip .so shared libraries
        const soFiles = fs.readdirSync(appOutDir).filter(f => f.endsWith('.so'));
        for (const so of soFiles) {
            const soPath = path.join(appOutDir, so);
            try {
                execSync(`strip --strip-debug "${soPath}"`, { stdio: 'pipe' });
            } catch (e) { /* ignore */ }
        }
        if (soFiles.length > 0) {
            console.log(`  • stripped debug symbols from ${soFiles.length} shared libraries`);
        }
    }

    // Remove unnecessary Chromium files on all platforms
    const junkFiles = [
        'LICENSE.electron.txt',
        'LICENSES.chromium.html',
        'chrome_crashpad_handler',
    ];
    for (const junk of junkFiles) {
        const junkPath = path.join(appOutDir, junk);
        if (fs.existsSync(junkPath)) {
            fs.rmSync(junkPath, { recursive: true });
        }
    }
};
