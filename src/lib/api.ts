// Admin API client for the Madmail RPC-style single-endpoint API.
// All requests are POST to the admin API URL provided by the user.
//
// When running inside Electron (detected by the page being served from 127.0.0.1),
// requests are routed through a local /__proxy endpoint in the Electron main process.
// This avoids CORS restrictions and self-signed certificate errors.
//
// In Vite dev with VITE_DEV_API_PROXY=1, requests go to the same-origin path (e.g. /api/admin)
// and Vite proxies to DEV_API_PROXY_TARGET from .env (see vite.config.ts).

function devProxyEnabled(): boolean {
    return import.meta.env.DEV && import.meta.env.VITE_DEV_API_PROXY === '1';
}

/** Vite dev serves the SPA at `/`; do not follow production `admin_web_path` redirects. */
export function isViteDevShell(): boolean {
    return import.meta.env.DEV;
}

/**
 * True when the SPA is served from the same origin as the connected admin API
 * (embedded under madmail's admin_web_path). False for hosted panels such as
 * admin.madmail.chat that call a remote server via cross-origin API.
 */
export function isEmbeddedAdminShell(baseUrl: string): boolean {
    if (typeof window === 'undefined' || !baseUrl) return false;
    try {
        return new URL(baseUrl).origin === window.location.origin;
    } catch {
        return false;
    }
}

/** Same-origin admin API URL in dev (Vite proxy); otherwise the configured baseUrl. */
function resolveAdminApiUrl(config: ApiConfig): string {
    if (devProxyEnabled() && typeof window !== 'undefined') {
        const path = (import.meta.env.VITE_DEV_API_PATH || '/api/admin').replace(/\/+$/, '');
        const normalized = path.startsWith('/') ? path : `/${path}`;
        return `${window.location.origin}${normalized}`;
    }
    return config.baseUrl.replace(/\/+$/, '');
}

export interface ApiConfig {
    baseUrl: string;
    token: string;
}

export interface ApiResponse<T = unknown> {
    status: number;
    resource: string;
    body: T;
    error: string | null;
    version: string;
}

// --- Response types ---

export interface EmailServersSummary {
    /** Successful federated peer servers (excluding this host). */
    connections: number;
    /** Peers identified by domain name. */
    domain_servers: number;
    /** Peers identified by IP literal. */
    ip_servers: number;
    /** @deprecated Same as `connections`; older servers used IMAP unique IPs here. */
    connection_ips?: number;
}

/** Message file rotation from `GET /admin/status` (and `/admin/overview`). */
export interface MessageRetentionSummary {
    enabled: boolean;
    days: number;
    retention: string;
}

/** Federation delivery aggregates from `GET /admin/status` (and `/admin/overview`). */
export interface FederationTrafficSummary {
    inbound: number;
    outbound: number;
    queued: number;
    expired: number;
    mean_latency_ms: number;
    health: {
        perfect: number;
        federated: number;
        bad: number;
    };
}

export interface StatusResponse {
    version: string;
    imap?: { connections: number; unique_ips: number };
    turn?: { relays: number };
    shadowsocks?: { connections: number; unique_ips: number };
    users: { registered: number };
    uptime: { boot_time: string; duration: string };
    email_servers?: EmailServersSummary;
    federation_traffic?: FederationTrafficSummary;
    message_retention?: MessageRetentionSummary;
    sent_messages: number;
    outbound_messages: number;
    received_messages: number;
}

/** Dashboard overview (`GET /admin/overview`). Prefer this over composing Status + Storage + tokens. */
export interface OverviewResponse {
    version: string;
    users: { registered: number };
    uptime: { boot_time: string; duration: string };
    disk: {
        total_bytes: number;
        used_bytes: number;
        available_bytes: number;
        percent_used: number;
    };
    tokens: { total: number };
    sent_messages: number;
    outbound_messages: number;
    received_messages: number;
    imap?: { connections: number; unique_ips: number };
    turn?: { relays: number };
    shadowsocks?: { connections: number; unique_ips: number };
    email_servers?: EmailServersSummary;
    federation_traffic?: FederationTrafficSummary;
    message_retention?: MessageRetentionSummary;
    /** Present on servers with overview+settings bundle; omitted on legacy composed responses. */
    settings?: AllSettings;
}

