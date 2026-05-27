<script lang="ts">
  import { RefreshCw } from "lucide-svelte";
  import { t, getLocale } from "$lib/i18n";

  let { label = "" }: { label?: string } = $props();

  let locale = $state(getLocale());
  function _(key: string): string {
    void locale;
    return t(key);
  }

  $effect(() => {
    locale = getLocale();
  });
</script>

<div class="page-loading" role="status" aria-live="polite">
  <RefreshCw size={18} class="page-loading__icon animate-spin shrink-0" />
  <span class="page-loading__text">{label || _("misc.loading")}</span>
</div>
