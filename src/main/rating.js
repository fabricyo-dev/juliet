'use strict';
// "Rate Juliet" — a 1–10 slider whose labels are Mirza's, verbatim. Kept apart from defaults.js so the
// scale can be edited without touching anything else.

const RATING_LABELS = [
  'i hate you you republican',                                    // 1
  'vibe coded slop',                                              // 2
  'i hope you have triple mr math (mean)',                        // 3
  'good effort (expected more of you)',                           // 4
  'first lyric of signs (I love that song)',                      // 5
  'BFF because of this',                                          // 6
  'Mamdani would be proud',                                       // 7
  'i should do cs as my major instead of finance (sometimes I wish)', // 8
  'ILY QUEEN',                                                    // 9
  'ILYSM TAKE ME OUT ON A DATE (are you sure?)',                  // 10
];

function clampRating(v) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return null;
  return Math.max(1, Math.min(10, n));
}
function ratingLabel(v) {
  const n = clampRating(v);
  return n === null ? '' : RATING_LABELS[n - 1];
}

// What Juliet says back. Short, no emojis.
function ratingReaction(v) {
  const n = clampRating(v);
  if (n === null) return '';
  if (n <= 2) return "Ouch. Noted. I'll walk it off and Mirza will hear about it.";
  if (n <= 4) return 'Fair. Mirza says he expected more of himself too.';
  if (n <= 6) return "Warm. I'll take it and keep showing up.";
  if (n <= 8) return "Now we're talking. Mirza is unreasonably pleased.";
  return "Careful, I'll get a big head. Mirza is blushing.";
}

// One-line summary she can paste to Mirza.
function ratingSummary(v, when = new Date()) {
  const n = clampRating(v);
  if (n === null) return '';
  const d = new Date(when);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `Areej rated Juliet ${n}/10 on ${date}: "${RATING_LABELS[n - 1]}"`;
}

module.exports = { RATING_LABELS, clampRating, ratingLabel, ratingReaction, ratingSummary };
