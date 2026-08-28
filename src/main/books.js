'use strict';
// Pure helpers for the reading list (Settings round-trip).

function normalizeBooks(patch, now) {
  return (patch || [])
    .filter((b) => b && String(b.title || '').trim())
    .map((b, i) => ({
      id: b.id || `book-${now}-${i}`,
      title: String(b.title).trim(),
      page: Math.max(0, parseInt(b.page, 10) || 0),
    }));
}

module.exports = { normalizeBooks };