export interface StorageResponse {
    disk: { total_bytes: number; used_bytes: number; available_bytes: number; percent_used: number };
    state_dir: { path: string; size_bytes: number };
    database?: { driver: string; size_bytes: number };
}

export interface ToggleStatus {
    status: string;
    restart_required?: boolean;
}

export interface SettingValue {
    key: string;
    value: string;
    is_set: boolean;
    restart_required?: boolean;
}

export interface AllSettings {
    registration: string;
    jit_registration: string;
    turn_enabled: string;
    iroh_enabled: string;
    ss_enabled: string;
    auto_purge_seen_enabled: string;
    message_retention_enabled: string;
    message_retention: SettingValue;
    ss_ws_enabled: string;
    ss_grpc_enabled: string;
    http_proxy_enabled: string;
    log_disabled: string;
    admin_web_enabled: string;
    webimap_enabled: string;
    websmtp_enabled: string;
    registration_token_required: string;
    smtp_port: SettingValue;
    submission_port: SettingValue;
    submission_tls_port: SettingValue;
    imap_port: SettingValue;
    imap_tls_port: SettingValue;
    turn_port: SettingValue;
    sasl_port: SettingValue;
    iroh_port: SettingValue;
    ss_port: SettingValue;
    ss_ws_port: SettingValue;
    ss_grpc_port: SettingValue;
    http_port: SettingValue;
    https_port: SettingValue;
    http_proxy_port: SettingValue;
    http_proxy_path: SettingValue;
    // Per-port access control: "public" or "local"
    smtp_access: string;
    submission_access: string;
    submission_tls_access: string;
    imap_access: string;
    imap_tls_access: string;
    turn_access: string;
    sasl_access: string;
    iroh_access: string;
    http_access: string;
    https_access: string;
    // Configuration
    smtp_hostname: SettingValue;
    turn_realm: SettingValue;
    turn_secret: SettingValue;
    turn_relay_ip: SettingValue;
    turn_ttl: SettingValue;
    iroh_relay_url: SettingValue;
    ss_cipher: SettingValue;
    ss_password: SettingValue;
    http_proxy_username: SettingValue;
    http_proxy_password: SettingValue;
    admin_path: SettingValue;
    admin_web_path: SettingValue;
    dclogin_imap_security: SettingValue;
    dclogin_smtp_security: SettingValue;
    language: SettingValue;
    /** Server-built SS URL when available (`GET /admin/settings`). */
    shadowsocks_url?: string;
}

export interface AccountList {
    accounts: { username: string; used_bytes: number; max_bytes: number; is_default_quota: boolean; created_at: number; first_login_at: number; last_login_at: number }[];
    total: number;
}

export interface BlocklistEntry {
    username: string;
    reason: string;
    blocked_at: string;
}

export interface BlocklistResponse {
    blocked: BlocklistEntry[];
    total: number;
}

export interface QuotaStats {
    total_storage_bytes: number;
    accounts_count: number;
    default_quota_bytes: number;
}

export interface DnsEntry {
    lookup_key: string;
    target_host: string;
    comment?: string;
}

export interface DnsListResponse {
    overrides: DnsEntry[];
    total: number;
}

export interface ExchangerEntry {
    name: string;
    url: string;
    enabled: boolean;
    poll_interval: number;
    last_poll_at?: string;
}

export interface ExchangerListResponse {
    exchangers: ExchangerEntry[];
    total: number;
}

export interface RegistrationTokenEntry {
    token: string;
    max_uses: number;
    used_count: number;
    pending_reservations: number;
    comment: string;
    created_at: string;
    expires_at?: string;
    status: 'active' | 'exhausted' | 'expired';
}

export interface RegistrationTokenListResponse {
    tokens: RegistrationTokenEntry[];
    total: number;
}

export interface FederationSettingsResponse {
    enabled: boolean;
    policy: string;
}

