const fs = require('fs');
const path = require('path');

/**
 * ⚠️ NO HOOK MAY BE CALLED AFTER AN EARLY RETURN.
 *
 * Contract: features/brief-straight-to-signing
 *
 * CollabDetailScreen called useCreatorSteps() below two early returns:
 *
 *     if (loading)        return <Spinner/>;    // first render stops here — 8 hooks
 *     if (error || !data) return <Error/>;
 *     ...
 *     const {...} = useCreatorSteps();          // second render — 9 hooks
 *
 * React throws "Rendered more hooks than during the previous render" and the component renders
 * NOTHING. The founder saw a blank page, reported it, saw it fixed, and saw it again — because
 * the first fix corrected the screen's stage vocabulary and never mounted the screen.
 *
 * This is not a bug about one screen. Any component that loads data, returns a spinner while it
 * loads, and then calls a hook further down has it — and this codebase has dozens of screens
 * built to exactly that shape. So this walks all of them.
 *
 * A heuristic, and honest about it: it reads the source rather than the AST, and it only judges
 * calls at the component's own top level of indentation. It cannot see a hook nested inside a
 * helper. What it does catch is precisely the shape that broke, which is the shape almost every
 * screen in here is written in.
 */

const SRC = path.resolve(__dirname, '..');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules' || e.name === '__fixtures__') continue;
      walk(p, out);
    } else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

/** Hooks whose call order React actually counts. useRef/useMemo/useCallback included — all of them. */
const HOOK = /(?:^|[\s({[=,])(use[A-Z]\w*)\s*\(/;

/**
 * Scan one component body for a hook that sits below a top-level `return`.
 *
 * "Top level" = indented exactly two spaces inside `export default function X(...) {`, which is
 * how every screen in this codebase is written. Anything more deeply indented is inside a
 * branch, a callback or JSX and is not what we are looking for.
 */
function offendersIn(src) {
  const lines = src.split('\n');
  const found = [];

  for (let i = 0; i < lines.length; i++) {
    if (!/^(export default )?function [A-Z]\w*\s*\(/.test(lines[i])) continue;

    let sawReturn = null;
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (/^\}/.test(l)) break;                       // end of the component
      if (!/^ {2}\S/.test(l)) continue;               // only the component's own top level
      const bare = l.replace(/\/\/.*$/, '');
      if (/^ {2}(return|if \(.*\)\s*(\{|return))/.test(bare) && !sawReturn) sawReturn = j + 1;
      const m = bare.match(HOOK);
      // useState etc. declared before any return is exactly right — only flag what comes after.
      if (m && sawReturn && !/^ {2}(function|const \w+ = \()/.test(bare)) {
        found.push({ hook: m[1], line: j + 1, afterReturnOnLine: sawReturn });
      }
    }
  }
  return found;
}

/**
 * KNOWN VIOLATIONS THAT DO NOT CRASH TODAY — recorded, not hidden.
 *
 * Both dispatch to a different screen entirely on the FIRST line, based on a category read from
 * route.params:
 *
 *     if (category === 'restaurant') return <RestaurantBillScreen .../>;
 *
 * That condition is fixed for the life of the mount, so the hook count never changes between
 * renders and React never throws. They are still Rules-of-Hooks violations, and they become
 * blank screens the day that category starts arriving asynchronously.
 *
 * They are listed here rather than fixed because restructuring a payment screen and a booking
 * screen is not something to do in the same change as a creator-signing fix. Listing them keeps
 * the guard honest about the rule while leaving the debt visible instead of silently allowed.
 */
// Docs/THE_CUT.md pass 1 — this list is now EMPTY, and that is the good outcome.
// It held two entries, both excused for the same reason: an early return that handed
// the whole render to a restaurant screen, above the hooks.
//   · PreBookScreen — deleted with bookings.
//   · PayAtStoreScreen — SURVIVES the cut, and removing its restaurant dispatch
//     removed the violation itself. The screen is now genuinely clean, not excused.
// The check below caught both the moment they rotted, exactly as its own comment
// predicted. Leave the list empty rather than deleting the machinery — the next
// violation should have to be added here deliberately.
const KNOWN_STABLE = [];

describe('⚠️ hook order cannot change between renders', () => {
  const files = walk(SRC).filter(f => /[\\/](screens|components)[\\/]/.test(f));

  it('finds screens to check at all — a scan of nothing always passes', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('no component calls a hook below an early return', () => {
    const bad = [];
    for (const f of files) {
      const rel = path.relative(SRC, f).split(path.sep).join('/');
      if (KNOWN_STABLE.includes(rel)) continue;
      for (const o of offendersIn(fs.readFileSync(f, 'utf8'))) {
        bad.push(`${rel}:${o.line}  ${o.hook}()  — below the return on line ${o.afterReturnOnLine}`);
      }
    }
    // Printed in full rather than counted: a number tells nobody which screen is blank.
    expect(bad).toEqual([]);
  });

  it('the allowlist has not rotted — every entry is still a real violation', () => {
    // An allowlist that outlives the problem quietly permits the next one. If somebody fixes
    // PayAtStore, this fails and the entry has to come out.
    for (const rel of KNOWN_STABLE) {
      const f = path.join(SRC, rel);
      expect([rel, fs.existsSync(f)]).toEqual([rel, true]);
      expect([rel, offendersIn(fs.readFileSync(f, 'utf8')).length > 0]).toEqual([rel, true]);
    }
  });

  it('and the guard actually bites', () => {
    // The exact shape that shipped. If this stops being detected the check above is decoration.
    const broken = [
      'export default function Screen({ route }) {',
      '  const [data, setData] = useState(null);',
      '  if (!data) {',
      '    return null;',
      '  }',
      '  const { data: steps } = useCreatorSteps();',
      '  return null;',
      '}',
    ].join('\n');
    const hits = offendersIn(broken);
    expect(hits.length).toBe(1);
    expect(hits[0].hook).toBe('useCreatorSteps');
  });

  it('and does not cry wolf on the correct shape', () => {
    const fine = [
      'export default function Screen({ route }) {',
      '  const [data, setData] = useState(null);',
      '  const { data: steps } = useCreatorSteps();',
      '  if (!data) {',
      '    return null;',
      '  }',
      '  const derived = stepFor(steps, 1);',
      '  return null;',
      '}',
    ].join('\n');
    expect(offendersIn(fine)).toEqual([]);
  });
});
