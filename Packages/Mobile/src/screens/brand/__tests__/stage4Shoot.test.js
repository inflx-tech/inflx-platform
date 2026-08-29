const fs = require('fs');
const path = require('path');

/**
 * Stage 4 — the shoot's wiring, in both apps.
 * Contract: features/stage-4-the-shoot (03-expected-outputs M-* and B-9)
 *
 * WHAT THIS IS FOR
 * The change class this programme keeps getting caught by is **new routes in two navigators**.
 * It passes every build check and then crashes, or silently does nothing, on a handset — three
 * times now, every one found by the founder holding a phone. The two shapes are:
 *   1. a navigate() to a route registered in a DIFFERENT stack — silent no-op
 *   2. a duplicate Stack.Screen name inside one navigator — uncatchable native crash
 * Both are resolved mechanically here, and so is the third: a util called but never imported.
 */

const SRC = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

const NEW_FILES = [
  'utils/shoot.js',
  'components/shoot/ShootParts.js',
  'screens/influencer/ShootScreen.js',
  'screens/brand/BrandShootScreen.js',
];

describe('Stage 4 · the new pieces load', () => {
  it.each(NEW_FILES)('%s parses', (rel) => {
    expect(() => require(path.join(SRC, rel))).not.toThrow();
  });

  it.each([
    ['screens/influencer/ShootScreen.js'],
    ['screens/brand/BrandShootScreen.js'],
  ])('%s default-exports a component', (rel) => {
    expect(typeof require(path.join(SRC, rel)).default).toBe('function');
  });
});

describe('Stage 4 · routes exist where they are navigated from', () => {
  const NAVS = {
    brand: read('navigation/BrandNavigator.js'),
    influencer: read('navigation/InfluencerNavigator.js'),
  };

  /** Split a navigator file into one string per <XStack.Navigator> block. */
  const stacks = (src) => {
    const out = [];
    const re = /<(\w+)\.Navigator[\s\S]*?<\/\1\.Navigator>/g;
    let m;
    while ((m = re.exec(src)) !== null) out.push(m[0]);
    return out;
  };

  it('BrandShoot is registered, and never twice inside one navigator', () => {
    const found = stacks(NAVS.brand).map(b => (b.match(/name="BrandShoot"/g) || []).length);
    // A duplicate name inside ONE navigator is a native crash no JS error boundary catches.
    expect(found.every(n => n <= 1)).toBe(true);
    expect(found.filter(n => n === 1).length).toBeGreaterThan(0);
  });

  it('Shoot is registered, and never twice inside one navigator', () => {
    const found = stacks(NAVS.influencer).map(b => (b.match(/name="Shoot"/g) || []).length);
    expect(found.every(n => n <= 1)).toBe(true);
    expect(found.filter(n => n === 1).length).toBeGreaterThan(0);
  });

  it('the brand spine can reach the shoot from the SAME stack it lives in', () => {
    // The Stage 2 comment in BrandNavigator says it outright: a cross-stack navigate fails
    // silently at runtime and passes every build check. So they must share a navigator.
    const together = stacks(NAVS.brand).some(
      b => b.includes('name="BrandCreatorSpine"') && b.includes('name="BrandShoot"')
    );
    expect(together).toBe(true);
  });

  it('her collab detail can reach the shoot from the SAME stack it lives in', () => {
    const together = stacks(NAVS.influencer).some(
      b => b.includes('name="CollabDetail"') && b.includes('name="Shoot"')
    );
    expect(together).toBe(true);
  });
});