export interface FederationRuleEntry {
    domain: string;
    created_at: number;
}

export interface FederationRulesResponse {
    rules: FederationRuleEntry[];
    total: number;
}

export interface FederationServerEntry {
    domain: string;
    queued_messages: number;
    failed_http: number;
    failed_https: number;
    failed_smtp: number;
    success_http: number;
    success_https: number;
    success_smtp: number;
    inbound_deliveries: number;
    successful_deliveries: number;
    mean_latency_ms: number;
    last_active: number;
}

export interface FederationServersResponse {
    servers: FederationServerEntry[];
    total: number;
}


export interface ReloadResponse {
    status: string;
    message: string;
}

export interface CreateAccountResponse {
    email: string;
    password: string;
}

// --- API Client ---

// Detect if we're running inside Electron's embedded server (localhost origin).
// In that case, route requests through the /__proxy endpoint to bypass CORS + self-signed certs.
function isElectron(): boolean {
    try {
        return typeof window !== 'undefined' && window.location.hostname === '127.0.0.1';
    } catch {
        return false;
    }
}

export async function apiCall<T = unknown>(
    config: ApiConfig,
    resource: string,
    method: string = 'GET',
    body?: unknown
): Promise<{ data?: T; error?: string; status: number; version?: string }> {
    try {
        const targetUrl = resolveAdminApiUrl(config);
        const payload = {
            method,
            resource,
            headers: { Authorization: `Bearer ${config.token}` },
            body: body ?? {}
        };

        let res: Response;

        if (isElectron()) {
            // Route through Electron's in-app proxy to avoid CORS and self-signed cert issues
            const proxyUrl = `${window.location.origin}/__proxy`;
            res = await fetch(proxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUrl, payload })
            });
        } else {
            // Direct fetch (web / GitHub Pages deployment)
            res = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        const text = await res.text();
        if (!text) {
            // HTTP 200 with empty body = auth succeeded, server accepted the request.
            // If auth failed, the server would return {"status":401,"error":"unauthorized"}.
            if (res.status >= 200 && res.status < 300) {
                return { data: undefined as unknown as T, status: res.status };
            }
            return { error: `Empty response from server (HTTP ${res.status})`, status: res.status };
        }

        let json: ApiResponse<T>;
        try {
            json = JSON.parse(text);
        } catch {
            return { error: `Invalid JSON from server: ${text.substring(0, 200)}`, status: res.status };
        }

        if (json.error) {
            return { error: json.error, status: json.status, version: json.version };
        }
        return { data: json.body, status: json.status ?? res.status, version: json.version };
    } catch (e) {
        return { error: String(e), status: 0 };
    }
}


