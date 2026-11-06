<script lang="ts">
    import { onDestroy } from 'svelte';
    import { apiCall, type ApiConfig } from '$lib/api';
    import { store } from '$lib/state.svelte';
    import { t } from '$lib/i18n';
    import { webhookPatch, type WebhookSettings } from '$lib/operatorWebhooks';
    import ToggleSwitch from './ToggleSwitch.svelte';

    const resource = '/admin/services/webhooks';
    let settings = $state<WebhookSettings | null>(null);
    let savedEnabled = $state(false);
    let secret = $state('');
    let clearSecret = $state(false);
    let loading = $state(false);
    let working = $state(false);
    let error = $state('');
    let revision = 0;
    onDestroy(() => { revision++; secret = ''; });
    const inputClass = 'w-full min-w-0 px-3 py-2 bg-surface border border-border rounded text-sm text-text focus:border-accent outline-none';

    $effect(() => {
        const config = store.cfg();
        const connected = store.connected;
        const current = ++revision;
        secret = '';
        clearSecret = false;
        settings = null;
        error = '';
        if (connected) void load(config, current);
    });

    async function load(config: ApiConfig, current: number) {
        loading = true;
        const result = await apiCall<WebhookSettings>(config, resource);
        if (current !== revision) return;
        loading = false;
        if (result.error || !result.data) { error = result.error || t('hooks.unavailable'); return; }
        settings = result.data;
        savedEnabled = result.data.enabled;
    }

    async function save() {
        if (!settings || working) return;
        const current = revision;
        const config = store.cfg();
        working = true;
        error = '';
        const result = await apiCall<WebhookSettings>(config, resource, 'PUT', webhookPatch(settings, secret, clearSecret));
        if (current !== revision) { working = false; return; }
        working = false;
        if (result.error || !result.data) { error = result.error || t('hooks.unavailable'); return; }
        settings = result.data;
        savedEnabled = result.data.enabled;
        secret = '';
        clearSecret = false;
        store.notify(t('hooks.saved'));
    }

    async function sendTest() {
        if (working || !savedEnabled) return;
        const current = revision;
        const config = store.cfg();
        working = true;
        error = '';
        const result = await apiCall<WebhookSettings>(config, resource, 'POST', { action: 'test' });
        if (current !== revision) { working = false; return; }
        working = false;
        if (result.error) error = result.error;
        else store.notify(t('hooks.test_sent'));
        // Refresh counters without overwriting unsaved form changes.
        const refreshed = await apiCall<WebhookSettings>(config, resource);
        if (current === revision && settings && refreshed.data) {
            settings.successful_deliveries = refreshed.data.successful_deliveries;
            settings.consecutive_failures = refreshed.data.consecutive_failures;
            settings.dropped_events = refreshed.data.dropped_events;
        }
    }
</script>

<section class="ui-card ui-card--rounded p-4 space-y-4" aria-labelledby="operator-webhooks-heading">
    <h2 id="operator-webhooks-heading" class="text-sm font-semibold">{t('hooks.title')}</h2>
    <p class="text-xs text-text-2">{t('hooks.description')}</p>
    {#if loading}<p role="status" class="text-xs text-text-2">{t('hooks.loading')}</p>{/if}
    {#if error}<p role="alert" class="text-sm text-danger break-words">{error}</p>{/if}
    {#if settings}
        <form onsubmit={(event) => { event.preventDefault(); void save(); }} class="space-y-4">
            <div class="flex items-center justify-between gap-3">
                <span class="text-sm">{t('hooks.enabled')}</span>
                <ToggleSwitch checked={settings.enabled} disabled={working} label={t('hooks.enabled')} onclick={() => { if (settings) settings.enabled = !settings.enabled; }} />
            </div>
            <label class="block text-xs space-y-1">
                <span>{t('hooks.url')}</span>
                <input type="url" bind:value={settings.url} required={settings.enabled} maxlength="2048" placeholder="https://hooks.example.com/madmail" disabled={working} class={inputClass} />
            </label>
            <label class="block text-xs space-y-1">
                <span>{t('hooks.secret')}</span>
                <input type="password" bind:value={secret} autocomplete="new-password" maxlength="4096" disabled={working || clearSecret} class={inputClass} />
                <span class="block text-text-2">{settings.secret_configured ? t('hooks.secret_present') : t('hooks.secret_missing')} {t('hooks.secret_help')}</span>
            </label>
            {#if settings.secret_configured}
                <label class="flex items-center gap-2 text-xs"><input type="checkbox" bind:checked={clearSecret} disabled={working} />{t('hooks.clear_secret')}</label>
            {/if}
            <label class="flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={settings.event_user_registered} disabled={working} />{t('hooks.registered')}</label>
            <label class="flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={settings.event_quota_exceeded} disabled={working} />{t('hooks.quota')}</label>
            <div class="grid grid-cols-2 gap-3">
                <label class="block text-xs space-y-1"><span>{t('hooks.timeout')}</span><input type="number" bind:value={settings.timeout_seconds} min="1" max="30" step="1" required disabled={working} class={inputClass} /></label>
                <label class="block text-xs space-y-1"><span>{t('hooks.retries')}</span><input type="number" bind:value={settings.retry_attempts} min="0" max="5" step="1" required disabled={working} class={inputClass} /></label>
            </div>
            <div class="flex flex-wrap gap-2">
                <button type="submit" disabled={working} class="px-3 py-2 bg-accent text-white text-xs rounded disabled:opacity-50">{t('action.save')}</button>
                <button type="button" onclick={sendTest} disabled={working || !savedEnabled} class="px-3 py-2 border border-border text-text text-xs rounded disabled:opacity-50">{t('hooks.test')}</button>
            </div>
            <p class="text-xs text-text-2">{t('hooks.test_help')}</p>
            <p class="text-xs text-text-2" aria-live="polite">{t('hooks.deliveries')}: {settings.successful_deliveries} · {t('hooks.failures')}: {settings.consecutive_failures} · {t('hooks.dropped')}: {settings.dropped_events}</p>
        </form>
    {/if}
</section>
