<script lang="ts">
  import { store } from "$lib/state.svelte";
  import { base } from "$app/paths";
  import { afterNavigate, goto } from "$app/navigation";
  import { api, type ApiConfig } from "$lib/api";
  import { t, getLocale } from "$lib/i18n";
  import {
    Users,
    Clock,
    HardDrive,
    Server,
    Network,
    Shield,
    Trash2,
    Mail,
    SendHorizonal,
    Inbox,
    QrCode,
    RefreshCw,
    ExternalLink,
    X,
    Ticket,
  } from "lucide-svelte";
  import ShadowsocksQR from "$lib/components/ShadowsocksQR.svelte";
  import FederationStatsGrid from "$lib/components/FederationStatsGrid.svelte";
  import ToggleSwitch from "$lib/components/ToggleSwitch.svelte";
  import Select from "$lib/components/Select.svelte";
  import { dashboardFederationFromOverview } from "$lib/federationStats";
  import type { FederationHealthTier } from "$lib/federationStats";
  import { federationHealthFilterHref } from "$lib/federationHealthNav";

  let showQR = $state(false);
  let showUpdateModal = $state(false);

  let locale = $state(getLocale());
  function _(key: string, params?: Record<string, string>): string {
    void locale;
    return t(key, params);
  }

  function isOverviewPath(pathname: string): boolean {
    const p = base ? pathname.replace(base, "") || "/" : pathname;
    return p === "/";
  }

  /** Re-fetch when navigating back to overview (connect already loaded on login). */
  afterNavigate(({ from, to }) => {
    if (!store.connected || !from || !to) return;
    if (isOverviewPath(to.url.pathname) && !isOverviewPath(from.url.pathname)) {
      store.loadOverview({ force: true });
    }
  });

  const ROTATION_DAY_OPTIONS = [1, 3, 7, 14, 30, 90] as const;

  let rotationApiAvailable = $derived(
    store.overview?.message_retention != null,
  );
  let rotationEnabled = $derived(
    store.overview?.message_retention?.enabled ?? false,
  );
  let rotationDays = $derived(
    store.overview?.message_retention?.days ?? 30,
  );
  let rotationDaysSelect = $state(30);

  $effect(() => {
    rotationDaysSelect = rotationDays;
  });

  let dashboardFederation = $derived(
    dashboardFederationFromOverview(store.overview),
  );

  let diskPercent = $derived(store.overview?.disk?.percent_used ?? 0);
  let fedConnections = $derived(
    store.overview?.email_servers?.connections ??
      store.overview?.email_servers?.connection_ips ??
      0,
  );
  let diskColor = $derived(
    diskPercent > 90
      ? "bg-danger"
      : diskPercent > 70
        ? "bg-warning"
        : "bg-accent",
  );

  // Purge older state
  let selectedRetention = $state("72h");
  let purging = $state(false);

  const RETENTION_KEYS = [
    { value: "1h", key: "queue.ret_1h" },
    { value: "6h", key: "queue.ret_6h" },
    { value: "24h", key: "queue.ret_24h" },
    { value: "72h", key: "queue.ret_72h" },
    { value: "168h", key: "queue.ret_168h" },
    { value: "720h", key: "queue.ret_720h" },
  ];

  function cfg(): ApiConfig {
    return { baseUrl: store.baseUrl, token: store.token };
  }

  async function purgeOlder() {
    const ret = RETENTION_KEYS.find((o) => o.value === selectedRetention);
    const label = ret ? _(ret.key) : selectedRetention;
    if (!confirm(_("queue.purge_confirm_older", { label }))) return;
    purging = true;
    try {
      const res = await api.purgeBlobsOlder(cfg(), selectedRetention);
      if (res.error) {
        store.notify(res.error, "err");
      } else {
        store.notify(
          (res as any).data?.message ??
            _("notify.blobs_purged_older", { label }),
        );
      }
    } catch (e) {
      store.notify(String(e), "err");
    } finally {
      purging = false;
    }
  }

  async function purgeAllBlobs() {
    if (!confirm(_("queue.purge_confirm_all"))) return;
    purging = true;
    try {
      const res = await api.purgeBlobs(cfg());
      if (res.error) {
        store.notify(res.error, "err");
      } else {
        store.notify(
          (res as any).data?.message ?? _("notify.all_files_deleted"),
        );
      }
    } catch (e) {
      store.notify(String(e), "err");
    } finally {
      purging = false;
    }
  }
