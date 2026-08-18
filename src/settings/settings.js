(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let state = null;

  // tabs
  document.querySelectorAll('nav button').forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll('nav button').forEach((x) => x.classList.toggle('on', x === b));
      document.querySelectorAll('main section').forEach((s) => { s.hidden = s.id !== `tab-${b.dataset.tab}`; });
    };
  });

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

    const s = state.settings;
    $('nudgesPerDay').value = s.nudgesPerDay;
    $('pepPerWeek').value = s.pepPerWeek;
    $('activeStart').value = s.activeStart;
    $('activeEnd').value = s.activeEnd;
    $('movieDay').value = String(s.movieDay);
    $('movieTime').value = s.movieTime;
    $('recapEnabled').checked = !!s.recapEnabled;
    $('recapDay').value = String(s.recapDay);
    $('recapTime').value = s.recapTime;
    $('launchAtLogin').checked = !!s.launchAtLogin;

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
  $('testNudge').onclick = () => window.juliet.testNudge();
  $('saveSchedule').onclick = () => save({
    settings: {
      nudgesPerDay: $('nudgesPerDay').value,
      pepPerWeek: $('pepPerWeek').value,
      activeStart: $('activeStart').value,
      activeEnd: $('activeEnd').value,
      movieDay: $('movieDay').value,
      movieTime: $('movieTime').value,
      recapEnabled: $('recapEnabled').checked,
      recapDay: $('recapDay').value,
      recapTime: $('recapTime').value,
      launchAtLogin: $('launchAtLogin').checked,
    },
  });

  window.juliet.getState().then((s) => { state = s; render(); });
})();
