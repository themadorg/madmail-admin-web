// Stand-ins for `$lib/*` while bun test loads `state.svelte.ts` directly.

export type SettingBody = {
    key?: string;
    value?: string;
    is_set?: boolean;
    applied?: boolean;
    restart_required?: boolean;
};

export type ApiResult = { data?: SettingBody; error?: string };

type Config = { baseUrl: string; token?: string };

export const handlers: {
    setSetting: (config: Config, key: string, value: string) => Promise<ApiResult>;
    resetSetting: (config: Config) => Promise<ApiResult>;
    reload: (config: Config) => Promise<ApiResult>;
    status: (config: Config) => Promise<ApiResult>;
} = {
    setSetting: async (_config, _key, value) => ({
        data: { key: 'admin_path', value, is_set: true, applied: false, restart_required: true },
    }),
    resetSetting: async () => ({
        data: {
            key: 'admin_path',
            value: '/api/admin',
            is_set: false,
            applied: false,
            restart_required: true,
        },
    }),
    reload: async () => ({ data: { value: 'ok' } }),
    status: async () => ({}),
};

export const api = {
    setSetting: (config: Config, key: string, value: string) => handlers.setSetting(config, key, value),
    resetSetting: (config: Config) => handlers.resetSetting(config),
    reload: (config: Config) => handlers.reload(config),
    status: (config: Config) => handlers.status(config),
};

export async function fetchOverview() {
    return {};
}
export function devProxyEnabled() {
    return false;
}
export function isLoopbackMadmailApiUrl(_url: string) {
    return false;
}
export function viteDevAdminApiUrl() {
    return 'http://localhost:5173/api/admin';
}
export function isEmbeddedAdminShell(_baseUrl: string) {
    return false;
}
export function isViteDevShell() {
    return false;
}
export const serverCapabilities = { reset() {} };
export function t(key: string) {
    return key;
}
export function compareVersions() {
    return 0;
}
export function applySettingsToAdminBaseUrl(url: string) {
    return url;
}
export function isUnderAdminWebPath() {
    return false;
}
export function normalizeAdminWebPath(path: string) {
    return path;
}
export function saveServer() {
    return Promise.resolve();
}
export function getPageRefreshLoaders() {
    return [];
}
export function normalizeRoutePath(path: string) {
    return path;
}
