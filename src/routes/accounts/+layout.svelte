<script lang="ts">
  import { store } from "$lib/state.svelte";
  import { page } from "$app/stores";
  import { base } from "$app/paths";
  import { t, getLocale } from "$lib/i18n";
  import { 
    Users, ShieldBan, Ticket, ArrowLeft
  } from "lucide-svelte";
  import "../federation/federation.css"; // Reuse tab styles

  let { children } = $props();

  let locale = $state(getLocale());
  function _(key: string): string {
    void locale;
    return t(key);
  }
  $effect(() => {
    locale = getLocale();
  });
  
  // Active tab based on URL
  let activeTab = $derived.by(() => {
    const p = $page.url.pathname;
    if (p.includes("/blocked")) return "blocked";
    if (p.includes("/tokens")) return "tokens";
    return "list";
  });
</script>

<div class="federation-layout">
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
