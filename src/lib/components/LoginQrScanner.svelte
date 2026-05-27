<script lang="ts">
  import { onDestroy } from "svelte";
  import { parseAdminLoginQrPayload } from "$lib/adminLoginQr";
  import { releaseCameraAccess } from "$lib/cameraAccess";
  import { decodeQrFromImageFile } from "$lib/qrDecode";
  import { t, getLocale } from "$lib/i18n";
  import { Image, X, QrCode, RotateCcw } from "lucide-svelte";

  let {
    open = $bindable(false),
    onScan,
  }: {
    open?: boolean;
    onScan: (creds: { url: string; token: string }) => void;
  } = $props();

  let locale = $state(getLocale());
  function _(key: string): string {
    void locale;
    return t(key);
  }

  let fileInput = $state<HTMLInputElement | null>(null);
  let previewUrl = $state<string | null>(null);
  let scanError = $state("");
  let scanning = $state(false);

  function applyScanResult(decoded: string): boolean {
    const creds = parseAdminLoginQrPayload(decoded);
    if (!creds) {
      scanError = _("login.qr_invalid");
      return false;
    }
    clearPreview();
    open = false;
    void releaseCameraAccess();
    onScan(creds);
    return true;
  }

  function clearPreview() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
  }

  async function scanFromFile(file: File) {
    scanError = "";
    clearPreview();
    previewUrl = URL.createObjectURL(file);
    scanning = true;
    try {
      const decoded = await decodeQrFromImageFile(file);
      applyScanResult(decoded);
    } catch (e) {
      scanError =
        e instanceof Error ? e.message : String(e) || _("login.qr_invalid");
    } finally {
      scanning = false;
    }
  }

  function onFileSelected(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (file) void scanFromFile(file);
  }

  function retry() {
    scanError = "";
    clearPreview();
  }

  function resetModal() {
    retry();
    scanning = false;
    void releaseCameraAccess();
  }

  $effect(() => {
    locale = getLocale();
  });

  $effect(() => {
    if (!open) resetModal();
  });

  onDestroy(() => {
    clearPreview();
    void releaseCameraAccess();
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="login-qr-overlay fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
    onclick={() => (open = false)}
  >
    <div
      class="login-qr-panel ui-card ui-card--panel w-full sm:max-w-sm p-4 rounded-t-2xl sm:rounded-2xl"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex items-center justify-between gap-3 mb-3">
        <div class="flex items-center gap-2 min-w-0">
          <QrCode size={16} class="text-accent shrink-0" />
          <h2 class="text-sm font-semibold truncate">{_("login.qr_title")}</h2>
        </div>
        <button
          type="button"
          onclick={() => (open = false)}
          class="p-1.5 text-text-2 hover:text-text rounded-lg transition-colors"
          aria-label={_("login.qr_close")}
        >
          <X size={16} />
        </button>
      </div>

      <p class="text-xs text-text-2 mb-3">{_("login.qr_hint")}</p>

      <input
        bind:this={fileInput}
        type="file"
        accept="image/*"
        class="hidden"
        onchange={onFileSelected}
      />

      {#if previewUrl}
        <div class="login-qr-preview overflow-hidden rounded-xl bg-black min-h-[240px] flex flex-col">
          <img
            src={previewUrl}
            alt=""
            class="w-full max-h-[320px] object-contain bg-black"
          />
          {#if scanning}
            <p class="px-3 py-2 text-xs text-text-2 text-center border-t border-border/40">
              {_("login.qr_scanning")}
            </p>
          {/if}
        </div>
      {:else}
        <button
          type="button"
          onclick={() => fileInput?.click()}
          disabled={scanning}
          class="w-full py-2.5 bg-accent hover:bg-accent-dim text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mb-1"
        >
          <Image size={16} />
          {_("login.qr_choose_photo")}
        </button>
      {/if}

      {#if scanError}
        <p class="mt-3 text-xs text-danger">{scanError}</p>
        <button
          type="button"
          onclick={retry}
          disabled={scanning}
          class="mt-2 w-full py-2.5 bg-surface border border-border rounded-lg hover:bg-surface-3 text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <RotateCcw size={14} />
          {_("login.qr_retry")}
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .login-qr-overlay {
    padding-bottom: env(safe-area-inset-bottom);
    padding-top: env(safe-area-inset-top);
  }
</style>
