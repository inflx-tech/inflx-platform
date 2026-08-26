const fs = require('fs');
const path = require('path');

/**
 * Every helper a screen USES is a helper it IMPORTS.
 *
 * WHY THIS TEST EXISTS
 * The founder tapped "counter" on a real handset on 2026-08-26 and the creator app crashed.
 * `CollabRequestDetailScreen.startCounter` called `fromMode(t.mode)`, and `fromMode` was
 * never in the import line — it had been left out when the working-style change landed on
 * 24 August. So countering a brand request had been dead for two days and nothing noticed:
 *
 *   · jest `require()`d the module — fine, the reference only throws when the function RUNS
 *   · the Android bundle built — same reason
 *   · the duplicate-route scan does not look at identifiers
 *   · no test taps the button
 *
 * That is the third time this programme has shipped "builds cleanly, dies on the handset"
 * — the others were three ig.* tokens that did not exist, and a `fonts` reference with no
 * import. Each was found by a person holding a phone.
 *
 * This closes the class rather than the instance. For every file that imports from a
 * util module, take that module's REAL exports, and fail if any of them is called in the
 * file without being named in the import.
 *
 * It cannot catch everything a linter would — but it catches exactly the shape that has now
 * cost three handset sessions, and it runs in a second.
 */

const SRC = path.resolve(__dirname, '../..');

/** Every .js under src, minus tests. */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue;
      walk(p, out);
    } else if (e.name.endsWith('.js')) {
      out.push(p);
    }
  }
  return out;
}

/** What a util module actually exports, by reading it rather than guessing. */
function exportsOf(absPath) {
  const src = fs.readFileSync(absPath, 'utf8');
  const names = new Set();
  // module.exports = { a, b, c }
  const cjs = src.match(/module\.exports\s*=\s*\{([^}]*)\}/);
  if (cjs) {
    cjs[1].split(',').forEach((part) => {
      const n = part.split(':')[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(n)) names.add(n);
    });
  }
  // export function x / export const x
  for (const m of src.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^export\s+const\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  return names;
}

const FILES = walk(SRC);

/** [{ file, moduleAbs, imported:Set }] for every `import { … } from '…/utils/x'`. */
function namedUtilImports(file) {
  const src = fs.readFileSync(file, 'utf8');
  const out = [];
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']*(?:utils|theme)\/[^']*)'/g)) {
    const imported = new Set(
      m[1].split(',')
        .map(x => x.trim().split(/\s+as\s+/)[0].trim())
        .filter(x => /^[A-Za-z_$][\w$]*$/.test(x))
    );
    let abs = path.resolve(path.dirname(file), m[2]);
    if (!abs.endsWith('.js')) abs += '.js';
    if (fs.existsSync(abs)) out.push({ moduleAbs: abs, imported });
  }
  return out;
}

describe('every helper a screen uses is a helper it imports', () => {
  const offenders = [];

  for (const file of FILES) {
    const src = fs.readFileSync(file, 'utf8');
    // Strip comments and strings so a name mentioned in prose is not mistaken for a call.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
      .replace(/'[^'\n]*'/g, "''")
      .replace(/"[^"\n]*"/g, '""')
      .replace(/`[^`]*`/g, '``');

    for (const { moduleAbs, imported } of namedUtilImports(file)) {
      for (const name of exportsOf(moduleAbs)) {
        if (imported.has(name)) continue;
        // Called as a function, and not as a property of something else (obj.fromMode).
        const called = new RegExp(`(^|[^.\\w$])${name}\\s*\\(`).test(code);
        // Or declared locally, in which case it is a different thing with the same name.
        const declared = new RegExp(`(?:function|const|let|var)\\s+${name}\\b`).test(code);
        if (called && !declared) {
          offenders.push(
            `${path.relative(SRC, file)} uses ${name}() from ` +
            `${path.relative(SRC, moduleAbs)} but does not import it`
          );
        }
      }
    }
  }

  it('nothing is used without being imported', () => {
    // A reference like this only throws when the function RUNS — so it builds, it bundles,
    // it passes every smoke test, and it crashes on a handset the moment a button is tapped.
    expect(offenders).toEqual([]);
  });

  it('the check is actually looking at something', () => {
    // Guards the inverse mistake: a regex that matched nothing would make the test above
    // vacuously pass for the whole app.
    const withImports = FILES.filter(f => namedUtilImports(f).length > 0);
    expect(withImports.length).toBeGreaterThan(15);
  });
});