describe('Stage 4 · the doors actually go somewhere', () => {
  it('the brand spine step 3 opens the shoot instead of naming a future stage', () => {
    const src = read('screens/brand/BrandCreatorSpineScreen.js');
    const step3 = src.slice(src.indexOf('case 3:'), src.indexOf('case 4:'));
    expect(step3).toContain("navigate('BrandShoot'");
    // The Stage 3 placeholder must be gone, or the button is still an apology.
    expect(step3).not.toContain('gets its own screen in Stage 4');
    // And it must pass a contract, because that is what the shoot is fetched by.
    expect(step3).toContain('contractId');
  });

  it('the spine has a contract id to pass, from the server', () => {
    const src = read('screens/brand/BrandCreatorSpineScreen.js');
    expect(src).toContain('contractId: detail?.contract_id');
    // …and the server actually sends it. Without this the button silently shows a note.
    const api = fs.readFileSync(
      path.resolve(SRC, '../../../backend/src/controllers/campaign.controller.js'), 'utf8');
    expect(api).toContain('con.id AS contract_id');
  });

  it('her logistics door opens the shoot, falling back honestly when unsigned', () => {
    const src = read('screens/influencer/CollabDetailScreen.js');
    const seg = src.slice(src.indexOf("case 'logistics'"), src.indexOf("case 'deliverables'"));
    expect(seg).toContain("navigate('Shoot'");
    expect(seg).toContain('data?.contract?.id');
    // No contract means nothing to arrange — the contract page is the truthful destination.
    expect(seg).toContain("navigate('Contract'");
  });
});

