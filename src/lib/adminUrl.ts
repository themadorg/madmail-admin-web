import type { AllSettings } from '$lib/api';

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
