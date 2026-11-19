import { expect, test } from 'bun:test';
import {
    adminConnectionKey,
    planAdminPathFollowUp,
    reconnectBaseUrl,
} from '../src/lib/adminPathApply.ts';

const current = 'https://mail.example/api/admin';

test('applied false remembers the saved path and does not switch', () => {
    const plan = planAdminPathFollowUp(current, '/api/new', {
        value: '/api/new',
        applied: false,
        restart_required: true,
    });
    expect(plan.confirmed).toBe(false);
    expect(plan.pendingUrl).toBe('https://mail.example/api/new');
    const polls = Array.from({ length: 10 }, () => reconnectBaseUrl(current, plan.pendingUrl));
    expect(polls.every((url) => url === 'https://mail.example/api/new')).toBe(true);
});

test('restart_required without applied is not a confirmed switch', () => {
    const plan = planAdminPathFollowUp(current, '/api/new', {
        value: '/api/new',
        restart_required: true,
    });
    expect(plan.confirmed).toBe(false);
    expect(plan.pendingUrl).toBe('https://mail.example/api/new');
    expect(reconnectBaseUrl(current, plan.pendingUrl)).toBe('https://mail.example/api/new');
});

test('a missing applied field is unknown, not success', () => {
    const plan = planAdminPathFollowUp(current, '/api/new', { value: '/api/new' });
    expect(plan.confirmed).toBe(false);
    expect(plan.pendingUrl).toBe('https://mail.example/api/new');
});

test('applied true without restart_required switches and clears the pending URL', () => {
    const plan = planAdminPathFollowUp(current, '/api/new', {
        value: '/api/new',
        applied: true,
        restart_required: false,
    });
    expect(plan.confirmed).toBe(true);
    expect(plan.pendingUrl).toBe(null);
    expect(plan.destination).toBe('https://mail.example/api/new');
    expect(reconnectBaseUrl(plan.destination, plan.pendingUrl)).toBe(plan.destination);
});

test('a different token is a different connection, and the admin path is not', () => {
    const saved = adminConnectionKey('https://a.example/api/admin', 'token-a');
    expect(adminConnectionKey('https://a.example/api/new', 'token-a')).toBe(saved);
    expect(adminConnectionKey('https://b.example/api/admin', 'token-a')).not.toBe(saved);
    expect(adminConnectionKey('https://a.example/api/admin', 'token-b')).not.toBe(saved);
});

test('applied true is ignored when restart_required is still set', () => {
    const plan = planAdminPathFollowUp(current, '/api/new', {
        value: '/api/new',
        applied: true,
        restart_required: true,
    });
    expect(plan.confirmed).toBe(false);
    expect(plan.pendingUrl).toBe('https://mail.example/api/new');
});
