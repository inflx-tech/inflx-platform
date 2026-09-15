const fs = require('fs');
const path = require('path');

/**
 * ⚠️ EVERY VALUE IN `accessibilityState` MUST BE AN EXPLICIT BOOLEAN.
 *
 * Contract: features/item4-campaigns-sets (found during the items 2–8 walk)
 *
 * The set posting-date picker closed the brand app the moment the calendar drew. The cause was
 * one line in DateField:
 *
 *     const blocked = (d) => (min && d < min) || (max && d > max);
 *
 * With no maxDate — every posting-date picker — that returns `null`, not `false`, for each day
 * that is still choosable, and the null went to the day cell as accessibilityState.disabled.
 * Android reads that map in BaseViewManager.setViewState:
 *
 *     if (accessibilityState.hasKey("disabled") && !accessibilityState.getBoolean("disabled"))
 *
 * hasKey() is TRUE for a key whose value is null, and getBoolean() on a null throws
 * NoSuchKeyException. Release build, no error boundary: the app dies. (A number is just as
 * fatal — it throws UnexpectedNativeTypeException instead.)
 *
 * Nothing in jest can see this: under node there is no native side to hand the map to. So the
 * rule is enforced on the source instead — write `!!x`, not `x`, and the crash cannot ship
 * again from any screen.
 *
 * A heuristic, and honest about it: it reads the source, not the AST, and only sees literal
 * `accessibilityState={{ ... }}` props. What it does catch is exactly the shape that crashed.
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

/**
 * Forms that are a boolean by construction. `!!x` and `!x` coerce; a comparison, `Boolean(...)`
 * and the literals already are one. `'mixed'` is the one string Android accepts (for `checked`),
 * and it is read as a string on that side, never with getBoolean.
 */
const SAFE = [
  /^!!/,                                   // !!on
  /^!(?!=)/,                               // !canEdit('goal')
  /^(true|false)$/,                        // literal
  /^Boolean\(/,                            // Boolean(x)
  /(===|!==|<=|>=|(^|[^<>=!])[<>][^=])/,   // a === b, n > 0
  /^'mixed'$/,                             // the one allowed string (checked)
];

/** Split `a: x, b: y` on the commas that are not inside (), [], {} or a string. */
function splitTop(body) {
  const out = [];
  let depth = 0, quote = null, cur = '';
  for (const ch of body) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; cur += ch; continue; }
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

describe('accessibilityState never carries a null, a number or a bare maybe', () => {
  const files = walk(SRC);

  it('reads every source file', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('coerces every accessibilityState value explicitly', () => {
    const offenders = [];

    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      const re = /accessibilityState=\{\{([^}]*)\}\}/g;
      let m;
      while ((m = re.exec(src)) !== null) {
        const line = src.slice(0, m.index).split('\n').length;
        for (const pair of splitTop(m[1])) {
          const i = pair.indexOf(':');
          if (i < 0) continue;                       // shorthand or spread — nothing to judge
          const key = pair.slice(0, i).trim();
          const value = pair.slice(i + 1).trim();
          if (!SAFE.some(r => r.test(value))) {
            offenders.push(`${path.relative(SRC, file).split(path.sep).join('/')}:${line} — ${key}: ${value}`);
          }
        }
      }
    }

    expect(offenders.join('\n')).toBe('');
  });
});
