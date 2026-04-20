<script lang="ts">
  import { store } from "$lib/state.svelte";
  import { t, getLocale } from "$lib/i18n";
  import {
    Pencil,
    RotateCcw,
    AlertTriangle,
    Globe,
    Lock,
    ShieldAlert,
  } from "lucide-svelte";

  let locale = $state(getLocale());
  function _(key: string, params?: Record<string, string>): string {
    void locale;
    return t(key, params);
  }

  type AccessInfo = { accessField: string; localOnlySetting: string };

  /**
   * Map each port row to its access field and local-only setting key.
   * Ports without access control (like Shadowsocks itself, SASL) are excluded.
   */
  const accessKeyMap: Record<string, AccessInfo> = {
    smtp_port: { accessField: "smtp_access", localOnlySetting: "smtp_local_only" },
    submission_port: {
      accessField: "submission_access",
      localOnlySetting: "submission_local_only",
    },
    submission_tls_port: {
      accessField: "submission_tls_access",
      localOnlySetting: "submission_tls_local_only",
    },
    imap_port: { accessField: "imap_access", localOnlySetting: "imap_local_only" },
    imap_tls_port: {
      accessField: "imap_tls_access",
      localOnlySetting: "imap_tls_local_only",
    },
    turn_port: { accessField: "turn_access", localOnlySetting: "turn_local_only" },
    sasl_port: { accessField: "sasl_access", localOnlySetting: "sasl_local_only" },
    iroh_port: { accessField: "iroh_access", localOnlySetting: "iroh_local_only" },
    http_port: { accessField: "http_access", localOnlySetting: "http_local_only" },
    https_port: { accessField: "https_access", localOnlySetting: "https_local_only" },
  };

  /** Map port keys to i18n keys for confirmation modals */
  const PORT_LABEL_KEYS: Record<string, string> = {
    smtp_port: "port.smtp",
    submission_port: "port.submission",
    submission_tls_port: "port.submission_tls",
    imap_port: "port.imap",
    imap_tls_port: "port.imap_tls",
    turn_port: "port.turn",
    sasl_port: "port.sasl",
    iroh_port: "port.iroh",
    http_port: "port.http",
    https_port: "port.https",
  };

  function getAccess(portKey: string): string | null {
    const info = accessKeyMap[portKey];
    if (!info || !store.settings) return null;
    const accessKey = info.accessField as keyof typeof store.settings;
    return (store.settings[accessKey] as string) || "public";
  }

  // Confirmation modal state
  let confirmingPort = $state<string | null>(null);
  let confirmingLabel = $state("");

  function requestMakeLocal(portKey: string) {
    confirmingPort = portKey;
    const lk = PORT_LABEL_KEYS[portKey];
    confirmingLabel = lk ? _(lk) : portKey;
  }

  function cancelConfirm() {
    confirmingPort = null;
    confirmingLabel = "";
  }

  async function confirmMakeLocal() {
    if (!confirmingPort) return;
    const info = accessKeyMap[confirmingPort];
    if (info) {
      await store.togglePortAccess(info.localOnlySetting, "public");
    }
    confirmingPort = null;
    confirmingLabel = "";
  }

  // Client-affecting port change warning
  const clientPorts = new Set([
    "smtp_port",
    "submission_port",
    "submission_tls_port",
    "imap_port",
    "imap_tls_port",
  ]);
  let pendingSaveKey = $state<string | null>(null);
  let pendingSaveValue = $state("");

  function handleSave(key: string, value: string) {
    if (clientPorts.has(key)) {
      pendingSaveKey = key;
      pendingSaveValue = value;
    } else {
      store.save(key, value);
    }
  }

  async function confirmPortChange() {
    if (!pendingSaveKey) return;
    await store.save(pendingSaveKey, pendingSaveValue);
    pendingSaveKey = null;
    pendingSaveValue = "";
  }

  function cancelPortChange() {
    pendingSaveKey = null;
    pendingSaveValue = "";
  }
</script>

