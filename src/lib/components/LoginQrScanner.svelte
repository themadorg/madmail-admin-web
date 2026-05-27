<script lang="ts">
  import { onDestroy } from "svelte";
  import { parseAdminLoginQrPayload } from "$lib/adminLoginQr";
  import { t, getLocale } from "$lib/i18n";
  import { X, QrCode } from "lucide-svelte";

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

  let scannerHost = $state<HTMLDivElement | null>(null);
  let scanError = $state("");
  let starting = $state(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let scanner: any = null;

  async function stopScanner() {
    if (!scanner) return;
    try {
      const running = scanner.isScanning?.() ?? false;
      if (running) await scanner.stop();
      await scanner.clear?.();
    } catch {
      /* ignore teardown errors */
    }
    scanner = null;
  }

  async function startScanner() {
    if (!scannerHost || !open) return;
    scanError = "";
    starting = true;
    await stopScanner();
    scannerHost.replaceChildren();

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const id = "madmail-login-qr-reader";
      const mount = document.createElement("div");
      mount.id = id;
      scannerHost.appendChild(mount);

      scanner = new Html5Qrcode(id);
      await scanner.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 240, height: 240 } },
        (decoded: string) => {
          const creds = parseAdminLoginQrPayload(decoded);
          if (!creds) {
            scanError = _("login.qr_invalid");
            return;
          }
          void stopScanner();
          open = false;
          onScan(creds);
        },
        () => {
          /* frame decode miss — ignore */
        },
      );
    } catch (e) {
      scanError = String(e);
    } finally {
      starting = false;
    }
  }

  $effect(() => {
    locale = getLocale();
  });

  $effect(() => {
    if (open) {
      void startScanner();
    } else {
      void stopScanner();
      scanError = "";
    }
  });

  onDestroy(() => {
    void stopScanner();
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

      <div
        bind:this={scannerHost}
        class="login-qr-reader overflow-hidden rounded-xl bg-black min-h-[240px] flex items-center justify-center"
      >
        {#if starting}
          <span class="text-xs text-text-2">{_("login.qr_starting")}</span>
        {/if}
      </div>

      {#if scanError}
        <p class="mt-3 text-xs text-danger">{scanError}</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .login-qr-overlay {
    padding-bottom: env(safe-area-inset-bottom);
    padding-top: env(safe-area-inset-top);
  }

  :global(.login-qr-reader video) {
    border-radius: 0.75rem;
    width: 100% !important;
    height: auto !important;
  }
</style>