describe('Stage 4 · the phone and the server agree on who may finish a shoot', () => {
  const shoot = require(path.join(SRC, 'utils/shoot.js'));
  // Read the server's rule as SOURCE and evaluate just the two things being pinned. Requiring
  // the file would drag it through the React Native babel transform, which has no reason to
  // work on backend code — and a test that cannot run proves nothing at all.
  const server = (() => {
    const src = fs.readFileSync(
      path.resolve(SRC, '../../../backend/src/services/parcel.service.js'), 'utf8');
    const decl = src.match(/const MAY_COMPLETE = \{[\s\S]*?\n\};/);
    const fn = src.match(/const canComplete = [^;]+;/);
    // The second rule, added 2026-08-28: who is ALLOWED to mark it and who is ENOUGH to close
    // it are different questions, and Stage 4 collapsed them.
    // Contract: features/shoot-starts-where-the-agreement-left-it
    const both = src.match(/const REQUIRES_BOTH = \[[^\]]*\];/);
    const needs = src.match(/const needsBothToComplete = [^;]+;/);
    const done = src.match(/const isShootComplete = \([\s\S]*?\n\};/);
    if (!decl || !fn || !both || !needs || !done) {
      throw new Error('parcel.service no longer declares the completion rules as expected');
    }
    // eslint-disable-next-line no-new-func
    return new Function(
      `${decl[0]}\n${fn[0]}\n${both[0]}\n${needs[0]}\n${done[0]}\n` +
      `return { MAY_COMPLETE, canComplete, REQUIRES_BOTH, needsBothToComplete, isShootComplete };`
    )();
  })();

  it('⚠️ both shoot screens unwrap the date range properly', () => {
    // The endpoint answers { range: { earliest, latest, basis } }. Both screens read
    // dates.data — the WRAPPER — which is truthy, so the card drew with both dates undefined
    // and neither phone could book a day. The identical mistake, twice.
    // Contract: features/shoot-plan-you-can-actually-see
    for (const p of ['../BrandShootScreen.js', '../../influencer/ShootScreen.js']) {
      const src = fs.readFileSync(path.resolve(__dirname, p), 'utf8');
      expect([p, src.includes('setRange(dates?.data?.range || null)')]).toEqual([p, true]);
      expect([p, /setRange\(dates\?\.data \|\| null\)/.test(src)]).toEqual([p, false]);
    }
  });

  it('⚠️ an impossible window explains itself instead of drawing two blanks', () => {
    // Real data, 2026-08-29: post due 30 Aug, a visit must finish 2 days before it = 28 Aug,
    // earliest bookable = tomorrow, 30 Aug. Latest lands BEFORE earliest and no day works.
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../../components/shoot/ShootParts.js'), 'utf8');
    expect(src).toContain('range.impossible');
    expect(src).toContain('No day works');
    // And a range that will not parse draws nothing rather than an empty gap around 'and'.
    expect(src).toContain('if (!from || !to) return null;');
  });

  it('⚠️ the server tells them when there is no day, and why', () => {
    const src = fs.readFileSync(
      path.resolve(SRC, '../../../backend/src/services/production.service.js'), 'utf8');
    expect(src).toContain('const impossible = latest.getTime() < earliest.getTime();');
    // The reason has to name the thing a person can change, not the rule they broke.
    expect(src).toMatch(/Move the posting date back/);
  });

  it('⚠️ her collab payload carries whether a shoot exists', () => {
    // hasShoot was ALWAYS false, because production_event was not in this payload — so a
    // creator with a store visit to arrange was told "You are live" and shown no way there.
    const src = fs.readFileSync(
      path.resolve(SRC, '../../../backend/src/controllers/influencer.controller.js'), 'utf8');
    expect(src).toContain('FROM production_events WHERE contract_id = $1');
    expect(src).toMatch(/^\s*production_event,$/m);
  });

  it('⚠️ REQUIRES_BOTH is identical on both sides', () => {
    // The founder's rule: a store visit is two people, so both of them say it happened.
    expect(shoot.REQUIRES_BOTH).toEqual(server.REQUIRES_BOTH);
    expect(shoot.REQUIRES_BOTH).toEqual(['visit']);
  });

  it.each([
    ['visit', { influencer_completed_at: 'x' }, false],
    ['visit', { brand_completed_at: 'x' }, false],
    ['visit', { brand_completed_at: 'x', influencer_completed_at: 'x' }, true],
    ['remote', { influencer_completed_at: 'x' }, true],
    ['remote', { brand_completed_at: 'x' }, false],
    ['shipment', { influencer_completed_at: 'x' }, true],
    ['shipment', {}, false],
  ])('isShootComplete(%s, %o) is %s on both sides', (mode, marks, expected) => {
    expect([mode, shoot.isShootComplete(mode, marks)]).toEqual([mode, expected]);
    expect([mode, server.isShootComplete(mode, marks)]).toEqual([mode, expected]);
  });

  describe('the third state neither screen had', () => {
    // After she taps, the button used to still read "Mark the shoot done" and tapping again
    // did nothing — which reads as broken.
    it('she has marked a visit and is waiting for the brand', () => {
      const ev = { mode: 'visit', status: 'confirmed', influencer_completed_at: 'x' };
      expect(shoot.waitingOnOtherSide(ev, 'influencer')).toBe(true);
      expect(shoot.waitingOnOtherSide(ev, 'brand')).toBe(false);
    });

    it('the brand has marked it and is waiting for her', () => {
      const ev = { mode: 'visit', status: 'confirmed', brand_completed_at: 'x' };
      expect(shoot.waitingOnOtherSide(ev, 'brand')).toBe(true);
      expect(shoot.waitingOnOtherSide(ev, 'influencer')).toBe(false);
    });

    it('nobody waits on a remote shoot — her mark finishes it', () => {
      const ev = { mode: 'remote', status: 'confirmed', influencer_completed_at: 'x' };
      expect(shoot.waitingOnOtherSide(ev, 'influencer')).toBe(false);
    });

    it('nobody waits before anyone has marked, or after it closed', () => {
      expect(shoot.waitingOnOtherSide({ mode: 'visit', status: 'confirmed' }, 'brand')).toBe(false);
      expect(shoot.waitingOnOtherSide({ mode: 'visit', status: 'completed',
        brand_completed_at: 'x', influencer_completed_at: 'x' }, 'brand')).toBe(false);
      expect(shoot.waitingOnOtherSide(null, 'brand')).toBe(false);
    });

    it('and BOTH screens render it — a rule nothing draws is not a rule', () => {
      for (const p of ['../../influencer/ShootScreen.js', '../BrandShootScreen.js']) {
        const src = fs.readFileSync(path.resolve(__dirname, p), 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        expect([p, src.includes('waitingOnOtherSide(event,')]).toEqual([p, true]);
        expect([p, src.includes('WAITING_ON_OTHER.')]).toEqual([p, true]);
      }
    });
  });

  it('MAY_COMPLETE is identical on both sides', () => {
    // The screen's copy exists ONLY so a button that would be refused is never drawn. If the
    // two drift, the server wins and the screen is the bug — so they are pinned together.
    expect(shoot.MAY_COMPLETE).toEqual(server.MAY_COMPLETE);
  });

  it.each([
    ['visit', 'brand', true],
    ['visit', 'influencer', true],
    ['shipment', 'brand', false],
    ['shipment', 'influencer', true],
    ['remote', 'brand', false],
    ['remote', 'influencer', true],
    ['anything_else', 'brand', false],
  ])('%s / %s → %s on both sides', (mode, role, expected) => {
    expect(shoot.canComplete(mode, role)).toBe(expected);
    expect(server.canComplete(mode, role)).toBe(expected);
  });

  it('the brand screen shows the reason where the button would be', () => {
    const src = read('screens/brand/BrandShootScreen.js');
    // A missing button with no explanation reads as a broken screen.
    expect(src).toContain('WHY_NOT_YOURS');
    expect(src).toContain('canComplete(mode');
  });
});

