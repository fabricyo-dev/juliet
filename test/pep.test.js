'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { PEP_LINES, PEP_MIRZA_COUNT, MORNING_LINES } = require('../src/main/defaults');

test('pep + morning lines: no emojis, non-empty, Mirza\'s lines lead', () => {
  assert.ok(PEP_LINES.length >= PEP_MIRZA_COUNT + 1);
  for (const l of [...PEP_LINES, ...MORNING_LINES]) {
    assert.ok(l.trim().length > 8);
    assert.doesNotMatch(l, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  }
  assert.match(PEP_LINES[1], /Tate McRae/);
  assert.match(PEP_LINES[2], /poems/);
  assert.match(PEP_LINES[3], /Mamdani/);
  assert.match(PEP_LINES[4], /diva/);
  assert.match(PEP_LINES[7], /door with a key/);
  assert.match(PEP_LINES[10], /jewellery/);
  assert.equal(PEP_MIRZA_COUNT, 11);
});