// Convenience wrappers
export const api = {
    /** @deprecated Prefer `overview()` for the dashboard; kept for auth checks and legacy servers. */
    status: (c: ApiConfig) => apiCall<StatusResponse>(c, '/admin/status'),
    overview: (c: ApiConfig) => apiCall<OverviewResponse>(c, '/admin/overview'),
    storage: (c: ApiConfig) => apiCall<StorageResponse>(c, '/admin/storage'),
    accounts: (c: ApiConfig) => apiCall<AccountList>(c, '/admin/accounts'),
    createAccount: (c: ApiConfig) =>
        apiCall<CreateAccountResponse>(c, '/admin/accounts', 'POST'),
    deleteAccount: (c: ApiConfig, username: string) =>
        apiCall(c, '/admin/accounts', 'DELETE', { username }),
    exportAccounts: (c: ApiConfig) =>
        apiCall<{ users: { username: string; hash?: string }[]; total: number }>(c, '/admin/accounts', 'PATCH', { action: 'export' }),
    importAccounts: (c: ApiConfig, users: { username: string; password?: string; hash?: string }[]) =>
        apiCall<{ imported: number; skipped: number; errors?: string[] }>(c, '/admin/accounts', 'PATCH', { action: 'import', users }),
    deleteAllAccounts: (c: ApiConfig) =>
        apiCall<{ deleted: number; errors?: string[] }>(c, '/admin/accounts', 'PATCH', { action: 'delete_all' }),
    quota: (c: ApiConfig) => apiCall<QuotaStats>(c, '/admin/quota'),
    setDefaultQuota: (c: ApiConfig, maxBytes: number) =>
        apiCall(c, '/admin/quota', 'PUT', { max_bytes: maxBytes }),
    setUserQuota: (c: ApiConfig, username: string, maxBytes: number) =>
        apiCall(c, '/admin/quota', 'PUT', { username, max_bytes: maxBytes }),
    resetUserQuota: (c: ApiConfig, username: string) =>
        apiCall(c, '/admin/quota', 'DELETE', { username }),
    settings: (c: ApiConfig) => apiCall<AllSettings>(c, '/admin/settings'),

    // Blocklist
    blocklist: (c: ApiConfig) => apiCall<BlocklistResponse>(c, '/admin/blocklist'),
    blockUser: (c: ApiConfig, username: string, reason?: string) =>
        apiCall(c, '/admin/blocklist', 'POST', { username, reason: reason || 'manually blocked' }),
    unblockUser: (c: ApiConfig, username: string) =>
        apiCall(c, '/admin/blocklist', 'DELETE', { username }),
    unblockAll: (c: ApiConfig) =>
        apiCall<{ unblocked: number; errors?: string[] }>(c, '/admin/blocklist', 'PATCH', { action: 'delete_all' }),

    // Toggles
    getToggle: (c: ApiConfig, resource: string) =>
        apiCall<ToggleStatus>(c, resource),
    setToggle: (c: ApiConfig, resource: string, action: string) =>
        apiCall<ToggleStatus>(c, resource, 'POST', { action }),

    // Settings
    getSetting: (c: ApiConfig, key: string) =>
        apiCall<SettingValue>(c, `/admin/settings/${key}`),
    setSetting: (c: ApiConfig, key: string, value: string) =>
        apiCall<SettingValue>(c, `/admin/settings/${key}`, 'POST', { action: 'set', value }),
    resetSetting: (c: ApiConfig, key: string) =>
        apiCall<SettingValue>(c, `/admin/settings/${key}`, 'POST', { action: 'reset' }),

    // Queue
    purgeQueue: (c: ApiConfig, action: string) =>
        apiCall(c, '/admin/queue', 'POST', { action }),
    purgeOlder: (c: ApiConfig, retention: string) =>
        apiCall(c, '/admin/queue', 'POST', { action: 'purge_older', retention }),
    purgeBlobs: (c: ApiConfig) =>
        apiCall(c, '/admin/queue', 'POST', { action: 'purge_blobs' }),
    purgeBlobsOlder: (c: ApiConfig, retention: string) =>
        apiCall(c, '/admin/queue', 'POST', { action: 'purge_blobs_older', retention }),

    // DNS overrides
    dns: (c: ApiConfig) => apiCall<DnsListResponse>(c, '/admin/dns'),
    addDns: (c: ApiConfig, lookup_key: string, target_host: string, comment?: string) =>
        apiCall<DnsEntry>(c, '/admin/dns', 'POST', { lookup_key, target_host, comment: comment || '' }),
    deleteDns: (c: ApiConfig, lookup_key: string) =>
        apiCall(c, '/admin/dns', 'DELETE', { lookup_key }),

    // Exchangers
    exchangers: (c: ApiConfig) => apiCall<ExchangerListResponse>(c, '/admin/exchangers'),
    addExchanger: (c: ApiConfig, name: string, url: string, poll_interval: number) =>
        apiCall<ExchangerEntry>(c, '/admin/exchangers', 'POST', { name, url, poll_interval }),
    updateExchanger: (c: ApiConfig, name: string, updates: { enabled?: boolean; url?: string; poll_interval?: number }) =>
        apiCall(c, '/admin/exchangers', 'PUT', { name, ...updates }),
    deleteExchanger: (c: ApiConfig, name: string) =>
        apiCall(c, '/admin/exchangers', 'DELETE', { name }),


    // Reload
    reload: (c: ApiConfig) => apiCall<ReloadResponse>(c, '/admin/reload', 'POST'),

    // Restart service (needed after port access changes)
    restart: (c: ApiConfig) => apiCall(c, '/admin/restart', 'POST'),

    // Admin notices
    sendNotice: (c: ApiConfig, subject: string, body: string, recipient?: string) =>
        apiCall<{ sent: number; failed: number; errors?: string[] }>(c, '/admin/notice', 'POST', {
            subject, body, recipient: recipient || '',
        }),

    // Registration tokens
    registrationTokens: (c: ApiConfig) =>
        apiCall<RegistrationTokenListResponse>(c, '/admin/registration-token'),
    createRegistrationToken: (c: ApiConfig, opts: { token?: string; max_uses?: number; comment?: string; expires_in?: string }) =>
        apiCall<RegistrationTokenEntry>(c, '/admin/registration-token', 'POST', opts),
    deleteRegistrationToken: (c: ApiConfig, token: string) =>
        apiCall(c, '/admin/registration-token', 'DELETE', { token }),

    // Federation
    federationSettings: (c: ApiConfig) =>
        apiCall<FederationSettingsResponse>(c, '/admin/settings/federation'),
    setFederationSettings: (c: ApiConfig, opts: { enabled?: boolean; policy?: string }) =>
        apiCall<FederationSettingsResponse>(c, '/admin/settings/federation', 'POST', opts),
    federationRules: (c: ApiConfig) =>
        apiCall<FederationRulesResponse>(c, '/admin/federation/rules'),
    addFederationRule: (c: ApiConfig, domain: string) =>
        apiCall(c, '/admin/federation/rules', 'POST', { domain }),
    deleteFederationRule: (c: ApiConfig, domain: string) =>
        apiCall(c, '/admin/federation/rules', 'DELETE', { domain }),
    federationServers: (c: ApiConfig) =>
        apiCall<FederationServersResponse>(c, '/admin/federation/servers'),
};

