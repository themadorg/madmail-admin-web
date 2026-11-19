/** Fields the dashboard uses to decide whether an admin API path change is live. */
export interface AdminPathApplyInput {
    value?: string;
    applied?: boolean;
    restart_required?: boolean;
}

export interface AdminPathPlan {
    /** The remount was confirmed. The live base URL can switch now. */
    confirmed: boolean;
    destination: string;
    /** Set when the remount was not confirmed. Later reconnects probe this URL. */
    pendingUrl: string | null;
}

/** Replace the path of an admin API URL, keeping its origin. */
export function adminApiUrlForPath(baseUrl: string, path: string): string {
    const url = new URL(baseUrl);
    const saved = path.trim();
    url.pathname = saved.startsWith('/') ? saved : `/${saved}`;
    return url.toString().replace(/\/+$/, '');
}

/**
 * A remount is confirmed only when `applied` is true and the server is not
 * still asking for a restart. `applied: false`, `restart_required: true`, and
 * a missing `applied` all keep the current URL and remember the saved path.
 * A missing `applied` is unknown, not a successful switch.
 */
export function planAdminPathFollowUp(
    baseUrl: string,
    savedPath: string,
    data: AdminPathApplyInput | undefined,
): AdminPathPlan {
    const path = (data?.value || savedPath).trim() || savedPath;
    const destination = adminApiUrlForPath(baseUrl, path);
    const confirmed = data?.applied === true && data.restart_required !== true;
    if (confirmed) {
        return { confirmed: true, destination, pendingUrl: null };
    }
    return { confirmed: false, destination, pendingUrl: destination };
}

/** Status polls after a deferred path change use the remembered destination. */
export function reconnectBaseUrl(baseUrl: string, pendingUrl: string | null | undefined): string {
    const pending = pendingUrl?.trim();
    return pending ? pending : baseUrl;
}

/**
 * Identity of an admin connection. The admin path is omitted: a deferred path
 * change is still the same server. A different origin or token is not.
 */
export function adminConnectionKey(baseUrl: string, token: string): string {
    let origin = baseUrl.trim();
    try {
        origin = new URL(baseUrl).origin;
    } catch {
        /* Keep the raw value when it is not a URL. */
    }
    return `${origin}\u0000${token}`;
}
