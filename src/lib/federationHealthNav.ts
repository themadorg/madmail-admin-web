import { goto } from '$app/navigation';
import { base } from '$app/paths';
import type { FederationHealthTier } from '$lib/federationStats';

const VALID: FederationHealthTier[] = ['perfect', 'federated', 'bad'];

export function parseHealthParam(raw: string | null): FederationHealthTier | null {
    if (raw && VALID.includes(raw as FederationHealthTier)) {
        return raw as FederationHealthTier;
    }
    return null;
}

export function toggleFederationHealthFilter(
    current: FederationHealthTier | null,
    tier: FederationHealthTier,
    opts: { pathname: string; search: string; onTraffic: boolean },
): void {
    const next = current === tier ? null : tier;
    const targetPath = opts.onTraffic ? opts.pathname : `${base}/federation/traffic`;
    const params = new URLSearchParams(opts.onTraffic ? opts.search : '');
    if (next) params.set('health', next);
    else params.delete('health');
    const qs = params.toString();
    goto(`${targetPath}${qs ? `?${qs}` : ''}`, {
        replaceState: opts.onTraffic,
        keepFocus: true,
        noScroll: true,
    });
}

export function federationHealthFilterHref(tier: FederationHealthTier): string {
    return `${base}/federation/traffic?health=${tier}`;
}
