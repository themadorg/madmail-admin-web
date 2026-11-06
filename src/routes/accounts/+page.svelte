<script lang="ts">
  import { store } from "$lib/state.svelte";
  import { t, getLocale } from "$lib/i18n";
  import { base } from "$app/paths";
  import {
    Users,
    Trash2,
    ArrowUpDown,
    UserPlus,
    Copy,
    ExternalLink,
    Check,
    AlertTriangle,
    Pencil,
    RotateCcw,
    ChevronLeft,
    ChevronRight,
    Search,
    Tag,
    X,
  } from "lucide-svelte";
  import Select from "$lib/components/Select.svelte";
  import PageLoader from "$lib/components/PageLoader.svelte";
  import {
    addTag,
    clearServer,
    clearUser,
    loadServerTags,
    MAX_TAGS_PER_USER,
    normalizeUsername,
    pruneAbsentUsers,
    removeTag,
    serverKeyFromBaseUrl,
    STORAGE_KEY,
    tagsForUser,
    tagsMatchQuery,
  } from "$lib/userTags";

  let locale = $state(getLocale());
  function _(key: string, params?: Record<string, string>): string {
    void locale;
    return t(key, params);
  }
  $effect(() => {
    locale = getLocale();
  });

  /** Focus element on mount for inline editing */
  function focusOnMount(el: HTMLInputElement) {
    el.focus();
    el.select();
  }

  let sortBy = $state<"name" | "size" | "date" | "login">("name");
  let sortAsc = $state(true);
  let copied = $state(false);
  let searchQuery = $state("");

  let editingUserQuota = $state(""); // username being edited
  let userQuotaInput = $state("");

  /** Bump to re-read tags from localStorage after mutations */
  let tagsEpoch = $state(0);

  let editingTagsFor = $state(""); // username being tag-edited
  let tagDraft = $state("");
  let newAccountTagDraft = $state("");

  let serverKey = $derived(serverKeyFromBaseUrl(store.baseUrl));

  /** One localStorage read per tag change or server change, shared by search and rows. */
  let serverTags = $derived.by(() => {
    void tagsEpoch;
    return loadServerTags(serverKey);
  });

  let hasServerTags = $derived(Object.keys(serverTags).length > 0);

  function tagsFor(username: string): string[] {
    return tagsForUser(serverTags, username);
  }

  function refreshTags() {
    tagsEpoch += 1;
  }

  function submitTagFor(username: string) {
    const before = tagsFor(username);
    const next = addTag(serverKey, username, tagDraft);
    const added = next.length > before.length;
    const duplicate = before.some(
      (t) => t.toLowerCase() === tagDraft.trim().toLowerCase(),
    );
    if (added || duplicate || !tagDraft.trim()) tagDraft = "";
    refreshTags();
    return next;
  }

  function dropTag(username: string, tag: string) {
    removeTag(serverKey, username, tag);
    refreshTags();
  }

  function submitNewAccountTag() {
    if (!store.newAccount) return;
    const before = tagsFor(store.newAccount.email);
    const next = addTag(serverKey, store.newAccount.email, newAccountTagDraft);
    const duplicate = before.some(
      (t) => t.toLowerCase() === newAccountTagDraft.trim().toLowerCase(),
    );
    if (next.length > before.length || duplicate || !newAccountTagDraft.trim()) {
      newAccountTagDraft = "";
    }
    refreshTags();
  }

  function dismissNewAccount() {
    // Persist any pending draft tag before closing the modal
    if (store.newAccount && newAccountTagDraft.trim()) {
      addTag(serverKey, store.newAccount.email, newAccountTagDraft);
      newAccountTagDraft = "";
      refreshTags();
    }
    store.dismissNewAccount();
  }

  async function confirmDeleteWithTags(username: string) {
    await store.confirmDelete(username);
    const accounts = store.accounts?.accounts;
    if (!accounts) return;
    const key = normalizeUsername(username);
    if (accounts.some((a) => normalizeUsername(a.username) === key)) return;
    clearUser(serverKey, username);
    if (normalizeUsername(editingTagsFor) === key) {
      editingTagsFor = "";
      tagDraft = "";
    }
    refreshTags();
  }

  /** Parse human-friendly size like "100MB" or "2GB" to bytes */
  function parseSize(s: string): number | null {
    const m = s.trim().match(/^([\d.]+)\s*(b|kb|mb|gb|tb)?$/i);
    if (!m) return null;
    const n = parseFloat(m[1]);
    if (isNaN(n) || n < 0) return null;
    const unit = (m[2] || "b").toUpperCase();
    const multipliers: Record<string, number> = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
      TB: 1024 * 1024 * 1024 * 1024,
    };
    return Math.floor(n * (multipliers[unit] || 1));
  }

  function fmtDate(ts: number): string {
    if (!ts) return _("acct.never");
    const d = new Date(ts * 1000);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60_000) return _("time.just_now");
    if (diff < 3_600_000)
      return _("time.minutes_ago", {
        n: String(Math.floor(diff / 60_000)),
      });
    if (diff < 86_400_000)
      return _("time.hours_ago", {
        n: String(Math.floor(diff / 3_600_000)),
      });
    if (diff < 7 * 86_400_000)
      return _("time.days_ago", {
        n: String(Math.floor(diff / 86_400_000)),
      });
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year:
        d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  }

  let sortedAccounts = $derived.by(() => {
    if (!store.accounts) return [];
    const tags = serverTags;
    let list = [...store.accounts.accounts];
    // Filter by search query (username or local admin tags)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.username.toLowerCase().includes(q) ||
          tagsMatchQuery(tags, a.username, q),
      );
    }
    if (sortBy === "size") {
      list.sort((a, b) =>
        sortAsc ? a.used_bytes - b.used_bytes : b.used_bytes - a.used_bytes,
      );
    } else if (sortBy === "date") {
      list.sort((a, b) =>
        sortAsc ? a.created_at - b.created_at : b.created_at - a.created_at,
      );
    } else if (sortBy === "login") {
      list.sort((a, b) =>
        sortAsc
          ? a.last_login_at - b.last_login_at
          : b.last_login_at - a.last_login_at,
      );
    } else {
      list.sort((a, b) =>
        sortAsc
          ? a.username.localeCompare(b.username)
          : b.username.localeCompare(a.username),
      );
    }
    return list;
  });

  // Pagination (frontend-only)
  let page = $state(1);
  let pageSize = $state(50);
  let totalPages = $derived(
    Math.max(1, Math.ceil(sortedAccounts.length / pageSize)),
  );
  let pagedAccounts = $derived.by(() => {
    const start = (page - 1) * pageSize;
    return sortedAccounts.slice(start, start + pageSize);
  });

  // Reset to page 1 when sort or search changes
  $effect(() => {
    void sortBy;
    void sortAsc;
    void searchQuery;
    page = 1;
  });

  // Reset modal tag draft when a new account is created
  $effect(() => {
    if (store.newAccount) {
      newAccountTagDraft = "";
    }
  });

  // `storage` fires in other tabs when they write this key.
  $effect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== STORAGE_KEY) return;
      tagsEpoch += 1;
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  });

  // Drop notes for accounts removed outside this page (CLI, delete-all, another tab).
  $effect(() => {
    const accounts = store.accounts?.accounts;
    if (!accounts) return;
    const keep = accounts.map((a) => a.username);
    if (store.newAccount?.email) keep.push(store.newAccount.email);
    if (pruneAbsentUsers(serverKey, keep)) tagsEpoch += 1;
  });

  function clearTagsForServer() {
    if (!confirm(_("acct.clear_tags_confirm"))) return;
    clearServer(serverKey);
    editingTagsFor = "";
    tagDraft = "";
    refreshTags();
  }

  let isRegistrationClosed = $derived(
    store.settings?.registration === "closed",
  );

  function toggleSort(col: "name" | "size" | "date" | "login") {
    if (sortBy === col) {
      sortAsc = !sortAsc;
    } else {
      sortBy = col;
      sortAsc = col === "name";
    }
  }

  function buildDcloginLink(email: string, password: string): string {
    // Extract hostname from the admin API URL
    let host = "";
    try {
      const url = new URL(store.baseUrl);
      host = url.hostname;
    } catch {
      host = "localhost";
    }

    // Use smtp_hostname from settings if available (more accurate)
    if (store.settings?.smtp_hostname?.value) {
      host = store.settings.smtp_hostname.value;
    }

    const imapPort = store.settings?.imap_port?.value || "993";
    const smtpPort = store.settings?.submission_port?.value || "465";

    return `dclogin:${email}/?p=${encodeURIComponent(password)}&v=1&ih=${host}&ip=${imapPort}&is=ssl&sh=${host}&sp=${smtpPort}&ss=ssl&ic=3`;
  }

  function copyDclogin() {
    if (!store.newAccount) return;
    const link = buildDcloginLink(
      store.newAccount.email,
      store.newAccount.password,
    );
    navigator.clipboard.writeText(link);
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 2000);
  }

  function openDeltaChat() {
    if (!store.newAccount) return;
    const link = buildDcloginLink(
      store.newAccount.email,
      store.newAccount.password,
    );
    window.location.href = link;
  }
