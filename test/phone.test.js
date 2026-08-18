'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/main/phone');

test('makeTopic: private, url-safe, prefixed', () => {
  const t = P.makeTopic(() => 0.5);
  assert.match(t, /^juliet-[a-z0-9]{14}$/);
  assert.notEqual(P.makeTopic(), P.makeTopic());
});

test('buildPhoneMessage per kind: title, body, click url, no emojis', () => {
  const n = P.buildPhoneMessage({ kind: 'nudge', activity: { name: 'LeetCode daily problem', url: 'https://leetcode.com/problemset/' } });
  assert.deepEqual(n, { title: 'Juliet', message: 'Areej — LeetCode daily problem. Fifteen minutes counts.', click: 'https://leetcode.com/problemset/' });
  const m = P.buildPhoneMessage({ kind: 'movie', title: 'Her' });
  assert.equal(m.message, 'Movie night, Areej: Her. Tap to open it on Netflix.');
  assert.equal(m.click, 'https://www.netflix.com/search?q=Her');
  const p = P.buildPhoneMessage({ kind: 'pep', line: "Stop overthinking — you've got this." });
  assert.equal(p.message, "Stop overthinking — you've got this.");
  assert.equal(p.click, undefined);
  const r = P.buildPhoneMessage({ kind: 'recap', line: 'This week: 3 done · 1 opened · best day Tuesday.' });
  assert.equal(r.title, 'Juliet — weekly recap');
  for (const x of [n, m, p, r]) assert.doesNotMatch(x.message + x.title, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
});

test('sendPhone posts to <server>/<topic> with ntfy headers and reports success/failure', async () => {
  const calls = [];
  const okFetch = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200 }; };
  const ok = await P.sendPhone({ phoneServer: 'https://ntfy.sh', phoneTopic: 'juliet-abc' }, { title: 'Juliet', message: 'hi', click: 'https://x.y' }, okFetch);
  assert.equal(ok, true);
  assert.equal(calls[0].url, 'https://ntfy.sh/juliet-abc');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.body, 'hi');
  assert.equal(calls[0].init.headers.Title, 'Juliet');
  assert.equal(calls[0].init.headers.Click, 'https://x.y');
  const bad = await P.sendPhone({ phoneServer: 'https://ntfy.sh', phoneTopic: 'juliet-abc' }, { title: 'J', message: 'x' }, async () => ({ ok: false, status: 500 }));
  assert.equal(bad, false);
  const threw = await P.sendPhone({ phoneServer: 'https://ntfy.sh', phoneTopic: 'juliet-abc' }, { title: 'J', message: 'x' }, async () => { throw new Error('offline'); });
  assert.equal(threw, false);
  const noTopic = await P.sendPhone({ phoneServer: 'https://ntfy.sh', phoneTopic: null }, { title: 'J', message: 'x' }, okFetch);
  assert.equal(noTopic, false);
});

test('ntfy header values are ASCII-safe (RFC 2047 encoded when needed)', () => {
  assert.equal(P.headerValue('Juliet'), 'Juliet');
  assert.equal(P.headerValue('Areej — hi'), '=?UTF-8?B?' + Buffer.from('Areej — hi', 'utf8').toString('base64') + '?=');
});
