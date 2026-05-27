<script lang="ts">
  import "./layout.css";
  import { page } from "$app/stores";
  import { base } from "$app/paths";
  import { afterNavigate, goto } from "$app/navigation";
  import { tick } from "svelte";
  import { store } from "$lib/state.svelte";
  import { t, getLocale, setLocale, LOCALES, type Locale } from "$lib/i18n";
  import { startVersionChecker, applyUpdate } from "$lib/sw-update";
  import {
    getSavedServers,
    removeServer,
    type SavedServer,
  } from "$lib/servers";
  import ThemeSwitcher from "$lib/components/ThemeSwitcher.svelte";
  import { dragScroll } from "$lib/actions/dragScroll";
  import { matrixRain } from "$lib/actions/matrixRain";
  import { doubleTap } from "$lib/actions/doubleTap";
  import { buildLogoMorphStyle } from "$lib/logoMorph";
  import {
    createLogoSecretGlitch,
    LOGO_SECRET_LABEL,
    LOGO_SECRET_TITLE,
  } from "$lib/logoSecretGlitch";
  import { createLogoSecretStatusPoller } from "$lib/logoSecretStatus";
  import {
    applyLogoSecretAccent,
    getLogoSecretAccent,
    setLogoSecretAccent,
    unlockLogoSecretAccent,
    type LogoSecretAccent,
  } from "$lib/logoSecretAccent";
  import { theme } from "$lib/stores/theme.svelte";
  import {
    Mail,
    Plug,
    RefreshCw,
    LogOut,
    AlertTriangle,
    Globe,
    LayoutDashboard,
    Settings,
    Network,
    Users,
    ShieldBan,
    Shield,
    Server,
    Trash2,
    Github,
    Download,
    ArrowDownToLine,
    Ticket,
    GitBranch,
  } from "lucide-svelte";

  let { children } = $props();

  const appVersion =
    typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

  let langOpen = $state(false);
  let locale = $state(getLocale());

  function _(key: string, params?: Record<string, string>): string {
    void locale;
    return t(key, params);
  }

  function switchLocale(l: Locale) {
    setLocale(l);
    locale = l;
    langOpen = false;
  }

  let canConnect = $derived(
    store.baseUrl.length > 0 && store.token.length > 0 && !store.connecting,
  );

  $effect(() => {
    theme.init();
  });

  const NAV_ITEMS = [
    { href: "/", key: "tab.overview", icon: LayoutDashboard },
    { href: "/services", key: "tab.services", icon: Settings },
    { href: "/proxy", key: "tab.proxy", icon: Shield },
    { href: "/ports", key: "tab.ports", icon: Network },
    { href: "/accounts", key: "tab.accounts", icon: Users },
    { href: "/federation", key: "tab.federation", icon: GitBranch },
    { href: "/notice", key: "tab.notice", icon: Mail },
  ];

  // Saved servers from IndexedDB
  let savedServers = $state<SavedServer[]>([]);

  async function loadSavedServers() {
    savedServers = await getSavedServers();
  }

  function selectServer(s: SavedServer) {
    store.baseUrl = s.url;
    store.token = s.token;
    store.connect();
  }

  async function deleteSavedServer(e: MouseEvent, id: string) {
    e.stopPropagation();
    await removeServer(id);
    await loadSavedServers();
  }

  // Auto-connect on mount
  let autoConnectDone = false;
  $effect(() => {
    if (!autoConnectDone && store.baseUrl && store.token) {
      autoConnectDone = true;
      store.connect();
    }
  });

  // Load saved servers when not connected
  $effect(() => {
    if (!store.connected) {
      loadSavedServers();
    }
  });

  // Version update checker
  let updateAvailable = $state("");
  if (typeof window !== "undefined") {
    startVersionChecker((newVer) => {
      updateAvailable = newVer;
    });
  }

  function isActive(href: string, path: string): boolean {
    // Strip base prefix for comparison
    const p = base ? path.replace(base, "") || "/" : path;
    if (href === "/") return p === "/";
    return p.startsWith(href);
  }

  let navScrollEl = $state<HTMLElement | null>(null);
  let navTrackEl = $state<HTMLElement | null>(null);
  let navScrollEndEl = $state<HTMLElement | null>(null);
  let showNavEndFade = $state(false);
  const linkRefs = new Map<string, HTMLAnchorElement>();
  let tabIndicator = $state({ left: 0, width: 0, ready: false });
  let tabIndicatorInstant = $state(true);

  function navLinkRef(node: HTMLAnchorElement, href: string) {
    linkRefs.set(href, node);
    void tick().then(updateTabIndicator);
    return {
      destroy() {
        linkRefs.delete(href);
      },
    };
  }

  function updateTabIndicator() {
    if (!navTrackEl) return;
    const active = NAV_ITEMS.find((item) =>
      isActive(item.href, $page.url.pathname),
    );
    if (!active) {
      tabIndicator = { left: 0, width: 0, ready: false };
      return;
    }
    const link = linkRefs.get(active.href);
    if (!link) return;
    const left = link.offsetLeft;
    const width = link.offsetWidth;
    if (
      tabIndicator.ready &&
      tabIndicator.left === left &&
      tabIndicator.width === width
    ) {
      return;
    }
    tabIndicator = { left, width, ready: true };
    if (tabIndicatorInstant) {
      requestAnimationFrame(() => {
        tabIndicatorInstant = false;
      });
    }
  }

  function scrollActiveNavTabIntoView(smooth: boolean) {
    const root = navScrollEl;
    if (!root) return;
    const active = NAV_ITEMS.find((item) =>
      isActive(item.href, $page.url.pathname),
    );
    if (!active) return;
    const link = linkRefs.get(active.href);
    if (!link) return;

    const maxScroll = root.scrollWidth - root.clientWidth;
    if (maxScroll <= 0) return;

    const target =
      link.offsetLeft - (root.clientWidth - link.offsetWidth) / 2;
    const scrollLeft = Math.max(0, Math.min(maxScroll, target));

    root.scrollTo({
      left: scrollLeft,
      behavior: smooth ? "smooth" : "auto",
    });
  }

  let navInitialScrollDone = false;

  async function alignNavToRoute(smooth: boolean) {
    await tick();
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    updateTabIndicator();
    const active = NAV_ITEMS.find((item) =>
      isActive(item.href, $page.url.pathname),
    );
    if (active && !linkRefs.get(active.href)) {
      await tick();
    }
    scrollActiveNavTabIntoView(smooth);
  }

  /** Reload / auto-connect: nav mounts after connected — scroll active tab once (instant). */
  $effect(() => {
    if (!store.connected) {
      navInitialScrollDone = false;
      return;
    }
    const _path = $page.url.pathname;
    if (navInitialScrollDone) return;
    void alignNavToRoute(false).then(() => {
      navInitialScrollDone = true;
    });
  });

  /** In-app navigation: smooth scroll + slide indicator. */
  afterNavigate(({ from, to }) => {
    if (!to || !store.connected || !from) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    void alignNavToRoute(smooth);
  });

  $effect(() => {
    locale;
    void tick().then(updateTabIndicator);
  });

  $effect(() => {
    const track = navTrackEl;
    if (!track) return;
    const onLayout = () => updateTabIndicator();
    const ro = new ResizeObserver(onLayout);
    ro.observe(track);
    window.addEventListener("resize", onLayout);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onLayout);
    };
  });

  /** Show edge fade only while the last tab is still clipped (more to scroll). */
  $effect(() => {
    const root = navScrollEl;
    const sentinel = navScrollEndEl;
    if (!root || !sentinel) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        showNavEndFade = !entry.isIntersecting;
      },
      { root, threshold: 1 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  });

  let loginLogoEl = $state<HTMLImageElement | null>(null);
  let headerLogoEl = $state<HTMLElement | null>(null);
  let logoMorphActive = $state(false);
  let headerLogoHidden = $state(false);
  let logoMorphStyle = $state("");
  /** Keeps login shell mounted while the logo flies into the header (same session, not a page swap). */
  let loginHandoff = $state(false);

  async function startLogoMorph(from: DOMRect) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      loginHandoff = false;
      return;
    }

    await tick();
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    const toEl = headerLogoEl;
    if (!toEl) {
      loginHandoff = false;
      return;
    }
    const to = toEl.getBoundingClientRect();
    if (to.width <= 0 || to.height <= 0) {
      loginHandoff = false;
      return;
    }

    logoMorphStyle = buildLogoMorphStyle(from, to);
    headerLogoHidden = true;
    logoMorphActive = true;
    window.setTimeout(() => {
      if (logoMorphActive) finishLogoMorph();
    }, 650);
  }

  function finishLogoMorph() {
    if (!logoMorphActive && !headerLogoHidden && !loginHandoff) return;
    logoMorphActive = false;
    headerLogoHidden = false;
    logoMorphStyle = "";
    loginHandoff = false;
  }

  async function connectWithMorph() {
    const from = loginLogoEl?.getBoundingClientRect();
    await store.connect();
    if (!store.connected) return;
    if (!from) return;
    loginHandoff = true;
    await startLogoMorph(from);
  }

  const LOGO_SECRET_SRC = `${base}/madmail_logo02_bg_white_bg.png`;
  let logoSecretActive = $state(false);
  let logoSecretLabel = $state(LOGO_SECRET_TITLE);
  let logoSecretTitleBase = $state(LOGO_SECRET_TITLE);
  let logoSecretAccent = $state<LogoSecretAccent>(
    getLogoSecretAccent() ?? "red",
  );
  let matrixGoldenFlashSeq = $state(0);
  let logoSecretRainWord = $state(`${LOGO_SECRET_LABEL}.`);
  let logoSecretHelpVisible = $state(false);
  let logoSecretHelpTimer: ReturnType<typeof window.setTimeout> | undefined;
  let logoSecretPollingActive = $state(false);

  function queueGoldenRainFlashes(count: number) {
    for (let i = 0; i < count; i++) {
      window.setTimeout(() => {
        matrixGoldenFlashSeq++;
      }, i * 1500);
    }
  }

  function selectLogoSecretAccent(accent: LogoSecretAccent) {
    logoSecretAccent = accent;
    setLogoSecretAccent(accent);
    applyLogoSecretAccent(theme.mode);
  }

  function toggleLogoSecret(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    const opening = !logoSecretActive;
    logoSecretActive = !logoSecretActive;
    if (opening) {
      unlockLogoSecretAccent();
      logoSecretAccent = getLogoSecretAccent() ?? "red";
      applyLogoSecretAccent(theme.mode);
      logoSecretPollingActive = false;
      logoSecretTitleBase = LOGO_SECRET_LABEL;
      logoSecretRainWord = LOGO_SECRET_LABEL;
      logoSecretLabel = LOGO_SECRET_LABEL;
      matrixGoldenFlashSeq = 0;
    }
  }

  function navigateHomeFromLogo() {
    void goto(`${base}/`);
  }

  function closeLogoSecret() {
    logoSecretActive = false;
    logoSecretPollingActive = false;
    logoSecretHelpVisible = false;
    if (logoSecretHelpTimer !== undefined) {
      window.clearTimeout(logoSecretHelpTimer);
      logoSecretHelpTimer = undefined;
    }
  }

  function showLogoSecretHelp(e: MouseEvent) {
    e.stopPropagation();
    logoSecretPollingActive = true;
    if (logoSecretHelpTimer !== undefined) {
      window.clearTimeout(logoSecretHelpTimer);
    }
    logoSecretHelpVisible = true;
    logoSecretHelpTimer = window.setTimeout(() => {
      logoSecretHelpVisible = false;
      logoSecretHelpTimer = undefined;
    }, 5500);
  }

  function onLogoSecretKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") closeLogoSecret();
  }

  $effect(() => {
    if (!logoSecretActive || typeof window === "undefined") {
      logoSecretLabel = LOGO_SECRET_TITLE;
      logoSecretTitleBase = LOGO_SECRET_TITLE;
      logoSecretRainWord = `${LOGO_SECRET_LABEL}.`;
      matrixGoldenFlashSeq = 0;
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      logoSecretLabel = logoSecretTitleBase;
      return;
    }
    return createLogoSecretGlitch({
      getTitle: () => logoSecretTitleBase,
      onUpdate: (text) => {
        logoSecretLabel = text;
      },
    });
  });

  $effect(() => {
    if (
      !logoSecretActive ||
      !logoSecretPollingActive ||
      !store.connected ||
      typeof window === "undefined"
    ) {
      return;
    }

    return createLogoSecretStatusPoller(
      () => ({ baseUrl: store.baseUrl, token: store.token }),
      {
        onStatusAvailable: () => {
          logoSecretTitleBase = LOGO_SECRET_TITLE;
          logoSecretRainWord = `${LOGO_SECRET_LABEL}.`;
          logoSecretLabel = LOGO_SECRET_TITLE;
        },
        onStatusUnavailable: () => {
          logoSecretTitleBase = LOGO_SECRET_LABEL;
          logoSecretRainWord = LOGO_SECRET_LABEL;
          logoSecretLabel = LOGO_SECRET_LABEL;
        },
        onNewSentMessages: (count) => queueGoldenRainFlashes(count),
      },
    );
  });

  $effect(() => {
    if (!logoSecretActive || typeof window === "undefined") return;
    window.addEventListener("keydown", onLogoSecretKeydown);
    return () => window.removeEventListener("keydown", onLogoSecretKeydown);
  });
