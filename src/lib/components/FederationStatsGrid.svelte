<script lang="ts">
  import type {
    FederationAggregateStats,
    FederationHealthStats,
    FederationHealthTier,
  } from '$lib/federationStats';
  import { t, getLocale } from '$lib/i18n';
  import {
    Activity,
    Clock,
    ShieldCheck,
    AlertTriangle,
    CircleCheck,
    CircleAlert,
  } from 'lucide-svelte';

  interface Props {
    stats: FederationAggregateStats;
    health?: FederationHealthStats | null;
    caption?: string;
    activeHealth?: FederationHealthTier | null;
    onHealthSelect?: (tier: FederationHealthTier) => void;
  }

  let {
    stats,
    health = null,
    caption,
    activeHealth = null,
    onHealthSelect,
  }: Props = $props();

  const healthInteractive = $derived(Boolean(onHealthSelect));

  let locale = $state(getLocale());
  function _(key: string, params?: Record<string, string>): string {
    void locale;
    return t(key, params);
  }
  $effect(() => {
    locale = getLocale();
  });

  function formatLatency(ms: number): string {
    if (!ms || ms === 0) return '—';
    if (ms < 1000) return _('latency.ms', { n: String(Math.round(ms)) });
    return _('latency.s', { n: ((ms || 0) / 1000).toFixed(1) });
  }

  const healthCards: {
    tier: FederationHealthTier;
    labelKey: string;
    shortLabelKey: string;
    hintKey: string;
    icon: typeof CircleCheck;
  }[] = [
    {
      tier: 'perfect',
      labelKey: 'fed.health_perfect',
      shortLabelKey: 'fed.health_perfect_short',
      hintKey: 'fed.health_perfect_hint',
      icon: CircleCheck,
    },
    {
      tier: 'federated',
      labelKey: 'fed.health_federated',
      shortLabelKey: 'fed.health_federated_short',
      hintKey: 'fed.health_federated_hint',
      icon: ShieldCheck,
    },
    {
      tier: 'bad',
      labelKey: 'fed.health_bad',
      shortLabelKey: 'fed.health_bad_short',
      hintKey: 'fed.health_bad_hint',
      icon: CircleAlert,
    },
  ];

  function healthCount(tier: FederationHealthTier): number {
    if (!health) return 0;
    return health[tier];
  }
</script>

{#if caption}
  <p class="text-text-2 text-xs mb-2 opacity-80">{caption}</p>
{/if}

<div class="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 mb-3">
  <div class="ui-card ui-card--rounded p-2.5 sm:p-3">
    <div
      class="flex items-center gap-1.5 text-text-2 text-[10px] uppercase tracking-wider mb-1"
    >
      <Activity size={12} class="text-ui-success shrink-0" />
      {_('fed.inbound')}
    </div>
    <div class="text-xl font-semibold text-ui-success tabular-nums">
      {stats.inbound.toLocaleString()}
    </div>
  </div>

  <div class="ui-card ui-card--rounded p-2.5 sm:p-3">
    <div
      class="flex items-center gap-1.5 text-text-2 text-[10px] uppercase tracking-wider mb-1"
    >
      <Activity size={12} class="text-ui-success shrink-0" />
      {_('fed.outbound')}
    </div>
    <div class="text-xl font-semibold text-ui-success tabular-nums">
      {stats.outbound.toLocaleString()}
    </div>
  </div>

  <div class="ui-card ui-card--rounded p-2.5 sm:p-3">
    <div
      class="flex items-center gap-1.5 text-text-2 text-[10px] uppercase tracking-wider mb-1"
    >
      <ShieldCheck size={12} class="shrink-0" />
      {_('fed.queued')}
    </div>
    <div class="text-xl font-semibold tabular-nums">{stats.queued.toLocaleString()}</div>
  </div>

  <div class="ui-card ui-card--rounded p-2.5 sm:p-3">
    <div
      class="flex items-center gap-1.5 text-text-2 text-[10px] uppercase tracking-wider mb-1"
    >
      <Clock size={12} class="shrink-0" />
      {_('fed.avg_latency')}
    </div>
    <div class="text-xl font-semibold tabular-nums">{formatLatency(stats.latency)}</div>
  </div>

  <div class="ui-card ui-card--rounded p-2.5 sm:p-3">
    <div
      class="flex items-center gap-1.5 text-text-2 text-[10px] uppercase tracking-wider mb-1"
    >
      <AlertTriangle size={12} class="text-ui-danger shrink-0" />
      {_('fed.expired')}
    </div>
    <div class="text-xl font-semibold text-ui-danger tabular-nums">
      {stats.expired.toLocaleString()}
    </div>
  </div>
</div>

{#snippet healthCardBody(
  card: (typeof healthCards)[number],
  Icon: typeof CircleCheck,
  count: number,
)}
  <!-- Mobile: compact 3-column tile -->
  <div class="fed-health-card__mobile sm:hidden">
    <div class="fed-health-card__mobile-top">
      <Icon size={16} class="ui-health-card__icon shrink-0" />
      <span class="text-lg font-semibold tabular-nums ui-health-card__value leading-none">
        {count.toLocaleString()}
      </span>
    </div>
    <span class="fed-health-card__mobile-label">{_(card.shortLabelKey)}</span>
  </div>
  <!-- Desktop: full card -->
  <div class="hidden sm:block">
    <div
      class="flex items-center gap-1.5 text-text-2 text-[10px] uppercase tracking-wider mb-1"
    >
      <Icon size={12} class="ui-health-card__icon shrink-0" />
      {_(card.labelKey)}
    </div>
    <div class="text-xl font-semibold tabular-nums ui-health-card__value">
      {count.toLocaleString()}
    </div>
    <p class="text-[10px] text-text-2 mt-1 leading-snug">{_(card.hintKey)}</p>
  </div>
{/snippet}

{#if health}
  <div class="fed-health-grid mb-4">
    {#each healthCards as card}
      {@const Icon = card.icon}
      {@const count = healthCount(card.tier)}
      {@const isActive = activeHealth === card.tier}
      {@const tierClass = `ui-health-card--${card.tier}`}
      {#if healthInteractive}
        <button
          type="button"
          class="ui-card ui-card--rounded ui-card--interactive fed-health-card border text-start transition-colors hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed {tierClass}"
          class:ui-health-card--active={isActive}
          class:cursor-pointer={count > 0}
          disabled={count === 0}
          title={_(card.hintKey)}
          aria-label="{_(card.labelKey)}: {count.toLocaleString()}"
          aria-pressed={isActive}
          onclick={() => onHealthSelect?.(card.tier)}
        >
          {@render healthCardBody(card, Icon, count)}
        </button>
      {:else}
        <div
          class="ui-card ui-card--rounded fed-health-card border {tierClass}"
          title={_(card.hintKey)}
        >
          {@render healthCardBody(card, Icon, count)}
        </div>
      {/if}
    {/each}
  </div>
{/if}
