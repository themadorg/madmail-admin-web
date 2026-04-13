<script lang="ts">
  import { store } from "$lib/state.svelte";
  import {
    GitBranch,
    Plus,
    Trash2,
    ShieldCheck,
    ShieldOff,
    ToggleLeft,
    ToggleRight,
    Activity,
    Clock,
    AlertTriangle,
    SearchX,
  } from "lucide-svelte";

  let showAdd = $state(false);
  let newDomain = $state("");
  let confirmingDelete = $state("");
  let search = $state("");
  let activeTab = $state<"rules" | "servers">("rules");

  // Derived
  let isEnabled = $derived(store.federationSettings?.enabled ?? false);
  let policy = $derived(store.federationSettings?.policy ?? "ACCEPT");
  let isAccept = $derived(policy === "ACCEPT");

  let filteredRules = $derived.by(() => {
    if (!store.federationRules) return [];
    if (!search) return store.federationRules.rules;
    const q = search.toLowerCase();
    return store.federationRules.rules.filter((r) =>
      r.domain.toLowerCase().includes(q),
    );
  });

  let filteredServers = $derived.by(() => {
    if (!store.federationServers) return [];
    if (!search) return store.federationServers.servers;
    const q = search.toLowerCase();
    return store.federationServers.servers.filter((s) =>
      s.domain.toLowerCase().includes(q),
    );
  });

  function formatDate(ts: number): string {
    if (!ts) return "—";
    return new Date(ts * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatLatency(ms: number): string {
    if (!ms || ms === 0) return "—";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function timeAgo(ts: number): string {
    if (!ts) return "never";
    const diff = Math.floor(Date.now() / 1000 - ts);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  async function handleAdd() {
    if (!newDomain.trim()) return;
    await store.addFederationRule(newDomain.trim());
    newDomain = "";
    showAdd = false;
  }

  function requestDelete(domain: string) {
    confirmingDelete = confirmingDelete === domain ? "" : domain;
  }

  async function handleConfirmDelete() {
    const d = confirmingDelete;
    confirmingDelete = "";
    await store.deleteFederationRule(d);
  }
</script>

<!-- Policy controls header -->
<div class="fed-header">
  <div class="fed-policy-info">
    <div class="fed-icon">
      <GitBranch size={16} />
    </div>
    <div class="fed-policy-text">
      <div class="fed-label">Federation Policy</div>
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
            Open federation — rules act as <strong>blocklist</strong>
          {:else}
            Closed federation — rules act as <strong>allowlist</strong>
          {/if}
        </span>
      </div>
    </div>
  </div>

  <div class="fed-actions">
    <!-- Enable/Disable toggle -->
    <button
      class="toggle-btn"
      class:active={isEnabled}
      onclick={() => store.toggleFederationEnabled()}
      disabled={store.busy}
    >
      {#if isEnabled}
        <ToggleRight size={16} />
        <span>Active</span>
      {:else}
        <ToggleLeft size={16} />
        <span>Inactive</span>
      {/if}
    </button>

    <!-- Policy switch -->
    <button
      class="policy-switch"
      onclick={() => store.setFederationPolicy(isAccept ? "REJECT" : "ACCEPT")}
      disabled={store.busy}
      title="Switch to {isAccept ? 'REJECT' : 'ACCEPT'} mode"
    >
      {#if isAccept}
        <ShieldOff size={13} />
        Switch to REJECT
      {:else}
        <ShieldCheck size={13} />
        Switch to ACCEPT
      {/if}
    </button>
  </div>
</div>

{#if !isEnabled}
  <div class="inactive-banner">
    <AlertTriangle size={14} />
    <span
      >Federation enforcement is <strong>inactive</strong>. Enable it to enforce
      policy rules on inbound and outbound traffic.</span
    >
  </div>
{/if}

<!-- Tabs -->
<div class="tab-bar">
  <button
    class="tab"
    class:active={activeTab === "rules"}
    onclick={() => (activeTab = "rules")}
  >
    <ShieldCheck size={13} />
    Rules
    {#if store.federationRules}
      <span class="tab-count">{store.federationRules.total}</span>
    {/if}
  </button>
  <button
    class="tab"
    class:active={activeTab === "servers"}
    onclick={() => (activeTab = "servers")}
  >
    <Activity size={13} />
    Traffic
    {#if store.federationServers}
      <span class="tab-count">{store.federationServers.total}</span>
    {/if}
  </button>
</div>

<!-- ── Rules Tab ── -->
{#if activeTab === "rules"}
  <div class="section-bar">
    <span class="section-count">
      {store.federationRules?.total ?? 0} domain exception{(store.federationRules
        ?.total ?? 0) !== 1
        ? "s"
        : ""}
    </span>
    <button class="btn-add" onclick={() => (showAdd = !showAdd)}>
      <Plus size={12} />
      Add Domain
    </button>
  </div>

  {#if showAdd}
    <div class="add-form">
      <div class="field">
        <label for="fed-domain">Domain</label>
        <input
          id="fed-domain"
          type="text"
          bind:value={newDomain}
          placeholder="example.com or [1.2.3.4]"
          onkeydown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
        />
      </div>
      <div class="form-actions">
        <button class="btn-cancel" onclick={() => (showAdd = false)}>
          Cancel
        </button>
        <button
          class="btn-submit"
          onclick={handleAdd}
          disabled={!newDomain.trim()}
        >
          {isAccept ? "Block Domain" : "Allow Domain"}
        </button>
      </div>
    </div>
  {/if}

  {#if (store.federationRules?.total ?? 0) > 3}
    <div class="search-wrap">
      <input
        type="text"
        bind:value={search}
        placeholder="Search rules..."
        class="search-input"
      />
    </div>
  {/if}

  {#if !store.federationRules}
    <p class="loading">Loading…</p>
  {:else if filteredRules.length === 0 && store.federationRules.total === 0 && !showAdd}
    <div class="empty-state">
      <GitBranch size={32} />
      <p>No domain exceptions configured</p>
      <span class="empty-hint"
        >{isAccept
          ? "Add domains to block specific servers"
          : "Add domains to allow trusted servers"}</span
      >
      <button class="btn-add" onclick={() => (showAdd = true)}>
        <Plus size={12} />
        Add First Rule
      </button>
    </div>
  {:else if filteredRules.length === 0 && store.federationRules.total > 0}
    <div class="empty-state">
      <SearchX size={24} />
      <p>No results for "{search}"</p>
    </div>
  {:else}
    <div class="entry-list">
      {#each filteredRules as rule (rule.domain)}
        <div class="entry">
          <div class="entry-info">
            <div class="entry-domain">
              <span class="rule-type-badge" class:blocklist={isAccept}>
                {isAccept ? "BLOCK" : "ALLOW"}
              </span>
              <span class="domain-text">{rule.domain}</span>
            </div>
            <span class="entry-date">
              <Clock size={10} />
              Added {formatDate(rule.created_at)}
            </span>
          </div>
          <div class="entry-actions">
            <button
              class="btn-delete"
              onclick={() => requestDelete(rule.domain)}
              aria-label="Delete {rule.domain}"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
{/if}

<!-- ── Servers Tab ── -->
{#if activeTab === "servers"}
  <div class="section-bar">
    <span class="section-count">
      {store.federationServers?.total ?? 0} tracked server{(store
        .federationServers?.total ?? 0) !== 1
        ? "s"
        : ""}
    </span>
  </div>

  {#if (store.federationServers?.total ?? 0) > 3}
    <div class="search-wrap">
      <input
        type="text"
        bind:value={search}
        placeholder="Search servers..."
        class="search-input"
      />
    </div>
  {/if}

  {#if !store.federationServers}
    <p class="loading">Loading…</p>
  {:else if filteredServers.length === 0}
    <div class="empty-state">
      <Activity size={32} />
      <p>No federation traffic recorded yet</p>
    </div>
  {:else}
    <div class="server-list">
      {#each filteredServers as server (server.domain)}
        {@const totalFailed =
          server.failed_http + server.failed_https + server.failed_smtp}
        {@const hasFailures = totalFailed > 0}
        <div class="server-card" class:has-failures={hasFailures}>
          <div class="server-header">
            <span class="server-domain">{server.domain}</span>
            <span class="server-last-active">
              <Clock size={10} />
              {timeAgo(server.last_active)}
            </span>
          </div>
          <div class="server-stats">
            <div class="stat-item">
              <span class="stat-label">Delivered</span>
              <span class="stat-value success"
                >{server.successful_deliveries}</span
              >
              {#if server.success_https > 0 || server.success_http > 0 || server.success_smtp > 0}
                <span class="transport-breakdown">
                  {#if server.success_https > 0}<span class="transport-tag https">HTTPS {server.success_https}</span>{/if}
                  {#if server.success_http > 0}<span class="transport-tag http">HTTP {server.success_http}</span>{/if}
                  {#if server.success_smtp > 0}<span class="transport-tag smtp">SMTP {server.success_smtp}</span>{/if}
                </span>
              {/if}
            </div>
            <div class="stat-item">
              <span class="stat-label">Queued</span>
              <span class="stat-value">{server.queued_messages}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Latency</span>
              <span class="stat-value"
                >{formatLatency(server.mean_latency_ms)}</span
              >
            </div>
            {#if hasFailures}
              <div class="stat-item failure">
                <span class="stat-label">Failed</span>
                <span class="stat-value danger">
                  {totalFailed}
                  <span class="failure-breakdown">
                    ({#if server.failed_https > 0}HTTPS:{server.failed_https}{/if}
                    {#if server.failed_http > 0}
                      HTTP:{server.failed_http}{/if}
                    {#if server.failed_smtp > 0}SMTP:{server.failed_smtp}{/if})
                  </span>
                </span>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
{/if}

<!-- Delete confirmation modal -->
{#if confirmingDelete}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={() => (confirmingDelete = "")}>
    <div class="modal-backdrop"></div>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-box" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div class="modal-icon">
          <Trash2 size={18} />
        </div>
        <div class="modal-title">
          <h3>Remove Federation Rule</h3>
          <p class="modal-detail">{confirmingDelete}</p>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-cancel" onclick={() => (confirmingDelete = "")}>
          Cancel
        </button>
        <button class="btn-danger" onclick={handleConfirmDelete}>
          Remove
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── Header ── */
  .fed-header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    margin-bottom: 0.75rem;
    background: var(--th-surface-2);
    border: 1px solid var(--th-border);
    border-radius: 0.625rem;
  }

  .fed-policy-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .fed-icon {
    padding: 0.5rem;
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--th-accent) 12%, transparent);
    color: var(--th-accent);
    flex-shrink: 0;
  }

  .fed-policy-text {
    min-width: 0;
  }

  .fed-label {
    font-size: 0.6875rem;
    color: var(--th-text-2);
    opacity: 0.6;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.25rem;
  }

  .fed-value {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .policy-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.05em;
  }
  .policy-badge.accept {
    background: color-mix(in srgb, var(--th-success) 15%, transparent);
    color: var(--th-success);
  }
  .policy-badge.reject {
    background: color-mix(in srgb, var(--th-danger) 15%, transparent);
    color: var(--th-danger);
  }

  .policy-desc {
    font-size: 0.75rem;
    color: var(--th-text-2);
    opacity: 0.7;
  }
  .policy-desc strong {
    color: var(--th-text);
    opacity: 1;
  }

  .fed-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  /* ── Toggle ── */
  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    font-size: 0.75rem;
    font-weight: 500;
    border: 1px solid var(--th-border);
    border-radius: 0.5rem;
    background: transparent;
    color: var(--th-text-2);
    cursor: pointer;
    transition: all 0.15s;
  }
  .toggle-btn.active {
    border-color: color-mix(in srgb, var(--th-success) 40%, transparent);
    color: var(--th-success);
    background: color-mix(in srgb, var(--th-success) 8%, transparent);
  }
  .toggle-btn:hover:not(:disabled) {
    border-color: var(--th-accent);
  }
  .toggle-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .policy-switch {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.625rem;
    font-size: 0.6875rem;
    font-weight: 500;
    border: 1px solid var(--th-border);
    border-radius: 0.5rem;
    background: transparent;
    color: var(--th-text-2);
    cursor: pointer;
    transition: all 0.15s;
  }
  .policy-switch:hover:not(:disabled) {
    background: var(--th-surface-3);
  }
  .policy-switch:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ── Inactive Banner ── */
  .inactive-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    margin-bottom: 0.75rem;
    font-size: 0.75rem;
    color: var(--th-warning);
    background: color-mix(in srgb, var(--th-warning) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--th-warning) 20%, transparent);
    border-radius: 0.5rem;
    animation: slide-in 0.15s ease-out;
  }

  /* ── Tabs ── */
  .tab-bar {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 0.75rem;
    border-bottom: 1px solid var(--th-border);
    padding-bottom: 0;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--th-text-2);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: all 0.15s;
    margin-bottom: -1px;
  }
  .tab:hover {
    color: var(--th-text);
  }
  .tab.active {
    color: var(--th-accent);
    border-bottom-color: var(--th-accent);
  }

  .tab-count {
    font-size: 0.625rem;
    padding: 0.0625rem 0.375rem;
    border-radius: 999px;
    background: var(--th-surface-3);
    color: var(--th-text-2);
    font-weight: 600;
  }
  .tab.active .tab-count {
    background: color-mix(in srgb, var(--th-accent) 15%, transparent);
    color: var(--th-accent);
  }

  /* ── Section bar ── */
  .section-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .section-count {
    font-size: 0.8125rem;
    color: var(--th-text-2);
    opacity: 0.7;
  }

  /* ── Buttons ── */
  .btn-add {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.625rem;
    font-size: 0.75rem;
    border: 1px solid color-mix(in srgb, var(--th-accent) 30%, transparent);
    border-radius: 0.5rem;
    color: var(--th-accent);
    background: transparent;
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s;
  }
  .btn-add:hover {
    background: color-mix(in srgb, var(--th-accent) 10%, transparent);
  }

  .btn-cancel {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    border: 1px solid var(--th-border);
    border-radius: 0.5rem;
    color: var(--th-text-2);
    background: transparent;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-cancel:hover {
    background: var(--th-surface-2);
  }

  .btn-submit {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    border: none;
    border-radius: 0.5rem;
    color: #fff;
    background: var(--th-accent);
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-submit:hover {
    background: var(--th-accent-dim);
  }
  .btn-submit:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-delete {
    padding: 0.375rem;
    border: none;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--th-danger);
    opacity: 0.35;
    cursor: pointer;
    transition:
      opacity 0.15s,
      background 0.15s;
  }
  .btn-delete:hover {
    opacity: 1;
    background: color-mix(in srgb, var(--th-danger) 10%, transparent);
  }

  .btn-danger {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    border: none;
    border-radius: 0.5rem;
    color: #fff;
    background: var(--th-danger);
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-danger:hover {
    opacity: 0.85;
  }

  /* ── Add form ── */
  .add-form {
    padding: 1rem;
    margin-bottom: 0.75rem;
    background: var(--th-surface-2);
    border: 1px solid color-mix(in srgb, var(--th-accent) 20%, transparent);
    border-radius: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    animation: slide-in 0.15s ease-out;
  }

  .field label {
    display: block;
    font-size: 0.6875rem;
    color: var(--th-text-2);
    opacity: 0.7;
    margin-bottom: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .field input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: var(--th-surface-1);
    border: 1px solid var(--th-border);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    color: var(--th-text);
    outline: none;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
    box-sizing: border-box;
  }
  .field input::placeholder {
    color: var(--th-text-2);
    opacity: 0.35;
  }
  .field input:focus {
    border-color: var(--th-accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--th-accent) 20%, transparent);
  }

  .form-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  /* ── Search ── */
  .search-wrap {
    margin-bottom: 0.75rem;
  }

  .search-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: var(--th-surface-2);
    border: 1px solid var(--th-border);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    color: var(--th-text);
    outline: none;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
    box-sizing: border-box;
  }
  .search-input::placeholder {
    color: var(--th-text-2);
    opacity: 0.4;
  }
  .search-input:focus {
    border-color: var(--th-accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--th-accent) 20%, transparent);
  }

  /* ── Empty state ── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 0;
    color: var(--th-text-2);
    opacity: 0.5;
  }
  .empty-state :global(svg) {
    margin-bottom: 0.5rem;
    opacity: 0.4;
  }
  .empty-state p {
    font-size: 0.875rem;
    margin: 0 0 0.25rem;
  }

  .empty-hint {
    font-size: 0.75rem;
    margin-bottom: 0.75rem;
    opacity: 0.6;
  }

  /* ── Entry list ── */
  .entry-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.625rem 0.75rem;
    background: var(--th-surface-2);
    border: 1px solid var(--th-border);
    border-radius: 0.5rem;
    transition: border-color 0.15s;
  }
  .entry:hover {
    border-color: color-mix(in srgb, var(--th-accent) 30%, var(--th-border));
  }
  .entry:hover .btn-delete {
    opacity: 1;
  }

  .entry-info {
    min-width: 0;
    flex: 1;
  }

  .entry-domain {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .rule-type-badge {
    font-size: 0.5625rem;
    padding: 0.0625rem 0.375rem;
    border-radius: 999px;
    font-weight: 700;
    letter-spacing: 0.05em;
    background: color-mix(in srgb, var(--th-success) 15%, transparent);
    color: var(--th-success);
  }
  .rule-type-badge.blocklist {
    background: color-mix(in srgb, var(--th-danger) 15%, transparent);
    color: var(--th-danger);
  }

  .domain-text {
    font-size: 0.8125rem;
    font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo,
      monospace;
    color: var(--th-text);
    word-break: break-all;
  }

  .entry-date {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-top: 0.125rem;
    font-size: 0.625rem;
    color: var(--th-text-2);
    opacity: 0.5;
  }

  .entry-actions {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    margin-inline-start: 0.5rem;
  }

  /* ── Server cards ── */
  .server-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .server-card {
    padding: 0.75rem;
    background: var(--th-surface-2);
    border: 1px solid var(--th-border);
    border-radius: 0.5rem;
    transition: border-color 0.15s;
  }
  .server-card:hover {
    border-color: color-mix(in srgb, var(--th-accent) 25%, var(--th-border));
  }
  .server-card.has-failures {
    border-color: color-mix(
      in srgb,
      var(--th-danger) 20%,
      var(--th-border) 80%
    );
  }

  .server-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .server-domain {
    font-size: 0.8125rem;
    font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo,
      monospace;
    font-weight: 500;
    color: var(--th-text);
  }

  .server-last-active {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.625rem;
    color: var(--th-text-2);
    opacity: 0.5;
  }

  .server-stats {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 0.0625rem;
  }

  .stat-label {
    font-size: 0.5625rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--th-text-2);
    opacity: 0.6;
  }

  .stat-value {
    font-size: 0.8125rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--th-text);
  }
  .stat-value.success {
    color: var(--th-success);
  }
  .stat-value.danger {
    color: var(--th-danger);
  }

  .failure-breakdown {
    font-size: 0.625rem;
    font-weight: 400;
    opacity: 0.7;
  }

  .transport-breakdown {
    display: flex;
    gap: 0.25rem;
    margin-top: 0.125rem;
  }

  .transport-tag {
    font-size: 0.5rem;
    padding: 0.0625rem 0.25rem;
    border-radius: 999px;
    font-weight: 600;
    letter-spacing: 0.03em;
  }
  .transport-tag.https {
    background: color-mix(in srgb, var(--th-success) 15%, transparent);
    color: var(--th-success);
  }
  .transport-tag.http {
    background: color-mix(in srgb, var(--th-warning) 15%, transparent);
    color: var(--th-warning);
  }
  .transport-tag.smtp {
    background: color-mix(in srgb, var(--th-accent) 15%, transparent);
    color: var(--th-accent);
  }

  /* ── Modal ── */
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .modal-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(4px);
  }

  .modal-box {
    position: relative;
    background: var(--th-surface-1);
    border: 1px solid var(--th-border);
    border-radius: 0.75rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    width: 100%;
    max-width: 24rem;
    padding: 1.25rem;
    animation: modal-in 0.15s ease-out;
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .modal-icon {
    padding: 0.5rem;
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--th-danger) 10%, transparent);
    color: var(--th-danger);
    flex-shrink: 0;
  }

  .modal-title h3 {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--th-text);
    margin: 0 0 0.25rem;
  }

  .modal-detail {
    font-size: 0.75rem;
    font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo,
      monospace;
    color: var(--th-text-2);
    word-break: break-all;
    margin: 0;
  }

  .modal-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  /* ── Loading ── */
  .loading {
    font-size: 0.875rem;
    color: var(--th-text-2);
  }

  /* ── Animations ── */
  @keyframes slide-in {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

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
</style>
