<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { parseAdminLoginQrPayload } from "$lib/adminLoginQr";
  import { decodeQrFromImageFile } from "$lib/qrDecode";
  import { t, getLocale } from "$lib/i18n";
  import { Camera, Image, X, QrCode } from "lucide-svelte";

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
  let fileInput = $state<HTMLInputElement | null>(null);
  let scanError = $state("");
  let starting = $state(false);
  let cameraActive = $state(false);
  let needsCameraTap = $state(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let scanner: any = null;

  function applyScanResult(decoded: string) {
    const creds = parseAdminLoginQrPayload(decoded);
    if (!creds) {
      scanError = _("login.qr_invalid");
      return false;
    }
    void stopScanner();
    open = false;
    onScan(creds);
    return true;
  }

  async function stopScanner() {
    cameraActive = false;
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

  async function pickCameraId(Html5Qrcode: {
    getCameras: () => Promise<{ id: string; label: string }[]>;
  }): Promise<string | { facingMode: string }> {
    try {
      const cameras = await Html5Qrcode.getCameras();
      if (cameras.length === 0) return { facingMode: "environment" };
      const back = cameras.find((c) =>
        /back|rear|environment/i.test(c.label),
      );
      return (back ?? cameras[cameras.length - 1]).id;
    } catch {
      return { facingMode: "environment" };
    }
  }

  async function startScanner() {
    if (!scannerHost || !open) return;
    scanError = "";
    starting = true;
    needsCameraTap = false;
    await stopScanner();
    await tick();
    scannerHost.replaceChildren();

    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } =
        await import("html5-qrcode");
      const id = "madmail-login-qr-reader";
      const mount = document.createElement("div");
      mount.id = id;
      scannerHost.appendChild(mount);

      scanner = new Html5Qrcode(id, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      });
      const camera = await pickCameraId(Html5Qrcode);
      await scanner.start(
        camera,
        {
          fps: 10,
          // Scan the full frame — terminal / screen QRs are easier when not cropped.
          qrbox: (w: number, h: number) => ({ width: w, height: h }),
          aspectRatio: 1,
          disableFlip: false,
          videoConstraints: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        (decoded: string) => {
          applyScanResult(decoded);
        },
        () => {
          /* frame decode miss */
        },
      );
      cameraActive = true;
    } catch (e) {
      scanError =
        e instanceof Error ? e.message : String(e) || _("login.qr_camera_failed");
      needsCameraTap = true;
    } finally {
      starting = false;
    }
  }

  async function scanFromFile(file: File) {
    scanError = "";
    starting = true;
    try {
      const decoded = await decodeQrFromImageFile(file);
      applyScanResult(decoded);
    } catch (e) {
      scanError =
        e instanceof Error ? e.message : String(e) || _("login.qr_invalid");
    } finally {
      starting = false;
    }
  }

  function onFileSelected(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (file) void scanFromFile(file);
  }

  function resetModal() {
    void stopScanner();
    scanError = "";
    starting = false;
    needsCameraTap = true;
  }

  $effect(() => {
    locale = getLocale();
  });

  $effect(() => {
    if (!open) {
      resetModal();
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

      <input
        bind:this={fileInput}
        type="file"
        accept="image/*"
        class="hidden"
        onchange={onFileSelected}
      />

      {#if needsCameraTap && !cameraActive}
        <div class="flex flex-col gap-2 mb-3">
          <button
            type="button"
            onclick={() => void startScanner()}
            disabled={starting}
            class="w-full py-2.5 bg-accent hover:bg-accent-dim text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Camera size={16} />
            {starting ? _("login.qr_starting") : _("login.qr_start_camera")}
          </button>
          <button
            type="button"
            onclick={() => fileInput?.click()}
            disabled={starting}
            class="w-full py-2.5 bg-surface border border-border rounded-lg hover:bg-surface-3 text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Image size={16} />
            {_("login.qr_from_photo")}
          </button>
        </div>
      {/if}

      <div
        bind:this={scannerHost}
        class="login-qr-reader overflow-hidden rounded-xl bg-black min-h-[240px] flex items-center justify-center"
        class:hidden={needsCameraTap && !cameraActive}
      >
        {#if starting && !cameraActive}
          <span class="text-xs text-text-2">{_("login.qr_starting")}</span>
        {/if}
      </div>

      {#if cameraActive}
        <button
          type="button"
          onclick={() => fileInput?.click()}
          disabled={starting}
          class="mt-3 w-full py-2 text-xs text-text-2 hover:text-text transition-colors flex items-center justify-center gap-1.5"
        >
          <Image size={14} />
          {_("login.qr_from_photo")}
        </button>
      {/if}

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
    object-fit: cover;
  }

  :global(.login-qr-reader #madmail-login-qr-reader) {
    width: 100%;
  }
</style>