</script>

<svelte:head>
  <title>{_("app.title")}</title>
  <meta name="description" content={_("app.description")} />
</svelte:head>

{#snippet langPicker()}
  <div class="relative">
    <button
      onclick={() => (langOpen = !langOpen)}
      class="p-1.5 text-text-2 border border-border rounded-lg hover:bg-surface-3 transition-colors flex items-center gap-1"
      title={_("misc.language")}
    >
      <Globe size={14} />
      <span class="text-xs">{LOCALES.find((l) => l.code === locale)?.flag}</span
      >
    </button>
    {#if langOpen}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="absolute top-full mt-1 end-0 bg-surface-2 border border-border rounded-lg shadow-xl z-50 min-w-[140px] py-1 overflow-hidden"
        onclick={(e: MouseEvent) => e.stopPropagation()}
      >
        {#each LOCALES as l}
          <button
            onclick={() => switchLocale(l.code)}
            class="w-full px-3 py-2 text-start text-sm hover:bg-surface-3 transition-colors flex items-center gap-2
              {locale === l.code ? 'text-accent font-medium' : 'text-text'}"
          >
            <span>{l.flag}</span>
            <span>{l.label}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

<!-- Update Banner -->
{#if updateAvailable}
  <div
    class="fixed top-0 inset-x-0 z-[60] bg-accent/95 text-white px-4 py-2.5 flex items-center justify-center gap-3 text-sm font-medium shadow-lg backdrop-blur-sm"
  >
    <Download size={16} />
    <span>{_("update.available", { version: updateAvailable })}</span>
    <button
      onclick={() => applyUpdate()}
      class="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md text-xs font-semibold transition-colors"
      >{_("update.button")}</button
    >
    <button
      onclick={() => (updateAvailable = "")}
      class="px-2 py-1 text-white/60 hover:text-white text-xs transition-colors"
      >✕</button
    >
  </div>
{/if}

<!-- Toast -->
{#if store.toast}
  <div
    class="fixed top-4 end-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-all
    {store.toastType === 'ok'
      ? 'bg-success/20 text-success border border-success/30'
      : 'bg-danger/20 text-danger border border-danger/30'}"
  >
    {store.toast}
  </div>
{/if}

{#if logoSecretActive}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="logo-secret-overlay"
    onclick={closeLogoSecret}
    role="presentation"
  >
    <canvas
      class="logo-secret__matrix"
      use:matrixRain={{
        accent: logoSecretAccent,
        goldenFlashSeq: matrixGoldenFlashSeq,
        rainWord: logoSecretRainWord,
      }}
      aria-hidden="true"
    ></canvas>
    {#if logoSecretHelpVisible}
      <p class="logo-secret__hint" role="status">
        {t("logo_secret.help_hint")}
      </p>
    {/if}
    <button
      type="button"
      class="logo-secret__help"
      aria-label={t("logo_secret.help_btn_aria")}
      onclick={showLogoSecretHelp}
    ></button>
    <div class="logo-secret" onclick={(e) => e.stopPropagation()}>
      <div class="logo-secret__mark">
        <div class="logo-secret__glitch" aria-hidden="true">
          <img src={LOGO_SECRET_SRC} alt="" class="logo-secret__layer logo-secret__layer--base" />
          <img src={LOGO_SECRET_SRC} alt="" class="logo-secret__layer logo-secret__layer--red" />
          <img src={LOGO_SECRET_SRC} alt="" class="logo-secret__layer logo-secret__layer--cyan" />
        </div>
        <img
          src={LOGO_SECRET_SRC}
          alt="Madmail"
          class="logo-secret__main"
          draggable="false"
        />
      </div>
      <p class="logo-secret__title" aria-hidden="true">
        <span class="logo-secret__title-layer logo-secret__title-layer--r"
          >{logoSecretLabel}</span
        >
        <span class="logo-secret__title-layer logo-secret__title-layer--g"
          >{logoSecretLabel}</span
        >
        <span class="logo-secret__title-main">{logoSecretLabel}</span>
      </p>
      <div class="logo-secret__pills" role="group" aria-label="Accent">
        <button
          type="button"
          class="logo-secret__pill logo-secret__pill--blue"
          class:logo-secret__pill--active={logoSecretAccent === "blue"}
          aria-label="Blue"
          aria-pressed={logoSecretAccent === "blue"}
          onclick={() => selectLogoSecretAccent("blue")}
        ></button>
        <button
          type="button"
          class="logo-secret__pill logo-secret__pill--red"
          class:logo-secret__pill--active={logoSecretAccent === "red"}
          aria-label="Red"
          aria-pressed={logoSecretAccent === "red"}
          onclick={() => selectLogoSecretAccent("red")}
        ></button>
      </div>
    </div>
  </div>
{/if}

{#if logoMorphActive}
  <img
    src="{base}/madmail-logo.png"
    alt=""
    class="logo-morph"
    style={logoMorphStyle}
    aria-hidden="true"
    onanimationend={finishLogoMorph}
  />
{/if}

<!-- Login Gate (stays visible during logo handoff so it is one continuous motion) -->
{#if !store.connected || loginHandoff}
  <div
    class="login-gate min-h-screen bg-surface text-text flex flex-col items-center justify-center p-4"
    class:login-gate--handoff={loginHandoff}
    style="font-family: 'Inter', system-ui, sans-serif;"
  >
    <div
      class="login-gate__card ui-card ui-card--panel w-full max-w-sm p-6"
    >
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <img
            bind:this={loginLogoEl}
            src="{base}/madmail-logo.png"
            alt="Madmail"
            width="48"
            height="48"
            class="login-logo h-12 w-12 rounded-xl object-contain shrink-0"
            class:login-logo--handoff={logoMorphActive}
          />
          <div>
            <h1 class="text-lg font-semibold">{_("login.title")}</h1>
            <p class="text-text-2 text-xs">{_("login.subtitle")}</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <ThemeSwitcher {locale} />
          {@render langPicker()}
        </div>
      </div>

      <label for="url" class="block text-xs text-text-2 mb-1"
        >{_("login.url_label")}</label
      >
      <input
        id="url"
        type="url"
        bind:value={store.baseUrl}
        placeholder={_("login.url_placeholder")}
        class="w-full mb-3 px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text placeholder-text-2/40 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition"
      />

      <label for="tok" class="block text-xs text-text-2 mb-1"
        >{_("login.token_label")}</label
      >
      <input
        id="tok"
        type="password"
        bind:value={store.token}
        placeholder={_("login.token_placeholder")}
        onkeydown={(e: KeyboardEvent) => {
          if (e.key === "Enter") connectWithMorph();
        }}
        class="w-full mb-4 px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text placeholder-text-2/40 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition"
      />

      {#if store.connectError}
        <div class="text-danger text-xs mb-3">
          <p class="flex items-center gap-1">
            <AlertTriangle size={12} />
            {store.connectError}
          </p>
          {#if store.connectError.includes("Failed to fetch") || store.connectError.includes("NetworkError") || store.connectError.includes("net::")}
            <div
              class="mt-2 p-2 bg-warning/10 border border-warning/20 rounded-md text-warning text-xs"
            >
              <p class="font-medium mb-1">{_("login.cert_title")}</p>
              <p class="text-text-2 mb-2">
                {_("login.cert_hint")}
              </p>
              <a
                href={store.baseUrl}
                target="_blank"
                rel="noopener"
                class="inline-flex items-center gap-1 text-accent hover:underline font-medium"
                >{_("login.cert_open", { url: store.baseUrl })}</a
              >
            </div>
          {/if}
        </div>
      {/if}

      <button
        onclick={() => connectWithMorph()}
        disabled={!canConnect}
        class="w-full py-2.5 bg-accent hover:bg-accent-dim text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {#if store.connecting}
          <RefreshCw size={14} class="animate-spin" /> {_("login.connecting")}
        {:else}
          <Plug size={14} /> {_("login.connect")}
        {/if}
      </button>

      <!-- Saved Servers -->
      {#if savedServers.length > 0}
        <div class="mt-5 pt-4 border-t border-border">
          <h3
            class="text-xs text-text-2 font-medium mb-2.5 flex items-center gap-1.5"
          >
            <Server size={12} />
            {_("login.saved_servers")}
          </h3>
          <div class="space-y-1.5">
            {#each savedServers as s (s.id)}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                onclick={() => selectServer(s)}
                class="w-full group flex items-center gap-2.5 px-3 py-2 bg-surface border border-border rounded-lg hover:border-accent/50 hover:bg-accent/5 transition-all text-start cursor-pointer"
              >
                <div class="p-1.5 bg-accent/10 rounded-md shrink-0">
                  <Server size={13} class="text-accent" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-medium truncate">{s.label}</div>
                  <div class="text-[11px] text-text-2 truncate">{s.url}</div>
                </div>
                <button
                  onclick={(e: MouseEvent) => deleteSavedServer(e, s.id)}
                  class="p-1 text-text-2 opacity-0 group-hover:opacity-100 hover:text-danger transition-all rounded"
                  title={_("login.remove_saved")}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
    <a
      href="https://github.com/themadorg/madmail-admin-web"
      target="_blank"
      rel="noopener"
      class="text-text-2/40 hover:text-text-2/70 text-[10px] mt-4 text-center flex items-center justify-center gap-1 transition-colors"
    >
      <Github size={10} />
      v{appVersion}
    </a>
  </div>
{/if}

{#if store.connected}
  <!-- Authenticated Shell -->
  <div
    class="app-shell min-h-dvh flex flex-col bg-surface text-text"
    style="font-family: 'Inter', system-ui, sans-serif;"
  >
    <div
      class="app-shell__inner max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 flex-1 flex flex-col w-full"
    >
      <!-- Header -->
      <header class="app-header mb-4 sm:mb-6">
        <a
          href="{base}/"
          bind:this={headerLogoEl}
          class="app-header__logo"
          class:app-header__logo--hidden={headerLogoHidden}
          use:doubleTap={{
            onDouble: toggleLogoSecret,
            onSingle: navigateHomeFromLogo,
          }}
        >
          <img
            src="{base}/madmail-logo.png"
            alt="Madmail"
            class="app-header__logo-img"
          />
        </a>

        <div class="app-header__content">
          <div class="app-header__heading flex items-center gap-1.5 flex-wrap">
            <h1 class="text-xl font-semibold leading-tight">Madmail</h1>
            <span class="text-[10px] text-text-2/50 font-mono">v{appVersion}</span>
          </div>
          <p class="app-header__url text-text-2 text-[11px] truncate leading-snug">
            {store.baseUrl}
          </p>
          <div class="app-header__actions flex items-center gap-1.5 flex-wrap">
            {#if store.pendingRestart}
              <button
                onclick={() => store.reload()}
                disabled={store.reloading}
                class="px-3 py-1.5 bg-warning/20 text-warning text-xs font-medium rounded-lg border border-warning/30 hover:bg-warning/30 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <AlertTriangle size={12} />
                {store.reloading
                  ? _("action.restarting")
                  : _("action.apply_restart")}
              </button>
            {/if}
            {@render langPicker()}
            <a
              href="https://github.com/themadorg/madmail-admin-web"
              target="_blank"
              rel="noopener"
              class="p-1.5 text-text-2 border border-border rounded-lg hover:bg-surface-3 transition-colors"
              title={_("misc.github")}
            >
              <Github size={14} />
            </a>
            <ThemeSwitcher {locale} />
            <button
              onclick={() => store.refreshForPath($page.url.pathname)}
              disabled={store.refreshing}
              class="p-1.5 text-text-2 border border-border rounded-lg hover:bg-surface-3 transition-colors disabled:opacity-50"
              title={_("action.refresh")}
            >
              <RefreshCw
                size={14}
                class={store.refreshing ? "animate-spin" : ""}
              />
            </button>
            <button
              onclick={() => store.disconnect()}
              class="p-1.5 text-text-2 border border-border rounded-lg hover:bg-surface-3 transition-colors"
              title={_("action.disconnect")}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      <!-- Navigation -->
      <div class="mb-2 sm:mb-3">
        <nav
          bind:this={navScrollEl}
          use:dragScroll
          class="nav-scroll border-b border-border overflow-x-auto scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0"
        >
          <div
            bind:this={navTrackEl}
            class="nav-track relative flex gap-0.5 min-w-max"
          >
            {#each NAV_ITEMS as item}
              <a
                href="{base}{item.href}"
                use:navLinkRef={item.href}
                data-sveltekit-noscroll
                class="px-3 py-2 text-sm transition-colors flex items-center gap-1.5 whitespace-nowrap
                  {isActive(item.href, $page.url.pathname)
                  ? 'text-accent font-medium'
                  : 'text-text-2 hover:text-text'}"
              >
                <item.icon size={13} />
                {_(item.key)}
              </a>
            {/each}
            <span
              bind:this={navScrollEndEl}
              class="nav-scroll-sentinel shrink-0 self-stretch w-px"
              aria-hidden="true"
            ></span>
            {#if tabIndicator.ready}
              <span
                class="nav-tab-indicator"
                class:nav-tab-indicator--instant={tabIndicatorInstant}
                style="transform: translateX({tabIndicator.left}px); width: {tabIndicator.width}px;"
                aria-hidden="true"
              ></span>
            {/if}
          </div>
          {#if showNavEndFade}
            <div class="nav-scroll-fade sm:hidden" aria-hidden="true"></div>
          {/if}
        </nav>
      </div>

      <!-- Page Content -->
      <main class="app-main flex flex-col flex-1">
        {@render children()}
      </main>
    </div>
  </div>
{/if}
