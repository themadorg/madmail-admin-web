// Service worker update checker.
// Polls version.json every 5 minutes and on page visibility change.
// When a new version is detected, it notifies the app via a callback.
// The caller can then trigger applyUpdate() to clear the SW cache and reload.

import { base } from '$app/paths';

/** Admin-web version baked in at build time (matches stamped version.json when embedded). */
const runningVersion =
    typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

let onUpdateAvailable: ((newVersion: string) => void) | null = null;
let checkInterval: ReturnType<typeof setInterval> | null = null;

const VERSION_URL = `${base}/version.json`;
const CHECK_MS = 5 * 60 * 1000; // 5 minutes

async function fetchVersion(): Promise<string | null> {
    try {
        // Always bypass cache for version checks
        const res = await fetch(VERSION_URL, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.version ?? null;
    } catch {
        return null;
    }
}

async function checkForUpdate() {
    const remote = await fetchVersion();
    if (!remote) return;

    // Compare server version.json against the code actually running (cached bundle).
    if (remote !== runningVersion) {
        console.log(`[sw-update] Update available: ${runningVersion} → ${remote}`);
        onUpdateAvailable?.(remote);
    }
}

export function startVersionChecker(cb: (newVersion: string) => void) {
    onUpdateAvailable = cb;

    // Check immediately
    checkForUpdate();

    // Check every 5 minutes
    if (checkInterval) clearInterval(checkInterval);
    checkInterval = setInterval(checkForUpdate, CHECK_MS);

    // Also check when page becomes visible (user returns to tab)
    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                checkForUpdate();
            }
        });
    }
}

/**
 * Applies a detected update:
 *   1. Tells the SW to clear all caches
 *   2. Waits for confirmation
 *   3. Hard-reloads the page
 */
export function applyUpdate() {
    let reloaded = false;
    const reload = () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage('CLEAR_CACHE');
        navigator.serviceWorker.addEventListener('message', (e) => {
            if (e.data === 'CACHE_CLEARED') reload();
        });
        setTimeout(reload, 2000);
    } else {
        reload();
    }
}
