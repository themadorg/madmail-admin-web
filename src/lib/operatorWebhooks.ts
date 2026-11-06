/** Operator-only settings. The server never returns the signing secret. */
export interface WebhookSettings {
    enabled: boolean;
    url: string;
    secret_configured: boolean;
    event_user_registered: boolean;
    event_quota_exceeded: boolean;
    timeout_seconds: number;
    retry_attempts: number;
    successful_deliveries: number;
    consecutive_failures: number;
    dropped_events: number;
}

export function webhookPatch(settings: WebhookSettings, secret: string, clearSecret: boolean) {
    return {
        enabled: settings.enabled,
        url: settings.url.trim(),
        event_user_registered: settings.event_user_registered,
        event_quota_exceeded: settings.event_quota_exceeded,
        timeout_seconds: settings.timeout_seconds,
        retry_attempts: settings.retry_attempts,
        ...(clearSecret ? { secret: '' } : secret ? { secret } : {}),
    };
}
