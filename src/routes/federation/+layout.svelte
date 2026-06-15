<script lang="ts">
  import { store } from "$lib/state.svelte";
  import { page } from "$app/stores";
  import { base } from "$app/paths";
  import { t, getLocale } from "$lib/i18n";
  import {
    GitBranch,
    ShieldCheck,
    ShieldOff,
    AlertTriangle,
    Activity,
    Globe,
    ArrowDownToLine,
    HardDrive,
    Pencil,
    RotateCcw,
  } from "lucide-svelte";
  import FederationStatsGrid from "$lib/components/FederationStatsGrid.svelte";
  import PageLoader from "$lib/components/PageLoader.svelte";
  import ToggleSwitch from "$lib/components/ToggleSwitch.svelte";
  import {
    aggregateFederationServers,
    classifyFederationServers,
  } from "$lib/federationStats";
  import type { FederationHealthTier } from "$lib/federationStats";
  import {
    parseHealthParam,
    toggleFederationHealthFilter,
  } from "$lib/federationHealthNav";
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

  let stats = $derived.by(() => {
    if (!store.federationServers) return null;
    return aggregateFederationServers(
      store.federationServers.servers,
      localHostnames,
    );
  });

  let health = $derived.by(() => {
    if (!store.federationServers) return null;
    return classifyFederationServers(
      store.federationServers.servers,
      localHostnames,
    );
  });

  let activeHealth = $derived(
    parseHealthParam($page.url.searchParams.get("health")),
  );

  function onHealthSelect(tier: FederationHealthTier) {
    toggleFederationHealthFilter(activeHealth, tier, {
      pathname: $page.url.pathname,
      search: $page.url.search,
      onTraffic: activeTab === "traffic",
    });
  }

  let sizeInfo = $derived(store.federationSizeDisplay());
  let sizeSupported = $derived(store.federationSizeSupported);
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
          <p class="policy-desc">
            {#if isAccept}
              {@html _("fed.open_desc")}
            {:else}
              {@html _("fed.closed_desc")}
            {/if}
          </p>
        </div>
      </div>
    </div>

    <div class="fed-controls">
      <div class="fed-enable-row">
        <span class="fed-enable-label">{_("tab.federation")}</span>
        <ToggleSwitch
          checked={isEnabled}
          disabled={store.busy}
          label={_("tab.federation")}
          onclick={() => store.toggleFederationEnabled()}
        />
      </div>

      <button
        class="policy-switch"
        onclick={() => store.setFederationPolicy(isAccept ? "REJECT" : "ACCEPT")}
        disabled={store.busy}
        title={_("fed.switch_to", { policy: isAccept ? "REJECT" : "ACCEPT" })}
      >
        {#if isAccept}
          <ShieldOff size={13} />
        {:else}
          <ShieldCheck size={13} />
        {/if}
        <span class="policy-switch-text policy-switch-text--long">
          {_("fed.switch_to", { policy: isAccept ? "REJECT" : "ACCEPT" })}
        </span>
        <span class="policy-switch-text policy-switch-text--short" aria-hidden="true">
          {isAccept ? "REJECT" : "ACCEPT"}
        </span>
      </button>
    </div>
  </div>

  {#if sizeSupported}
    <div class="fed-size-bar">
      <div class="fed-size-info">
        <div class="fed-size-icon">
          <HardDrive size={14} />
        </div>
        <div class="fed-size-text">
          <div class="fed-label">{_("fed.body_size_limit")}</div>
          <div class="fed-size-value">
            <span class="size-effective">{sizeInfo.effective}</span>
            <span class="size-hint">{_("fed.body_size_hint")}</span>
          </div>
        </div>
      </div>

      <div class="fed-size-actions">
        {#if store.editingFederationSize}
          <input
            type="text"
            bind:value={store.federationSizeEditValue}
            placeholder="70M"
            class="fed-size-input"
            onkeydown={(e) => {
              if (e.key === "Enter") void store.saveFederationSize();
              if (e.key === "Escape") store.cancelEditFederationSize();
            }}
          />
          <button
            class="fed-size-btn fed-size-btn--save"
            onclick={() => store.saveFederationSize()}
            disabled={store.busy || !store.federationSizeEditValue.trim()}
          >
            {_("action.save")}
          </button>
          <button
            class="fed-size-btn"
            onclick={() => store.cancelEditFederationSize()}
            disabled={store.busy}
          >
            {_("action.cancel")}
          </button>
        {:else}
          {#if sizeInfo.hasOverride}
            <span class="size-override" title={_("fed.body_size_override")}>
              {sizeInfo.configured}
            </span>
          {/if}
          <button
            class="fed-size-icon-btn"
            onclick={() => store.startEditFederationSize()}
            disabled={store.busy}
            aria-label={_("fed.edit_body_size")}
          >
            <Pencil size={12} />
          </button>
          {#if sizeInfo.hasOverride}
            <button
              class="fed-size-icon-btn fed-size-icon-btn--reset"
              onclick={() => store.resetFederationSize()}
              disabled={store.busy}
              aria-label={_("fed.reset_body_size")}
            >
              <RotateCcw size={12} />
            </button>
          {/if}
        {/if}
      </div>
    </div>
  {/if}

  {#if stats && health}
    <FederationStatsGrid
      {stats}
      {health}
      {activeHealth}
      onHealthSelect={onHealthSelect}
    />
  {:else if store.federationSectionLoading}
    <PageLoader />
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
      data-sveltekit-noscroll
    >
      <ShieldCheck size={13} />
      {_("tab.federation_rules")}
      {#if store.federationRules}
        <span class="tab-count">{store.federationRules.total}</span>
      {/if}
    </a>
    <a
      class="tab"
      class:active={activeTab === "traffic"}
      href="{base}/federation/traffic"
      data-sveltekit-noscroll
    >
      <Activity size={13} />
      {_("tab.federation_peers")}
      {#if store.federationServers}
        <span class="tab-count">{store.federationServers.total}</span>
      {/if}
    </a>
    <a
      class="tab"
      class:active={activeTab === "endpoints"}
      href="{base}/federation/endpoints"
      data-sveltekit-noscroll
    >
      <Globe size={13} />
      {_("tab.dns")}
    </a>
    <a
      class="tab"
      class:active={activeTab === "exchangers"}
      href="{base}/federation/exchangers"
      data-sveltekit-noscroll
    >
      <ArrowDownToLine size={13} />
      {_("tab.exchangers")}
    </a>
  </div>

  <div class="tab-content">
    {@render children()}
  </div>
</div>
