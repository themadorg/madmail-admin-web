import type { AllSettings } from '$lib/api';

/** Normalize an admin-web mount path (`/admin`, `/secret`, …). */
export function normalizeAdminWebPath(raw: string): string {
    const trimmed = raw.trim();
    const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return withSlash.replace(/\/+$/, '') || '/';
}

/** True when `pathname` is the SPA root or a client route under `adminWebPath`. */
export function isUnderAdminWebPath(pathname: string, adminWebPath: string): boolean {
    const prefix = normalizeAdminWebPath(adminWebPath);
    const cur = pathname.replace(/\/+$/, '') || '/';
    if (cur === prefix) {
        return true;
    }
    return cur.startsWith(`${prefix}/`);
}

export interface AdminBaseUrlSyncOptions {
    /**
     * Copy `smtp_hostname` and the HTTP(S) listen port onto the URL.
     * Overview and settings refresh leave this off so a reverse proxy in
     * front of a custom listen port keeps the origin that loaded the page.
     * The ports screen turns it on after the operator changes that listener.
     */
    followListener?: boolean;
}

/**
 * Recompute the admin API base URL. `admin_path` always follows the server.
 * Host and port follow `smtp_hostname` and the listen port only when
 * `followListener` is set, which is the madmail admin-token shape.
 */
export function applySettingsToAdminBaseUrl(
    current: string,
    settings: AllSettings,
    options?: AdminBaseUrlSyncOptions,
): string {
    let u: URL;
    try {
        u = new URL(current);
    } catch {
        return current;
    }

    if (options?.followListener) {
        if (settings.smtp_hostname.is_set && settings.smtp_hostname.value?.trim()) {
            u.hostname = settings.smtp_hostname.value.trim();
        }

        if (u.protocol === 'https:') {
            if (settings.https_port.is_set && settings.https_port.value) {
                const p = settings.https_port.value.trim();
                u.port = p === '443' ? '' : p;
            }
        } else if (u.protocol === 'http:') {
            if (settings.http_port.is_set && settings.http_port.value) {
                const p = settings.http_port.value.trim();
                u.port = p === '80' ? '' : p;
            }
        }
    }

    if (settings.admin_path.is_set && settings.admin_path.value?.trim()) {
        const pv = settings.admin_path.value.trim();
        u.pathname = pv.startsWith('/') ? pv : `/${pv}`;
    }

    return u.toString().replace(/\/+$/, '');
}
