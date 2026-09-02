const fs = require('fs');
const path = require('path');

/**
 * Stage A, slice 4 — SB-37 "Before you send it". The screen already existed
 * (features/stage-2-build-a-campaign-from-the-phone) with real blocker/warning logic; the
 * locked mockup's own note names exactly one gap: "the check exists but the message is a
 * generic failure with no amount." That is a display gap — the backend already computed
 * balance/required/short. This slice adds the breakdown and a way to fix it, in place.
 *
 * Contract: features/stage-a-the-set
 * Board: features/screen-atlas/04-preview/mockups/atlas-brand.html → SB-37, SB-54
 */

const SRC = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

const REVIEW = 'screens/brand/BrandCampaignReviewScreen.js';
const WALLET = 'screens/brand/BrandWalletScreen.js';

describe('SB-37 · the wallet shortfall names the amount and offers a fix', () => {
  const src = read(REVIEW);

  it('parses', () => {
    const parser = require('@babel/parser');
    expect(() => parser.parse(src, { sourceType: 'module', plugins: ['jsx'] })).not.toThrow();
  });

  it('shows the full breakdown, not a single generic figure', () => {
    expect(src).toContain('Not enough in the wallet');
    expect(src).toContain('You have');
    expect(src).toContain('You need');
    expect(src).toContain('Short by');
  });

  it('only appears when the wallet is actually short', () => {
    expect(src).toMatch(/check\?\.wallet && check\.wallet\.short > 0/);
  });

  it('the Add button carries the exact shortfall to the Wallet tab', () => {
    expect(src).toMatch(/navigate\('Wallet', \{ prefillAmount: check\.wallet\.short \}\)/);
  });

  it('the stale Starts/Ends rows are gone — SB-23 stopped asking for a campaign date', () => {
    expect(src).not.toContain('k="Starts"');
    expect(src).not.toContain('k="Ends"');
    expect(src).not.toContain('fmtLong');
  });

  it('does not claim a per-set publish that does not exist', () => {
    // publish() below invites every set's creators then calls one campaign-wide
    // publishCampaign — there is no way to publish set 1 without set 2. The mockup's own
    // copy ("publish set 1 now, set 2 later") would be a lie about this screen's actual
    // capability, so it is not reused here.
    expect(src).not.toContain('publish set 1 now');
    expect(src).toContain('remove this set');
  });
});

describe('SB-54 (KEEP) · the wallet screen accepts a pre-filled amount from SB-37', () => {
  const src = read(WALLET);

  it('parses', () => {
    const parser = require('@babel/parser');
    expect(() => parser.parse(src, { sourceType: 'module', plugins: ['jsx'] })).not.toThrow();
  });

  it('reads route.params.prefillAmount into the top-up field', () => {
    expect(src).toMatch(/export default function BrandWalletScreen\(\{ navigation, route \}\)/);
    expect(src).toMatch(/route\?\.\s*params\?\.\s*prefillAmount/);
    expect(src).toContain('setTopupAmt(String(Math.ceil(Number(amt))))');
  });

  it('re-applies the prefill on every navigate, not just first mount', () => {
    // This is a bottom-tab screen — it stays mounted across visits. A useState initialiser
    // would only ever see the FIRST amount it was opened with; a second campaign's
    // shortfall would be silently ignored. Must be a useEffect keyed on the param.
    const eff = src.slice(src.indexOf('useEffect(() => {\n    const amt'), src.indexOf('useEffect(() => {\n    const amt') + 260);
    expect(eff).toContain('[route?.params?.prefillAmount]');
  });
});
