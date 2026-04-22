<script lang="ts">
  import { store } from "$lib/state.svelte";
  import { page } from "$app/stores";
  import { base } from "$app/paths";
  import { t, getLocale } from "$lib/i18n";
  import { 
    Users, ShieldBan, Ticket, ArrowLeft,
    HardDrive, ShieldCheck, Download, Upload, Trash2, Pencil
  } from "lucide-svelte";
  import "../federation/federation.css"; // Reuse tab styles

  let { children } = $props();

  let locale = $state(getLocale());
  function _(key: string, params?: Record<string, string>): string {
    void locale;
    return t(key, params);
  }
  $effect(() => {
    locale = getLocale();
  });
  
  // Quota editing state
  let editingDefaultQuota = $state(false);
  let defaultQuotaInput = $state("");

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

  /** Focus element on mount for inline editing */
  function focusOnMount(el: HTMLInputElement) {
    el.focus();
    el.select();
  }

  // Active tab based on URL
  let activeTab = $derived.by(() => {
    const p = $page.url.pathname;
    if (p.includes("/blocked")) return "blocked";
    if (p.includes("/tokens")) return "tokens";
    return "list";
  });
</script>

<div class="federation-layout">
  <!-- Accounts Stats Grid -->
  <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
    <div class="bg-surface-2 rounded-lg p-3 border border-border">
      <div class="flex items-center gap-1.5 text-text-2 text-[10px] uppercase tracking-wider mb-1">
        <Users size={12} class="text-accent" />
        {_("acct.total")}
      </div>
      <div class="text-xl font-semibold">
        {store.accounts?.total ?? "—"}
      </div>
    </div>

    <div class="bg-surface-2 rounded-lg p-3 border border-border">
      <div class="flex items-center gap-1.5 text-text-2 text-[10px] uppercase tracking-wider mb-1">
        <ShieldBan size={12} class="text-danger" />
        {_("acct.blocked")}
      </div>
      <div class="text-xl font-semibold">
        {store.blocklist?.total ?? 0}
      </div>
    </div>

    <div class="bg-surface-2 rounded-lg p-3 border border-border">
      <div class="flex items-center gap-1.5 text-text-2 text-[10px] uppercase tracking-wider mb-1">
        <Ticket size={12} class="text-warning" />
        {_("tab.tokens")}
      </div>
      <div class="text-xl font-semibold">
        {store.registrationTokens?.total ?? "—"}
      </div>
    </div>

    <div class="bg-surface-2 rounded-lg p-3 border border-border">
      <div class="flex items-center gap-1.5 text-text-2 text-[10px] uppercase tracking-wider mb-1">
        <HardDrive size={12} class="text-success" />
        {_("acct.used")}
      </div>
      <div class="text-xl font-semibold text-success">
        {store.quota ? store.fmtBytes(store.quota.total_storage_bytes) : "—"}
      </div>
      {#if store.quota?.percent_used}
        <div class="text-[10px] text-text-2 mt-1">
          {_("acct.pool_pct", {
            pct: store.quota.percent_used.toFixed(1),
          })}
        </div>
      {/if}
    </div>

    <div class="bg-surface-2 rounded-lg p-3 border border-border">
      <div class="flex items-center gap-1.5 text-text-2 text-[10px] uppercase tracking-wider mb-1">
        <ShieldCheck size={12} class="text-accent" />
        {_("acct.default_quota")}
      </div>
      {#if editingDefaultQuota}
        <form
          class="flex items-center gap-1 mt-1"
          onsubmit={(e) => {
            e.preventDefault();
            const bytes = parseSize(defaultQuotaInput);
            if (bytes !== null) {
              store.setDefaultQuota(bytes);
              editingDefaultQuota = false;
            }
          }}
        >
          <input
            type="text"
            class="w-full px-1.5 py-0.5 text-xs rounded border border-accent/40 bg-surface-1 text-text focus:outline-none"
            bind:value={defaultQuotaInput}
            use:focusOnMount
          />
        </form>
      {:else}
        <button
          type="button"
          class="text-xl font-semibold flex items-center gap-1.5 cursor-pointer hover:text-accent transition-colors w-full text-start bg-transparent border-0 p-0 m-0 font-inherit"
          onclick={() => {
            defaultQuotaInput = store.quota
              ? (store.quota.default_quota_bytes / 1048576).toFixed(0) + "MB"
              : "";
            editingDefaultQuota = true;
          }}
        >
          {store.quota ? store.fmtBytes(store.quota.default_quota_bytes) : "—"}
          <Pencil size={10} class="opacity-30" />
        </button>
      {/if}
    </div>
  </div>

  <!-- Actions Bar -->
  <div class="flex flex-wrap items-center justify-between gap-3 mb-4 p-2 bg-surface-2 border border-border rounded-lg">
    <div class="flex items-center gap-2">
      <button
        onclick={() => store.exportAccounts()}
        disabled={store.busy}
        class="px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-text-2 hover:bg-surface-3 transition-all flex items-center gap-1.5 disabled:opacity-50"
      >
        <Download size={13} />
        {_("action.export")}
      </button>

      <label
        class="px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-text-2 hover:bg-surface-3 transition-all flex items-center gap-1.5 cursor-pointer"
        class:opacity-50={store.busy}
      >
        <Upload size={13} />
        {_("action.import")}
        <input
          type="file"
          accept=".json"
          class="hidden"
          disabled={store.busy}
          onchange={(e) => {
            const file = e.currentTarget.files?.[0];
            if (file) {
              store.importAccounts(file);
              e.currentTarget.value = "";
            }
          }}
        />
      </label>
    </div>

    <button
      onclick={() => store.deleteAllAccounts()}
      disabled={store.busy}
      class="px-3 py-1.5 text-xs font-medium rounded-lg border border-danger/30 text-danger hover:bg-danger/10 transition-all flex items-center gap-1.5 disabled:opacity-50"
    >
      <Trash2 size={13} />
      {_("action.delete_all")}
    </button>
  </div>

  <!-- Tabs -->
  <div class="tab-bar">
    <a
      class="tab"
      class:active={activeTab === "list"}
      href="{base}/accounts"
    >
      <Users size={13} />
      {_("tab.accounts")}
      {#if store.accounts}
        <span class="tab-count">{store.accounts.total}</span>
      {/if}
    </a>
    <a
      class="tab"
      class:active={activeTab === "blocked"}
      href="{base}/accounts/blocked"
    >
      <ShieldBan size={13} />
      {_("acct.blocked")}
      {#if store.blocklist}
        <span class="tab-count">{store.blocklist.total}</span>
      {/if}
    </a>
    <a
      class="tab"
      class:active={activeTab === "tokens"}
      href="{base}/accounts/tokens"
    >
      <Ticket size={13} />
      {_("tab.tokens")}
    </a>
  </div>

  <div class="tab-content">
    {@render children()}
  </div>
</div>
