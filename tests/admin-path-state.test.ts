// Exercises AdminState.save / reset / reload with a mocked API.
// bun test --preload ./tests/strip-svelte-state.ts ./tests/admin-path-state.test.ts
import './strip-svelte-state.ts';
import { beforeEach, expect, test } from 'bun:test';
import { handlers, type ApiResult } from './stubs/deps.ts';

if (typeof globalThis.localStorage === 'undefined') {
    const mem = new Map<string, string>();
    globalThis.localStorage = {
        getItem: (key) => mem.get(key) ?? null,
        setItem: (key, value) => {
            mem.set(key, value);
        },
        removeItem: (key) => {
            mem.delete(key);
        },
        clear: () => mem.clear(),
        key: () => null,
        length: 0,
    };
}

type Call = { fn: string; baseUrl: string; token: string };

const calls: Call[] = [];

function record(fn: string, config: { baseUrl: string; token?: string }) {
    calls.push({ fn, baseUrl: config.baseUrl, token: config.token ?? '' });
}

const { store } = await import('../src/lib/state.svelte.ts');

const current = 'https://mail.example/api/admin';
const moved = 'https://mail.example/api/new';

function immediateTimers() {
    const original = globalThis.setTimeout;
    globalThis.setTimeout = ((fn: TimerHandler) => {
        if (typeof fn === 'function') fn();
        return 0;
    }) as typeof setTimeout;
    return () => {
        globalThis.setTimeout = original;
    };
}

async function flush() {
    for (let i = 0; i < 40; i++) await Promise.resolve();
}

function resetHandlers() {
    handlers.setSetting = async (_config, _key, value) => ({
        data: {
            key: 'admin_path',
            value,
            is_set: true,
            applied: false,
            restart_required: true,
        },
    });
    handlers.resetSetting = async () => ({
        data: {
            key: 'admin_path',
            value: '/api/admin',
            is_set: false,
            applied: false,
            restart_required: true,
        },
    });
    handlers.reload = async (config) => {
        record('reload', config);
        return { data: { value: 'ok' } };
    };
    handlers.status = async (config) => {
        record('status', config);
        return {};
    };
}

beforeEach(() => {
    calls.length = 0;
    resetHandlers();
    store.baseUrl = current;
    store.token = 'token';
    store.pendingAdminUrl = '';
    store.pendingRestart = false;
    store.busy = false;
    store.reloading = false;
    store.connected = false;
    store.connecting = false;
    store.toast = '';
    localStorage.removeItem('madmail_url');
    localStorage.removeItem('madmail_token');
});

test('save keeps the live URL and reload polls the saved path ten times', async () => {
    const restore = immediateTimers();
    try {
        await store.save('admin_path', '/api/new');
        expect(store.baseUrl).toBe(current);
        expect(store.pendingAdminUrl).toBe(moved);
        expect(store.pendingRestart).toBe(true);

        await store.reload();
        await flush();

        const polls = calls.filter((call) => call.fn === 'status');
        expect(polls).toHaveLength(10);
        expect(polls.every((call) => call.baseUrl === moved)).toBe(true);
        expect(calls.find((call) => call.fn === 'reload')?.baseUrl).toBe(current);
        expect(store.baseUrl).toBe(current);
        expect(store.pendingRestart).toBe(true);
    } finally {
        restore();
    }
});

test('restart_required without applied does not switch or clear the restart flag', async () => {
    handlers.setSetting = async (_config, _key, value) => ({
        data: { key: 'admin_path', value, is_set: true, restart_required: true },
    });
    await store.save('admin_path', '/api/new');
    expect(store.baseUrl).toBe(current);
    expect(store.pendingAdminUrl).toBe(moved);
    expect(store.pendingRestart).toBe(true);
});

test('a response with no applied field is not treated as success', async () => {
    handlers.setSetting = async (_config, _key, value): Promise<ApiResult> => ({
        data: { key: 'admin_path', value, is_set: true },
    });
    await store.save('admin_path', '/api/new');
    expect(store.baseUrl).toBe(current);
    expect(store.pendingAdminUrl).toBe(moved);
    expect(store.pendingRestart).toBe(true);
});

