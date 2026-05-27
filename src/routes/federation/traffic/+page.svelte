<script lang="ts">
  import { store } from "$lib/state.svelte";
  import { page } from "$app/stores";
  import type { FederationServerEntry } from "$lib/api";
  import { t, getLocale } from "$lib/i18n";
  import {
    Activity,
    Clock,
    SearchX,
    ChevronLeft,
    ChevronRight,
    ShieldBan,
    ShieldCheck,
    ArrowUpDown,
    Search,
  } from "lucide-svelte";
  import {
    classifyFederationServer,
    federationServerFailed,
  } from "$lib/federationStats";
  import { parseHealthParam } from "$lib/federationHealthNav";
  import Select from "$lib/components/Select.svelte";

  type SortKey =
    | "domain"
    | "last_active"
    | "outbound"
    | "inbound"
    | "queued"
    | "latency"
    | "failures";
  type FilterKey =
    | "all"
    | "failures"
    | "queued"
    | "restricted"
    | "unrestricted";

  let locale = $state(getLocale());
  function _(key: string, params?: Record<string, string>): string {
    void locale;
    return t(key, params);
  }
  $effect(() => {
    locale = getLocale();
  });

  $effect(() => {
    if (store.connected) {
      store.loadFederationRules();
      store.loadFederationSettings();
    }
  });

  let search = $state("");
  let filterBy = $state<FilterKey>("all");
  let healthFilter = $derived(
    parseHealthParam($page.url.searchParams.get("health")),
  );
  let sortBy = $state<SortKey>("last_active");
  let sortAsc = $state(false);
  let currentPage = $state(1);
  const itemsPerPage = 20;

  const FILTER_OPTIONS: { value: FilterKey; labelKey: string }[] = [
    { value: "all", labelKey: "fed.filter_all" },
    { value: "failures", labelKey: "fed.filter_failures" },
    { value: "queued", labelKey: "fed.filter_queued" },
    { value: "restricted", labelKey: "fed.filter_restricted" },
    { value: "unrestricted", labelKey: "fed.filter_unrestricted" },
  ];

  const SORT_OPTIONS: { key: SortKey; labelKey: string }[] = [
    { key: "last_active", labelKey: "fed.sort_last_active" },
    { key: "domain", labelKey: "fed.sort_domain" },
    { key: "outbound", labelKey: "fed.sort_outbound" },
    { key: "inbound", labelKey: "fed.sort_inbound" },
    { key: "queued", labelKey: "fed.sort_queued" },
    { key: "latency", labelKey: "fed.sort_latency" },
    { key: "failures", labelKey: "fed.sort_failures" },
  ];

  let localHostnames = $derived.by(() => {
    const names = new Set<string>();
    const smtpHost = store.settings?.smtp_hostname?.value;
    if (smtpHost) names.add(smtpHost.toLowerCase());
    try {
      const url = new URL(store.baseUrl);
      names.add(url.hostname.toLowerCase());
    } catch {
      /* ignore */
    }
    return names;
  });

  function fmtDomain(d: string): string {
    return (d || "").replace(/^\[(.*)\]$/, "$1");
  }

  function totalFailed(s: FederationServerEntry): number {
    return federationServerFailed(s);
  }

  function serverHasRule(domain: string): boolean {
    const bare = fmtDomain(domain).toLowerCase();
    return (
      store.federationRules?.rules.some(
        (r) => fmtDomain(r.domain).toLowerCase() === bare,
      ) ?? false
    );
  }

  function emptyServerEntry(domain: string): FederationServerEntry {
    return {
      domain,
      queued_messages: 0,
      failed_http: 0,
      failed_https: 0,
      failed_smtp: 0,
      success_http: 0,
      success_https: 0,
      success_smtp: 0,
      inbound_deliveries: 0,
      successful_deliveries: 0,
      mean_latency_ms: 0,
      last_active: 0,
    };
  }

  /** Under ACCEPT policy, federation rules are block-list entries. */
  function isBlockedByPolicy(domain: string): boolean {
    if ((store.federationSettings?.policy ?? "ACCEPT") !== "ACCEPT") {
      return false;
    }
    return serverHasRule(domain);
  }

  let filteredServers = $derived.by(() => {
    if (!store.federationServers) return [];
    let list = store.federationServers.servers.filter(
      (s) => !localHostnames.has(fmtDomain(s.domain).toLowerCase()),
    );

    const policy = store.federationSettings?.policy ?? "ACCEPT";
    if (policy === "ACCEPT" && store.federationRules) {
      const seen = new Set(
        list.map((s) => fmtDomain(s.domain).toLowerCase()),
      );
      for (const rule of store.federationRules.rules) {
        const bare = fmtDomain(rule.domain).toLowerCase();
        if (!localHostnames.has(bare) && !seen.has(bare)) {
          seen.add(bare);
          list.push(emptyServerEntry(rule.domain));
        }
      }
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) => fmtDomain(s.domain).toLowerCase().includes(q));
    }

    if (filterBy === "failures") {
      list = list.filter((s) => totalFailed(s) > 0);
    } else if (filterBy === "queued") {
      list = list.filter((s) => s.queued_messages > 0);
    } else if (filterBy === "restricted") {
      list = list.filter((s) => serverHasRule(s.domain));
    } else if (filterBy === "unrestricted") {
      list = list.filter((s) => !serverHasRule(s.domain));
    }

    if (healthFilter) {
      list = list.filter((s) => classifyFederationServer(s) === healthFilter);
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "domain":
          cmp = fmtDomain(a.domain).localeCompare(fmtDomain(b.domain), undefined, {
            sensitivity: "base",
          });
          break;
        case "last_active":
          cmp = a.last_active - b.last_active;
          break;
        case "outbound":
          cmp = a.successful_deliveries - b.successful_deliveries;
          break;
        case "inbound":
          cmp = a.inbound_deliveries - b.inbound_deliveries;
          break;
        case "queued":
          cmp = a.queued_messages - b.queued_messages;
          break;
        case "latency":
          cmp = a.mean_latency_ms - b.mean_latency_ms;
          break;
        case "failures":
          cmp = totalFailed(a) - totalFailed(b);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });

    if (policy === "ACCEPT") {
      const active: FederationServerEntry[] = [];
      const blocked: FederationServerEntry[] = [];
      for (const s of list) {
        (isBlockedByPolicy(s.domain) ? blocked : active).push(s);
      }
      list = [...active, ...blocked];
    }

    return list;
  });

  let totalItems = $derived(filteredServers.length);
  let totalPages = $derived(Math.max(1, Math.ceil(totalItems / itemsPerPage)));
  let paginatedServers = $derived(
    filteredServers.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage,
    ),
  );

  $effect(() => {
    void search;
    void filterBy;
    void healthFilter;
    void sortBy;
    void sortAsc;
    currentPage = 1;
  });

  function toggleSort(col: SortKey) {
    if (sortBy === col) {
      sortAsc = !sortAsc;
    } else {
      sortBy = col;
      sortAsc = col === "domain";
    }
  }

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
</script>

