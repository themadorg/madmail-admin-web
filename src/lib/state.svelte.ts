// Shared reactive state for the admin dashboard.
// Uses a singleton object with $state fields so it can be exported from a module.

import {
    api,
    type ApiConfig,
    type StatusResponse,
    type StorageResponse,
    type AllSettings,
    type AccountList,
    type QuotaStats,
    type SettingValue,
    type BlocklistResponse,
    type DnsListResponse,
    type ExchangerListResponse,
    type RegistrationTokenListResponse,
    type CreateAccountResponse,
    type FederationSettingsResponse,
    type FederationRulesResponse,
    type FederationServersResponse,
} from '$lib/api';
import { t } from '$lib/i18n';
import { applySettingsToAdminBaseUrl } from '$lib/adminUrl';
import { saveServer } from '$lib/servers';

/** Map admin toggle API paths to i18n keys for toast labels */
const TOGGLE_RESOURCE_I18N: Record<string, string> = {
    '/admin/registration': 'svc.registration',
    '/admin/registration/jit': 'svc.jit_registration',
    '/admin/services/turn': 'svc.turn',
    '/admin/services/iroh': 'svc.iroh',
    '/admin/services/admin_web': 'svc.admin_web',
    '/admin/services/auto_purge_seen': 'svc.auto_purge_seen',
    '/admin/services/webimap': 'svc.webimap',
    '/admin/services/websmtp': 'svc.websmtp',
    '/admin/services/shadowsocks': 'svc.shadowsocks',
    '/admin/services/ss_ws': 'proxy.ws',
    '/admin/services/ss_grpc': 'proxy.grpc',
    '/admin/services/http_proxy': 'proxy.http_proxy',
};

function toggleResourceLabel(resource: string): string {
    const key = TOGGLE_RESOURCE_I18N[resource];
    return key ? t(key) : (resource.split('/').pop() ?? resource);
}

function toggleStatusLabel(status: string | undefined): string {
    if (!status) return '';
    if (status === 'enabled' || status === 'disabled') {
        return t(status === 'enabled' ? 'proxy.enabled' : 'proxy.disabled');
    }
    if (status === 'open' || status === 'closed') {
        return t(status === 'open' ? 'svc.toggle_open' : 'svc.toggle_closed');
    }
    return status;
}

const PURGE_CONFIRM_KEYS: Record<string, string> = {
    purge_read: 'queue.confirm_queue_purge_read',
    purge_all: 'queue.confirm_queue_purge_all',
    purge_read_blobs: 'queue.confirm_queue_purge_blobs',
};

const PURGE_NOTIFY_KEYS: Record<string, string> = {
    purge_read: 'queue.purge_notify_read',
    purge_all: 'queue.purge_notify_all',
    purge_read_blobs: 'queue.purge_notify_blobs',
};

// --- Initialization ---
let savedUrl = '';
let savedToken = '';
if (typeof localStorage !== 'undefined') {
    savedUrl = localStorage.getItem('madmail_url') ?? '';
    savedToken = localStorage.getItem('madmail_token') ?? '';
    try {
        if (savedUrl && !new URL(savedUrl).pathname.replace(/\/+$/, '')) {
            savedUrl = savedUrl.replace(/\/+$/, '') + '/api/admin';
            localStorage.setItem('madmail_url', savedUrl);
        }
    } catch { /* invalid URL */ }
}

// --- Singleton reactive store ---
class AdminState {
    // Connection
    baseUrl = $state(savedUrl);
    token = $state(savedToken);
    connected = $state(false);
    connectError = $state('');
    connecting = $state(false);
    serverVersion = $state('');
    latestServerVersion = $state('');
    checkingUpdates = $state(false);

    // Data
    status = $state<StatusResponse | null>(null);
    storage = $state<StorageResponse | null>(null);
    settings = $state<AllSettings | null>(null);
    accounts = $state<AccountList | null>(null);
    quota = $state<QuotaStats | null>(null);
    blocklist = $state<BlocklistResponse | null>(null);
    endpointOverrides = $state<DnsListResponse | null>(null);
    exchangers = $state<ExchangerListResponse | null>(null);
    registrationTokens = $state<RegistrationTokenListResponse | null>(null);
    federationSettings = $state<FederationSettingsResponse | null>(null);
    federationRules = $state<FederationRulesResponse | null>(null);
    federationServers = $state<FederationServersResponse | null>(null);

