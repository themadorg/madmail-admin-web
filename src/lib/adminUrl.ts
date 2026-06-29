import type { AllSettings } from '$lib/api';

export type AdminApiProtocol = 'https:' | 'http:';

/** Split a stored or pasted admin API URL into protocol + host/path. */
export function splitAdminApiUrl(input: string): { protocol: AdminApiProtocol; rest: string } {
    const trimmed = input.trim();
    if (!trimmed) return { protocol: 'https:', rest: '' };

    if (/^https?:\/\//i.test(trimmed)) {
        try {
            const u = new URL(trimmed);
            const rest = `${u.host}${u.pathname}${u.search}${u.hash}`.replace(/\/+$/, '');
            return { protocol: u.protocol as AdminApiProtocol, rest };
        } catch {
            const m = trimmed.match(/^(https?):\/\/(.*)$/i);
            if (m) {
                return {
                    protocol: `${m[1].toLowerCase()}:` as AdminApiProtocol,
                    rest: m[2].replace(/\/+$/, ''),
                };
            }
        }
    }

    if (trimmed.startsWith('//')) {
        return { protocol: 'https:', rest: trimmed.slice(2).replace(/\/+$/, '') };
    }

    return { protocol: 'https:', rest: trimmed.replace(/\/+$/, '') };
}

/** Build a full admin API URL from the login protocol selector and host/path field. */
export function buildAdminApiUrl(protocol: AdminApiProtocol, rest: string): string {
    const trimmed = rest.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) {
        return normalizeAdminApiUrl(trimmed);
    }
    return normalizeAdminApiUrl(`${protocol}//${trimmed.replace(/^\/+/, '')}`, protocol);
}

/**
 * Ensure the admin API URL has a protocol. Defaults to HTTPS when omitted
 * (matches madmail admin-token output and typical deployments).
 */
export function normalizeAdminApiUrl(
    input: string,
    defaultProtocol: AdminApiProtocol = 'https:',
): string {
    const trimmed = input.trim();
    if (!trimmed) return '';

    let candidate = trimmed;
    if (!/^https?:\/\//i.test(candidate)) {
        if (candidate.startsWith('//')) {
            candidate = `${defaultProtocol}${candidate}`;
        } else {
            candidate = `${defaultProtocol}//${candidate.replace(/^\/+/, '')}`;
        }
    }

    try {
        const u = new URL(candidate);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
            return candidate.replace(/\/+$/, '');
        }
        return u.toString().replace(/\/+$/, '');
    } catch {
        return candidate.replace(/\/+$/, '');
    }
}

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

/**
 * Recompute the admin API base URL (same inputs as the madmail admin-token
 * / buildAdminURL logic): apply DB overrides for SMTP hostname, HTTPS/HTTP
 * port, and admin API path, while keeping the current URL as the template.
 */
export function applySettingsToAdminBaseUrl(
    current: string,
    settings: AllSettings,
): string {
    let u: URL;
    try {
        u = new URL(current);
    } catch {
        return current;
    }

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

    if (settings.admin_path.is_set && settings.admin_path.value?.trim()) {
        const pv = settings.admin_path.value.trim();
        u.pathname = pv.startsWith('/') ? pv : `/${pv}`;
    }

    return u.toString().replace(/\/+$/, '');
}
