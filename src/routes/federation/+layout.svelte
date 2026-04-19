<script lang="ts">
  import { store } from "$lib/state.svelte";
  import { page } from "$app/stores";
  import { base } from "$app/paths";
  import { t, getLocale } from "$lib/i18n";
  import { 
    GitBranch, ShieldCheck, ShieldOff, ToggleLeft, ToggleRight,
    AlertTriangle, Activity, Clock, Globe, ArrowDownToLine
  } from "lucide-svelte";
  import "./federation.css";

  let { children } = $props();

  let locale = $state(getLocale());
  function _(key: string, params?: Record<string, string>): string {
    void locale;
    return t(key, params);
  }
  $effect(() => {
    locale = getLocale();
  });

  // Derived state from store
  let isEnabled = $derived(store.federationSettings?.enabled ?? false);
  let policy = $derived(store.federationSettings?.policy ?? "ACCEPT");
  let isAccept = $derived(policy === "ACCEPT");
  
  // Active tab based on URL
  let activeTab = $derived.by(() => {
    const p = $page.url.pathname;
    if (p.includes("/traffic")) return "traffic";
    if (p.includes("/endpoints")) return "endpoints";
    if (p.includes("/exchangers")) return "exchangers";
    return "rules";
  });

  // Derive local hostnames to exclude self
  let localHostnames = $derived.by(() => {
    const names = new Set<string>();
    const smtpHost = store.settings?.smtp_hostname?.value;
    if (smtpHost) names.add(smtpHost.toLowerCase());
    try {
      const url = new URL(store.baseUrl);
      names.add(url.hostname.toLowerCase());
    } catch { /* ignore */ }
    return names;
  });

  function fmtDomain(d: string): string {
    return (d || "").replace(/^\[(.*)\]$/, "$1");
  }

  // Global aggregates (excluding self)
  let stats = $derived.by(() => {
    if (!store.federationServers) return null;
    let inbound = 0;
    let outbound = 0;
    let queued = 0;
    let expired = 0;
    let latencySum = 0;
    let latencyCount = 0;
    for (const s of store.federationServers.servers) {
      if (localHostnames.has(fmtDomain(s.domain).toLowerCase())) continue;
      inbound += s.inbound_deliveries;
      outbound += s.successful_deliveries;
      queued += s.queued_messages;
      expired += (s.failed_http || 0) + (s.failed_https || 0) + (s.failed_smtp || 0);
      if (s.mean_latency_ms > 0) {
        latencySum += s.mean_latency_ms;
        latencyCount++;
      }
    }
    return {
      inbound,
      outbound,
      queued,
      expired,
      latency: latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0
    };
  });

  function formatLatency(ms: number): string {
    if (!ms || ms === 0) return "—";
    if (ms < 1000) return _("latency.ms", { n: String(Math.round(ms)) });
    return _("latency.s", { n: ((ms || 0) / 1000).toFixed(1) });
  }
</script>