    // UI
    toast = $state('');
    toastType = $state<'ok' | 'err'>('ok');
    pendingRestart = $state(false);
    reloading = $state(false);
    editingField = $state('');
    editValue = $state('');
    refreshing = $state(false);
    busy = $state(false);
    confirmingDelete = $state('');
    newAccount = $state<CreateAccountResponse | null>(null);

    // Derived
    get shadowsocksUrl(): string {
        if (!this.settings || this.settings.ss_enabled !== 'enabled') return '';

        const getVal = (key: string, fallback: string) => {
            if (this.editingField === key) return this.editValue;
            return this.setting(key).value || fallback;
        };

        const cipher = getVal('ss_cipher', 'chacha20-ietf-poly1305');
        const password = getVal('ss_password', '');
        const port = getVal('ss_port', '8388');

        if (!password) return '';

        try {
            const url = new URL(this.baseUrl);
            const userinfo = `${cipher}:${password}`;
            const auth = btoa(userinfo).replace(/=+$/, '');
            const tag = encodeURIComponent(url.hostname);
            // Plain SS URL (raw TCP) — compatible with Delta Chat.
            // gRPC transport is available on port+1 for v2ray-plugin clients.
            return `ss://${auth}@${url.hostname}:${port}#${tag}`;
        } catch {
            return '';
        }
    }

    // --- Helpers ---
    cfg(): ApiConfig {
        return { baseUrl: this.baseUrl, token: this.token };
    }

    notify(msg: string, type: 'ok' | 'err' = 'ok') {
        this.toast = msg;
        this.toastType = type;
        setTimeout(() => { this.toast = ''; }, 3000);
    }

    setting(key: string): SettingValue {
        if (!this.settings) return { key, value: '', is_set: false };
        return (this.settings as Record<string, any>)[key] ?? { key, value: '', is_set: false };
    }

    fmtBytes(b: number): string {
        if (!b || isNaN(b)) return '0 B';
        if (b < 1024) return `${b} B`;
        if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
        if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
        return `${(b / 1073741824).toFixed(1)} GB`;
    }

