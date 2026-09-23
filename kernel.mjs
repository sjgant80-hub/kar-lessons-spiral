// kernel.mjs — kar-lessons-spiral: an honest, provable render of a lessons ledger.
//
// NOT a compression claim. The picture asserts exactly three checkable things about the DATA it
// renders, nothing more:
//   BIJECTION     — every lesson maps to exactly one glyph. None lost, none invented.
//   MONOTONICITY  — glyph size is a monotonic function of rediscovery count: higher count never
//                   gets a smaller-or-equal glyph than a lower count, and equal counts always get
//                   equal size. The biggest glyph on the page IS provably the most-rediscovered
//                   lesson — checkable against the output, not asserted by the picture alone.
//   DETERMINISM   — the same ledger, in ANY input order, produces byte-identical output. Placement
//                   is a pure function of the data (sorted canonically), never of array order.
//
// Placement reuses golden-placer's exact phyllotaxis formula (place2D, the estate's proven
// collision-free 2D placement — connect, don't invent): r = sqrt((i+0.5)/N), theta = 2*PI*G*i,
// with i assigned by RANK after a canonical sort (count desc, then title asc — the same tie-break
// lessonsfold.mjs itself already uses). Rank 0 (the highest count) lands nearest the center by
// construction, since sqrt(0.5/N) is the smallest radius in the sequence — the most-rediscovered
// lesson sits at the heart of the spiral for free, not by a special case.
//
// Total throughout: bad input returns { ok:false, why }, never a throw.

const PHI = (1 + Math.sqrt(5)) / 2;
const G = PHI - 1; // 1/phi — golden-placer's rotation constant, reused verbatim

// place2D's exact formula from golden-placer/placer.mjs, reused not reinvented.
function place2D(i, n) {
  const r = Math.sqrt((i + 0.5) / n);
  const t = 2 * Math.PI * G * i;
  return { x: r * Math.cos(t), y: r * Math.sin(t) };
}

function isPlainObject(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
function isPosInt(v) { return Number.isInteger(v) && v >= 1; }
function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }

// Accepts either a bare array of {title,count} lessons, or an object shaped like the real
// lessons-ledger.json ({ lessons: [...] }) — the exact output shape of lessonsfold-cli.mjs.
function resolveLessons(ledger) {
  if (Array.isArray(ledger)) return ledger;
  if (isPlainObject(ledger) && Array.isArray(ledger.lessons)) return ledger.lessons;
  return null;
}

const MIN_SIZE = 0.28;
const MAX_SIZE = 1.0;

// spiralLayout(ledger) -> { ok:true, glyphs:[{title,count,rank,x,y,size}] } | { ok:false, why }
export function spiralLayout(ledger) {
  const raw = resolveLessons(ledger);
  if (raw === null) return { ok: false, why: 'ledger must be an array of lessons, or an object with a .lessons array' };

  const seen = new Set();
  const lessons = [];
  for (let i = 0; i < raw.length; i++) {
    const l = raw[i];
    if (!isPlainObject(l)) return { ok: false, why: `entry at index ${i} must be an object` };
    if (!isNonEmptyString(l.title)) return { ok: false, why: `entry at index ${i} has no valid title` };
    if (!isPosInt(l.count)) return { ok: false, why: `entry "${l.title}" has an invalid count (must be a positive integer)` };
    if (seen.has(l.title)) return { ok: false, why: `duplicate title "${l.title}" — bijection requires unique titles` };
    seen.add(l.title);
    lessons.push({ title: l.title, count: l.count });
  }

  if (lessons.length === 0) return { ok: true, glyphs: [] };

  // Canonical order: count desc, then title asc (localeCompare — same tie-break lessonsfold.mjs
  // itself uses) — deterministic regardless of the input array's own order.
  const sorted = lessons.slice().sort((a, b) => (b.count - a.count) || a.title.localeCompare(b.title));

  const counts = sorted.map((l) => l.count);
  const maxCount = counts[0];
  const minCount = counts[counts.length - 1];
  const span = maxCount - minCount;

  const n = sorted.length;
  const glyphs = sorted.map((l, i) => {
    const { x, y } = place2D(i, n);
    // monotonic in count; all-tied ledgers (span===0, including n===1) get one fixed mid size —
    // still trivially monotonic (a constant function is non-decreasing), never divides by zero.
    const size = span === 0 ? (MIN_SIZE + MAX_SIZE) / 2 : MIN_SIZE + ((l.count - minCount) / span) * (MAX_SIZE - MIN_SIZE);
    return { title: l.title, count: l.count, rank: i, x, y, size };
  });

  return { ok: true, glyphs };
}
