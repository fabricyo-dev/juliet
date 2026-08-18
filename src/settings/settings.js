(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let state = null;

  // tabs
  function showTab(name) {
    document.querySelectorAll('nav button').forEach((x) => x.classList.toggle('on', x.dataset.tab === name));
    document.querySelectorAll('main section').forEach((s) => { s.hidden = s.id !== `tab-${name}`; });
  }
  document.querySelectorAll('nav button').forEach((b) => { b.onclick = () => showTab(b.dataset.tab); });
  if (location.hash === '#rate') showTab('rate');
  window.juliet.onTab((t) => showTab(t));

  // ---- rate Juliet ----
  let lastSummary = '';
  function renderRate() {
    const v = parseInt($('rateSlider').value, 10);
    $('rateValue').textContent = String(v);
    $('rateLabel').textContent = ((state && state.ratingLabels) || [])[v - 1] || '';
  }
  $('rateSlider').oninput = () => { renderRate(); $('rateStatus').textContent = ''; };
  $('sendRating').onclick = async () => {
    const res = await window.juliet.rate($('rateSlider').value);
    lastSummary = res.summary || '';
    state = res;
    $('rateStatus').textContent = res.reacted ? 'Sent. Juliet is on her way.' : 'Saved. Juliet is busy right now; she will react as soon as she is free.';
    $('copyRating').disabled = !lastSummary;
  };
  $('copyRating').onclick = async () => {
    try { await navigator.clipboard.writeText(lastSummary); $('rateStatus').textContent = 'Copied. Paste it to Mirza.'; }
    catch { $('rateStatus').textContent = lastSummary; }
  };

  // ---- iPhone (ntfy) ----
  function renderPhone() {
    const on = !!state.settings.phoneEnabled;
    $('phoneEnabled').checked = on;
    $('phoneSetup').hidden = !on;
    $('phoneTopic').textContent = state.settings.phoneTopic || '';
  }
  $('phoneEnabled').onchange = async () => { state = await window.juliet.phoneEnable($('phoneEnabled').checked); renderPhone(); };
  $('phoneNewTopic').onclick = async () => { state = await window.juliet.phoneNewTopic(); renderPhone(); $('phoneStatus').textContent = 'New topic. Re-subscribe in ntfy.'; };
  $('phoneStore').onclick = () => window.juliet.phoneOpenStore();
  $('phoneCopy').onclick = async () => {
    try { await navigator.clipboard.writeText(state.settings.phoneTopic || ''); $('phoneStatus').textContent = 'Topic copied.'; }
    catch { $('phoneStatus').textContent = state.settings.phoneTopic || ''; }
  };
  $('phoneTest').onclick = async () => {
    $('phoneStatus').textContent = 'Sending…';
    const r = await window.juliet.phoneTest();
    $('phoneStatus').textContent = r.ok ? 'Sent. Check your iPhone.' : "Couldn't send. Are you online? Is the topic subscribed?";
  };

  // ---- activities ----
  function actRow(a) {
    const tr = document.createElement('tr');
    tr.dataset.id = a.id || '';
    const tdOn = document.createElement('td');
    const on = document.createElement('input'); on.type = 'checkbox'; on.checked = a.enabled !== false; tdOn.append(on);
    const tdName = document.createElement('td');
    const name = document.createElement('input'); name.type = 'text'; name.value = a.name || ''; name.placeholder = 'What to do'; tdName.append(name);
    const tdUrl = document.createElement('td');
    const url = document.createElement('input'); url.type = 'text'; url.value = a.url || ''; url.placeholder = 'https://…'; tdUrl.append(url);
    const tdX = document.createElement('td');
    const x = document.createElement('button'); x.className = 'x'; x.title = 'Remove'; x.textContent = '×'; x.onclick = () => tr.remove(); tdX.append(x);
    tr.append(tdOn, tdName, tdUrl, tdX);
    return tr;
  }
  function readActs() {
    return [...$('acts').querySelectorAll('tr')].map((tr) => {
      const [on, name, url] = tr.querySelectorAll('input');
      return { id: tr.dataset.id || undefined, enabled: on.checked, name: name.value, url: url.value };
    });
  }

  // ---- render everything from state ----
  function render() {
    $('notice').hidden = !state.recovered;
    if (state.recovered) $('notice').textContent = 'Your previous settings file was unreadable — defaults were loaded (a backup was kept next to it).';

    $('acts').replaceChildren(...state.activities.map(actRow));

    const ph = new Set(state.placeholders || []);
    $('movies').value = state.movies.unseen.filter((t) => !ph.has(t)).join('\n');
    $('seenCount').textContent = state.movies.seen.length ? `(${state.movies.seen.length})` : '';
    $('seen').replaceChildren(...state.movies.seen.map((t) => {
      const li = document.createElement('li'); li.textContent = t;
      const b = document.createElement('button'); b.textContent = 'put back';
      b.onclick = async () => { state = await window.juliet.unpickMovie(t); render(); };
      li.append(b);
      return li;
    }));

    const favs = state.favourites || [];
    $('favCount').textContent = favs.length ? `(${favs.length})` : '';
    $('favs').replaceChildren(...favs.slice().reverse().map((f) => {
      const li = document.createElement('li'); li.textContent = f.title;
      const b = document.createElement('button'); b.textContent = 'remove';
      b.onclick = async () => { state = await window.juliet.unfavourite(f.title); render(); };
      li.append(b);
      return li;
    }));

    const s = state.settings;
    $('nudgesPerDay').value = s.nudgesPerDay;
    $('pepPerWeek').value = s.pepPerWeek;
    $('checkinPerWeek').value = s.checkinPerWeek;
    $('strollPerWeek').value = s.strollPerWeek;
    $('morningEnabled').checked = !!s.morningEnabled;
    $('activeStart').value = s.activeStart;
    $('activeEnd').value = s.activeEnd;
    $('movieDay').value = String(s.movieDay);
    $('movieTime').value = s.movieTime;
    $('recapEnabled').checked = !!s.recapEnabled;
    $('recapDay').value = String(s.recapDay);
    $('recapTime').value = s.recapTime;
    $('goodnightEnabled').checked = !!s.goodnightEnabled;
    $('launchAtLogin').checked = !!s.launchAtLogin;

    renderRate(); renderPhone();

    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const n = (state.history || []).filter((h) => (!h.outcome || h.outcome === 'done') && h.at >= monthStart.getTime()).length;
    $('stats').textContent = `Done this month: ${n}`;
  }
  async function save(patch) { state = await window.juliet.save(patch); render(); }

  $('addAct').onclick = () => $('acts').append(actRow({ name: '', url: 'https://', enabled: true }));
  $('saveActs').onclick = () => save({ activities: readActs() });
  $('restore').onclick = async () => { state = await window.juliet.restoreDefaults(); render(); };
  $('saveMovies').onclick = () => save({ moviesText: $('movies').value });
  $('clearSeen').onclick = () => save({ clearSeen: true });
  $('testMovie').onclick = () => window.juliet.testMovie();
  $('callJuliet').onclick = async () => {
    const sent = await window.juliet.testNudge();
    $('callStatus').textContent = sent ? 'On her way.' : "She's already out — look at the bottom of your screen.";
    setTimeout(() => { $('callStatus').textContent = ''; }, 6000);
  };
  $('saveSchedule').onclick = () => save({
    settings: {
      nudgesPerDay: $('nudgesPerDay').value,
      pepPerWeek: $('pepPerWeek').value,
      checkinPerWeek: $('checkinPerWeek').value,
      strollPerWeek: $('strollPerWeek').value,
      morningEnabled: $('morningEnabled').checked,
      activeStart: $('activeStart').value,
      activeEnd: $('activeEnd').value,
      movieDay: $('movieDay').value,
      movieTime: $('movieTime').value,
      recapEnabled: $('recapEnabled').checked,
      recapDay: $('recapDay').value,
      recapTime: $('recapTime').value,
      goodnightEnabled: $('goodnightEnabled').checked,
      launchAtLogin: $('launchAtLogin').checked,
    },
  });

  window.juliet.getState().then((s) => { state = s; render(); });
})();