describe('Stage 4 · turnOf reads the field that actually changes', () => {
  const { turnOf, countersLeft, STATUS_LABEL } = require(path.join(SRC, 'utils/shoot.js'));

  it('a proposed slot belongs to whoever did NOT propose it', () => {
    // There is no 'countered' status: a counter keeps the event 'proposed' and flips
    // slot_proposed_by. Reading status alone would leave BOTH phones saying "waiting on them".
    const base = { status: 'proposed', visit_scheduled_at: '2026-08-28', mode: 'visit' };
    expect(turnOf({ ...base, slot_proposed_by: 'brand' }, 'visit').who).toBe('influencer');
    expect(turnOf({ ...base, slot_proposed_by: 'influencer' }, 'visit').who).toBe('brand');
  });

  it('no label exists for a status the server cannot write', () => {
    const server = fs.readFileSync(
      path.resolve(SRC, '../../../backend/src/services/production.service.js'), 'utf8');
    const real = new Set([...server.matchAll(/status = '([a-z_]+)'/g)].map(m => m[1]));
    for (const k of Object.keys(STATUS_LABEL)) {
      expect(real.has(k)).toBe(true);
    }
  });

  it('a shipment that has landed is still on her, not finished', () => {
    // D-5 / B-9 on the phone: in_progress means the box arrived, NOT that the shoot happened.
    const t = turnOf({ status: 'in_progress', mode: 'shipment' }, 'shipment');
    expect(t.who).toBe('influencer');
    expect(t.line).toMatch(/shooting/i);
  });

  it('an undispatched shipment is on the brand', () => {
    expect(turnOf({ status: 'confirmed', mode: 'shipment' }, 'shipment').who).toBe('brand');
  });

  it('counters left never goes negative and never comes back undefined', () => {
    expect(countersLeft({ reschedule_count_influencer: 0 }, 'influencer')).toBe(2);
    expect(countersLeft({ reschedule_count_influencer: 2 }, 'influencer')).toBe(0);
    expect(countersLeft({ reschedule_count_influencer: 9 }, 'influencer')).toBe(0);
    expect(countersLeft(null, 'brand')).toBe(2);
  });
});

describe('Stage 4 · no native module sneaks in over the air', () => {
  it.each(NEW_FILES)('%s imports nothing that an OTA bundle cannot add', (rel) => {
    const src = read(rel);
    // An OTA bundle is JavaScript. A native module that is not already compiled into the
    // installed APK crashes on launch, uncatchably. DateField exists for exactly this reason.
    expect(src).not.toMatch(/from '@react-native-community\/datetimepicker'/);
    expect(src).not.toMatch(/from 'react-native-modal-datetime-picker'/);
  });

  it('the date picker used is the pure-JS one', () => {
    expect(read('screens/influencer/ShootScreen.js')).toContain("from '../../components/DateField'");
    expect(read('screens/brand/BrandShootScreen.js')).toContain("from '../../components/DateField'");
  });
});