</script>

{#snippet statCard(Icon: any, label: string, value: string)}
  <div class="ui-card ui-card--rounded p-3">
    <div class="flex items-center gap-1.5 text-text-2 text-xs mb-1">
      <Icon size={12} />
      {label}
    </div>
    <div class="text-xl font-semibold">{value}</div>
  </div>
{/snippet}

{#snippet linkCard(Icon: any, label: string, value: string, href: string)}
  <a
    {href}
    data-sveltekit-noscroll
    class="ui-card ui-card--rounded ui-card--interactive p-3 block"
  >
    <div class="flex items-center gap-1.5 text-text-2 text-xs mb-1">
      <Icon size={12} />
      {label}
    </div>
    <div class="text-xl font-semibold">{value}</div>
  </a>
{/snippet}

<!-- Bento Grid -->
<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
  {@render linkCard(
    Users,
    _("stat.users"),
    String(store.overview?.users?.registered ?? "—"),
    `${base}/accounts`,
  )}
  {@render statCard(
    Clock,
    _("stat.uptime"),
    store.overview?.uptime?.duration ?? "—",
  )}
  {@render linkCard(
    Ticket,
    _("tab.tokens"),
    String(store.overview?.tokens?.total ?? "—"),
    `${base}/accounts/tokens`,
  )}

  {@render statCard(
    Mail,
    _("stat.sent"),
    store.overview?.sent_messages != null
      ? store.overview.sent_messages.toLocaleString()
      : "—",
  )}
  {@render statCard(
    SendHorizonal,
    _("stat.outbound"),
    store.overview?.outbound_messages != null
      ? store.overview.outbound_messages.toLocaleString()
      : "—",
  )}
  {@render statCard(
    Inbox,
    _("stat.received"),
    store.overview?.received_messages != null
      ? store.overview.received_messages.toLocaleString()
      : "—",
  )}

  <!-- Madmail Version Card (clickable, same size as others) -->
  <button
    onclick={() => showUpdateModal = true}
    class="ui-card ui-card--rounded ui-card--interactive p-3 text-start cursor-pointer"
  >
    <div class="flex items-center gap-1.5 text-text-2 text-xs mb-1">
      <Server size={12} />
      {_("stat.madmail_version")}
    </div>
    <div class="text-xl font-semibold truncate">
      {store.overview?.version ?? store.serverVersion ?? "—"}
    </div>
  </button>

  {#if store.overview?.imap}
    {@render statCard(
      Network,
      _("stat.imap"),
      _("stat.imap_detail", {
        connections: String(store.overview.imap.connections),
        unique_ips: String(store.overview.imap.unique_ips),
      }),
    )}
  {/if}
  {#if store.overview?.turn}
    {@render statCard(
      Server,
      _("stat.turn_relays"),
      String(store.overview.turn.relays),
    )}
  {/if}
  {#if store.overview?.shadowsocks}
    {@render linkCard(
      Shield,
      _("stat.ss_conns"),
      _("stat.ss_detail", {
        connections: String(store.overview.shadowsocks.connections),
        unique_ips: String(store.overview.shadowsocks.unique_ips),
      }),
      `${base}/proxy`,
    )}
  {/if}
</div>

<!-- Shadowsocks URL -->
{#if store.shadowsocksUrl}
  <div class="ui-card ui-card--rounded p-3 mb-4">
    <div class="flex items-center justify-between gap-3 mb-2">
      <div class="min-w-0">
        <div class="text-[10px] uppercase tracking-wider text-text-2 mb-0.5">
          {_("svc.shadowsocks_client_url")}
        </div>
        <div class="text-xs font-mono text-accent truncate">
          {store.shadowsocksUrl}
        </div>
      </div>
      <div class="flex gap-1">
        <button
          onclick={() => (showQR = !showQR)}
          class="p-1.5 bg-surface-3 border border-border rounded hover:border-accent/50 transition-colors text-text-2"
          title={_("misc.qr_show")}
        >
          <QrCode size={14} />
        </button>
        <button
          onclick={() => {
            navigator.clipboard.writeText(store.shadowsocksUrl);
            store.notify(_("notify.copied"));
          }}
          class="px-2 py-1 bg-surface-3 border border-border rounded text-[10px] hover:border-text-2/50 transition-colors shrink-0"
        >
          {_("action.copy")}
        </button>
      </div>
    </div>
    {#if showQR}
      <div
        class="flex justify-center p-2 bg-white rounded border border-border animate-in fade-in zoom-in duration-300"
      >
        <ShadowsocksQR url={store.shadowsocksUrl} />
      </div>
    {/if}
  </div>
{/if}

<!-- Disk Usage -->
{#if store.overview?.disk}
  <div class="ui-card ui-card--rounded p-4 mb-4 relative overflow-hidden">
    <div
      class="absolute inset-0 opacity-15 transition-all duration-700 {diskColor}"
      style="width: {diskPercent}%"
    ></div>
    <div class="relative">
      <h3 class="text-sm font-medium mb-3 flex items-center gap-1.5">
        <HardDrive size={14} class="text-text-2" />
        {_("disk.title")}
      </h3>
      <div class="h-1.5 bg-surface rounded-full overflow-hidden mb-2">
        <div
          class="h-full rounded-full transition-all duration-500 {diskColor}"
          style="width: {diskPercent}%"
        ></div>
      </div>
      <div class="flex justify-between text-xs text-text-2">
        <span
          >{store.fmtBytes(store.overview.disk.used_bytes)} {_("disk.used")}</span
        >
        <span
          >{store.fmtBytes(store.overview.disk.available_bytes)}
          {_("disk.free_of")}
          {store.fmtBytes(store.overview.disk.total_bytes)}</span
        >
      </div>
    </div>
  </div>
{/if}

<!-- Federation traffic -->
{#if dashboardFederation}
  <div class="mb-4">
    <h3 class="text-sm font-medium mb-2 flex items-center gap-1.5">
      <Network size={14} class="text-text-2" />
      <a href="{base}/federation/traffic" class="hover:text-accent transition-colors">
        {_("tab.federation")}
      </a>
    </h3>
    <FederationStatsGrid
      stats={dashboardFederation.stats}
      health={dashboardFederation.health}
      onHealthSelect={(tier: FederationHealthTier) =>
        goto(federationHealthFilterHref(tier))}
    />
    {#if store.overview?.email_servers}
      <div class="grid grid-cols-3 gap-3">
        <div class="ui-card ui-card--rounded p-3 text-center">
          <div class="text-lg font-semibold tabular-nums">{fedConnections}</div>
          <div class="text-text-2 text-[10px] uppercase tracking-wider mt-1">
            {_("traffic.connections")}
          </div>
        </div>
        <div class="ui-card ui-card--rounded p-3 text-center">
          <div class="text-lg font-semibold tabular-nums">
            {store.overview.email_servers.domain_servers}
          </div>
          <div class="text-text-2 text-[10px] uppercase tracking-wider mt-1">
            {_("traffic.domains")}
          </div>
        </div>
        <div class="ui-card ui-card--rounded p-3 text-center">
          <div class="text-lg font-semibold tabular-nums">
            {store.overview.email_servers.ip_servers}
          </div>
          <div class="text-text-2 text-[10px] uppercase tracking-wider mt-1">
            {_("traffic.ip_servers")}
          </div>
        </div>
      </div>
    {/if}
  </div>
{:else if store.overview?.email_servers}
  <div class="ui-card ui-card--rounded p-4 mb-4">
    <h3 class="text-sm font-medium mb-2 flex items-center gap-1.5">
      <Network size={14} class="text-text-2" />
      {_("tab.federation")}
    </h3>
    <div class="grid grid-cols-3 gap-3 text-center">
      <div>
        <div class="text-lg font-semibold">{fedConnections}</div>
        <div class="text-text-2 text-xs">{_("traffic.connections")}</div>
      </div>
      <div>
        <div class="text-lg font-semibold">
          {store.overview.email_servers.domain_servers}
        </div>
        <div class="text-text-2 text-xs">{_("traffic.domains")}</div>
      </div>
      <div>
        <div class="text-lg font-semibold">
          {store.overview.email_servers.ip_servers}
        </div>
        <div class="text-text-2 text-xs">{_("traffic.ip_servers")}</div>
      </div>
    </div>
  </div>
{/if}

<!-- Purge actions -->
<div class="mb-4">
  <h3 class="text-sm font-medium mb-3 flex items-center gap-1.5 text-text-2">
    <Trash2 size={14} />
    {_("dashboard.actions")}
  </h3>

  <div class="grid sm:grid-cols-2 gap-3">
    <!-- Message files -->
    <div class="ui-card ui-card--rounded p-3 flex flex-col gap-2">
      <div class="flex items-center gap-2 text-xs font-medium text-text mb-1">
        <HardDrive size={13} class="text-text-2 shrink-0" />
        {_("queue.purge_files")}
      </div>

      <div
        class="rounded-lg border border-border bg-surface p-2.5 space-y-2 transition-opacity {rotationApiAvailable
          ? ''
          : 'opacity-45 pointer-events-none select-none'}"
        title={rotationApiAvailable ? undefined : _("queue.rotation_unsupported")}
      >
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-medium text-text">
              {_("svc.message_retention")}
            </div>
            <p class="text-[10px] text-text-2 leading-snug mt-0.5">
              {#if rotationApiAvailable}
                {rotationEnabled
                  ? _("queue.rotation_on_hint", { days: String(rotationDays) })
                  : _("queue.rotation_off_hint")}
              {:else}
                {_("queue.rotation_unsupported")}
              {/if}
            </p>
          </div>
          <ToggleSwitch
            checked={rotationEnabled}
            disabled={store.busy || !rotationApiAvailable}
            label={_("svc.message_retention")}
            onclick={() => store.toggleMessageRetention()}
          />
        </div>
        <div class="flex gap-2 items-center">
          <label class="text-[11px] text-text-2 shrink-0" for="rotation-days">
            {_("queue.rotation_keep")}
          </label>
          <Select
            id="rotation-days"
            bind:value={rotationDaysSelect}
            disabled={!rotationApiAvailable || !rotationEnabled || store.busy}
            onchange={() => store.setMessageRetentionDays(rotationDaysSelect)}
            class="flex-1 bg-surface-2 py-1.5 disabled:opacity-45"
          >
            {#each ROTATION_DAY_OPTIONS as days}
              <option value={days}>{_("queue.retention_days", { n: String(days) })}</option>
            {/each}
          </Select>
        </div>
      </div>

      <label class="text-[11px] text-text-2" for="purge-retention">
        {_("queue.older_than")}
      </label>
      <div class="flex gap-2">
        <Select
          id="purge-retention"
          bind:value={selectedRetention}
          disabled={purging}
          class="flex-1"
        >
          {#each RETENTION_KEYS as opt}
            <option value={opt.value}>{_(opt.key)}</option>
          {/each}
        </Select>
        <button
          type="button"
          onclick={purgeOlder}
          disabled={purging}
          class="shrink-0 px-3 py-2 text-xs font-medium rounded-lg border border-warning/40 bg-warning/10 text-warning hover:bg-warning/20 transition-colors disabled:opacity-50"
        >
          {purging ? "…" : _("queue.purge_short")}
        </button>
      </div>

      <button
        type="button"
        onclick={() => store.purge("purge_read_blobs")}
        disabled={purging}
        class="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-xs text-start rounded-lg border border-border bg-surface hover:border-accent/40 hover:bg-surface-3 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
      >
        <span>{_("queue.purge_read_blobs")}</span>
        <Trash2 size={13} class="text-text-2 shrink-0" />
      </button>
      <button
        type="button"
        onclick={purgeAllBlobs}
        disabled={purging}
        class="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-xs text-start rounded-lg border border-danger/35 bg-danger/5 text-danger hover:bg-danger/10 hover:border-danger/50 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
      >
        <span>{_("queue.purge_all_files")}</span>
        <Trash2 size={13} class="shrink-0" />
      </button>
    </div>

    <!-- Actions -->
    <div class="ui-card ui-card--rounded p-3 flex flex-col gap-2">
      <div class="flex items-center gap-2 text-xs font-medium text-text mb-1">
        <Server size={13} class="text-text-2 shrink-0" />
        {_("actions.title")}
      </div>

      <button
        type="button"
        onclick={() => store.reload()}
        disabled={store.reloading || purging}
        class="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-xs text-start rounded-lg border border-border bg-surface hover:border-accent/40 hover:bg-surface-3 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
      >
        <span>
          {store.reloading ? _("action.restarting") : _("actions.soft_reload")}
        </span>
        <RefreshCw
          size={13}
          class="text-text-2 shrink-0 {store.reloading ? 'animate-spin' : ''}"
        />
      </button>

      <button
        type="button"
        onclick={() => store.purge("purge_all")}
        disabled={purging}
        class="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-xs text-start rounded-lg border border-danger/35 bg-danger/5 text-danger hover:bg-danger/10 hover:border-danger/50 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
      >
        <span>{_("queue.purge_all")}</span>
        <Trash2 size={13} class="shrink-0" />
      </button>

      <button
        type="button"
        onclick={() => store.purge("purge_read")}
        disabled={purging}
        class="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-xs text-start rounded-lg border border-border bg-surface hover:border-accent/40 hover:bg-surface-3 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
      >
        <span>{_("queue.purge_read")}</span>
        <Trash2 size={13} class="text-text-2 shrink-0" />
      </button>
    </div>
  </div>
</div>

<!-- Update Modal -->
{#if showUpdateModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    onclick={() => showUpdateModal = false}
  >
    <div
      class="ui-card ui-card--panel w-full max-w-sm p-5"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-semibold flex items-center gap-2">
          <Server size={14} class="text-accent" />
          {_("version.title")}
        </h2>
        <button
          onclick={() => showUpdateModal = false}
          class="p-1 text-text-2 hover:text-text rounded transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div class="bg-surface rounded-lg p-3 border border-border mb-4">
        <div class="text-text-2 text-[10px] uppercase tracking-wider mb-1"
          >{_("version.current")}</div
        >
        <div class="text-lg font-semibold font-mono">
          {store.overview?.version ?? store.serverVersion ?? "—"}
        </div>
      </div>

      {#if store.latestServerVersion}
        <div class="bg-surface rounded-lg p-3 border border-border mb-4">
          <div class="text-text-2 text-[10px] uppercase tracking-wider mb-1"
            >{_("version.latest")}</div
          >
          <div class="text-lg font-semibold font-mono">{store.latestServerVersion}</div>
          {#if !store.hasUpdate}
            <div class="mt-1 text-xs text-success flex items-center gap-1"
              >{_("version.up_to_date")}</div
            >
          {:else}
            <div class="mt-1 text-xs text-warning flex items-center gap-1"
              >{_("version.update_available")}</div
            >
          {/if}
        </div>
      {/if}

      <div class="flex gap-2">
        <button
          onclick={() => store.checkServerUpdate()}
          disabled={store.checkingUpdates}
          class="flex-1 px-3 py-2 text-xs bg-accent/10 text-accent border border-accent/30 rounded-lg hover:bg-accent/20 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw size={12} class={store.checkingUpdates ? "animate-spin" : ""} />
          {store.checkingUpdates
            ? _("version.checking")
            : _("version.check_updates")}
        </button>
        <a
          href="https://github.com/themadorg/madmail/releases/latest"
          target="_blank"
          rel="noopener"
          class="px-3 py-2 text-xs bg-surface border border-border rounded-lg hover:bg-surface-3 transition-colors flex items-center gap-1.5 text-text-2"
        >
          <ExternalLink size={12} />
          {_("misc.github")}
        </a>
      </div>
    </div>
  </div>
{/if}