{#if store.settings}
  <div class="space-y-2">
    <!-- Hint about Local mode -->
    <div class="text-xs text-text-2 flex items-center gap-1.5 mb-3 px-1">
      <Lock size={11} class="opacity-60" />
      <span>{_("port.access_hint")}</span>
    </div>

    {#snippet editableRow(key: string, label: string, fallback: string)}
      {@const access = getAccess(key)}
      <div
        class="flex items-center justify-between bg-surface-2 rounded-lg p-3 border border-border gap-3"
      >
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium">{label}</div>
          {#if store.editingField === key}
            <div class="flex gap-2 mt-1.5">
              <input
                type="number"
                bind:value={store.editValue}
                min="1"
                max="65535"
                class="w-28 px-2 py-1 bg-surface border border-border rounded text-xs text-text outline-none focus:border-accent"
              />
              <button
                onclick={() => handleSave(key, store.editValue)}
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
            <div class="text-xs text-text-2 truncate">
              {store.setting(key).is_set ? store.setting(key).value : fallback}
              {#if !store.setting(key).is_set}<span class="opacity-50"
                  >{_("misc.default")}</span
                >{/if}
            </div>
          {/if}
        </div>
        {#if store.editingField !== key}
          <div class="flex gap-1 shrink-0 items-center">
            <!-- Access toggle (Public / Local) -->
            {#if access}
              <button
                onclick={() => {
                  const info = accessKeyMap[key];
                  if (!info || !access) return;
                  if (access === "local") {
                    // Going local → public: safe, do it directly
                    store.togglePortAccess(info.localOnlySetting, access);
                  } else {
                    // Going public → local: show confirmation modal
                    requestMakeLocal(key);
                  }
                }}
                disabled={store.busy}
                class="flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors {access ===
                'local'
                  ? 'bg-warning/15 border-warning/40 text-warning'
                  : 'bg-success/10 border-success/30 text-success'} hover:opacity-80 disabled:opacity-50"
                title={access === "local" ? _("port.local") : _("port.public")}
              >
                {#if access === "local"}
                  <Lock size={11} />
                {:else}
                  <Globe size={11} />
                {/if}
                <span
                  >{access === "local"
                    ? _("port.local")
                    : _("port.public")}</span
                >
              </button>
            {/if}

            {#if store.setting(key).is_set}<span
                class="w-1.5 h-1.5 rounded-full bg-warning"
              ></span>{/if}
            <button
              onclick={() =>
                store.startEdit(
                  key,
                  store.setting(key).is_set
                    ? store.setting(key).value
                    : fallback,
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

    {@render editableRow("smtp_port", _("port.smtp"), "25")}
    {@render editableRow("submission_port", _("port.submission"), "587")}
    {@render editableRow("submission_tls_port", _("port.submission_tls"), "465")}
    {@render editableRow("imap_port", _("port.imap"), "143")}
    {@render editableRow("imap_tls_port", _("port.imap_tls"), "993")}
    {@render editableRow("turn_port", _("port.turn"), "3478")}
    {@render editableRow("sasl_port", _("port.sasl"), "24")}
    {@render editableRow("iroh_port", _("port.iroh"), "3340")}
    {@render editableRow("ss_port", _("port.shadowsocks"), "8388")}
    {@render editableRow("http_port", _("port.http"), "80")}
    {@render editableRow("https_port", _("port.https"), "443")}
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

  <!-- Confirmation Modal: Public → Local Only -->
  {#if confirmingPort}
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <div
        class="bg-surface-2 border border-border rounded-xl p-5 max-w-sm w-full shadow-2xl"
      >
        <div class="flex items-center gap-2 mb-3">
          <div class="p-2 bg-warning/15 rounded-lg">
            <ShieldAlert size={20} class="text-warning" />
          </div>
          <h3 class="text-base font-semibold text-text">
            {_("port.confirm_local", { port: confirmingLabel })}
          </h3>
        </div>

        <p class="text-sm text-text-2 mb-5 leading-relaxed">
          {_("port.confirm_local_warn")}
        </p>

        <div class="flex gap-2 justify-end">
          <button
            onclick={cancelConfirm}
            class="px-3 py-1.5 text-text-2 text-xs border border-border rounded-lg hover:bg-surface-3 transition-colors"
          >
            {_("port.confirm_no")}
          </button>
          <button
            onclick={confirmMakeLocal}
            disabled={store.busy}
            class="px-3 py-1.5 bg-warning text-black text-xs font-medium rounded-lg hover:bg-warning/80 transition-colors disabled:opacity-50"
          >
            {_("port.confirm_yes")}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Warning Modal: Client-Affecting Port Change -->
  {#if pendingSaveKey}
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <div
        class="bg-surface-2 border border-border rounded-xl p-5 max-w-sm w-full shadow-2xl"
      >
        <div class="flex items-center gap-2 mb-3">
          <div class="p-2 bg-warning/15 rounded-lg">
            <AlertTriangle size={20} class="text-warning" />
          </div>
          <h3 class="text-base font-semibold text-text">
            {_("port.client_warn_title", {
              port:
                pendingSaveKey && PORT_LABEL_KEYS[pendingSaveKey]
                  ? _(PORT_LABEL_KEYS[pendingSaveKey])
                  : pendingSaveKey ?? "",
            })}
          </h3>
        </div>

        <p class="text-sm text-text-2 mb-5 leading-relaxed">
          {_("port.client_warn_body")}
        </p>

        <div class="flex gap-2 justify-end">
          <button
            onclick={cancelPortChange}
            class="px-3 py-1.5 text-text-2 text-xs border border-border rounded-lg hover:bg-surface-3 transition-colors"
          >
            {_("port.confirm_no")}
          </button>
          <button
            onclick={confirmPortChange}
            disabled={store.busy}
            class="px-3 py-1.5 bg-warning text-black text-xs font-medium rounded-lg hover:bg-warning/80 transition-colors disabled:opacity-50"
          >
            {_("port.client_warn_confirm")}
          </button>
        </div>
      </div>
    </div>
  {/if}
{:else}
  <p class="text-text-2 text-sm">{_("misc.loading")}</p>
{/if}
