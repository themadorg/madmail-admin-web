<script lang="ts">
  import { store } from "$lib/state.svelte";
  import { t, getLocale } from "$lib/i18n";
  import {
    Activity,
    Clock,
    SearchX,
    ChevronLeft,
    ChevronRight,
    ShieldBan,
    ShieldCheck,
  } from "lucide-svelte";

  let locale = $state(getLocale());
  function _(key: string, params?: Record<string, string>): string {
    void locale;
    return t(key, params);
  }
  $effect(() => {
    locale = getLocale();
  });

  let search = $state("");
  let currentPage = $state(1);
  const itemsPerPage = 20;

  // Derived paginated & filtered list
  // Derive local hostnames to exclude self from traffic
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

  let filteredServers = $derived.by(() => {
    if (!store.federationServers) return [];
    let list = store.federationServers.servers.filter(
      (s) => !localHostnames.has(fmtDomain(s.domain).toLowerCase())
    );
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.domain.toLowerCase().includes(q));
    }
    return list;
  });

  let totalItems = $derived(filteredServers.length);
  let totalPages = $derived(Math.max(1, Math.ceil(totalItems / itemsPerPage)));
  let paginatedServers = $derived(
    filteredServers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
  );

  // Auto-reset page on search change
  $effect(() => {
    void search;
    currentPage = 1;
  });

  function formatLatency(ms: number): string {
    if (!ms || ms === 0) return "—";
    if (ms < 1000) return _("latency.ms", { n: String(Math.round(ms)) });
    return _("latency.s", { n: ((ms || 0) / 1000).toFixed(1) });
  }

  function timeAgo(ts: number): string {
    if (!ts) return _("time.never");
    const diff = Math.floor(Date.now() / 1000 - ts);
    if (diff < 60) return _("time.seconds_ago", { n: String(diff) });
    if (diff < 3600)
      return _("time.minutes_ago", { n: String(Math.floor(diff / 60)) });
    if (diff < 86400)
      return _("time.hours_ago", { n: String(Math.floor(diff / 3600)) });
    return _("time.days_ago", { n: String(Math.floor(diff / 86400)) });
  }

  function fmtDomain(d: string): string {
    return (d || "").replace(/^\[(.*)\]$/, "$1");
  }
</script>

<div class="federation-traffic">
  <div class="section-bar">
    <span class="section-count">
      {totalItems} {_("fed.tracked_servers")}
      {#if search}
        ({_("fed.matching_total", {
          shown: String(totalItems),
          total: String(store.federationServers?.total ?? 0),
        })}){/if}
    </span>
  </div>

  <div class="search-wrap">
    <input
      type="text"
      bind:value={search}
      placeholder={_("fed.search_placeholder")}
      class="search-input"
    />
  </div>

  {#if !store.federationServers}
    <p class="loading">{_("fed.loading_traffic")}</p>
  {:else if filteredServers.length === 0}
    <div class="empty-state">
      {#if search}
        <SearchX size={32} />
        <p>{_("fed.rule_no_results", { query: search })}</p>
      {:else}
        <Activity size={32} />
        <p>{_("fed.no_traffic_yet")}</p>
      {/if}
    </div>
  {:else}
    <div class="server-list">
      {#each paginatedServers as server (server.domain)}
        {@const domain = fmtDomain(server.domain)}
        {@const hasRule = store.federationRules?.rules.some(r => r.domain === domain)}
        {@const policy = store.federationSettings?.policy || "ACCEPT"}
        {@const isBlockAction = policy === "ACCEPT"}
        {@const totalFailed =
          server.failed_http + server.failed_https + server.failed_smtp}
        {@const hasFailures = totalFailed > 0}
        <div class="server-card" class:has-failures={hasFailures}>
          <div class="server-header">
            <span class="server-domain">{domain}</span>
            <div class="flex items-center gap-3">
              <span class="server-last-active">
                <Clock size={10} />
                {timeAgo(server.last_active)}
              </span>

              {#if hasRule}
                <button
                  onclick={() => store.deleteFederationRule(domain)}
                  disabled={store.busy}
                  class="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded border border-accent/30 text-accent hover:bg-accent/10 transition-all disabled:opacity-50"
                  title={_("fed.remove_restriction", { domain })}
                >
                  <ShieldCheck size={12} />
                  {_("fed.status_restricted")}
                </button>
              {:else}
                <button
                  onclick={() => store.addFederationRule(domain)}
                  disabled={store.busy}
                  class="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded border border-border text-text-2 hover:border-danger/50 hover:text-danger hover:bg-danger/5 transition-all disabled:opacity-50"
                  title={(isBlockAction ? _("fed.action_block") : _("fed.action_allow")) + " " + domain}
                >
                  <ShieldBan size={12} />
                  {isBlockAction ? _("fed.action_block") : _("fed.action_allow")}
                </button>
              {/if}
            </div>
          </div>
          <div class="server-stats">
            <div class="stat-item">
              <span class="stat-label">{_("fed.inbound")}</span>
              <span class="stat-value success">{server.inbound_deliveries}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">{_("fed.outbound")}</span>
              <span class="stat-value success"
                >{server.successful_deliveries}</span
              >
              {#if server.success_https > 0 || server.success_http > 0 || server.success_smtp > 0}
                <span class="transport-breakdown">
                  {#if server.success_https > 0}<span class="transport-tag https"
                      >{_("fed.transport_https")}
                      {server.success_https}</span
                    >{/if}
                  {#if server.success_http > 0}<span class="transport-tag http"
                      >{_("fed.transport_http")}
                      {server.success_http}</span
                    >{/if}
                  {#if server.success_smtp > 0}<span class="transport-tag smtp"
                      >{_("fed.transport_smtp")}
                      {server.success_smtp}</span
                    >{/if}
                </span>
              {/if}
            </div>
            <div class="stat-item">
              <span class="stat-label">{_("fed.queued")}</span>
              <span class="stat-value">{server.queued_messages}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">{_("fed.avg_latency")}</span>
              <span class="stat-value"
                >{formatLatency(server.mean_latency_ms)}</span
              >
            </div>
            {#if hasFailures}
              <div class="stat-item failure">
                <span class="stat-label">{_("fed.expired")}</span>
                <span class="stat-value danger">
                  {totalFailed}
                  <span class="failure-breakdown">
                    ({#if server.failed_https > 0}{_("fed.transport_https")}:{server.failed_https}{/if}
                    {#if server.failed_http > 0} {_("fed.transport_http")}:{server.failed_http}{/if}
                    {#if server.failed_smtp > 0} {_("fed.transport_smtp")}:{server.failed_smtp}{/if})
                  </span>
                </span>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <!-- Pagination controls -->
    {#if totalPages > 1}
      <div class="pagination">
        <button
          class="btn-page"
          disabled={currentPage === 1}
          onclick={() => (currentPage -= 1)}
          aria-label={_("misc.page_prev")}
        >
          <ChevronLeft size={14} />
        </button>

        <span class="page-info">
          {_("misc.page_of", {
            current: String(currentPage),
            total: String(totalPages),
          })}
        </span>

        <button
          class="btn-page"
          disabled={currentPage === totalPages}
          onclick={() => (currentPage += 1)}
          aria-label={_("misc.page_next")}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    {/if}
  {/if}
</div>
