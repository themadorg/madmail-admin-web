/**
 * Admin-only user tags stored in browser localStorage.
 *
 * Never send these values to the Madmail admin API — they exist only on this device
 * so operators can label accounts without storing PII on the server.
 *
 * Tags are keyed by hostname, not origin. Changing the admin API port or scheme
 * keeps the same bucket. Older entries keyed by origin are folded in on read.
 */

export const STORAGE_KEY = 'madmail_user_tags';

/** Max characters per tag (after trim). */
export const MAX_TAG_LENGTH = 64;

/** Max tags per user. */
export const MAX_TAGS_PER_USER = 10;

/** Full store: serverKey → username → tags */
export type UserTagsStore = Record<string, Record<string, string[]>>;

/** In-memory tags for one server: username → tags */
export type ServerTagMap = Record<string, string[]>;

/**
 * Stable id for a server connection. Hostname only, so a port or scheme
 * change does not hide tags saved against the previous admin URL.
 */
export function serverKeyFromBaseUrl(baseUrl: string): string {
    return canonicalServerKey(baseUrl);
}

export function canonicalServerKey(serverKey: string): string {
    const raw = (serverKey || '').trim();
    if (!raw) return 'default';
    try {
        const u = new URL(raw.includes('://') ? raw : `https://${raw}`);
        return (u.hostname || raw).toLowerCase();
    } catch {
        return raw.toLowerCase();
    }
}

export function normalizeUsername(username: string): string {
    return username.trim().toLowerCase();
}

export function normalizeTag(tag: string): string {
    return tag.trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH);
}

function readStore(): UserTagsStore {
    if (typeof localStorage === 'undefined') return {};
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return parsed as UserTagsStore;
    } catch {
        return {};
    }
}

function writeStore(store: UserTagsStore): void {
    if (typeof localStorage === 'undefined') return;
    try {
        if (Object.keys(store).length === 0) {
            localStorage.removeItem(STORAGE_KEY);
            return;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
        // Quota or private mode — ignore
    }
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((t) => typeof t === 'string');
}

function copyBucket(bucket: unknown): ServerTagMap {
    if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) return {};
    const out: ServerTagMap = {};
    for (const [user, tags] of Object.entries(bucket as Record<string, unknown>)) {
        const u = normalizeUsername(user);
        if (!u || !isStringArray(tags)) continue;
        const cleaned = tags.map((t) => normalizeTag(t)).filter(Boolean);
        if (cleaned.length === 0) continue;
        out[u] = mergeTagLists(out[u], cleaned);
    }
    return out;
}

function mergeTagLists(current: string[] | undefined, extra: string[]): string[] {
    const dest = current ? [...current] : [];
    const seen = new Set(dest.map((t) => t.toLowerCase()));
    for (const tag of extra) {
        const key = tag.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        dest.push(tag);
        if (dest.length >= MAX_TAGS_PER_USER) break;
    }
    return dest;
}

/** Origin-shaped keys from the first version of this store (`https://host:port`). */
function legacyHostname(key: string): string | null {
    if (!key.includes('://')) return null;
    try {
        return new URL(key).hostname.toLowerCase() || null;
    } catch {
        return null;
    }
}

/**
 * Move tags saved under `https://host` / `https://host:port` onto the hostname key.
 * Returns true when the store object was changed.
 */
function foldLegacyKeys(store: UserTagsStore, sk: string): boolean {
    if (!sk || sk === 'default') return false;
    const merged = copyBucket(store[sk]);
    let changed = false;
    for (const key of Object.keys(store)) {
        if (legacyHostname(key) !== sk) continue;
        const extra = copyBucket(store[key]);
        for (const [user, tags] of Object.entries(extra)) {
            merged[user] = mergeTagLists(merged[user], tags);
        }
        delete store[key];
        changed = true;
    }
    if (!changed) return false;
    if (Object.keys(merged).length === 0) delete store[sk];
    else store[sk] = merged;
    return true;
}

function prepare(serverKey: string): { store: UserTagsStore; sk: string; migrated: boolean } {
    const sk = canonicalServerKey(serverKey);
    const store = readStore();
    const migrated = foldLegacyKeys(store, sk);
    return { store, sk, migrated };
}

