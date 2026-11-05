import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { webhookPatch, type WebhookSettings } from '../src/lib/operatorWebhooks';

const settings: WebhookSettings = {
    enabled: true, url: ' https://example.com/hook ', secret_configured: true,
    event_user_registered: true, event_quota_exceeded: false, timeout_seconds: 5,
    retry_attempts: 2, successful_deliveries: 4, consecutive_failures: 0, dropped_events: 0,
};

describe('operator webhook form', () => {
    it('blank secret preserves the server secret and strips response counters', () => {
        const patch = webhookPatch(settings, '', false);
        assert.equal(patch.url, 'https://example.com/hook');
        for (const key of ['secret', 'secret_configured', 'successful_deliveries']) {
            assert.equal(Object.hasOwn(patch, key), false);
        }
    });
    it('explicit clearing differs from leaving the password field blank', () => {
        assert.equal(webhookPatch(settings, 'new-key', true).secret, '');
        assert.equal(webhookPatch(settings, 'new-key', false).secret, 'new-key');
    });
    it('retains the independent event gates and delivery policy', () => {
        const patch = webhookPatch(settings, '', false);
        assert.equal(patch.enabled, true);
        assert.equal(patch.event_user_registered, true);
        assert.equal(patch.event_quota_exceeded, false);
        assert.equal(patch.timeout_seconds, 5);
        assert.equal(patch.retry_attempts, 2);
    });
});
