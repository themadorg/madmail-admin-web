<script lang="ts">
  import { store } from "$lib/state.svelte";
  import { api, type ApiConfig } from "$lib/api";
  import { t, getLocale } from "$lib/i18n";
  import { Mail, Send, Users, AlertTriangle } from "lucide-svelte";

  let locale = $state(getLocale());
  function _(key: string, params?: Record<string, string>): string {
    void locale;
    return t(key, params);
  }
  $effect(() => {
    locale = getLocale();
  });

  let mode = $state<"all" | "single">("all");
  let recipient = $state("");
  let subject = $state("");
  let body = $state("");
  let sending = $state(false);
  let result = $state<{
    sent: number;
    failed: number;
    errors?: string[];
  } | null>(null);
  let showConfirm = $state(false);

  function cfg(): ApiConfig {
    return { baseUrl: store.baseUrl, token: store.token };
  }

  // Get total users from store
  let totalUsers = $derived(store.status?.users?.registered ?? 0);

  async function doSend() {
    showConfirm = false;
    sending = true;
    result = null;
    try {
      const res = await api.sendNotice(
        cfg(),
        subject,
        body,
        mode === "single" ? recipient : undefined,
      );
      if (res.error) {
        store.showToast(res.error, "err");
      } else if (res.body) {
        result = res.body;
        if (res.body.sent > 0) {
          store.showToast(
            _("notice.sent", { count: String(res.body.sent) }),
            "ok",
          );
        }
        if (res.body.failed > 0) {
          store.showToast(
            _("notice.failed", { count: String(res.body.failed) }),
            "err",
          );
        }
      }
    } catch (e) {
      store.showToast(String(e), "err");
    } finally {
      sending = false;
    }
  }

  function handleSend() {
    if (!subject.trim() || !body.trim()) return;
    if (mode === "single" && !recipient.trim()) return;

    if (mode === "all") {
      showConfirm = true;
    } else {
      doSend();
    }
  }

  let canSend = $derived(
    subject.trim().length > 0 &&
      body.trim().length > 0 &&
      (mode === "all" || recipient.trim().length > 0) &&
      !sending,
  );
</script>

<!-- Header -->
<div class="bg-surface-2 rounded-lg border border-border mb-4 p-4">
  <div class="flex items-center gap-2 mb-1">
    <Mail size={16} class="text-accent" />
    <h2 class="text-base font-semibold">{_("notice.title")}</h2>
  </div>
  <p class="text-xs text-text-2">{_("notice.subtitle")}</p>
</div>

<!-- Recipient Mode -->
<div class="bg-surface-2 rounded-lg border border-border mb-3 p-3">
  <div class="flex gap-2 mb-3">
    <button
      onclick={() => (mode = "all")}
      class="flex-1 py-2 text-sm rounded-lg border transition-colors flex items-center justify-center gap-1.5
        {mode === 'all'
        ? 'bg-accent/15 border-accent/40 text-accent font-medium'
        : 'border-border text-text-2 hover:bg-surface-3'}"
    >
      <Users size={13} />
      {_("notice.recipient_all")}
      {#if totalUsers > 0}
        <span class="text-[10px] opacity-60">({totalUsers})</span>
      {/if}
    </button>
    <button
      onclick={() => (mode = "single")}
      class="flex-1 py-2 text-sm rounded-lg border transition-colors flex items-center justify-center gap-1.5
        {mode === 'single'
        ? 'bg-accent/15 border-accent/40 text-accent font-medium'
        : 'border-border text-text-2 hover:bg-surface-3'}"
    >
      <Mail size={13} />
      {_("notice.recipient_single")}
    </button>
  </div>

  {#if mode === "single"}
    <input
      type="email"
      bind:value={recipient}
      placeholder={_("notice.recipient_placeholder")}
      class="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text placeholder-text-2/40 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition"
    />
  {/if}
</div>

<!-- Subject -->
<div class="mb-3">
  <label for="notice-subject" class="block text-xs text-text-2 mb-1"
    >{_("notice.subject")}</label
  >
  <input
    id="notice-subject"
    type="text"
    bind:value={subject}
    placeholder={_("notice.subject_placeholder")}
    class="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-text placeholder-text-2/40 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition"
  />
</div>

<!-- Body -->
<div class="mb-4">
  <label for="notice-body" class="block text-xs text-text-2 mb-1"
    >{_("notice.body")}</label
  >
  <textarea
    id="notice-body"
    bind:value={body}
    placeholder={_("notice.body_placeholder")}
    rows="8"
    class="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-text placeholder-text-2/40 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition resize-y min-h-[120px]"
  ></textarea>
</div>

<!-- Send Button -->
<button
  onclick={handleSend}
  disabled={!canSend}
  class="w-full py-2.5 bg-accent hover:bg-accent-dim text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
>
  {#if sending}
    <Send size={14} class="animate-pulse" />
    {_("notice.sending")}
  {:else}
    <Send size={14} />
    {_("notice.send")}
  {/if}
</button>

<!-- Result -->
{#if result}
  <div class="mt-4 p-3 bg-surface-2 border border-border rounded-lg text-sm">
    <div class="flex items-center gap-3">
      {#if result.sent > 0}
        <span class="text-success flex items-center gap-1">
          ✅ {_("notice.sent", { count: String(result.sent) })}
        </span>
      {/if}
      {#if result.failed > 0}
        <span class="text-danger flex items-center gap-1">
          ❌ {_("notice.failed", { count: String(result.failed) })}
        </span>
      {/if}
    </div>
    {#if result.errors && result.errors.length > 0}
      <div class="mt-2 text-xs text-text-2 space-y-0.5">
        {#each result.errors as err}
          <p class="font-mono text-[11px] text-danger/70">{err}</p>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<!-- Broadcast Confirmation Modal -->
{#if showConfirm}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    onclick={() => (showConfirm = false)}
  >
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="relative bg-surface-1 border border-border rounded-xl shadow-2xl w-full max-w-sm p-5 animate-modal"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex items-start gap-3 mb-4">
        <div class="p-2 rounded-lg bg-warning/10 text-warning shrink-0">
          <AlertTriangle size={18} />
        </div>
        <div class="min-w-0">
          <h3 class="text-sm font-semibold text-text-1 mb-1">
            {_("notice.send")}
          </h3>
          <p class="text-xs text-text-2">
            {_("notice.confirm_all", { count: String(totalUsers) })}
          </p>
        </div>
      </div>

      <div class="flex gap-2 justify-end">
        <button
          onclick={() => (showConfirm = false)}
          class="px-3 py-1.5 text-xs rounded-lg border border-border text-text-2 hover:bg-surface-2 transition-colors"
        >
          {_("action.cancel")}
        </button>
        <button
          onclick={doSend}
          class="px-3 py-1.5 text-xs rounded-lg bg-accent text-white hover:bg-accent-dim transition-colors font-medium"
        >
          {_("notice.send")}
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
