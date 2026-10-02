/**
 * ui-walk-fixes — closing pass (K2): a copy key is written once.
 * Contract: features/ui-walk-fixes · drift/K2.md
 *
 * JavaScript lets one object name the same key twice and quietly keeps the LAST one. In
 * components/remote/copy11.js the creator's block had `notePlaceholder` twice — "A landmark, or a
 * good time to deliver" for the Delivery note on her address screen, and "What was wrong?" for the
 * note on a missing or damaged item — so her Delivery note box asked "What was wrong?". Nothing
 * failed: no test, no lint, no crash.
 *
 * This reads every copy file (components/…/copy*.js) and fails if any block names a key twice.
 */
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const COMPONENTS = path.join(__dirname, '..');

/** Every key written more than once in one object of this source: [{ key, line, firstLine }]. */
function repeatedKeys(code) {
  const ast = babel.parseSync(code, { configFile: false, babelrc: false, sourceType: 'module', parserOpts: { plugins: ['jsx'] } });
  const out = [];
  const visit = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(visit); return; }
    if (n.type === 'ObjectExpression') {
      const seen = new Map();
      for (const p of n.properties) {
        if ((p.type !== 'ObjectProperty' && p.type !== 'ObjectMethod') || p.computed) continue;
        const key = p.key.type === 'Identifier' ? p.key.name : String(p.key.value);
        if (seen.has(key)) out.push({ key, line: p.loc.start.line, firstLine: seen.get(key) });
        else seen.set(key, p.loc.start.line);
      }
    }
    for (const k of Object.keys(n)) { if (k !== 'loc') visit(n[k]); }
  };
  visit(ast.program);
  return out;
}

function copyFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'node_modules') copyFiles(p, out); } else if (/^copy\w*\.js$/.test(e.name)) out.push(p);
  }
  return out;
}

describe('a copy key is written once', () => {
  const files = copyFiles(COMPONENTS);
  const rel = (f) => path.relative(COMPONENTS, f).split(path.sep).join('/');

  it('the check itself sees a key named twice — in a nested block, and not across two blocks', () => {
    expect(repeatedKeys("export const C = { creator: { note: 'a',\n other: 'b',\n note: 'c' } };")).toEqual([{ key: 'note', line: 3, firstLine: 1 }]);
    expect(repeatedKeys("export const C = { brand: { note: 'a' }, creator: { note: 'b' } };")).toEqual([]);
    expect(repeatedKeys("export const C = { 'note': 'a', note: (n) => `${n}` };")).toHaveLength(1);
  });

  it('reads the copy files', () => {
    expect(files.length).toBeGreaterThanOrEqual(18);
    expect(files.map(rel)).toEqual(expect.arrayContaining(['remote/copy11.js', 'settings/copy.js', 'content/copy12.js', 'negotiation/copy6.js']));
  });

  it('no block of any copy file names a key twice', () => {
    const found = [];
    for (const f of files) {
      for (const d of repeatedKeys(fs.readFileSync(f, 'utf8'))) found.push(`${rel(f)}:${d.line} "${d.key}" is also on line ${d.firstLine}`);
    }
    expect(found).toEqual([]);
  });
});
