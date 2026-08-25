<script lang="ts">
  import { store } from "$lib/state.svelte";
  import { t, getLocale } from "$lib/i18n";
  import { KeyRound, Copy, AlertTriangle, CheckCircle2, Globe } from "lucide-svelte";
  import PageLoader from "$lib/components/PageLoader.svelte";

  let locale = $state(getLocale());
  function _(key: string, params?: Record<string, string>): string {
    void locale;
    return t(key, params);
  }
  $effect(() => {
    locale = getLocale();
  });

  let dkim = $derived(store.dkim);
  let zoneLine = $derived.by(() => {
    if (!dkim?.txt) return "";
    const name = dkim.dns_fqdn ?? dkim.dns_name;
    return `${name}. IN TXT "${dkim.txt}"`;
  });

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      store.notify(_("notify.copied"));
    } catch (e) {
      store.notify(String(e), "err");
    }
  }
</script>

<div class="tab-pane federation-dkim">
  {#if dkim}
    <div class={["dkim-status", dkim.publishable ? "ok" : "warn"]}>
      {#if dkim.publishable}
        <CheckCircle2 size={14} />
        {_("dkim.publishable")}
      {:else}
        <AlertTriangle size={14} />
        {_("dkim.not_publishable")}
      {/if}
    </div>

    {#if dkim.generated}
      <p class="dkim-banner">{_("dkim.generated")}</p>
    {/if}

    {#if !dkim.publishable && dkim.reason}
      <p class="dkim-banner dkim-banner--warn">{dkim.reason}</p>
    {/if}

    <p class="dkim-hint">{_("dkim.hint")}</p>

    <div class="dkim-actions">
      <button
        type="button"
        class="btn-copy"
        disabled={store.dkimChecking}
        onclick={() => store.checkDkim()}
      >
        <Globe size={12} />
        {_("dkim.check_dns")}
      </button>
      {#if store.dkimCheckResult}
        <span
          class={[
            "dkim-check-result",
            store.dkimCheckResult.checked && store.dkimCheckResult.matched
              ? "ok"
              : store.dkimCheckResult.checked
                ? "fail"
                : "skip",
          ]}
        >
          {#if !store.dkimCheckResult.checked}
            {_("dkim.check_skipped")}
          {:else if store.dkimCheckResult.lookup_error}
            {_("dkim.check_lookup_failed")}
          {:else if store.dkimCheckResult.matched}
            {_("dkim.check_ok")}
          {:else}
            {_("dkim.check_mismatch")}
          {/if}
        </span>
      {/if}
    </div>

    <dl class="dkim-meta">
      <div class="dkim-row">
        <dt>{_("dkim.selector")}</dt>
        <dd class="mono">{dkim.selector}</dd>
      </div>
      <div class="dkim-row">
        <dt>{_("dkim.domain")}</dt>
        <dd class="mono">{dkim.domain}</dd>
      </div>
      <div class="dkim-row">
        <dt>{_("dkim.dns_name")}</dt>
        <dd class="mono">{dkim.dns_name}</dd>
      </div>
      {#if dkim.dns_fqdn}
        <div class="dkim-row">
          <dt>{_("dkim.dns_fqdn")}</dt>
          <dd class="dkim-copy-row">
            <span class="mono">{dkim.dns_fqdn}</span>
            <button
              type="button"
              class="btn-copy"
              onclick={() => copy(dkim.dns_fqdn ?? "")}
            >
              <Copy size={12} />
              {_("dkim.copy_fqdn")}
            </button>
          </dd>
        </div>
      {/if}
      <div class="dkim-row">
        <dt>{_("dkim.private_key")}</dt>
        <dd class="mono path">{dkim.private_key_path}</dd>
      </div>
      <div class="dkim-row">
        <dt>{_("dkim.txt_path")}</dt>
        <dd class="mono path">{dkim.txt_path}</dd>
      </div>
    </dl>

    {#if dkim.txt}
      <div class="dkim-block">
        <div class="dkim-block-head">
          <span>{_("dkim.txt")}</span>
          <button type="button" class="btn-copy" onclick={() => copy(dkim.txt ?? "")}>
            <Copy size={12} />
            {_("dkim.copy_txt")}
          </button>
        </div>
        <pre class="dkim-pre">{dkim.txt}</pre>
      </div>

      {#if zoneLine}
        <div class="dkim-block">
          <div class="dkim-block-head">
            <span>{_("dkim.zone")}</span>
            <button type="button" class="btn-copy" onclick={() => copy(zoneLine)}>
              <Copy size={12} />
              {_("dkim.copy_zone")}
            </button>
          </div>
          <pre class="dkim-pre">{zoneLine}</pre>
        </div>
      {/if}
    {/if}
  {:else if !store.dkimChecked || store.dkimLoading}
    <PageLoader />
  {:else}
    <div class="empty-state">
      <KeyRound size={32} />
      <p>{_("dkim.unsupported")}</p>
    </div>
  {/if}
</div>

<style>
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
    margin: 0;
    text-align: center;
    padding: 0 1rem;
  }

  .dkim-status {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    font-size: 0.75rem;
    font-weight: 500;
    border-radius: 0.5rem;
    margin-bottom: 0.75rem;
  }
  .dkim-status.ok {
    color: var(--th-success);
    background: color-mix(in srgb, var(--th-success) 12%, transparent);
  }
  .dkim-status.warn {
    color: var(--th-warning);
    background: color-mix(in srgb, var(--th-warning) 12%, transparent);
  }

  .dkim-banner {
    font-size: 0.75rem;
    line-height: 1.4;
    padding: 0.625rem 0.75rem;
    margin-bottom: 0.75rem;
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--th-accent) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--th-accent) 25%, transparent);
    color: var(--th-text);
  }
  .dkim-banner--warn {
    background: color-mix(in srgb, var(--th-warning) 10%, transparent);
    border-color: color-mix(in srgb, var(--th-warning) 25%, transparent);
  }

  .dkim-hint {
    font-size: 0.75rem;
    color: var(--th-text-2);
    line-height: 1.4;
    margin: 0 0 1rem;
  }

  .dkim-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin: 0 0 1rem;
  }

  .dkim-check-result {
    font-size: 0.75rem;
    font-weight: 500;
  }
  .dkim-check-result.ok {
    color: var(--th-success);
  }
  .dkim-check-result.fail {
    color: var(--th-danger, var(--th-warning));
  }
  .dkim-check-result.skip {
    color: var(--th-text-2);
  }

  .dkim-meta {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0 0 1rem;
  }

  .dkim-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    background: var(--th-surface-2);
    border: 1px solid var(--th-border);
    border-radius: 0.5rem;
  }
  .dkim-row dt {
    font-size: 0.6875rem;
    color: var(--th-text-2);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
  }
  .dkim-row dd {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--th-text);
    word-break: break-all;
  }
  .mono {
    font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, monospace;
  }
  .path {
    font-size: 0.75rem;
    color: var(--th-text-2);
  }

  .dkim-copy-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .btn-copy {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.6875rem;
    border: 1px solid color-mix(in srgb, var(--th-accent) 30%, transparent);
    border-radius: 0.375rem;
    color: var(--th-accent);
    background: transparent;
    cursor: pointer;
    flex-shrink: 0;
    transition:
      background 0.15s,
      border-color 0.15s;
  }
  .btn-copy:hover {
    background: color-mix(in srgb, var(--th-accent) 10%, transparent);
  }

  .dkim-block {
    padding: 0.75rem;
    margin-bottom: 0.75rem;
    background: var(--th-surface-2);
    border: 1px solid var(--th-border);
    border-radius: 0.5rem;
  }

  .dkim-block-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    font-size: 0.6875rem;
    color: var(--th-text-2);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .dkim-pre {
    margin: 0;
    padding: 0.625rem 0.75rem;
    background: var(--th-surface-1);
    border: 1px solid var(--th-border);
    border-radius: 0.375rem;
    font-size: 0.75rem;
    line-height: 1.45;
    color: var(--th-text);
    font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, monospace;
    white-space: pre-wrap;
    word-break: break-all;
    overflow-wrap: anywhere;
  }
</style>
