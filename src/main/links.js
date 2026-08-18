'use strict';

function googleUrl(title) {
  return 'https://www.google.com/search?q=' + encodeURIComponent(`${title} movie`);
}
function netflixUrl(title) {
  return 'https://www.netflix.com/search?q=' + encodeURIComponent(title);
}
function movieLinks(title) {
  return [googleUrl(title), netflixUrl(title)];
}

function cleanMovieList(text, placeholders = []) {
  const ph = new Set(placeholders.map((s) => s.trim().toLowerCase()));
  const seen = new Set();
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const t = raw.trim();
    const k = t.toLowerCase();
    if (!t || ph.has(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function pickMovie(movies, rng = Math.random) {
  let unseen = [...movies.unseen];
  let seen = [...movies.seen];
  if (unseen.length === 0) {
    if (seen.length === 0) return null;
    unseen = seen;
    seen = [];
  }
  const i = Math.min(unseen.length - 1, Math.floor(rng() * unseen.length));
  const title = unseen[i];
  unseen.splice(i, 1);
  seen.push(title);
  return { title, movies: { unseen, seen } };
}

function unpickMovie(movies, title) {
  if (!movies.seen.includes(title)) return { unseen: [...movies.unseen], seen: [...movies.seen] };
  return { unseen: [...movies.unseen, title], seen: movies.seen.filter((t) => t !== title) };
}

function rerollMovie(movies, currentTitle, rng = Math.random) {
  const back = unpickMovie(movies, currentTitle);
  const others = back.unseen.filter((t) => t !== currentTitle);
  if (others.length === 0) return pickMovie(back, rng);
  const i = Math.min(others.length - 1, Math.floor(rng() * others.length));
  const title = others[i];
  return {
    title,
    movies: { unseen: back.unseen.filter((t) => t !== title), seen: [...back.seen, title] },
  };
}

module.exports = { googleUrl, netflixUrl, movieLinks, cleanMovieList, pickMovie, rerollMovie, unpickMovie };