test('reset with applied false remembers the default path', async () => {
    store.baseUrl = moved;
    await store.reset('admin_path');
    expect(store.baseUrl).toBe(moved);
    expect(store.pendingAdminUrl).toBe(current);
    expect(store.pendingRestart).toBe(true);
});

test('applied true switches the live URL and clears the restart flag', async () => {
    const restore = immediateTimers();
    try {
        handlers.setSetting = async (_config, _key, value) => ({
            data: {
                key: 'admin_path',
                value,
                is_set: true,
                applied: true,
                restart_required: false,
            },
        });
        await store.save('admin_path', '/api/new');
        await flush();
        expect(store.baseUrl).toBe(moved);
        expect(store.pendingAdminUrl).toBe('');
        expect(store.pendingRestart).toBe(false);
        const polls = calls.filter((call) => call.fn === 'status');
        expect(polls.length).toBeGreaterThan(0);
        expect(polls.every((call) => call.baseUrl === moved)).toBe(true);
    } finally {
        restore();
    }
});

const serverA = 'https://a.example/api/admin';
const serverANext = 'https://a.example/api/new';
const serverB = 'https://b.example/api/admin';
const tokenA = 'token-a';
const tokenB = 'token-b';

async function connectAs(url: string, token: string) {
    store.baseUrl = url;
    store.token = token;
    await store.connect();
    expect(store.connected).toBe(true);
}

test('deferred path on A is not polled with B’s token after disconnect', async () => {
    const restore = immediateTimers();
    try {
        await connectAs(serverA, tokenA);
        await store.save('admin_path', '/api/new');
        expect(store.pendingAdminUrl).toBe(serverANext);

        store.disconnect();
        expect(store.pendingAdminUrl).toBe('');
        expect(store.pendingRestart).toBe(false);

        calls.length = 0;
        await connectAs(serverB, tokenB);
        await store.reload();
        await flush();

        expect(calls.length).toBeGreaterThan(0);
        expect(calls.every((call) => call.token === tokenB)).toBe(true);
        expect(calls.every((call) => call.baseUrl.startsWith('https://b.example'))).toBe(true);
        expect(calls.some((call) => call.fn === 'reload' && call.baseUrl === serverB)).toBe(true);
        expect(store.baseUrl).toBe(serverB);
        expect(store.token).toBe(tokenB);
    } finally {
        restore();
    }
});

test('a status result from A does not update B after the connection changes', async () => {
    const restore = immediateTimers();
    let release: (result: ApiResult) => void = () => {};
    try {
        await connectAs(serverA, tokenA);
        await store.save('admin_path', '/api/new');
        handlers.status = (config) => {
            record('status', config);
            return new Promise((resolve) => {
                release = resolve;
            });
        };

        await store.reload();
        await flush();
        expect(calls.some((call) => call.fn === 'status' && call.baseUrl === serverANext && call.token === tokenA)).toBe(true);

        store.disconnect();
        await connectAs(serverB, tokenB);
        store.toast = 'b-session';
        const callsBefore = calls.length;

        release({ data: { value: 'up' } });
        await flush();

        expect(calls.length).toBe(callsBefore);
        expect(store.baseUrl).toBe(serverB);
        expect(store.token).toBe(tokenB);
        expect(store.pendingAdminUrl).toBe('');
        expect(store.pendingRestart).toBe(false);
        expect(localStorage.getItem('madmail_url')).toBe(serverB);
        expect(store.toast).toBe('b-session');
    } finally {
        restore();
    }
});

