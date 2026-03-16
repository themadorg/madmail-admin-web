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
    AlertTriangle,
  } from "lucide-svelte";
  import ShadowsocksQR from "$lib/components/ShadowsocksQR.svelte";

  let showQR = $state(false);

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

  function toggleLabel(val: string | undefined): string {
    return (val ?? "enabled") === "enabled"
      ? _("proxy.enabled")
      : _("proxy.disabled");
  }

  let httpProxyUrl = $derived.by(() => {
    if (!store.settings) return "";
    const port = store.setting("http_proxy_port").is_set
      ? store.setting("http_proxy_port").value
      : store.setting("https_port").is_set
        ? store.setting("https_port").value
        : "443";
    const path = store.setting("http_proxy_path").is_set
      ? store.setting("http_proxy_path").value
      : "/proxy";
    const user = store.setting("http_proxy_username").is_set
      ? store.setting("http_proxy_username").value
      : "madmail";
    const pass = store.setting("http_proxy_password").is_set
      ? store.setting("http_proxy_password").value
      : "";
    if (!pass) return "";
    // Use the admin panel host as the server host
    let host = "";
    try {
      host = new URL(store.baseUrl).hostname;
    } catch {
      host = window.location.hostname;
    }
    const portSuffix = port === "443" ? "" : `:${port}`;
    return `https://${user}:${pass}@${host}${portSuffix}${path}`;
  });
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
        {toggleLabel(current)}
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
              {#if key === "ss_password" || key === "http_proxy_password"}
                <button
                  onclick={() => (store.editValue = randomPassword())}
                  class="p-1.5 text-text-2 border border-border rounded hover:bg-surface-3 transition-colors"
                  title="Generate random password"
                >
                  <Dice5 size={12} />
                </button>
              {/if}
              {#if key === "http_proxy_username"}
                <button
                  onclick={() => (store.editValue = "madmail")}
                  class="p-1.5 text-text-2 border border-border rounded hover:bg-surface-3 transition-colors text-[10px]"
                  title="Set default username"
                >
                  default
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
            {#if (key === "ss_password" || key === "http_proxy_password") && store.setting(key).is_set}
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

  <!-- ═══════════════════════════════════════════════ -->
  <!-- Shadowsocks (Raw TCP) Section                   -->
  <!-- ═══════════════════════════════════════════════ -->
  <div class="mb-8">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-medium text-text-2">
        {_("proxy.shadowsocks")}
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
        {toggleLabel(store.settings.ss_enabled)}
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

  <!-- ═══════════════════════════════════════════════ -->
  <!-- WebSocket Transport Section                     -->
  <!-- ═══════════════════════════════════════════════ -->
  <div class="mb-8">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-medium text-text-2">
        {_("proxy.ws")}
      </h3>
      <button
        onclick={() =>
          store.toggleService(
            "/admin/services/ss_ws",
            store.settings!.ss_ws_enabled ?? "enabled",
          )}
        disabled={isWorking}
        class="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full transition-colors disabled:opacity-50
          {(store.settings.ss_ws_enabled ?? 'enabled') === 'enabled'
          ? 'bg-success/15 text-success border border-success/30'
          : 'bg-surface-3 text-text-2 border border-border hover:border-text-2/50'}"
      >
        {#if (store.settings.ss_ws_enabled ?? "enabled") === "enabled"}
          <ToggleRight size={14} />
        {:else}
          <ToggleLeft size={14} />
        {/if}
        {toggleLabel(store.settings.ss_ws_enabled)}
      </button>
    </div>

    <div
      class="bg-surface-2 rounded-xl border border-border overflow-hidden shadow-sm"
    >
      <div class="divide-y divide-border">
        {@render editableRow(
          "ss_ws_port",
          _("proxy.ws_port"),
          "",
          "number",
        )}
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════ -->
  <!-- gRPC+TLS Transport Section                      -->
  <!-- ═══════════════════════════════════════════════ -->
  <div class="mb-8">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-medium text-text-2">
        {_("proxy.grpc")}
      </h3>
      <button
        onclick={() =>
          store.toggleService(
            "/admin/services/ss_grpc",
            store.settings!.ss_grpc_enabled ?? "enabled",
          )}
        disabled={isWorking}
        class="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full transition-colors disabled:opacity-50
          {(store.settings.ss_grpc_enabled ?? 'enabled') === 'enabled'
          ? 'bg-success/15 text-success border border-success/30'
          : 'bg-surface-3 text-text-2 border border-border hover:border-text-2/50'}"
      >
        {#if (store.settings.ss_grpc_enabled ?? "enabled") === "enabled"}
          <ToggleRight size={14} />
        {:else}
          <ToggleLeft size={14} />
        {/if}
        {toggleLabel(store.settings.ss_grpc_enabled)}
      </button>
    </div>

    <div
      class="bg-surface-2 rounded-xl border border-border overflow-hidden shadow-sm"
    >
      <div class="divide-y divide-border">
        {@render editableRow(
          "ss_grpc_port",
          _("proxy.grpc_port"),
          "",
          "number",
        )}
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════ -->
  <!-- HTTP CONNECT Proxy Section                      -->
  <!-- ═══════════════════════════════════════════════ -->
  <div class="mb-8">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-medium text-text-2">
        {_("proxy.http_proxy")}
      </h3>
      <button
        onclick={() =>
          store.toggleService(
            "/admin/services/http_proxy",
            store.settings!.http_proxy_enabled ?? "disabled",
          )}
        disabled={isWorking}
        class="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full transition-colors disabled:opacity-50
          {(store.settings.http_proxy_enabled ?? 'disabled') === 'enabled'
          ? 'bg-success/15 text-success border border-success/30'
          : 'bg-surface-3 text-text-2 border border-border hover:border-text-2/50'}"
      >
        {#if (store.settings.http_proxy_enabled ?? "disabled") === "enabled"}
          <ToggleRight size={14} />
        {:else}
          <ToggleLeft size={14} />
        {/if}
        {toggleLabel(store.settings.http_proxy_enabled ?? "disabled")}
      </button>
    </div>

    <div
      class="bg-surface-2 rounded-xl border border-border overflow-hidden shadow-sm"
    >
      <div class="divide-y divide-border">
        {@render editableRow(
          "http_proxy_port",
          _("proxy.http_proxy_port"),
          store.setting("https_port").is_set ? store.setting("https_port").value : "443",
          "number",
        )}
        {@render editableRow(
          "http_proxy_path",
          _("proxy.http_proxy_path"),
          "/proxy",
          "text",
        )}
        {@render editableRow(
          "http_proxy_username",
          _("proxy.http_proxy_username"),
          "madmail",
          "text",
        )}
        {@render editableRow(
          "http_proxy_password",
          _("proxy.http_proxy_password"),
          "",
          "text",
        )}
      </div>

      {#if httpProxyUrl}
        <div class="p-4 bg-accent/5 border-t border-border">
          <label
            for="http-proxy-url"
            class="block text-[10px] uppercase tracking-wider text-text-2 font-semibold mb-2"
          >Connection String</label>
          <div class="flex gap-2 font-mono">
            <input
              id="http-proxy-url"
              type="text"
              readonly
              value={httpProxyUrl}
              class="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-[11px] text-accent outline-none shadow-inner truncate"
            />
            <button
              onclick={() => {
                navigator.clipboard.writeText(httpProxyUrl);
                store.notify(_("notify.copied"));
              }}
              class="px-4 py-2 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent-dim transition-all shadow-sm active:scale-95 shrink-0"
            >
              {_("action.copy")}
            </button>
          </div>
        </div>
      {/if}
    </div>

    <p class="mt-2 text-[10px] text-text-2 opacity-70">
      {_("proxy.http_proxy_hint")}
    </p>
  </div>

  {#if store.pendingRestart}
    <div
      class="mt-4 p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-center justify-between"
    >
      <span class="text-warning text-sm flex items-center gap-1.5">
        <AlertTriangle size={14} />
        {_("action.restart_needed")}
      </span>
      <button
        onclick={() => store.reload()}
        disabled={store.reloading}
        class="px-3 py-1.5 bg-warning text-black text-xs font-medium rounded-lg hover:bg-warning/80 transition-colors disabled:opacity-50"
      >
        {store.reloading ? _("action.restarting") : _("action.apply_restart")}
      </button>
    </div>
  {/if}
{:else}
  <p class="text-text-2 text-sm">{_("misc.loading")}</p>
{/if}
