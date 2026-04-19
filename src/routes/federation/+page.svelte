<script lang="ts">
  import { store } from "$lib/state.svelte";
  import { t, getLocale } from "$lib/i18n";
  import {
    GitBranch,
    Plus,
    Trash2,
    ShieldCheck,
    Clock,
    SearchX,
    ChevronLeft,
    ChevronRight,
  } from "lucide-svelte";

  let locale = $state(getLocale());
  function _(key: string, params?: Record<string, string>): string {
    void locale;
    return t(key, params);
  }
  $effect(() => {
    locale = getLocale();
  });

  let showAdd = $state(false);
  let newDomain = $state("");
  let confirmingDelete = $state("");
  let search = $state("");
  let currentPage = $state(1);
  const itemsPerPage = 20;

  // Derived
  let policy = $derived(store.federationSettings?.policy ?? "ACCEPT");
  let isAccept = $derived(policy === "ACCEPT");

  let filteredRules = $derived.by(() => {
    if (!store.federationRules) return [];
    let list = store.federationRules.rules;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.domain.toLowerCase().includes(q));
    }
    return list;
  });

  let totalItems = $derived(filteredRules.length);
  let totalPages = $derived(Math.max(1, Math.ceil(totalItems / itemsPerPage)));
  let paginatedRules = $derived(
    filteredRules.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
  );

  // Reset page on search
  $effect(() => {
    void search;
    currentPage = 1;
  });

  function formatDate(ts: number): string {
    if (!ts) return "—";
    return new Date(ts * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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

  function fmtDomain(d: string): string {
    return (d || "").replace(/^\[(.*)\]$/, "$1");
  }
</script>

<div class="federation-rules">
  <div class="section-bar">
    <span class="section-count">
      {totalItems} {_("fed.exceptions")}
      {#if search} ({_("tok.no_results").replace(':','')}: {store.federationRules?.total ?? 0}){/if}
    </span>
    <button class="btn-add" onclick={() => (showAdd = !showAdd)}>
      <Plus size={12} />
      {_("fed.add_domain")}
    </button>
  </div>

  {#if showAdd}
    <div class="add-form">
      <div class="field">
        <label for="fed-domain">{_("fed.domain_label")}</label>
        <input
          id="fed-domain"
          type="text"
          bind:value={newDomain}
          placeholder={_("fed.domain_placeholder")}
          onkeydown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
        />
      </div>
      <div class="form-actions">
        <button class="btn-cancel" onclick={() => (showAdd = false)}>
          {_("action.cancel")}
        </button>
        <button
          class="btn-submit"
          onclick={handleAdd}
          disabled={!newDomain.trim()}
        >
          {isAccept ? _("fed.action_block") : _("fed.action_allow")}
        </button>
      </div>
    </div>
  {/if}

  <div class="search-wrap">
    <input
      type="text"
      bind:value={search}
      placeholder={_("fed.search_rules")}
      class="search-input"
    />
  </div>

  {#if !store.federationRules}
    <p class="loading">{_("misc.loading")}</p>
  {:else if filteredRules.length === 0 && store.federationRules.total === 0 && !showAdd}
    <div class="empty-state">
      <GitBranch size={32} />
      <p>{_("fed.empty_rules")}</p>
      <span class="empty-hint"
        >{isAccept
          ? _("fed.empty_hint_accept")
          : _("fed.empty_hint_reject")}</span
      >
      <button class="btn-add" onclick={() => (showAdd = true)}>
        <Plus size={12} />
        {_("fed.add_first")}
      </button>
    </div>
  {:else if filteredRules.length === 0}
    <div class="empty-state">
      <SearchX size={24} />
      <p>{_("fed.rule_no_results", { query: search })}</p>
    </div>
  {:else}
    <div class="entry-list">
      {#each paginatedRules as rule (rule.domain)}
        <div class="entry">
          <div class="entry-info">
            <div class="entry-domain">
              <span class="rule-type-badge" class:blocklist={isAccept}>
                {isAccept ? _("fed.badge_block") : _("fed.badge_allow")}
              </span>
              <span class="domain-text">{fmtDomain(rule.domain)}</span>
            </div>
            <span class="entry-date">
              <Clock size={10} />
              {_("acct.created")} {formatDate(rule.created_at)}
            </span>
          </div>
          <div class="entry-actions">
            <button
              class="btn-delete"
              onclick={() => requestDelete(rule.domain)}
              aria-label={_("fed.delete_rule_aria", {
                domain: rule.domain,
              })}
            >
              <Trash2 size={13} />
            </button>
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
          <h3>{_("fed.confirm_delete_title")}</h3>
          <p class="modal-detail">{fmtDomain(confirmingDelete)}</p>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-cancel" onclick={() => (confirmingDelete = "")}>
          {_("action.cancel")}
        </button>
        <button class="btn-danger" onclick={handleConfirmDelete}>
          {_("action.delete")}
        </button>
      </div>
    </div>
  </div>
{/if}
