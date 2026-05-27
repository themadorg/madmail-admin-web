import type {
    FederationServerEntry,
    FederationServersResponse,
    FederationTrafficSummary,
    OverviewResponse,
} from '$lib/api';

export type FederationAggregateStats = {
    inbound: number;
    outbound: number;
    queued: number;
    expired: number;
    latency: number;
    serverCount: number;
};

export type FederationHealthTier = 'perfect' | 'federated' | 'bad';

export type FederationHealthStats = {
    perfect: number;
    federated: number;
    bad: number;
};

/** Outbound delivery attempts per transport (success + failure). */
export function federationServerAttempts(s: FederationServerEntry): number {
    return federationServerSuccessTotal(s) + federationServerFailed(s);
}

export function federationServerSuccessTotal(s: FederationServerEntry): number {
    return s.success_http + s.success_https + s.success_smtp;
}

/** Share of successful transport attempts; null when there are no attempts. */
export function federationServerSuccessRate(s: FederationServerEntry): number | null {
    const attempts = federationServerAttempts(s);
    if (attempts === 0) return null;
    return federationServerSuccessTotal(s) / attempts;
}

const FEDERATION_OK_THRESHOLD = 0.3;

export function classifyFederationServer(
    s: FederationServerEntry,
): FederationHealthTier | null {
    const failed = federationServerFailed(s);
    const hasActivity =
        federationServerAttempts(s) > 0 ||
        s.successful_deliveries > 0 ||
        s.inbound_deliveries > 0;

    if (!hasActivity) return null;

    if (failed === 0) return 'perfect';

    const rate = federationServerSuccessRate(s);
    if (rate === null) return 'bad';
    if (rate < FEDERATION_OK_THRESHOLD) return 'bad';
    return 'federated';
}

export function classifyFederationServers(
    servers: FederationServerEntry[],
    localHostnames: Set<string>,
): FederationHealthStats {
    const health: FederationHealthStats = { perfect: 0, federated: 0, bad: 0 };

    for (const s of servers) {
        if (localHostnames.has(fmtFederationDomain(s.domain).toLowerCase())) continue;
        const tier = classifyFederationServer(s);
        if (tier === 'perfect') health.perfect++;
        else if (tier === 'federated') health.federated++;
        else if (tier === 'bad') health.bad++;
    }

    return health;
}

export function fmtFederationDomain(d: string): string {
    return (d || '').replace(/^\[(.*)\]$/, '$1');
}

export function federationServerFailed(s: FederationServerEntry): number {
    return s.failed_http + s.failed_https + s.failed_smtp;
}

export function federationTrafficToDashboard(
    traffic: FederationTrafficSummary,
    serverCount?: number,
): { stats: FederationAggregateStats; health: FederationHealthStats } {
    return {
        stats: {
            inbound: traffic.inbound,
            outbound: traffic.outbound,
            queued: traffic.queued,
            expired: traffic.expired,
            latency: traffic.mean_latency_ms,
            serverCount: serverCount ?? 0,
        },
        health: traffic.health,
    };
}

/** Dashboard federation block from `overview.federation_traffic` (`GET /admin/status`). */
export function dashboardFederationFromOverview(
    overview: OverviewResponse | null,
): { stats: FederationAggregateStats; health: FederationHealthStats } | null {
    if (!overview?.federation_traffic) return null;
    return federationTrafficToDashboard(
        overview.federation_traffic,
        overview.email_servers?.connections,
    );
}

export function aggregateFederationServers(
    servers: FederationServerEntry[],
    localHostnames: Set<string>,
): FederationAggregateStats {
    let inbound = 0;
    let outbound = 0;
    let queued = 0;
    let expired = 0;
    let latencySum = 0;
    let latencyCount = 0;
    let serverCount = 0;

    for (const s of servers) {
        if (localHostnames.has(fmtFederationDomain(s.domain).toLowerCase())) continue;
        serverCount++;
        inbound += s.inbound_deliveries;
        outbound += s.successful_deliveries;
        queued += s.queued_messages;
        expired += federationServerFailed(s);
        if (s.mean_latency_ms > 0) {
            latencySum += s.mean_latency_ms;
            latencyCount++;
        }
    }

    return {
        inbound,
        outbound,
        queued,
        expired,
        latency: latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0,
        serverCount,
    };
}