</script>

<!-- Search + Sort + Pagination bar -->
<div class="relative mb-3">
    <Search
      size={13}
      class="absolute start-2.5 top-1/2 -translate-y-1/2 text-text-2/50 pointer-events-none"
    />
    <input
      type="text"
      class="w-full ps-8 pe-3 py-1.5 text-xs rounded-lg border border-border bg-surface-2 text-text-1 placeholder:text-text-2/40 focus:outline-none focus:border-accent/50 transition-colors"
      placeholder={_("acct.search_placeholder")}
      bind:value={searchQuery}
    />
  </div>

  <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
    <div class="flex gap-2 flex-wrap">
      <button
        onclick={() => toggleSort("name")}
        class="px-2.5 py-1 text-xs rounded-lg border transition-colors flex items-center gap-1
          {sortBy === 'name'
          ? 'border-accent/40 text-accent bg-accent/5'
          : 'border-border text-text-2 hover:border-text-2/40'}"
      >
        <ArrowUpDown size={11} />
        {_("acct.sort_name")}
        {#if sortBy === "name"}<span class="text-[10px] opacity-60"
            >{sortAsc ? "↑" : "↓"}</span
          >{/if}
      </button>
      <button
        onclick={() => toggleSort("size")}
        class="px-2.5 py-1 text-xs rounded-lg border transition-colors flex items-center gap-1
          {sortBy === 'size'
          ? 'border-accent/40 text-accent bg-accent/5'
          : 'border-border text-text-2 hover:border-text-2/40'}"
      >
        <ArrowUpDown size={11} />
        {_("acct.sort_size")}
        {#if sortBy === "size"}<span class="text-[10px] opacity-60"
            >{sortAsc ? "↑" : "↓"}</span
          >{/if}
      </button>
      <button
        onclick={() => toggleSort("date")}
        class="px-2.5 py-1 text-xs rounded-lg border transition-colors flex items-center gap-1
          {sortBy === 'date'
          ? 'border-accent/40 text-accent bg-accent/5'
          : 'border-border text-text-2 hover:border-text-2/40'}"
      >
        <ArrowUpDown size={11} />
        {_("acct.sort_date")}
        {#if sortBy === "date"}<span class="text-[10px] opacity-60"
            >{sortAsc ? "↑" : "↓"}</span
          >{/if}
      </button>
      <button
        onclick={() => toggleSort("login")}
        class="px-2.5 py-1 text-xs rounded-lg border transition-colors flex items-center gap-1
          {sortBy === 'login'
          ? 'border-accent/40 text-accent bg-accent/5'
          : 'border-border text-text-2 hover:border-text-2/40'}"
      >
        <ArrowUpDown size={11} />
        {_("acct.sort_login")}
        {#if sortBy === "login"}<span class="text-[10px] opacity-60"
            >{sortAsc ? "↑" : "↓"}</span
          >{/if}
      </button>
      {#if hasServerTags}
        <button
          type="button"
          onclick={clearTagsForServer}
          class="px-2.5 py-1 text-xs rounded-lg border border-border text-text-2 hover:border-danger/40 hover:text-danger transition-colors"
        >
          {_("acct.clear_tags")}
        </button>
      {/if}
    </div>

    <!-- Pagination -->
    <div class="flex items-center gap-1.5">
      <span class="text-[10px] text-text-2 tabular-nums">
        {(page - 1) * pageSize + 1}–{Math.min(
          page * pageSize,
          sortedAccounts.length,
        )}/{sortedAccounts.length}
      </span>
      <Select
        class="bg-surface-1 py-0.5 text-[10px] w-auto flex-none"
        bind:value={pageSize}
        onchange={() => {
          page = 1;
        }}
      >
        <option value={25}>25</option>
        <option value={50}>50</option>
        <option value={100}>100</option>
      </Select>
      <button
        onclick={() => {
          page = Math.max(1, page - 1);
        }}
        disabled={page <= 1}
        class="p-0.5 rounded border border-border text-text-2 hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft size={12} />
      </button>
      <span class="text-[10px] text-text-2 tabular-nums"
        >{page}/{totalPages}</span
      >
      <button
        onclick={() => {
          page = Math.min(totalPages, page + 1);
        }}
        disabled={page >= totalPages}
        class="p-0.5 rounded border border-border text-text-2 hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight size={12} />
      </button>
    </div>
  </div>

{#if store.accounts}
  {#if isRegistrationClosed}
    <div class="mb-4 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-2 text-xs text-amber-400">
          <AlertTriangle size={14} />
          <span>{_("acct.create_hint")}</span>
        </div>
        <button
          onclick={() => store.createAccount()}
          disabled={store.busy}
          class="px-3 py-1.5 text-xs rounded-lg bg-accent text-white hover:bg-accent/80 transition-colors font-medium flex items-center gap-1.5 disabled:opacity-50"
        >
          <UserPlus size={12} />
          {_("acct.create")}
        </button>
      </div>
    </div>
  {/if}

  <div class="space-y-1">
    {#each pagedAccounts as acct (acct.username)}
      {@const userTags = tagsFor(acct.username)}
      <div
        class="ui-card ui-card--rounded ui-card-row px-3 py-2 group"
      >
        <div class="min-w-0 flex-1">
          <span class="text-xs sm:text-sm font-mono truncate block"
            >{acct.username}</span
          >
          <div class="flex gap-3 mt-0.5 text-[10px] text-text-2">
            <span>{_("acct.created")}: {fmtDate(acct.created_at)}</span>
            <span>{_("acct.last_login")}: {fmtDate(acct.last_login_at)}</span>
          </div>
          <!-- Admin tags (localStorage only — never sent to the server) -->
          <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
            {#each userTags as tag (tag)}
              <span
                class="inline-flex items-center gap-1 max-w-full ps-2 pe-1 py-0.5 rounded-md text-xs bg-accent/10 text-accent border border-accent/20"
              >
                <span class="truncate">{tag}</span>
                {#if editingTagsFor === acct.username}
                  <button
                    type="button"
                    class="shrink-0 inline-flex items-center justify-center min-w-8 min-h-8 rounded hover:bg-accent/20 text-accent/80"
                    onclick={() => dropTag(acct.username, tag)}
                    aria-label={_("acct.remove_tag", { tag })}
                  >
                    <X size={14} />
                  </button>
                {/if}
              </span>
            {/each}
            {#if editingTagsFor === acct.username && userTags.length >= MAX_TAGS_PER_USER}
              <span class="text-xs text-text-2/70">{_("acct.tags_full")}</span>
              <button
                type="button"
                onclick={() => {
                  editingTagsFor = "";
                  tagDraft = "";
                }}
                class="inline-flex items-center justify-center min-w-8 min-h-8 rounded border border-border text-text-2"
                aria-label={_("action.cancel")}
              >
                <X size={14} />
              </button>
            {:else if editingTagsFor === acct.username}
              <form
                class="inline-flex items-center gap-1.5 min-w-0"
                onsubmit={(e) => {
                  e.preventDefault();
                  submitTagFor(acct.username);
                }}
              >
                <input
                  type="text"
                  class="w-36 max-w-[50vw] px-2 py-1.5 text-xs rounded border border-accent/40 bg-surface-1 text-text-1 focus:outline-none"
                  bind:value={tagDraft}
                  placeholder={_("acct.tags_placeholder")}
                  use:focusOnMount
                />
                <button
                  type="submit"
                  class="px-2.5 py-1.5 text-xs rounded bg-accent text-white hover:bg-accent/80"
                >
                  {_("acct.add_tag")}
                </button>
                <button
                  type="button"
                  onclick={() => {
                    editingTagsFor = "";
                    tagDraft = "";
                  }}
                  class="inline-flex items-center justify-center min-w-8 min-h-8 rounded border border-border text-text-2"
                  aria-label={_("action.cancel")}
                >
                  <X size={14} />
                </button>
              </form>
            {:else}
              <button
                type="button"
                class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border/60 text-text-2/70 hover:text-text-2 hover:border-text-2/40 transition-colors"
                onclick={() => {
                  editingTagsFor = acct.username;
                  tagDraft = "";
                  editingUserQuota = "";
                }}
                title={_("acct.tags_hint")}
              >
                <Tag size={12} />
                {userTags.length === 0 ? _("acct.add_tag") : _("acct.edit_tags")}
              </button>
            {/if}
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0 ms-2">
          <div class="flex flex-col items-end gap-0.5">
            <span class="text-xs text-text-2 tabular-nums"
              >{store.fmtBytes(acct.used_bytes)}</span
            >
            {#if editingUserQuota === acct.username}
              <form
                class="flex items-center gap-1"
                onsubmit={(e) => {
                  e.preventDefault();
                  const bytes = parseSize(userQuotaInput);
                  if (bytes !== null) {
                    store.setUserQuota(acct.username, bytes);
                    editingUserQuota = "";
                  }
                }}
              >
                <input
                  type="text"
                  class="w-16 px-1 py-0.5 text-[10px] rounded border border-accent/40 bg-surface-1 text-text-1 focus:outline-none"
                  bind:value={userQuotaInput}
                  placeholder={_("acct.quota_placeholder")}
                />
                <button
                  type="submit"
                  class="px-1 py-0.5 text-[9px] rounded bg-accent text-white hover:bg-accent/80"
                >
                  ✓
                </button>
                <button
                  type="button"
                  onclick={() => (editingUserQuota = "")}
                  class="px-1 py-0.5 text-[9px] rounded border border-border text-text-2"
                >
                  ✕
                </button>
              </form>
            {:else}
              <button
                class="flex items-center gap-0.5 text-[10px] transition-colors cursor-pointer
                  {acct.is_default_quota
                  ? 'text-text-2/50 hover:text-text-2'
                  : 'text-accent/70 hover:text-accent'}"
                onclick={() => {
                  userQuotaInput = (acct.max_bytes / 1048576).toFixed(0) + "MB";
                  editingUserQuota = acct.username;
                  editingTagsFor = "";
                }}
              >
                {store.fmtBytes(acct.max_bytes)}
                {acct.is_default_quota ? "" : "★"}
                <Pencil size={8} class="opacity-30" />
              </button>
              {#if !acct.is_default_quota}
                <button
                  class="text-[9px] text-text-2/40 hover:text-text-2 flex items-center gap-0.5 transition-colors"
                  onclick={() => store.resetUserQuota(acct.username)}
                  title={_("acct.reset_quota")}
                >
                  <RotateCcw size={8} />
                  {_("acct.reset_quota")}
                </button>
              {/if}
            {/if}
          </div>
          <button
            onclick={() => store.requestDelete(acct.username)}
            class="p-1.5 text-danger/60 border border-transparent rounded hover:border-danger/30 hover:bg-danger/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
            aria-label={_("acct.delete_aria", {
              username: acct.username,
            })}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    {/each}
  </div>
{:else}
  <PageLoader />
{/if}

<!-- New Account Created Modal (one-time dclogin display) -->
{#if store.newAccount}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    onclick={() => {}}
  >
    <!-- Backdrop (non-dismissible — user must explicitly acknowledge) -->
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
    <!-- Modal -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="relative bg-surface-1 border border-border rounded-xl shadow-2xl w-full max-w-md p-5 animate-modal"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex items-start gap-3 mb-4">
        <div class="p-2 rounded-lg bg-green-500/10 text-green-400 shrink-0">
          <UserPlus size={18} />
        </div>
        <div class="min-w-0">
          <h3 class="text-sm font-semibold text-text-1 mb-1">
            {_("acct.new_account")}
          </h3>
          <p class="text-xs text-text-2 font-mono break-all">
            {store.newAccount.email}
          </p>
        </div>
      </div>

      <!-- Warning -->
      <div
        class="mb-4 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2"
      >
        <AlertTriangle size={14} class="text-amber-400 shrink-0" />
        <span class="text-xs text-amber-400">{_("acct.dclogin_warning")}</span>
      </div>

      <!-- dclogin link display -->
      <div class="mb-4 p-3 rounded-lg bg-black/30 border border-border">
        <p class="text-[10px] text-text-2 mb-1 uppercase tracking-wider">
          {_("acct.dclogin_label")}
        </p>
        <p
          class="text-xs font-mono text-accent break-all select-all leading-relaxed"
          dir="ltr"
        >
          {buildDcloginLink(store.newAccount.email, store.newAccount.password)}
        </p>
      </div>

      <!-- Optional admin tags (browser localStorage only) -->
      <div class="mb-4 p-3 rounded-lg border border-border bg-surface-2/40">
        <div class="flex items-center gap-1.5 mb-1">
          <Tag size={12} class="text-text-2 shrink-0" />
          <p class="text-xs text-text-2 uppercase tracking-wider">
            {_("acct.tags")}
          </p>
        </div>
        <p class="text-xs text-text-2/70 mb-2">{_("acct.tags_hint")}</p>
        {#if tagsFor(store.newAccount.email).length > 0}
          <div class="flex flex-wrap gap-1.5 mb-2">
            {#each tagsFor(store.newAccount.email) as tag (tag)}
              <span
                class="inline-flex items-center gap-1 ps-2 pe-1 py-0.5 rounded-md text-xs bg-accent/10 text-accent border border-accent/20"
              >
                {tag}
                <button
                  type="button"
                  class="inline-flex items-center justify-center min-w-8 min-h-8 rounded hover:bg-accent/20"
                  onclick={() => dropTag(store.newAccount!.email, tag)}
                  aria-label={_("acct.remove_tag", { tag })}
                >
                  <X size={14} />
                </button>
              </span>
            {/each}
          </div>
        {/if}
        {#if tagsFor(store.newAccount.email).length >= MAX_TAGS_PER_USER}
          <p class="text-xs text-text-2/70">{_("acct.tags_full")}</p>
        {:else}
        <form
          class="flex gap-1.5"
          onsubmit={(e) => {
            e.preventDefault();
            submitNewAccountTag();
          }}
        >
          <input
            type="text"
            class="flex-1 min-w-0 px-2 py-1.5 text-xs rounded-lg border border-border bg-surface-1 text-text-1 placeholder:text-text-2/40 focus:outline-none focus:border-accent/50"
            bind:value={newAccountTagDraft}
            placeholder={_("acct.tags_placeholder")}
          />
          <button
            type="submit"
            class="px-2.5 py-1.5 text-xs rounded-lg border border-accent/30 text-accent hover:bg-accent/10 transition-colors shrink-0"
          >
            {_("acct.add_tag")}
          </button>
        </form>
        {/if}
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex gap-2">
          <button
            onclick={copyDclogin}
            class="flex-1 px-3 py-2 text-xs rounded-lg border transition-colors font-medium flex items-center justify-center gap-1.5
              {copied
              ? 'border-green-500/40 text-green-400 bg-green-500/10'
              : 'border-accent/30 text-accent hover:bg-accent/10'}"
          >
            {#if copied}
              <Check size={12} />
              {_("acct.copied_button")}
            {:else}
              <Copy size={12} />
              {_("acct.copy_dclogin")}
            {/if}
          </button>
          <button
            onclick={openDeltaChat}
            class="flex-1 px-3 py-2 text-xs rounded-lg border border-border text-text-2 hover:bg-surface-2 transition-colors font-medium flex items-center justify-center gap-1.5"
          >
            <ExternalLink size={12} />
            {_("acct.open_dc")}
          </button>
        </div>
        <button
          onclick={dismissNewAccount}
          class="w-full px-3 py-2 text-xs rounded-lg bg-surface-2 text-text-1 hover:bg-surface-2/80 transition-colors font-medium border border-border"
        >
          {_("acct.dismiss")}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete confirmation modal -->
{#if store.confirmingDelete}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    onclick={() => store.cancelDelete()}
  >
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
    <!-- Modal -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="relative bg-surface-1 border border-border rounded-xl shadow-2xl w-full max-w-sm p-5 animate-modal"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex items-start gap-3 mb-4">
        <div class="p-2 rounded-lg bg-danger/10 text-danger shrink-0">
          <Trash2 size={18} />
        </div>
        <div class="min-w-0">
          <h3 class="text-sm font-semibold text-text-1 mb-1">
            {_("acct.confirm_delete", {
              username: store.confirmingDelete,
            })}
          </h3>
          <p class="text-xs text-text-2 font-mono break-all">
            {store.confirmingDelete}
          </p>
        </div>
      </div>

      <div class="flex gap-2 justify-end">
        <button
          onclick={() => store.cancelDelete()}
          class="px-3 py-1.5 text-xs rounded-lg border border-border text-text-2 hover:bg-surface-2 transition-colors"
        >
          {_("acct.confirm_no")}
        </button>
        <button
          onclick={() => confirmDeleteWithTags(store.confirmingDelete)}
          class="px-3 py-1.5 text-xs rounded-lg bg-danger text-white hover:bg-danger/80 transition-colors font-medium"
        >
          {_("acct.confirm_yes")}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes modal-in {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(8px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  .animate-modal {
    animation: modal-in 0.15s ease-out;
  }
</style>
