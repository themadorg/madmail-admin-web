<script lang="ts">
  import { store } from '$lib/state.svelte';
  let protectedSettings = $derived(Object.entries(store.settings?.configuration_sources ?? {}).filter(([, source]) => source.locked));
</script>
{#if protectedSettings.length}
  <details class="ui-card m-3 p-3 text-sm">
    <summary>Deployment configuration: {protectedSettings.length} read-only settings</summary>
    <p class="mt-2 text-text-2">These settings are controlled by environment variables or the configuration file. Change the indicated source and restart the service. Database-backed controls cannot override them.</p>
    <ul class="mt-2">
      {#each protectedSettings as [name, entry]}
        <li><code>{name}</code>: {entry.source}{entry.database_value_present ? ' (stored database value is inactive)' : ''}</li>
      {/each}
    </ul>
  </details>
{/if}
