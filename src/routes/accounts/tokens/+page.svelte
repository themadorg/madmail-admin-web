<script lang="ts">
  import { store } from "$lib/state.svelte";
  import { t, getLocale } from "$lib/i18n";
  import {
    Ticket,
    Plus,
    Trash2,
    Copy,
    Clock,
    Users,
    SearchX,
    ShieldCheck,
    ShieldAlert,
    AlertTriangle,
    Link,
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
  let showCreate = $state(false);
  let confirmingDelete = $state("");

  // Create form
  let newToken = $state("");
  let newMaxUses = $state(1);
  let newComment = $state("");
  let newExpiresIn = $state("");

  let filtered = $derived.by(() => {
    if (!store.registrationTokens) return [];
    if (!search) return store.registrationTokens.tokens;
    const q = search.toLowerCase();
    return store.registrationTokens.tokens.filter(
      (t) =>
        t.token.toLowerCase().includes(q) ||
        t.comment.toLowerCase().includes(q) ||
        t.status.includes(q),
    );
  });

  function statusColor(status: string): string {
    switch (status) {
      case "active":
        return "text-success";
      case "exhausted":
        return "text-warning";
      case "expired":
        return "text-danger";
      default:
        return "text-text-2";
    }
  }

  function statusBg(status: string): string {
    switch (status) {
      case "active":
        return "bg-success/15 border-success/30";
      case "exhausted":
        return "bg-warning/15 border-warning/30";
      case "expired":
        return "bg-danger/15 border-danger/30";
      default:
        return "bg-surface-3 border-border";
    }
  }

  function statusLabel(status: string): string {
    switch (status) {
      case "active":
        return _("tok.status_active");
      case "exhausted":
        return _("tok.status_exhausted");
      case "expired":
        return _("tok.status_expired");
      default:
        return status;
    }
  }

  function formatDate(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  function timeUntil(iso: string): string {
    try {
      const d = new Date(iso);
      const now = Date.now();
      const diff = d.getTime() - now;
      if (diff <= 0) return _("tok.status_expired");
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(hours / 24);
      if (days > 0) return `${days}d ${hours % 24}h`;
      return `${hours}h`;
    } catch {
      return "";
    }
  }

  async function handleCreate() {
    await store.createRegistrationToken({
      token: newToken || undefined,
      max_uses: newMaxUses,
      comment: newComment || undefined,
      expires_in: newExpiresIn || undefined,
    });
    showCreate = false;
    newToken = "";
    newMaxUses = 1;
    newComment = "";
    newExpiresIn = "";
  }

  async function handleDelete() {
    const tok = confirmingDelete;
    confirmingDelete = "";
    await store.deleteRegistrationToken(tok);
  }

  async function copyToken(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      store.notify(_("notify.copied"));
    } catch {
      store.notify("Copy failed", "err");
    }
  }

  function getInviteUrl(token: string): string {
    try {
      const url = new URL(store.baseUrl);
      return `${url.protocol}//${url.hostname}${url.port && url.port !== '443' && url.port !== '80' ? ':' + url.port : ''}/inv/${token}`;
    } catch {
      return `/inv/${token}`;
    }
  }

  async function copyInviteLink(token: string) {
    try {
      await navigator.clipboard.writeText(getInviteUrl(token));
      store.notify(_("notify.copied"));
    } catch {
      store.notify("Copy failed", "err");
    }
  }
</script>

{#if store.registrationTokens}
  <!-- Header card -->
  <div
    class="bg-surface-2 rounded-lg border border-border mb-4 p-3 flex flex-wrap justify-between items-center gap-2"
  >
    <div class="flex items-center gap-3">
      <span class="text-sm flex items-center gap-1.5">
        <Ticket size={14} class="text-accent/70" />
        {store.registrationTokens.total} {_("tok.count")}
      </span>
    </div>
    <div class="flex items-center gap-2">
      <button
        onclick={() => (showCreate = !showCreate)}
        class="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-all flex items-center gap-1"
      >
        <Plus size={12} />
        {_("tok.create")}
      </button>
    </div>
  </div>

  <!-- Create form -->
  {#if showCreate}
    <div
      class="bg-surface-2 rounded-lg border border-accent/30 mb-4 p-4 space-y-3 animate-modal"
    >
      <h3 class="text-sm font-semibold flex items-center gap-1.5">
        <Plus size={14} class="text-accent" />
        {_("tok.new_title")}
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label for="tok-id" class="block text-xs text-text-2 mb-1"
            >{_("tok.code_label")}</label
          >
          <input
            id="tok-id"
            type="text"
            bind:value={newToken}
            placeholder={_("tok.auto")}
            class="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text placeholder-text-2/40 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition"
          />
        </div>
        <div>
          <label for="tok-max" class="block text-xs text-text-2 mb-1"
            >{_("tok.max_uses")}</label
          >
          <input
            id="tok-max"
            type="number"
            bind:value={newMaxUses}
            min="1"
            class="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition"
          />
        </div>
        <div>
          <label for="tok-comment" class="block text-xs text-text-2 mb-1"
            >{_("tok.comment")}</label
          >
          <input
            id="tok-comment"
            type="text"
            bind:value={newComment}
            placeholder={_("tok.comment_placeholder")}
            class="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text placeholder-text-2/40 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition"
          />
        </div>
        <div>
          <label for="tok-exp" class="block text-xs text-text-2 mb-1"
            >{_("tok.expires_in")}</label
          >
          <input
            id="tok-exp"
            type="text"
            bind:value={newExpiresIn}
            placeholder={_("tok.expires_never")}
            class="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text placeholder-text-2/40 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition"
          />
        </div>
      </div>
      <div class="flex gap-2 justify-end pt-1">
        <button
          onclick={() => (showCreate = false)}
          class="px-3 py-1.5 text-xs rounded-lg border border-border text-text-2 hover:bg-surface-3 transition-colors"
        >
          {_("action.cancel")}
        </button>
        <button
          onclick={handleCreate}
          disabled={store.busy}
          class="px-3 py-1.5 text-xs rounded-lg bg-accent text-white hover:bg-accent-dim transition-colors font-medium disabled:opacity-50"
        >
          {_("tok.create")}
        </button>
      </div>
    </div>
  {/if}

  <!-- Search -->
  {#if store.registrationTokens.total > 0}
    <div class="mb-3">
      <input
        type="text"
        bind:value={search}
        placeholder={_("tok.search")}
        class="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-text placeholder-text-2/40 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition"
      />
    </div>
  {/if}

  <!-- Empty state -->
  {#if filtered.length === 0 && store.registrationTokens.total === 0}
    <div
      class="flex flex-col items-center justify-center py-16 text-text-2/50"
    >
      <Ticket size={32} class="mb-2" />
      <p class="text-sm">{_("tok.empty")}</p>
      <p class="text-xs mt-1">
        {_("tok.empty_hint")}
      </p>
    </div>
  {:else if filtered.length === 0}
    <div
      class="flex flex-col items-center justify-center py-12 text-text-2/50"
    >
      <SearchX size={24} class="mb-2" />
      <p class="text-sm">{_("tok.no_results")} "{search}"</p>
    </div>
  {:else}
    <!-- Token list -->
    <div class="space-y-1.5">
      {#each filtered as entry (entry.token)}
        <div
          class="bg-surface-2 rounded-lg px-3 py-3 border border-border group"
        >
          <div class="flex items-start justify-between gap-2">
            <!-- Token info -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 mb-1">
                <code
                  class="text-xs sm:text-sm font-mono truncate text-text-1 max-w-[200px] sm:max-w-[300px] inline-block"
                  >{entry.token}</code
                >
                <button
                  onclick={() => copyToken(entry.token)}
                  class="p-1 text-text-2/40 hover:text-accent transition-colors shrink-0"
                  title={_("tok.copy_code")}
                >
                  <Copy size={12} />
                </button>
                <span
                  class="text-[10px] font-medium px-1.5 py-0.5 rounded-full border {statusBg(entry.status)} {statusColor(entry.status)}"
                >
                  {statusLabel(entry.status)}
                </span>
              </div>

              <!-- Stats row -->
              <div class="flex flex-wrap items-center gap-3 text-[11px] text-text-2/60">
                <span class="flex items-center gap-1" title={_("tok.max_uses")}>
                  <Users size={10} />
                  {entry.used_count}/{entry.max_uses}
                  {#if entry.pending_reservations > 0}
                    <span class="text-warning/70"
                      >(+{entry.pending_reservations} {_("tok.pending")})</span
                    >
                  {/if}
                </span>
                {#if entry.expires_at}
                  <span class="flex items-center gap-1">
                    <Clock size={10} />
                    {#if entry.status === "expired"}
                      <span class="text-danger/70"
                        >{_("tok.expired_at")} {formatDate(entry.expires_at)}</span
                      >
                    {:else}
                      <span>{timeUntil(entry.expires_at)} {_("tok.left")}</span>
                    {/if}
                  </span>
                {/if}
                {#if entry.comment}
                  <span class="text-text-2/40 truncate max-w-[180px]"
                    >{entry.comment}</span
                  >
                {/if}
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center shrink-0 ms-2 gap-1">
              {#if entry.status === "active"}
                <button
                  onclick={() => copyInviteLink(entry.token)}
                  class="p-1.5 text-text-2/40 hover:text-accent transition-colors rounded-lg hover:bg-accent/10"
                  title={_("tok.copy_invite")}
                >
                  <Link size={13} />
                </button>
              {/if}
              <button
                onclick={() => (confirmingDelete = entry.token)}
                class="p-1.5 text-text-2/30 hover:text-danger transition-colors rounded-lg hover:bg-danger/10"
                title={_("tok.delete_title")}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
{:else}
  <p class="text-text-2 text-sm">{_("misc.loading")}</p>
{/if}

<!-- Delete confirmation modal -->
{#if confirmingDelete}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    onclick={() => (confirmingDelete = "")}
  >
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="relative bg-surface-1 border border-border rounded-xl shadow-2xl w-full max-w-sm p-5 animate-modal"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex items-start gap-3 mb-4">
        <div class="p-2 rounded-lg bg-danger/10 text-danger shrink-0">
          <AlertTriangle size={18} />
        </div>
        <div class="min-w-0">
          <h3 class="text-sm font-semibold text-text-1 mb-1">{_("tok.delete_title")}</h3>
          <p class="text-xs text-text-2 font-mono break-all">
            {confirmingDelete}
          </p>
          <p class="text-xs text-text-2/60 mt-1">
            {_("tok.delete_warning")}
          </p>
        </div>
      </div>

      <div class="flex gap-2 justify-end">
        <button
          onclick={() => (confirmingDelete = "")}
          class="px-3 py-1.5 text-xs rounded-lg border border-border text-text-2 hover:bg-surface-2 transition-colors"
        >
          {_("action.cancel")}
        </button>
        <button
          onclick={handleDelete}
          class="px-3 py-1.5 text-xs rounded-lg bg-danger text-white hover:bg-danger/80 transition-colors font-medium"
        >
          {_("action.delete")}
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
