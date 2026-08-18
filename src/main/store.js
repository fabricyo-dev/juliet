'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Deep-fill plain-object keys from defaults; arrays and scalars are taken from target when present.
function fill(target, defaults) {
  const out = { ...defaults, ...(target || {}) };
  for (const k of Object.keys(defaults)) {
    const d = defaults[k];
    if (d && typeof d === 'object' && !Array.isArray(d)) out[k] = fill(target ? target[k] : undefined, d);
  }
  return out;
}

function loadState(filePath, defaultState) {
  const defaults = defaultState();
  if (!fs.existsSync(filePath)) return { state: defaults, recovered: false };
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
    const state = fill(parsed, defaults);
    if (!Array.isArray(state.activities) || state.activities.length === 0) state.activities = defaults.activities;
    return { state, recovered: false };
  } catch {
    const bad = `${filePath}.bad-${Date.now()}`;
    try { fs.renameSync(filePath, bad); } catch { /* ignore */ }
    return { state: defaults, recovered: true };
  }
}

function createStore(filePath, defaultState) {
  const { state, recovered } = loadState(filePath, defaultState);
  function save() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, filePath);
  }
  return { state, recovered, save };
}

module.exports = { loadState, createStore };
