import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configurationSource, protectionMessage } from '../src/lib/configurationPolicy';
const sources = {
  registration_open: { source: 'file:madmail.conf', locked: true },
  admin_web_path: { source: 'environment:CHATMAIL_ADMIN_WEB_PATH', locked: true },
  language: { source: 'database', locked: false },
};
test('aliases use the same protection as the backend key', () => {
  assert.equal(configurationSource(sources, 'registration')?.locked, true);
});
test('protected settings explain source and restart', () => {
  assert.match(protectionMessage(sources, 'admin_web_path')!, /environment:CHATMAIL_ADMIN_WEB_PATH/);
  assert.match(protectionMessage(sources, 'admin_web_path')!, /restart/);
});
test('database/default and older servers remain editable', () => {
  assert.equal(protectionMessage(sources, 'language'), undefined);
  assert.equal(protectionMessage(sources, 'missing'), undefined);
  assert.equal(protectionMessage(undefined, 'admin_web_path'), undefined);
});
