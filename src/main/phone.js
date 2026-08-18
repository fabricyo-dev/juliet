'use strict';
// iPhone notifications via ntfy (https://ntfy.sh): Areej installs the ntfy app and subscribes to a private
// random topic; when something comes due while she is away from the Mac we POST it there instead of
// showing the cat. Off by default. Nothing else in the app touches the network.

const NUDGE_SUFFIX = 'Fifteen minutes counts.';

// juliet-xxxxxxxxxxxxxx — 14 base-36 chars ≈ 72 bits; the topic name is the only secret.
function makeTopic(rng = Math.random) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 14; i++) s += alphabet[Math.floor(rng() * alphabet.length) % alphabet.length];
  return `juliet-${s}`;
}

// HTTP header values must be Latin-1; ntfy accepts RFC 2047 for anything else.
function headerValue(s) {
  const str = String(s);
  // eslint-disable-next-line no-control-regex
  return /^[\x20-\x7e]*$/.test(str) ? str : `=?UTF-8?B?${Buffer.from(str, 'utf8').toString('base64')}?=`;
}

// What lands on the phone for each kind of visit.
function buildPhoneMessage(fire) {
  if (fire.kind === 'nudge') {
    return { title: 'Juliet', message: `Areej — ${fire.activity.name}. ${NUDGE_SUFFIX}`, click: fire.activity.url };
  }
  if (fire.kind === 'movie') {
    return {
      title: 'Juliet',
      message: `Movie night, Areej: ${fire.title}. Tap to open it on Netflix.`,
      click: 'https://www.netflix.com/search?q=' + encodeURIComponent(fire.title),
    };
  }
  if (fire.kind === 'pep') return { title: 'Juliet', message: fire.line, click: undefined };
  if (fire.kind === 'recap') return { title: 'Juliet — weekly recap', message: fire.line, click: undefined };
  if (fire.kind === 'test') return { title: 'Juliet', message: "Hi Areej. Your iPhone is connected. I'll ping you here when you're away from the Mac.", click: undefined };
  return { title: 'Juliet', message: String(fire.line || fire.title || ''), click: undefined };
}

async function sendPhone(settings, msg, fetchImpl = globalThis.fetch) {
  const server = String(settings.phoneServer || 'https://ntfy.sh').replace(/\/+$/, '');
  const topic = settings.phoneTopic;
  if (!topic || !/^[A-Za-z0-9_-]{3,64}$/.test(topic)) return false;
  const headers = { Title: headerValue(msg.title || 'Juliet'), Priority: 'default' };
  if (msg.click) headers.Click = String(msg.click);
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null;
  try {
    const res = await fetchImpl(`${server}/${topic}`, { method: 'POST', body: msg.message, headers, signal: ctrl ? ctrl.signal : undefined });
    return !!(res && res.ok);
  } catch (e) {
    console.error('phone push failed', e && e.message ? e.message : e);
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

module.exports = { makeTopic, headerValue, buildPhoneMessage, sendPhone, NUDGE_SUFFIX };