<div class="tab-pane federation-traffic">
  <div class="section-bar">
    <span class="section-count">
      {totalItems} {_("fed.tracked_servers")}
      {#if search || filterBy !== "all" || healthFilter}
        ({_("fed.matching_total", {
          shown: String(totalItems),
          total: String(store.federationServers?.total ?? 0),
        })}){/if}
    </span>
  </div>

  <div class="traffic-toolbar">
    <div class="search-wrap search-wrap-icon">
      <Search size={13} class="search-icon" aria-hidden="true" />
      <input
        type="text"
        bind:value={search}
        placeholder={_("fed.search_placeholder")}
        class="search-input"
      />
    </div>

    <div class="traffic-controls">
      <label class="traffic-filter">
        <span class="traffic-filter-label">{_("fed.filter_label")}</span>
        <Select class="traffic-select" bind:value={filterBy}>
          {#each FILTER_OPTIONS as opt}
            <option value={opt.value}>{_(opt.labelKey)}</option>
          {/each}
        </Select>
      </label>

      <div class="traffic-sort-wrap">
        <span class="traffic-sort-label">{_("fed.sort_label")}</span>
        <div class="traffic-sort" role="group" aria-label={_("fed.sort_label")}>
          {#each SORT_OPTIONS as opt}
            <button
              type="button"
              class="traffic-sort-btn"
              class:active={sortBy === opt.key}
              onclick={() => toggleSort(opt.key)}
            >
              <ArrowUpDown size={11} class="traffic-sort-btn-icon" aria-hidden="true" />
              {_(opt.labelKey)}
              {#if sortBy === opt.key}
                <span class="sort-dir">{sortAsc ? "↑" : "↓"}</span>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    </div>
  </div>

  {#if !store.federationServers}
    <p class="loading">{_("fed.loading_traffic")}</p>
  {:else if filteredServers.length === 0}
    <div class="empty-state">
      {#if search || filterBy !== "all" || healthFilter}
        <SearchX size={32} />
        <p>
          {#if search}
            {_("fed.rule_no_results", { query: search })}
          {:else}
            {_("fed.rule_no_results", { query: _(FILTER_OPTIONS.find((o) => o.value === filterBy)?.labelKey ?? "fed.filter_all") })}
          {/if}
        </p>
      {:else}
        <Activity size={32} />
        <p>{_("fed.no_traffic_yet")}</p>
      {/if}
    </div>
  {:else}
    <div class="server-list">
      {#each paginatedServers as server (server.domain)}
        {@const domain = fmtDomain(server.domain)}
        {@const hasRule = serverHasRule(server.domain)}
        {@const policy = store.federationSettings?.policy || "ACCEPT"}
        {@const isBlockAction = policy === "ACCEPT"}
        {@const failed = totalFailed(server)}
        {@const hasFailures = failed > 0}
        <div
          class="server-card"
          class:has-failures={hasFailures}
          class:is-blocked={hasRule && policy === "ACCEPT"}
        >
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
                  {failed}
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