describe('Stage 4 · every API helper the screens call exists', () => {
  const api = read('services/api.js');
  const CALLED = {
    'screens/influencer/ShootScreen.js': 'influencerApi',
    'screens/brand/BrandShootScreen.js': 'brandApi',
  };

  it.each(Object.entries(CALLED))('%s only calls helpers that are defined', (rel, which) => {
    const src = read(rel);
    const used = [...src.matchAll(new RegExp(`${which}\\.(\\w+)\\(`, 'g'))].map(m => m[1]);
    expect(used.length).toBeGreaterThan(0);
    // The helper has to exist somewhere in api.js — a call to a helper that was never added
    // is undefined-is-not-a-function on the handset, and nothing before this catches it.
    for (const name of new Set(used)) {
      expect(api).toMatch(new RegExp(`^\\s+${name}:`, 'm'));
    }
  });

  it('the parcel helpers point at the routes the server actually mounts', () => {
    const routes = fs.readFileSync(
      path.resolve(SRC, '../../../backend/src/routes/production.routes.js'), 'utf8');
    expect(routes).toContain("'/production-events/:id/items'");
    expect(routes).toContain("'/production-events/:id/items/:itemId'");
    expect(routes).toContain("'/production-events/:id/items/:itemId/drop'");
  });
});

describe('Stage 4 · the screen never tells her what to shoot', () => {
  it.each(['screens/influencer/ShootScreen.js', 'screens/brand/BrandShootScreen.js'])(
    '%s carries no shot list', (rel) => {
      // Comments stripped first. The prose explaining WHY there is no shot list is not a
      // shot list, and a check that cannot tell the difference would only ever punish the
      // file for documenting the rule it keeps.
      const src = read(rel)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      // The founder's rule, older than this stage: state the aim and the scope, never the
      // shots. A shot list on this screen would be the platform doing her job badly.
      expect(src).not.toMatch(/shot list|shotList|shots required|camera angles/i);
    });
});

