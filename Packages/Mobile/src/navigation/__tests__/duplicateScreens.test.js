/**
 * Item 12 (approval §3.9) — no navigator registers the same screen name twice in one stack.
 *
 * A duplicate Stack.Screen name has crashed the app natively before (reference_rn_native_crash_
 * debugging), and nothing in the repo caught it: the navigator test mocks the stack factory away.
 * This reads the navigator SOURCE, stack by stack, so the check does not depend on rendering.
 */
const fs = require('fs');
const path = require('path');

function screensByStack(file) {
  const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const out = {};
  const re = /<(\w+)\.Screen\s+name="([^"]+)"/g;
  let m;
  while ((m = re.exec(src))) (out[m[1]] = out[m[1]] || []).push(m[2]);
  return out;
}

describe.each(['BrandNavigator.js', 'InfluencerNavigator.js'])('%s', (file) => {
  it('registers every screen name once per stack', () => {
    const stacks = screensByStack(file);
    expect(Object.keys(stacks).length).toBeGreaterThan(0);
    for (const [stack, names] of Object.entries(stacks)) {
      const dup = names.filter((n, i) => names.indexOf(n) !== i);
      expect(`${stack}: ${dup.join(', ')}`).toBe(`${stack}: `);
    }
  });
});

it('item 12\'s two screens are registered where their doors lead', () => {
  expect(screensByStack('InfluencerNavigator.js').CollabsStack).toContain('Content');
  expect(screensByStack('BrandNavigator.js').CampaignsStack).toContain('BrandContent');
});