export interface OverviewFetchResult {
    data?: OverviewResponse;
    error?: string;
    status: number;
    version?: string;
}

/**
 * Load dashboard overview. Uses `GET /admin/overview` when available (one request);
 * otherwise composes legacy endpoints in parallel (backward compatible).
 */
export async function fetchOverview(config: ApiConfig): Promise<OverviewFetchResult> {
    const res = await api.overview(config);
    if (!res.error && res.data) {
        return { data: res.data, status: res.status, version: res.version };
    }
    const missing =
        res.status === 404 ||
        (res.error?.includes('unknown resource') ?? false);
    if (!missing) {
        return { error: res.error, status: res.status, version: res.version };
    }

    const [statusRes, storageRes, tokensRes, settingsRes] = await Promise.all([
        api.status(config),
        api.storage(config),
        api.registrationTokens(config),
        api.settings(config),
    ]);
    if (statusRes.error) {
        return { error: statusRes.error, status: statusRes.status, version: statusRes.version };
    }
    if (storageRes.error) {
        return { error: storageRes.error, status: storageRes.status, version: storageRes.version };
    }
    if (tokensRes.error) {
        return { error: tokensRes.error, status: tokensRes.status, version: tokensRes.version };
    }
    const status = statusRes.data!;
    const disk = storageRes.data?.disk ?? {
        total_bytes: 0,
        used_bytes: 0,
        available_bytes: 0,
        percent_used: 0,
    };
    const overview: OverviewResponse = {
        version: status.version,
        users: status.users,
        uptime: status.uptime,
        disk,
        tokens: { total: tokensRes.data?.total ?? 0 },
        sent_messages: status.sent_messages,
        outbound_messages: status.outbound_messages,
        received_messages: status.received_messages,
        imap: status.imap,
        turn: status.turn,
        shadowsocks: status.shadowsocks,
        email_servers: status.email_servers,
        federation_traffic: status.federation_traffic,
        message_retention: status.message_retention,
        settings: settingsRes.data,
    };
    return {
        data: overview,
        status: 200,
        version:
            statusRes.version ??
            storageRes.version ??
            tokensRes.version ??
            settingsRes.version,
    };
}