describe('Stage 4 · the list, the diary, and the one-tap confirm', () => {
  it('the shoots list and the diary both parse', () => {
    expect(() => require(path.join(SRC, 'screens/brand/BrandShootsListScreen.js'))).not.toThrow();
    expect(() => require(path.join(SRC, 'components/shoot/ShootDiary.js'))).not.toThrow();
  });

  it('M-2 · the list is brand-wide, not per campaign', () => {
    const api = read('services/api.js');
    expect(api).toMatch(/listShoots:.*\/brands\/me\/shoots/);
    // And the server mounts it where every other brand /me/* route lives, so it does not
    // depend on router fall-through to be reachable at all.
    const routes = fs.readFileSync(
      path.resolve(SRC, '../../../backend/src/routes/brand.routes.js'), 'utf8');
    expect(routes).toMatch(/router\.get\('\/me\/shoots'/);
    // The require has to come BEFORE the route or the file throws on load — TDZ, at boot.
    expect(routes.indexOf("require('../controllers/production.controller')"))
      .toBeLessThan(routes.indexOf('productionCtrl.listBrandShoots'));
  });

  it('M-2 · the list is reachable, and lands on a route in the same stack', () => {
    const home = read('screens/brand/BrandHomeScreen.js');
    expect(home).toContain("target: 'BrandShootsList'");
    const navSrc = read('navigation/BrandNavigator.js');
    const blocks = [...navSrc.matchAll(/<(\w+)\.Navigator[\s\S]*?<\/\1\.Navigator>/g)].map(m => m[0]);
    // The tile has no `tab`, so it navigates within the Home stack — BrandHome and
    // BrandShootsList must therefore share one navigator, and BrandShootsList must be able
    // to reach BrandShoot from wherever it lands.
    expect(blocks.some(b => b.includes('name="BrandHome"') && b.includes('name="BrandShootsList"'))).toBe(true);
    expect(blocks.every(b => !b.includes('name="BrandShootsList"') || b.includes('name="BrandShoot"'))).toBe(true);
    // And never registered twice inside one navigator — that is a native crash.
    expect(blocks.every(b => (b.match(/name="BrandShootsList"/g) || []).length <= 1)).toBe(true);
  });

  it('M-8 · the diary is rendered on BOTH sides, from the same component', () => {
    for (const f of ['screens/influencer/ShootScreen.js', 'screens/brand/BrandShootScreen.js']) {
      const src = read(f);
      expect(src).toContain("from '../../components/shoot/ShootDiary'");
      expect(src).toContain('<ShootDiary log={log} />');
      expect(src).toContain('setLog(prod.data?.log || [])');
    }
  });

  it('M-8 · the diary knows every action the server can write', () => {
    const { ACTION_LABEL } = require(path.join(SRC, 'components/shoot/ShootDiary.js'));
    const svc = fs.readFileSync(
      path.resolve(SRC, '../../../backend/src/services/production.service.js'), 'utf8');
    const ctrl = fs.readFileSync(
      path.resolve(SRC, '../../../backend/src/controllers/production.controller.js'), 'utf8');
    const actions = new Set([
      ...[...svc.matchAll(/logAction\([^,]+,[^,]+,[^,]+,\s*'[a-z]+',\s*'([a-z_]+)'/g)].map(m => m[1]),
      ...[...ctrl.matchAll(/logAction\([^,]+,[^,]+,[^,]+,\s*'[a-z]+',\s*'([a-z_]+)'/g)].map(m => m[1]),
    ]);
    expect(actions.size).toBeGreaterThan(5);
    // An unlabelled action falls back to the raw column value — "parcel_packed" shown to a
    // brand. Better to fail here than to leak a database word onto a phone.
    for (const a of actions) expect(Object.keys(ACTION_LABEL)).toContain(a);
  });

  it('B-8 · every new parcel action writes to the diary', () => {
    const ctrl = fs.readFileSync(
      path.resolve(SRC, '../../../backend/src/controllers/production.controller.js'), 'utf8');
    for (const a of ['parcel_packed', 'parcel_item_removed', 'item_dropped', 'receipt_recorded']) {
      expect(ctrl).toContain(`'${a}'`);
    }
  });

  it('M-6 · one tap says everything arrived, and it is hidden once she flags anything', () => {
    const src = read('screens/influencer/ShootScreen.js');
    expect(src).toContain('confirmAllArrived');
    expect(src).toContain('label="Everything arrived"');
    // The fast path must not become the fast way to dismiss a problem already being reported.
    expect(src).toMatch(/!anyFlagged/);
    // It goes through the SAME endpoint with a verdict per item — not a shortcut that leaves
    // the brand with an unreconcilable "she said it was fine".
    expect(src).toMatch(/answers: items\.map\(i => \(\{ item_id: i\.id, status: 'received' \}\)\)/);
  });
});

describe('Stage 4 · M-10 · every ig token used actually exists', () => {
  const ig = require(path.join(SRC, 'theme/ig.js')).ig;

  // Only the files that actually style anything. utils/shoot.js is pure logic and draws
  // nothing, so demanding a token from it would be a rule about the wrong file.
  const STYLED = [
    'components/shoot/ShootParts.js',
    'components/shoot/ShootDiary.js',
    'screens/influencer/ShootScreen.js',
    'screens/brand/BrandShootScreen.js',
    'screens/brand/BrandShootsListScreen.js',
  ];

  it('utils/shoot.js draws nothing, and so uses no tokens', () => {
    expect(read('utils/shoot.js')).not.toMatch(/\big\./);
  });

  it.each(STYLED)('%s uses no ig.* token that is missing', (rel) => {
    const used = [...read(rel).matchAll(/\big\.(\w+)/g)].map(m => m[1]);
    expect(used.length).toBeGreaterThan(0);
    // A missing token is `undefined` in a StyleSheet: silent on some props, black-on-black on
    // others. The guard added on 26 August covers imports; this covers the other half.
    for (const t of new Set(used)) {
      expect(Object.prototype.hasOwnProperty.call(ig, t)).toBe(true);
    }
  });
});
