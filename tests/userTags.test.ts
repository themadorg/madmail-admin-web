import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  addTag,
  clearServer,
  clearUser,
  getTags,
  migrateServerKey,
  loadServerTags,
  MAX_TAG_LENGTH,
  MAX_TAGS_PER_USER,
  pruneAbsentUsers,
  removeTag,
  serverKeyFromBaseUrl,
  setTags,
  STORAGE_KEY,
  tagsForUser,
  tagsMatchQuery,
} from "../src/lib/userTags.ts";

const mem = new Map<string, string>();
let reads = 0;
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => {
      reads += 1;
      return mem.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      mem.set(key, value);
    },
    removeItem: (key: string) => {
      mem.delete(key);
    },
    clear: () => mem.clear(),
  },
});

beforeEach(() => {
  mem.clear();
  reads = 0;
});

test("server key is the hostname, so a port change keeps tags on that server", () => {
  assert.equal(
    serverKeyFromBaseUrl("https://Admin.Example:443/admin"),
    "admin.example",
  );
  assert.equal(
    serverKeyFromBaseUrl("http://admin.example:8080/api/admin"),
    "admin.example",
  );
  addTag("https://a.example", "Ada@A.Example", "Family");
  addTag("https://a.example:8443", "ada@a.example", "Alex");
  addTag("https://b.example", "ada@a.example", "Other");
  assert.deepEqual(getTags("https://a.example:9443", "ada@a.example"), [
    "Family",
    "Alex",
  ]);
  assert.deepEqual(getTags("https://b.example", "ada@a.example"), ["Other"]);
});

test("legacy origin keys are folded into the hostname", () => {
  mem.set(
    STORAGE_KEY,
    JSON.stringify({
      "https://admin.example": { "ada@admin.example": ["Family"] },
      "https://admin.example:8443": {
        "ada@admin.example": ["Alex"],
        "bob@admin.example": ["Work"],
      },
      "https://other.example": { "ada@other.example": ["Stay"] },
    }),
  );
  const tags = loadServerTags("https://admin.example:9443/api/admin");
  assert.deepEqual(tags["ada@admin.example"], ["Family", "Alex"]);
  assert.deepEqual(tags["bob@admin.example"], ["Work"]);
  const raw = JSON.parse(mem.get(STORAGE_KEY) ?? "{}") as Record<string, unknown>;
  assert.deepEqual(Object.keys(raw).sort(), ["admin.example", "https://other.example"]);
  assert.equal(getTags("https://other.example", "ada@other.example")[0], "Stay");
});

test("tags are trimmed, deduped, capped, and never stored empty", () => {
  const server = "https://relay.example";
  const user = "ada@relay.example";
  assert.deepEqual(addTag(server, user, "   "), []);
  assert.deepEqual(addTag(server, user, "  family   friend  "), [
    "family friend",
  ]);
  assert.deepEqual(addTag(server, user, "FAMILY FRIEND"), ["family friend"]);
  const long = "x".repeat(MAX_TAG_LENGTH + 20);
  const stored = addTag(server, user, long);
  assert.equal(stored[1].length, MAX_TAG_LENGTH);
  for (let i = 0; i < MAX_TAGS_PER_USER + 3; i++) {
    addTag(server, user, `tag-${i}`);
  }
  const tags = loadServerTags(server);
  assert.equal(tagsForUser(tags, user).length, MAX_TAGS_PER_USER);
  assert.equal(tagsMatchQuery(tags, user, "tag-0"), true);
  assert.equal(tagsMatchQuery(tags, user, "missing"), false);
  removeTag(server, user, tagsForUser(tags, user)[0]);
  assert.equal(getTags(server, user).length, MAX_TAGS_PER_USER - 1);
  clearUser(server, user);
  assert.deepEqual(getTags(server, user), []);
  assert.equal(mem.has(STORAGE_KEY), false);
});

test("matching a loaded map does not re-read localStorage", () => {
  const server = "https://relay.example";
  addTag(server, "ada@relay.example", "Family");
  reads = 0;
  const tags = loadServerTags(server);
  const readsAfterLoad = reads;
  assert.equal(readsAfterLoad, 1);
  assert.equal(tagsMatchQuery(tags, "ada@relay.example", "fam"), true);
  assert.deepEqual(tagsForUser(tags, "ada@relay.example"), ["Family"]);
  assert.equal(tagsMatchQuery(tags, "other@relay.example", "fam"), false);
  assert.equal(reads, readsAfterLoad);
});

test("corrupt storage is ignored and a failed delete does not depend on the server", () => {
  mem.set(STORAGE_KEY, "{not json");
  assert.deepEqual(getTags("https://a.example", "ada@a.example"), []);
  setTags("https://a.example", "ada@a.example", ["Alex"]);
  const raw = mem.get(STORAGE_KEY) ?? "";
  assert.equal(raw.includes("Alex"), true);
  assert.equal(raw.includes("password"), false);
});

test("a settings host rewrite moves tags and does not clobber an existing server", () => {
  addTag("https://1.2.3.4", "ada@mail.example", "Family");
  assert.equal(
    migrateServerKey("https://1.2.3.4/api/admin", "https://mail.example:8443/api/admin"),
    true,
  );
  assert.deepEqual(getTags("https://mail.example", "ada@mail.example"), ["Family"]);
  assert.deepEqual(getTags("https://1.2.3.4", "ada@mail.example"), []);
  assert.equal(
    migrateServerKey("https://mail.example", "https://mail.example:9443"),
    false,
  );

  addTag("https://9.9.9.9", "bob@other.example", "Work");
  addTag("https://other.example", "ada@other.example", "Stay");
  assert.equal(migrateServerKey("https://9.9.9.9", "https://other.example"), false);
  assert.deepEqual(getTags("https://9.9.9.9", "bob@other.example"), ["Work"]);
  assert.deepEqual(getTags("https://other.example", "ada@other.example"), ["Stay"]);
});

test("prune drops accounts that are gone and clear removes only this server", () => {
  addTag("https://a.example", "ada@a.example", "Family");
  addTag("https://a.example", "bob@a.example", "Work");
  addTag("https://b.example", "ada@b.example", "Other");
  assert.equal(
    pruneAbsentUsers("https://a.example:8443", ["ada@a.example"]),
    true,
  );
  assert.deepEqual(getTags("https://a.example", "ada@a.example"), ["Family"]);
  assert.deepEqual(getTags("https://a.example", "bob@a.example"), []);
  assert.equal(pruneAbsentUsers("https://a.example", ["ada@a.example"]), false);
  clearServer("http://a.example");
  assert.deepEqual(getTags("https://a.example", "ada@a.example"), []);
  assert.deepEqual(getTags("https://b.example", "ada@b.example"), ["Other"]);
});
