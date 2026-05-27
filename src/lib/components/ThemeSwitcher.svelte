<script lang="ts">
  import { Sun, Moon } from "lucide-svelte";
  import { theme } from "$lib/stores/theme.svelte";
  import { t, type Locale } from "$lib/i18n";

  interface Props {
    /** Pass layout locale so the tooltip updates when language changes */
    locale?: Locale;
    class?: string;
  }

  let { locale, class: className = "" }: Props = $props();

  $effect(() => {
    theme.init();
  });

  let title = $derived.by(() => {
    void locale;
    return theme.isDark ? t("theme.light") : t("theme.dark");
  });
</script>

<button
  type="button"
  onclick={() => theme.toggle()}
  class="p-1.5 text-text-2 border border-border rounded-lg hover:bg-surface-3 transition-colors {className}"
  {title}
  aria-label={title}
>
  {#if theme.isDark}
    <Sun size={14} />
  {:else}
    <Moon size={14} />
  {/if}
</button>
