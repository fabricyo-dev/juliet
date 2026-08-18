'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeUrl, mergeActivities, migrateActivities } = require('../src/main/activities');
const { DEFAULT_ACTIVITIES } = require('../src/main/defaults');

test('normalizeUrl adds https:// only when there is no scheme', () => {
  assert.equal(normalizeUrl('leetcode.com'), 'https://leetcode.com');
  assert.equal(normalizeUrl('http://x.y'), 'http://x.y');
  assert.equal(normalizeUrl('mailto:a@b.c'), 'mailto:a@b.c');
});

test('mergeActivities keeps the easy flag across a Settings round-trip that never saw it', () => {
  const prev = [{ id: 'leetcode', name: 'L', url: 'https://l', enabled: true, easy: true }, { id: 'cs50', name: 'C', url: 'https://c', enabled: true }];
  const patch = [{ id: 'leetcode', name: 'LeetCode', url: 'leetcode.com', enabled: false }, { id: 'cs50', name: 'CS50', url: 'https://c', enabled: true }, { name: 'New', url: 'new.org', enabled: true }];
  const out = mergeActivities(prev, patch, 123);
  assert.deepEqual(out[0], { id: 'leetcode', name: 'LeetCode', url: 'https://leetcode.com', enabled: false, easy: true });
  assert.deepEqual(out[1], { id: 'cs50', name: 'CS50', url: 'https://c', enabled: true });
  assert.equal(out[2].id, 'custom-123-2'); assert.equal(out[2].url, 'https://new.org'); assert.equal('easy' in out[2], false);
});

test('mergeActivities drops rows without a name or url', () => {
  assert.deepEqual(mergeActivities([], [{ name: ' ', url: 'x' }, { name: 'a', url: '' }, null], 1), []);
});

test('migrateActivities adds easy to matching defaults on old state files, leaves others alone', () => {
  const old = [{ id: 'arxiv', name: 'a', url: 'u', enabled: true }, { id: 'cs50', name: 'c', url: 'u', enabled: true }, { id: 'custom-1', name: 'x', url: 'u', enabled: true, easy: false }];
  const out = migrateActivities(old, DEFAULT_ACTIVITIES);
  assert.equal(out[0].easy, true);
  assert.equal('easy' in out[1], false);
  assert.equal(out[2].easy, false); // explicit value respected
});