test('a late poll commits the URL it probed, not a pending URL saved afterwards', async () => {
    const restore = immediateTimers();
    let release: (result: ApiResult) => void = () => {};
    const unprobed = 'https://mail.example/api/other';
    try {
        store.baseUrl = current;
        store.token = 'token';
        await store.save('admin_path', '/api/new');
        handlers.status = (config) => {
            record('status', config);
            return new Promise((resolve) => {
                release = resolve;
            });
        };

        await store.reload();
        await flush();
        expect(calls.some((call) => call.fn === 'status' && call.baseUrl === moved)).toBe(true);
        store.pendingAdminUrl = unprobed;

        release({ data: { value: 'up' } });
        await flush();

        expect(store.baseUrl).toBe(moved);
        expect(localStorage.getItem('madmail_url')).toBe(moved);
        expect(store.pendingAdminUrl).toBe(unprobed);
        expect(store.baseUrl).not.toBe(unprobed);
    } finally {
        restore();
    }
});

const fromA = '/api/from-a';

function holdApi(action: 'save' | 'reset'): (result: ApiResult) => void {
    let release: (result: ApiResult) => void = () => {};
    const pending = () => new Promise<ApiResult>((resolve) => {
        release = resolve;
    });
    if (action === 'save') handlers.setSetting = pending;
    else handlers.resetSetting = pending;
    return (result) => release(result);
}

async function crossSession(action: 'save' | 'reset', applied: boolean, restartRequired: boolean) {
    const release = holdApi(action);
    await connectAs(serverA, tokenA);
    const request = action === 'save'
        ? store.save('admin_path', fromA)
        : store.reset('admin_path');
    await flush();

    store.disconnect();
    await connectAs(serverB, tokenB);
    store.toast = 'b-session';
    const polls = calls.filter((call) => call.fn === 'status').length;

    release({
        data: {
            key: 'admin_path',
            value: fromA,
            is_set: action === 'save',
            applied,
            restart_required: restartRequired,
        },
    });
    await request;
    await flush();

    expect(store.baseUrl).toBe(serverB);
    expect(store.token).toBe(tokenB);
    expect(store.pendingAdminUrl).toBe('');
    expect(store.pendingRestart).toBe(false);
    expect(localStorage.getItem('madmail_url')).toBe(serverB);
    expect(localStorage.getItem('madmail_token')).toBe(tokenB);
    expect(store.toast).toBe('b-session');
    expect(calls.filter((call) => call.fn === 'status').length).toBe(polls);
}

test('a deferred save from A does not attach its path to B', async () => {
    const restore = immediateTimers();
    try {
        await crossSession('save', false, true);
    } finally {
        restore();
    }
});

test('a confirmed save from A does not switch B', async () => {
    const restore = immediateTimers();
    try {
        await crossSession('save', true, false);
    } finally {
        restore();
    }
});

test('a deferred reset from A does not attach its path to B', async () => {
    const restore = immediateTimers();
    try {
        await crossSession('reset', false, true);
    } finally {
        restore();
    }
});

test('a confirmed reset from A does not switch B', async () => {
    const restore = immediateTimers();
    try {
        await crossSession('reset', true, false);
    } finally {
        restore();
    }
});

test('a stale save cannot clear the busy state of a newer operation', async () => {
    let releaseA: (result: ApiResult) => void = () => {};
    handlers.setSetting = () => new Promise((resolve) => {
        releaseA = resolve;
    });
    await connectAs(serverA, tokenA);
    const saveA = store.save('admin_path', fromA);
    expect(store.busy).toBe(true);

    store.disconnect();
    await connectAs(serverB, tokenB);
    store.toast = 'b-session';

    let releaseB: (result: ApiResult) => void = () => {};
    handlers.setSetting = () => new Promise((resolve) => {
        releaseB = resolve;
    });
    const saveB = store.save('admin_path', '/api/from-b');
    expect(store.busy).toBe(true);

    releaseA({
        data: {
            key: 'admin_path',
            value: fromA,
            is_set: true,
            applied: false,
            restart_required: true,
        },
    });
    await saveA;
    await flush();

    expect(store.busy).toBe(true);
    expect(store.baseUrl).toBe(serverB);
    expect(store.pendingAdminUrl).toBe('');
    expect(store.pendingRestart).toBe(false);
    expect(store.toast).toBe('b-session');

    releaseB({ error: 'stopped' });
    await saveB;
    expect(store.busy).toBe(false);
    expect(store.baseUrl).toBe(serverB);
    expect(store.pendingAdminUrl).toBe('');
});
