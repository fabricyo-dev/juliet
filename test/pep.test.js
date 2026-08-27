'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { PEP_LINES, PEP_MIRZA_COUNT, pickPepLine, MORNING_LINES } = require('../src/main/defaults');

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
  assert.match(PEP_LINES[5], /shopping/);
  assert.match(PEP_LINES[6], /library full of cats/);
  assert.match(PEP_LINES[9], /bonita/);
  assert.match(PEP_LINES[12], /Areej Intelligence/);
  assert.match(PEP_LINES[13], /Funko Pop/);
  assert.match(PEP_LINES[17], /Palestine/);
  assert.match(PEP_LINES[22], /give up on men/);
  assert.equal(PEP_MIRZA_COUNT, 35);
  assert.match(PEP_LINES[27], /tulips/);
  assert.match(PEP_LINES[30], /Algerie/);
  assert.match(PEP_LINES[34], /reflection of your eyes/);
  assert.match(PEP_LINES[26], /go ghost/);
  assert.match(PEP_LINES[23], /Lana song/);
  assert.match(PEP_LINES[24], /men beater/);
  assert.match(PEP_LINES[25], /learn how to spit/);
  assert.match(PEP_LINES[7], /door with a key/);
  assert.match(PEP_LINES[10], /jewellery/);
});

test('pickPepLine(onlyMirza) never leaves Mirza\'s lines; mixed mode can reach the rest', () => {
  const mirza = new Set(PEP_LINES.slice(0, PEP_MIRZA_COUNT));
  for (let i = 0; i < 200; i++) assert.ok(mirza.has(pickPepLine(true)));
  let sawOther = false;
  for (let i = 0; i < 500; i++) if (!mirza.has(pickPepLine(false))) sawOther = true;
  assert.ok(sawOther);
  assert.equal(pickPepLine(false, () => 0.9), PEP_LINES[PEP_LINES.length - 1] === undefined ? undefined : PEP_LINES[Math.floor(0.9 * PEP_LINES.length)]);
});