/** Tags for one server, read and parsed once. Folds legacy origin keys when needed. */
export function loadServerTags(serverKey: string): ServerTagMap {
    const { store, sk, migrated } = prepare(serverKey);
    if (migrated) writeStore(store);
    return copyBucket(store[sk]);
}

export function tagsForUser(tags: ServerTagMap, username: string): string[] {
    const u = normalizeUsername(username);
    if (!u) return [];
    const list = tags[u];
    return Array.isArray(list) ? [...list] : [];
}

export function getTags(serverKey: string, username: string): string[] {
    return tagsForUser(loadServerTags(serverKey), username);
}

export function setTags(serverKey: string, username: string, tags: string[]): void {
    const u = normalizeUsername(username);
    if (!u) return;
    const { store, sk } = prepare(serverKey);

    const cleaned: string[] = [];
    const seen = new Set<string>();
    for (const t of tags) {
        const n = normalizeTag(t);
        if (!n) continue;
        const key = n.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        cleaned.push(n);
        if (cleaned.length >= MAX_TAGS_PER_USER) break;
    }

    if (!store[sk]) store[sk] = {};
    if (cleaned.length === 0) {
        delete store[sk][u];
        if (Object.keys(store[sk]).length === 0) delete store[sk];
    } else {
        store[sk][u] = cleaned;
    }
    writeStore(store);
}

export function addTag(serverKey: string, username: string, tag: string): string[] {
    const n = normalizeTag(tag);
    if (!n) return getTags(serverKey, username);
    const current = getTags(serverKey, username);
    if (current.some((t) => t.toLowerCase() === n.toLowerCase())) {
        return current;
    }
    if (current.length >= MAX_TAGS_PER_USER) return current;
    const next = [...current, n];
    setTags(serverKey, username, next);
    return next;
}

export function removeTag(serverKey: string, username: string, tag: string): string[] {
    const key = tag.trim().toLowerCase();
    const next = getTags(serverKey, username).filter((t) => t.toLowerCase() !== key);
    setTags(serverKey, username, next);
    return next;
}

export function clearUser(serverKey: string, username: string): void {
    setTags(serverKey, username, []);
}

/**
 * Move tags from one server key to another when this connection's URL is rewritten
 * (SMTP hostname replacing an IP, for example).
 * A key that already has tags is left alone.
 * Returns true only when a bucket was moved.
 */
export function migrateServerKey(fromServerKey: string, toServerKey: string): boolean {
    const src = canonicalServerKey(fromServerKey);
    const dst = canonicalServerKey(toServerKey);
    if (src === dst || src === 'default' || dst === 'default') return false;

    const store = readStore();
    const folded = foldLegacyKeys(store, src) || foldLegacyKeys(store, dst);
    const fromBucket = store[src];
    const destHasTags = !!store[dst] && Object.keys(store[dst]).length > 0;
    if (!fromBucket || Object.keys(fromBucket).length === 0 || destHasTags) {
        if (folded) writeStore(store);
        return false;
    }
    store[dst] = fromBucket;
    delete store[src];
    writeStore(store);
    return true;
}

/** Drop every tag stored for this server, including legacy origin keys. */
export function clearServer(serverKey: string): void {
    const { store, sk, migrated } = prepare(serverKey);
    const had = !!store[sk];
    if (had) delete store[sk];
    if (had || migrated) writeStore(store);
}

/**
 * Remove tags whose usernames are not in `usernames`.
 * Returns true when storage changed. No-ops when the bucket is already clean,
 * so callers can run this after every account refresh.
 */
export function pruneAbsentUsers(serverKey: string, usernames: string[]): boolean {
    const { store, sk, migrated } = prepare(serverKey);
    const bucket = store[sk];
    if (!bucket) {
        if (migrated) writeStore(store);
        return migrated;
    }
    const keep = new Set(usernames.map(normalizeUsername).filter(Boolean));
    let changed = migrated;
    for (const user of Object.keys(bucket)) {
        if (keep.has(user)) continue;
        delete bucket[user];
        changed = true;
    }
    if (Object.keys(bucket).length === 0) delete store[sk];
    if (changed) writeStore(store);
    return changed;
}

/** True if any tag for the user contains the query (case-insensitive). */
export function tagsMatchQuery(tags: ServerTagMap, username: string, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return tagsForUser(tags, username).some((t) => t.toLowerCase().includes(q));
}
