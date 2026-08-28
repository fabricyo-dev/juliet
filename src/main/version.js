'use strict';
// "1.10.2" vs "1.9.9" — numeric per-part comparison. Returns >0 if a is newer, 0 if equal, <0 if older.
function cmpVer(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}
module.exports = { cmpVer };
