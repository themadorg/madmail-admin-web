<script lang="ts">
  import { store } from "$lib/state.svelte";
  import { t, getLocale } from "$lib/i18n";
  import {
    ToggleLeft,
    ToggleRight,
    Pencil,
    RotateCcw,
    Dice5,
    QrCode,
  } from "lucide-svelte";
  import ShadowsocksQR from "$lib/components/ShadowsocksQR.svelte";

  let showQR = $state(false);

  function randomPath(): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let s = "/";
    for (let i = 0; i < 16; i++)
      s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  function randomPassword(): string {
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let s = "";
    for (let i = 0; i < 16; i++)
      s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  let locale = $state(getLocale());
  function _(key: string, params?: Record<string, string>): string {
    void locale;
    return t(key, params);
  }

  let isWorking = $derived(store.refreshing || store.busy || store.reloading);
</script>

{#if store.settings}
  {#snippet toggleRow(
    label: string,
    resource: string,
    current: string,
    onLabel: string,
  )}
    <div
      class="flex items-center justify-between bg-surface-2 rounded-lg p-3 border border-border"
    >
      <div>
        <div class="text-sm font-medium">{label}</div>
        <div class="text-xs text-text-2 font-mono">{resource}</div>
      </div>
      <button
        onclick={() => store.toggleService(resource, current)}
        disabled={isWorking}
        class="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full transition-colors disabled:opacity-50
          {current === onLabel
          ? 'bg-success/15 text-success border border-success/30'
          : 'bg-surface-3 text-text-2 border border-border hover:border-text-2/50'}"
      >
        {#if current === onLabel}
          <ToggleRight size={14} />
        {:else}
          <ToggleLeft size={14} />
        {/if}
        {current}
      </button>
    </div>
  {/snippet}

  {#snippet editableRow(
    key: string,
    label: string,
    fallback: string,
    inputType: string,
  )}
    <div
      class="flex items-center justify-between bg-surface-2 rounded-lg p-3 border border-border gap-3"
    >
      <div class="min-w-0 flex-1">
        <div class="text-sm font-medium">{label}</div>
        {#if store.editingField === key}
          <div class="flex gap-2 mt-1.5">
            {#if inputType === "number"}
              <input
                type="number"
                bind:value={store.editValue}
                min="1"
                max="65535"
                class="w-28 px-2 py-1 bg-surface border border-border rounded text-xs text-text outline-none focus:border-accent"
              />
            {:else}
              <input
                type="text"
                bind:value={store.editValue}
                class="flex-1 px-2 py-1 bg-surface border border-border rounded text-xs text-text outline-none focus:border-accent"
              />
              {#if key === "admin_path"}
                <button
                  onclick={() => (store.editValue = randomPath())}
                  class="p-1.5 text-text-2 border border-border rounded hover:bg-surface-3 transition-colors"
                  title="Generate random path"
                >
                  <Dice5 size={12} />
                </button>
              {/if}
              {#if key === "ss_password"}
                <button
                  onclick={() => (store.editValue = randomPassword())}
                  class="p-1.5 text-text-2 border border-border rounded hover:bg-surface-3 transition-colors"
                  title="Generate random password"
                >
                  <Dice5 size={12} />
                </button>
              {/if}
            {/if}
            <button
              onclick={() => store.save(key, store.editValue)}
              class="px-2 py-1 bg-accent text-white text-xs rounded hover:bg-accent-dim transition-colors"
              >{_("action.save")}</button
            >
            <button
              onclick={() => (store.editingField = "")}
              class="px-2 py-1 text-text-2 text-xs border border-border rounded hover:bg-surface-3 transition-colors"
              >{_("action.cancel")}</button
            >
          </div>
        {:else}
          <div class="flex items-center gap-2 min-w-0">
            <div class="text-xs text-text-2 truncate">
              {store.setting(key).is_set ? store.setting(key).value : fallback}
              {#if !store.setting(key).is_set}<span class="opacity-50"
                  >{_("misc.default")}</span
                >{/if}
            </div>
            {#if key === "ss_password" && store.setting(key).is_set}
              <button
                onclick={() => {
                  navigator.clipboard.writeText(store.setting(key).value);
                  store.notify(_("notify.copied"));
                }}
                class="p-1 px-1.5 text-[10px] bg-surface-3 border border-border rounded hover:border-text-2/50 transition-colors shrink-0"
              >
                {_("action.copy")}
              </button>
            {/if}
          </div>
        {/if}
      </div>
      {#if store.editingField !== key}
        <div class="flex gap-1 shrink-0 items-center">
          {#if store.setting(key).is_set}<span
              class="w-1.5 h-1.5 rounded-full bg-warning"
            ></span>{/if}
          <button
            onclick={() =>
              store.startEdit(
                key,
                store.setting(key).is_set ? store.setting(key).value : fallback,
              )}
            class="p-1.5 text-text-2 border border-border rounded hover:bg-surface-3 transition-colors"
          >
            <Pencil size={12} />
          </button>
          {#if store.setting(key).is_set}
            <button
              onclick={() => store.reset(key)}
              class="p-1.5 text-danger border border-danger/30 rounded hover:bg-danger/10 transition-colors"
            >
              <RotateCcw size={12} />
            </button>
          {/if}
        </div>
      {/if}
    </div>
  {/snippet}

  <!-- Toggle Services -->
  <div class="space-y-2">
    {@render toggleRow(
      _("svc.registration"),
      "/admin/registration",
      store.settings.registration,
      "open",
    )}
    {@render toggleRow(
      _("svc.jit_registration"),
      "/admin/registration/jit",
      store.settings.jit_registration,
      "enabled",
    )}
    {@render toggleRow(
      _("svc.turn"),
      "/admin/services/turn",
      store.settings.turn_enabled,
      "enabled",
    )}
    {@render toggleRow(
      _("svc.iroh"),
      "/admin/services/iroh",
      store.settings.iroh_enabled,
      "enabled",
    )}
  </div>

  <!-- Shadowsocks Section -->
  <div class="mt-6 mb-8">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-medium text-text-2">
        {_("svc.shadowsocks")}
      </h3>
      <button
        onclick={() =>
          store.toggleService(
            "/admin/services/shadowsocks",
            store.settings!.ss_enabled,
          )}
        disabled={isWorking}
        class="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full transition-colors disabled:opacity-50
          {store.settings.ss_enabled === 'enabled'
          ? 'bg-success/15 text-success border border-success/30'
          : 'bg-surface-3 text-text-2 border border-border hover:border-text-2/50'}"
      >
        {#if store.settings.ss_enabled === "enabled"}
          <ToggleRight size={14} />
        {:else}
          <ToggleLeft size={14} />
        {/if}
        {store.settings.ss_enabled}
      </button>
    </div>

    <div
      class="bg-surface-2 rounded-xl border border-border overflow-hidden shadow-sm"
    >
      <div class="divide-y divide-border">
        {@render editableRow("ss_password", _("svc.ss_password"), "", "text")}
        {@render editableRow(
          "ss_port",
          _("port.shadowsocks"),
          "8388",
          "number",
        )}
        <div class="opacity-70 group hover:opacity-100 transition-opacity">
          {@render editableRow("ss_cipher", _("svc.ss_cipher"), "", "text")}
        </div>
      </div>

      {#if store.shadowsocksUrl}
        <div class="p-4 bg-accent/5 border-t border-border">
          <div class="flex items-center justify-between mb-2">
            <label
              for="ss-url-main"
              class="block text-[10px] uppercase tracking-wider text-text-2 font-semibold"
              >{_("svc.shadowsocks_client_url")}</label
            >
            <button
              onclick={() => (showQR = !showQR)}
              class="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium rounded bg-surface-3 border border-border hover:border-accent/50 transition-colors"
            >
              <QrCode size={12} />
              {showQR ? "Hide QR" : "Show QR"}
            </button>
          </div>

          {#if showQR}
            <div
              class="flex justify-center my-4 animate-in fade-in zoom-in duration-300"
            >
              <ShadowsocksQR url={store.shadowsocksUrl} />
            </div>
          {/if}

          <div class="flex gap-2 font-mono">
            <input
              id="ss-url-main"
              type="text"
              readonly
              value={store.shadowsocksUrl}
              class="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-[11px] text-accent outline-none shadow-inner truncate"
            />
            <button
              onclick={() => {
                navigator.clipboard.writeText(store.shadowsocksUrl);
                store.notify(_("notify.copied"));
              }}
              class="px-4 py-2 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent-dim transition-all shadow-sm active:scale-95 shrink-0"
            >
              {_("action.copy")}
            </button>
          </div>
          <p class="mt-2.5 text-[10px] text-text-2 italic opacity-80">
            {_("svc.shadowsocks_url_hint")}
          </p>
        </div>
      {/if}
    </div>
  </div>

  <!-- Configuration -->
  <h3 class="text-sm font-medium mt-6 mb-3 text-text-2">
    {_("svc.configuration")}
  </h3>
  <div class="space-y-2">
    {@render editableRow("smtp_hostname", _("svc.smtp_hostname"), "", "text")}
    {@render editableRow("turn_realm", _("svc.turn_realm"), "", "text")}
    {@render editableRow("turn_secret", _("svc.turn_secret"), "", "text")}
    {@render editableRow("turn_relay_ip", _("svc.turn_relay_ip"), "", "text")}
    {@render editableRow("turn_ttl", _("svc.turn_ttl"), "", "number")}
    {@render editableRow("iroh_relay_url", _("svc.iroh_relay_url"), "", "text")}
    {@render editableRow(
      "admin_path",
      _("svc.admin_path"),
      "/api/admin",
      "text",
    )}
  </div>
{:else}
  <p class="text-text-2 text-sm">{_("misc.loading")}</p>
{/if}