<div class="federation-layout">
  <!-- Policy controls header -->
  <div class="fed-header">
    <div class="fed-policy-info">
      <div class="fed-policy-icon" class:accept={isAccept} class:reject={!isAccept}>
        <GitBranch size={16} />
      </div>
      <div class="fed-policy-text">
        <div class="fed-label">{_("fed.policy")}</div>
        <div class="fed-value">
          <span
            class="policy-badge"
            class:accept={isAccept}
            class:reject={!isAccept}
          >
            {#if isAccept}
              <ShieldCheck size={11} />
            {:else}
              <ShieldOff size={11} />
            {/if}
            {policy}
          </span>
          <span class="policy-desc">
            {#if isAccept}
              {@html _("fed.open_desc")}
            {:else}
              {@html _("fed.closed_desc")}
            {/if}
          </span>
        </div>
      </div>
    </div>

    <div class="fed-controls">
      <button
        class="toggle-btn"
        class:active={isEnabled}
        onclick={() => store.toggleFederationEnabled()}
        disabled={store.busy}
      >
        {#if isEnabled}
          <ToggleRight size={16} />
          <span>{_("fed.active")}</span>
        {:else}
          <ToggleLeft size={16} />
          <span>{_("fed.inactive")}</span>
        {/if}
      </button>

      <button
        class="policy-switch"
        onclick={() => store.setFederationPolicy(isAccept ? "REJECT" : "ACCEPT")}
        disabled={store.busy}
        title={_("fed.switch_to", { policy: isAccept ? "REJECT" : "ACCEPT" })}
      >
        {#if isAccept}
          <ShieldOff size={13} />
          {_("fed.switch_to", { policy: "REJECT" })}
        {:else}
          <ShieldCheck size={13} />
          {_("fed.switch_to", { policy: "ACCEPT" })}
        {/if}
      </button>
    </div>
  </div>

  {#if stats}
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
      <div class="bg-surface-2 rounded-lg p-3 border border-border">
        <div class="flex items-center gap-1.5 text-text-2 text-[10px] uppercase tracking-wider mb-1">
          <Activity size={12} class="text-success" />
          {_("fed.inbound")}
        </div>
        <div class="text-xl font-semibold text-success">{stats.inbound}</div>
      </div>

      <div class="bg-surface-2 rounded-lg p-3 border border-border">
        <div class="flex items-center gap-1.5 text-text-2 text-[10px] uppercase tracking-wider mb-1">
          <Activity size={12} class="text-success" />
          {_("fed.outbound")}
        </div>
        <div class="text-xl font-semibold text-success">{stats.outbound}</div>
      </div>

      <div class="bg-surface-2 rounded-lg p-3 border border-border">
        <div class="flex items-center gap-1.5 text-text-2 text-[10px] uppercase tracking-wider mb-1">
          <ShieldCheck size={12} />
          {_("fed.queued")}
        </div>
        <div class="text-xl font-semibold">{stats.queued}</div>
      </div>

      <div class="bg-surface-2 rounded-lg p-3 border border-border">
        <div class="flex items-center gap-1.5 text-text-2 text-[10px] uppercase tracking-wider mb-1">
          <Clock size={12} />
          {_("fed.avg_latency")}
        </div>
        <div class="text-xl font-semibold">{formatLatency(stats.latency)}</div>
      </div>

      <div class="bg-surface-2 rounded-lg p-3 border border-border">
        <div class="flex items-center gap-1.5 text-text-2 text-[10px] uppercase tracking-wider mb-1">
          <AlertTriangle size={12} class="text-danger" />
          {_("fed.expired")}
        </div>
        <div class="text-xl font-semibold text-danger">{stats.expired}</div>
      </div>
    </div>
  {/if}

  {#if !isEnabled}
    <div class="inactive-banner">
      <AlertTriangle size={14} />
      <span>{@html _("fed.inactive_banner_html")}</span>
    </div>
  {/if}

  <!-- Tabs -->
  <div class="tab-bar">
    <a
      class="tab"
      class:active={activeTab === "rules"}
      href="{base}/federation"
    >
      <ShieldCheck size={13} />
      {_("tab.federation")}
      {#if store.federationRules}
        <span class="tab-count">{store.federationRules.total}</span>
      {/if}
    </a>
    <a
      class="tab"
      class:active={activeTab === "traffic"}
      href="{base}/federation/traffic"
    >
      <Activity size={13} />
      {_("traffic.title")}
      {#if store.federationServers}
        <span class="tab-count">{store.federationServers.total}</span>
      {/if}
    </a>
    <a
      class="tab"
      class:active={activeTab === "endpoints"}
      href="{base}/federation/endpoints"
    >
      <Globe size={13} />
      {_("tab.dns")}
    </a>
    <a
      class="tab"
      class:active={activeTab === "exchangers"}
      href="{base}/federation/exchangers"
    >
      <ArrowDownToLine size={13} />
      {_("tab.exchangers")}
    </a>
  </div>

  <div class="tab-content">
    {@render children()}
  </div>
</div>
