'use strict';
// Pure helpers for the Activities list (Settings round-trip and upgrades of older state files).

// "leetcode.com" -> "https://leetcode.com"; anything with a scheme is left alone.
function normalizeUrl(u) {
  return /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u}`;
}

// Apply what the Settings UI sent. The UI only knows id/name/url/enabled, so flags that live only in
// state (currently `easy`) are carried forward by id instead of being lost.
function mergeActivities(prev, patch, now) {
  const prevEasy = new Set((prev || []).filter((x) => x && x.easy).map((x) => x.id));
  return (patch || [])
    .filter((a) => a && String(a.name || '').trim() && String(a.url || '').trim())
    .map((a, i) => {
      const id = a.id || `custom-${now}-${i}`;
      return {
        id,
        name: String(a.name).trim(),
        url: normalizeUrl(String(a.url).trim()),
        enabled: a.enabled !== false,
        ...(a.easy || prevEasy.has(id) ? { easy: true } : {}),
      };
    });
}

// State files written before `easy` existed: take the flag from the defaults for matching ids.
function migrateActivities(activities, defaults) {
  const easyIds = new Set((defaults || []).filter((d) => d.easy).map((d) => d.id));
  return (activities || []).map((a) => (a && !('easy' in a) && easyIds.has(a.id) ? { ...a, easy: true } : a));
}

module.exports = { normalizeUrl, mergeActivities, migrateActivities };