    /**
     * Compares two semantic versions.
     * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
     */
    compareVersions(v1: string, v2: string): number {
        const parse = (v: string) => (v || '').replace(/^v/, '').split('+')[0].split('.').map(Number);
        const p1 = parse(v1);
        const p2 = parse(v2);
        for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
            const n1 = p1[i] || 0;
            const n2 = p2[i] || 0;
            if (n1 > n2) return 1;
            if (n2 > n1) return -1;
        }
        return 0;
    }

    get hasUpdate(): boolean {
        if (!this.latestServerVersion) return false;
        const current = this.status?.version ?? this.serverVersion;
        if (!current) return false;
        return this.compareVersions(current, this.latestServerVersion) < 0;
    }

    // --- API actions ---
    /**
     * If the DB override for admin_web_path does not match the current browser path,
     * navigate to the configured path (e.g. after a CLI change) so the SPA keeps working.
     */
    /**
     * Keep the stored admin API base URL in sync with server-side overrides
     * (hostname, https/http port, admin path) so the bar matches madmail admin-token.
     */
    syncConnectionBaseUrlWithSettings() {
        if (!this.connected || !this.settings || !this.baseUrl) {
            return;
        }
        const next = applySettingsToAdminBaseUrl(this.baseUrl, this.settings);
        if (next === this.baseUrl) {
            return;
        }
        this.baseUrl = next;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('madmail_url', next);
        }
        saveServer(next, this.token).catch(() => { });
    }

    syncAdminWebPathFromSettings() {
        if (typeof window === 'undefined' || !this.settings) {
            return;
        }
        const s = this.settings.admin_web_path;
        if (!s.is_set || !s.value?.trim()) {
            return;
        }
        const raw = s.value.trim();
        const want =
            (raw.startsWith('/') ? raw : `/${raw}`).replace(/\/+$/, '') || '/';
        const cur =
            window.location.pathname.replace(/\/+$/, '') || '/';
        if (want === cur) {
            return;
        }
        const u = new URL(want + '/', window.location.origin);
        u.search = window.location.search;
        u.hash = window.location.hash;
        window.location.replace(u.toString());
    }

    async connect() {
        if (!this.baseUrl || !this.token || this.connecting) return;
        this.connecting = true;
        this.connectError = '';
        const res = await api.status(this.cfg());
        this.connecting = false;
        if (res.error) { this.connectError = res.error; return; }
        localStorage.setItem('madmail_url', this.baseUrl);
        localStorage.setItem('madmail_token', this.token);
        // Save to IndexedDB for multi-server support
        saveServer(this.baseUrl, this.token).catch(() => { });
        this.connected = true;
        if (res.data) this.status = res.data;
        if ((res as any).version) this.serverVersion = (res as any).version;
        this.refresh();
    }

    async refresh() {
        if (this.refreshing) return;
        this.refreshing = true;
        try {
            // Fetch everything in parallel but update state as soon as each resolves.
            // This makes the dashboard feel much faster as results pop in.
            await Promise.all([
                api.storage(this.cfg()).then(res => { if (res.data) this.storage = res.data; if (res.version) this.serverVersion = res.version; }),
                api.settings(this.cfg()).then(res => { if (res.data) this.settings = res.data; if (res.version) this.serverVersion = res.version; }),
                api.accounts(this.cfg()).then(res => { if (res.data) this.accounts = res.data; if (res.version) this.serverVersion = res.version; }),
                api.quota(this.cfg()).then(res => { if (res.data) this.quota = res.data; if (res.version) this.serverVersion = res.version; }),
                api.status(this.cfg()).then(res => { if (res.data) this.status = res.data; if (res.version) this.serverVersion = res.version; }),
                api.blocklist(this.cfg()).then(res => { if (res.data) this.blocklist = res.data; if (res.version) this.serverVersion = res.version; }),
                api.dns(this.cfg()).then(res => { if (res.data) this.endpointOverrides = res.data; if (res.version) this.serverVersion = res.version; }),
                api.exchangers(this.cfg()).then(res => { if (res.data) this.exchangers = res.data; if (res.version) this.serverVersion = res.version; }),
                api.registrationTokens(this.cfg()).then(res => { if (res.data) this.registrationTokens = res.data; if (res.version) this.serverVersion = res.version; }),
                api.federationSettings(this.cfg()).then(res => { if (res.data) this.federationSettings = res.data; }),
                api.federationRules(this.cfg()).then(res => { if (res.data) this.federationRules = res.data; }),
                api.federationServers(this.cfg()).then(res => { if (res.data) this.federationServers = res.data; }),
            ]);
            this.syncConnectionBaseUrlWithSettings();
            this.syncAdminWebPathFromSettings();
        } finally {
            this.refreshing = false;
        }
    }

    disconnect() {
        this.connected = false;
        localStorage.removeItem('madmail_url');
        localStorage.removeItem('madmail_token');
        this.baseUrl = '';
        this.token = '';
        this.status = this.storage = this.settings = this.accounts = this.quota = this.blocklist = this.endpointOverrides = this.exchangers = this.registrationTokens = null;
        this.federationSettings = this.federationRules = this.federationServers = null;
        this.newAccount = null;
    }

    async toggleService(resource: string, current: string) {
        if (this.busy) return;
        this.busy = true;
        try {
            const isOn = current === 'enabled' || current === 'open';
            const action = isOn
                ? resource === '/admin/registration' ? 'close' : 'disable'
                : resource === '/admin/registration' ? 'open' : 'enable';
            const res = await api.setToggle(this.cfg(), resource, action);
            if (res.error) { this.notify(res.error, 'err'); return; }
            this.notify(
                t('notify.toggle_arrow', {
                    service: toggleResourceLabel(resource),
                    status: toggleStatusLabel(res.data?.status),
                }),
            );
            // Proxy transport toggles require a restart to take effect
            const restartResources = ['/admin/services/shadowsocks', '/admin/services/ss_ws', '/admin/services/ss_grpc', '/admin/services/http_proxy'];
            if (restartResources.includes(resource)) this.pendingRestart = true;
            await this.refresh();
        } finally { this.busy = false; }
    }

    async save(key: string, value: string) {
        if (this.busy) return;
        this.busy = true;
        try {
            const res = await api.setSetting(this.cfg(), key, value);
            if (res.error) { this.notify(res.error, 'err'); return; }
            if (res.data?.restart_required) this.pendingRestart = true;
            this.notify(t('notify.updated', { key }));
            this.editingField = '';
            // If admin_path changed, reload immediately with the new URL
            if (key === 'admin_path' && value) {
                // Send reload on the OLD url (still active until restart)
                await api.reload(this.cfg());
                // Now update our baseUrl to the new path
                const url = new URL(this.baseUrl);
                url.pathname = value;
                this.baseUrl = url.toString().replace(/\/+$/, '');
                localStorage.setItem('madmail_url', this.baseUrl);
                this.pendingRestart = false;
                this.notify(t('action.restarting'));
                // Wait for service to come back on the new path
                setTimeout(async () => {
                    for (let i = 0; i < 10; i++) {
                        await new Promise(r => setTimeout(r, 2000));
                        if ((await api.status(this.cfg())).data) {
                            this.notify(t('notify.online'));
                            await this.refresh();
                            return;
                        }
                    }
                    this.notify(t('notify.restart_pending'), 'err');
                }, 1000);
                return;
            }
            // Admin web UI path: reload config then full navigation (same origin, new path prefix)
            if (key === 'admin_web_path' && value) {
                const v = value.trim();
                const path = (v.startsWith('/') ? v : `/${v}`).replace(/\/+$/, '') || '/';
                await api.reload(this.cfg());
                this.pendingRestart = false;
                this.notify(t('action.restarting'));
                const u = new URL(path + '/', window.location.origin);
                u.search = window.location.search;
                u.hash = window.location.hash;
                window.location.replace(u.toString());
                return;
            }
            // HTTP/HTTPS listener ports: restart immediately so the UI reconnects on the new port
            if ((key === 'http_port' || key === 'https_port') && res.data?.restart_required) {
                this.patchPortSettingAfterSave(key, value);
                this.syncConnectionBaseUrlWithSettings();
                this.pendingRestart = false;
                await this.reload();
                return;
            }
            await this.refresh();
        } finally { this.busy = false; }
    }

    /** Update local settings snapshot so baseUrl can follow the new port before reload. */
    patchPortSettingAfterSave(key: 'http_port' | 'https_port', value: string) {
        if (!this.settings) return;
        if (key === 'https_port') {
            this.settings.https_port = { ...this.settings.https_port, value, is_set: true };
        } else {
            this.settings.http_port = { ...this.settings.http_port, value, is_set: true };
        }
    }

    patchPortSettingAfterReset(
        key: 'http_port' | 'https_port',
        res: Pick<SettingValue, 'key' | 'value' | 'is_set'>,
    ) {
        if (!this.settings) return;
        if (key === 'https_port') {
            this.settings.https_port = { ...this.settings.https_port, value: res.value, is_set: res.is_set };
        } else {
            this.settings.http_port = { ...this.settings.http_port, value: res.value, is_set: res.is_set };
        }
    }

    async reset(key: string) {
        if (this.busy) return;
        this.busy = true;
        try {
            const res = await api.resetSetting(this.cfg(), key);
            if (res.error) { this.notify(res.error, 'err'); return; }
            if (res.data?.restart_required) this.pendingRestart = true;
            this.notify(t('notify.reset', { key }));
            // If admin_path reset, reload immediately with the default URL
            if (key === 'admin_path') {
                await api.reload(this.cfg());
                const url = new URL(this.baseUrl);
                url.pathname = '/api/admin';
                this.baseUrl = url.toString().replace(/\/+$/, '');
                localStorage.setItem('madmail_url', this.baseUrl);
                this.pendingRestart = false;
                this.notify(t('action.restarting'));
                setTimeout(async () => {
                    for (let i = 0; i < 10; i++) {
                        await new Promise(r => setTimeout(r, 2000));
                        if ((await api.status(this.cfg())).data) {
                            this.notify(t('notify.online'));
                            await this.refresh();
                            return;
                        }
                    }
                    this.notify(t('notify.restart_pending'), 'err');
                }, 1000);
                return;
            }
            if (key === 'admin_web_path') {
                await api.reload(this.cfg());
                this.pendingRestart = false;
                this.notify(t('action.restarting'));
                const u = new URL('/admin/', window.location.origin);
                u.search = window.location.search;
                u.hash = window.location.hash;
                window.location.replace(u.toString());
                return;
            }
            if (
                (key === 'http_port' || key === 'https_port') &&
                res.data?.restart_required
            ) {
                this.patchPortSettingAfterReset(
                    key,
                    {
                        key: res.data.key,
                        value: res.data.value,
                        is_set: res.data.is_set,
                    },
                );
                this.syncConnectionBaseUrlWithSettings();
                this.pendingRestart = false;
                await this.reload();
                return;
            }
            await this.refresh();
        } finally { this.busy = false; }
    }

    async reload() {
        this.reloading = true;
        const res = await api.reload(this.cfg());
        this.reloading = false;
        if (res.error) { this.notify(res.error, 'err'); return; }
        this.pendingRestart = false;
        this.notify(t('action.restarting'));
        setTimeout(async () => {
            for (let i = 0; i < 10; i++) {
                await new Promise(r => setTimeout(r, 2000));
                if ((await api.status(this.cfg())).data) {
                    this.notify(t('notify.online'));
                    await this.refresh();
                    return;
                }
            }
            this.notify(t('notify.restart_pending'), 'err');
        }, 1000);
    }

    async togglePortAccess(localOnlySettingKey: string, currentAccess: string) {
        if (this.busy) return;
        this.busy = true;
        try {
            if (currentAccess === 'public') {
                // Make local-only
                await api.setSetting(this.cfg(), localOnlySettingKey, 'true');
            } else {
                // Make public
                await api.resetSetting(this.cfg(), localOnlySettingKey);
            }
            this.pendingRestart = true;
            await this.refresh();
        } finally { this.busy = false; }
    }

    requestDelete(u: string) {
        this.confirmingDelete = this.confirmingDelete === u ? '' : u;
    }

    cancelDelete() {
        this.confirmingDelete = '';
    }

    async confirmDelete(u: string) {
        if (this.busy) return;
        this.busy = true;
        this.confirmingDelete = '';
        try {
            const res = await api.deleteAccount(this.cfg(), u);
            if (res.error) { this.notify(res.error, 'err'); return; }
            this.notify(t('notify.deleted', { username: u }));
            await this.refresh();
        } finally { this.busy = false; }
    }

    async createAccount() {
        if (this.busy) return;
        this.busy = true;
        this.newAccount = null;
        try {
            const res = await api.createAccount(this.cfg());
            if (res.error) { this.notify(res.error, 'err'); return; }
            if (res.data) {
                this.newAccount = res.data;
                this.notify(t('notify.account_created', { email: res.data.email }));
                await this.refresh();
            }
        } finally { this.busy = false; }
    }

    dismissNewAccount() {
        this.newAccount = null;
    }

    async setDefaultQuota(maxBytes: number) {
        if (this.busy) return;
        this.busy = true;
        try {
            const res = await api.setDefaultQuota(this.cfg(), maxBytes);
            if (res.error) { this.notify(res.error, 'err'); return; }
            this.notify(t('notify.quota_updated'));
            await this.refresh();
        } finally { this.busy = false; }
    }

    async setUserQuota(username: string, maxBytes: number) {
        if (this.busy) return;
        this.busy = true;
        try {
            const res = await api.setUserQuota(this.cfg(), username, maxBytes);
            if (res.error) { this.notify(res.error, 'err'); return; }
            this.notify(t('notify.quota_updated'));
            await this.refresh();
        } finally { this.busy = false; }
    }

    async resetUserQuota(username: string) {
        if (this.busy) return;
        this.busy = true;
        try {
            const res = await api.resetUserQuota(this.cfg(), username);
            if (res.error) { this.notify(res.error, 'err'); return; }
            this.notify(t('notify.quota_reset'));
            await this.refresh();
        } finally { this.busy = false; }
    }

    async exportAccounts() {
        if (this.busy) return;
        this.busy = true;
        try {
            const res = await api.exportAccounts(this.cfg());
            if (res.error) { this.notify(res.error, 'err'); return; }
            if (res.data) {
                const blob = new Blob([JSON.stringify(res.data.users, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `madmail-accounts-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                this.notify(t('notify.export_done', { count: String(res.data.total) }));
            }
        } catch (e) {
            this.notify(t('notify.export_failed', { error: String(e) }), 'err');
        } finally { this.busy = false; }
    }

    async importAccounts(file: File) {
        if (this.busy) return;
        this.busy = true;
        try {
            const text = await file.text();
            const users = JSON.parse(text);
            const res = await api.importAccounts(this.cfg(), users);
            if (res.error) { this.notify(res.error, 'err'); return; }
            this.notify(
                t('notify.import_done', {
                    imported: String(res.data?.imported ?? 0),
                    skipped: String(res.data?.skipped ?? 0),
                }),
            );
            await this.refresh();
        } catch (e) {
            this.notify(t('notify.import_failed', { error: String(e) }), 'err');
        } finally { this.busy = false; }
    }

    async deleteAllAccounts() {
        if (!confirm(t('confirm.delete_all_accounts'))) return;
        if (this.busy) return;
        this.busy = true;
        try {
            const res = await api.deleteAllAccounts(this.cfg());
            if (res.error) { this.notify(res.error, 'err'); return; }
            this.notify(t('notify.delete_all_done', { count: String(res.data?.deleted ?? 0) }));
            await this.refresh();
        } finally { this.busy = false; }
    }

    async unblockUser(u: string) {
        if (this.busy) return;
        this.busy = true;
        try {
            const res = await api.unblockUser(this.cfg(), u);
            if (res.error) { this.notify(res.error, 'err'); return; }
            this.notify(t('notify.unblocked', { username: u }));
            await this.refresh();
        } finally { this.busy = false; }
    }

    async unblockAllAccounts() {
        if (!confirm(t('confirm.unblock_all'))) return;
        if (this.busy) return;
        this.busy = true;
        try {
            const res = await api.unblockAll(this.cfg());
            if (res.error) { this.notify(res.error, 'err'); return; }
            this.notify(t('notify.unblock_all_done', { count: String(res.data?.unblocked ?? 0) }));
            await this.refresh();
        } finally { this.busy = false; }
    }

    async purge(action: string) {
        if (this.busy) return;
        const ckey = PURGE_CONFIRM_KEYS[action];
        if (!confirm(ckey ? t(ckey) : `${action}?`)) return;
        this.busy = true;
        try {
            const res = await api.purgeQueue(this.cfg(), action);
            if (res.error) { this.notify(res.error, 'err'); return; }
            const nk = PURGE_NOTIFY_KEYS[action];
            this.notify(
                t('notify.purge_done', {
                    action: nk ? t(nk) : action,
                }),
            );
        } finally { this.busy = false; }
    }

    startEdit(key: string, current: string) {
        this.editingField = key;
        this.editValue = current;
    }

    async addEndpointOverride(lookupKey: string, targetHost: string, comment?: string) {
        if (this.busy) return;
        this.busy = true;
        try {
            const res = await api.addDns(this.cfg(), lookupKey, targetHost, comment);
            if (res.error) { this.notify(res.error, 'err'); return; }
            this.notify(t('notify.endpoint_added', { key: lookupKey }));
            await this.refresh();
        } finally { this.busy = false; }
    }

    async deleteEndpointOverride(lookupKey: string) {
        if (this.busy) return;
        this.busy = true;
        try {
            const res = await api.deleteDns(this.cfg(), lookupKey);
            if (res.error) { this.notify(res.error, 'err'); return; }
            this.notify(t('notify.endpoint_deleted', { key: lookupKey }));
            await this.refresh();
        } finally { this.busy = false; }
    }

    async addExchanger(name: string, url: string, pollInterval: number) {
        if (this.busy) return;
        this.busy = true;
        try {
            const res = await api.addExchanger(this.cfg(), name, url, pollInterval);
            if (res.error) { this.notify(res.error, 'err'); return; }
            this.notify(t('notify.exchanger_added', { name }));
            await this.refresh();
        } finally { this.busy = false; }
    }

    async updateExchanger(name: string, updates: { enabled?: boolean; url?: string; poll_interval?: number }) {
        if (this.busy) return;
        this.busy = true;
        try {
            const res = await api.updateExchanger(this.cfg(), name, updates);
            if (res.error) { this.notify(res.error, 'err'); return; }
            if (updates.enabled !== undefined) {
                this.notify(
                    updates.enabled
                        ? t('notify.exchanger_enabled', { name })
                        : t('notify.exchanger_disabled', { name }),
                );
            } else {
                this.notify(t('notify.exchanger_updated', { name }));
            }
            await this.refresh();
        } finally { this.busy = false; }
    }

    async deleteExchanger(name: string) {
        if (this.busy) return;
        this.busy = true;
        try {
            const res = await api.deleteExchanger(this.cfg(), name);
            if (res.error) { this.notify(res.error, 'err'); return; }
            this.notify(t('notify.exchanger_deleted', { name }));
            await this.refresh();
        } finally { this.busy = false; }
    }

    async createRegistrationToken(opts: { token?: string; max_uses?: number; comment?: string; expires_in?: string }) {
        if (this.busy) return;
        this.busy = true;
        try {
            const res = await api.createRegistrationToken(this.cfg(), opts);
            if (res.error) { this.notify(res.error, 'err'); return; }
            this.notify(t('notify.token_created'));
            await this.refresh();
        } finally { this.busy = false; }
    }

    async deleteRegistrationToken(token: string) {
        if (this.busy) return;
        this.busy = true;
        try {
            const res = await api.deleteRegistrationToken(this.cfg(), token);
            if (res.error) { this.notify(res.error, 'err'); return; }
            this.notify(t('notify.token_deleted'));
            await this.refresh();
        } finally { this.busy = false; }
    }

    async toggleAutoPurgeSeen() {
        if (this.busy) return;
        this.busy = true;
        try {
            const current = this.settings?.auto_purge_seen_enabled ?? 'disabled';
            const action = current === 'enabled' ? 'disable' : 'enable';
            const res = await api.setToggle(this.cfg(), '/admin/services/auto_purge_seen', action);
            if (res.error) { this.notify(res.error, 'err'); return; }
            this.notify(
                action === 'enable' ? t('notify.auto_purge_enabled') : t('notify.auto_purge_disabled'),
            );
            await this.refresh();
        } finally { this.busy = false; }
    }

    async toggleTokenRequired() {
        if (this.busy) return;
        this.busy = true;
        try {
            const current = this.settings?.registration_token_required ?? 'disabled';
            const action = current === 'enabled' ? 'disable' : 'enable';
            const res = await api.setToggle(this.cfg(), '/admin/settings/registration_token_required', action);
            if (res.error) { this.notify(res.error, 'err'); return; }
            this.notify(
                action === 'enable' ? t('notify.reg_tokens_required_on') : t('notify.reg_tokens_required_off'),
            );
            await this.refresh();
        } finally { this.busy = false; }
    }

    async checkServerUpdate() {
        if (this.checkingUpdates) return;
        this.checkingUpdates = true;
        try {
            const res = await fetch('https://api.github.com/repos/themadorg/madmail/releases/latest');
            if (res.ok) {
                const data = await res.json();
                this.latestServerVersion = data.tag_name;
                // If the version is different, show a notification
                if (this.hasUpdate) {
                    this.notify(t('notify.update_available_short', { version: data.tag_name }), 'ok');
                } else {
                    this.notify(t('notify.already_latest', { version: data.tag_name }));
                }
            } else {
                throw new Error(t('notify.github_unreachable'));
            }
        } catch (e) {
            this.notify(t('notify.update_check_failed', { error: String(e) }), 'err');
        } finally {
            this.checkingUpdates = false;
        }
    }

    // --- Federation ---
    async setFederationPolicy(policy: string) {
        if (this.busy) return;
        this.busy = true;
        try {
            const res = await api.setFederationSettings(this.cfg(), { policy });
            if (res.error) { this.notify(res.error, 'err'); return; }
            this.notify(t('notify.federation_policy', { policy }));
            await this.refresh();
        } finally { this.busy = false; }
    }

    async toggleFederationEnabled() {
        if (this.busy) return;
        this.busy = true;
        try {
            const enabled = !(this.federationSettings?.enabled ?? false);
            const res = await api.setFederationSettings(this.cfg(), { enabled });
            if (res.error) { this.notify(res.error, 'err'); return; }
            this.notify(enabled ? t('notify.federation_on') : t('notify.federation_off'));
            await this.refresh();
        } finally { this.busy = false; }
    }

    async addFederationRule(domain: string) {
        if (this.busy) return;
        this.busy = true;
        try {
            const res = await api.addFederationRule(this.cfg(), domain);
            if (res.error) { this.notify(res.error, 'err'); return; }
            this.notify(t('notify.fed_rule_added', { domain }));
            await this.refresh();
        } finally { this.busy = false; }
    }

    async deleteFederationRule(domain: string) {
        if (this.busy) return;
        this.busy = true;
        try {
            const res = await api.deleteFederationRule(this.cfg(), domain);
            if (res.error) { this.notify(res.error, 'err'); return; }
            this.notify(t('notify.fed_rule_removed', { domain }));
            await this.refresh();
        } finally { this.busy = false; }
    }
}

export const store = new AdminState();
