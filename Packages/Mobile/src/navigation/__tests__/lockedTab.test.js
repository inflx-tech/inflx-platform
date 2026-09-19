/**
 * features/registration-and-profile — the tab lock (spec §6.5, mockups B2/B2b).
 *
 * What these pin:
 *   - the accountStatus store round-trips, rejects junk, and tells subscribers
 *   - a locked tab's tabPress swallows the press and raises the sheet with the server's words
 *     when the account is pending or rejected; approved and unknown pass straight through
 *   - a pending account opens on Home, never on the usual first tab
 *   - the real API client records user_status from GET /brands/me and /influencers/me only,
 *     and a cleared session forgets it
 */
jest.mock('@react-native-clipboard/clipboard', () => ({ getString: jest.fn().mockResolvedValue('') }));

const store = require('../../services/accountStatus');
const api = require('../../services/api');
const { lockedTabListeners, initialTabFor, gateEventFor, GATE_EVENTS } = require('../lockedTab');

const PENDING_WORDS = 'Your account is under review by admin. This feature will be available once approved (usually within 24 hours).';
const REJECTED_WORDS = 'Your account was not approved. Please update your profile and resubmit.';

let seen; let off;
beforeEach(() => { store.setAccountStatus(null); seen = []; off = api.onAccountGate((e) => seen.push(e)); });
afterEach(() => { off(); store.setAccountStatus(null); });

const press = () => { const e = { preventDefault: jest.fn() }; lockedTabListeners().tabPress(e); return e; };

describe('accountStatus store', () => {
  it('round-trips the four statuses, maps junk to null, and notifies subscribers once per change', () => {
    expect(store.getAccountStatus()).toBeNull();
    const heard = [];
    const unsub = store.subscribeAccountStatus((s) => heard.push(s));
    for (const s of ['pending', 'approved', 'rejected', 'suspended']) {
      store.setAccountStatus(s);
      expect(store.getAccountStatus()).toBe(s);
    }
    store.setAccountStatus('suspended');          // same value → no second notification
    store.setAccountStatus('whatever');           // unknown → null
    expect(store.getAccountStatus()).toBeNull();
    expect(heard).toEqual(['pending', 'approved', 'rejected', 'suspended', null]);
    unsub();
    store.setAccountStatus('pending');
    expect(heard).toHaveLength(5);
  });

  it('isAccountApproved: approved and unknown are open; pending, rejected, suspended are not', () => {
    expect(store.isAccountApproved('approved')).toBe(true);
    expect(store.isAccountApproved(null)).toBe(true);
    expect(store.isAccountApproved(undefined)).toBe(true);
    expect(store.isAccountApproved('pending')).toBe(false);
    expect(store.isAccountApproved('rejected')).toBe(false);
    expect(store.isAccountApproved('suspended')).toBe(false);
  });
});

describe('lockedTabListeners', () => {
  it('pending: the press is swallowed and the sheet gets ACCOUNT_PENDING with the server\'s words', () => {
    store.setAccountStatus('pending');
    const e = press();
    expect(e.preventDefault).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([{ code: 'ACCOUNT_PENDING', message: PENDING_WORDS }]);
  });

  it('rejected: the press is swallowed and the sheet gets ACCOUNT_REJECTED', () => {
    store.setAccountStatus('rejected');
    const e = press();
    expect(e.preventDefault).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([{ code: 'ACCOUNT_REJECTED', message: REJECTED_WORDS }]);
  });

  it('suspended: locked too, with its own code', () => {
    store.setAccountStatus('suspended');
    const e = press();
    expect(e.preventDefault).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([{ code: 'ACCOUNT_SUSPENDED', message: 'This account is suspended. Contact support.' }]);
  });

  it('approved: the press goes through and nothing is emitted', () => {
    store.setAccountStatus('approved');
    const e = press();
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(seen).toEqual([]);
  });

  it('unknown (null): never locks — a missing value must not trap an approved user', () => {
    const e = press();
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(seen).toEqual([]);
  });

  it('reads the status at press time, so an approval that lands while the app is open unlocks the tab', () => {
    const listeners = lockedTabListeners();
    store.setAccountStatus('pending');
    let e = { preventDefault: jest.fn() }; listeners.tabPress(e);
    expect(e.preventDefault).toHaveBeenCalled();
    store.setAccountStatus('approved');
    e = { preventDefault: jest.fn() }; listeners.tabPress(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(seen).toHaveLength(1);
  });

  it('gateEventFor falls back to the pending words for anything it does not know', () => {
    expect(gateEventFor('pending')).toBe(GATE_EVENTS.pending);
    expect(gateEventFor('rejected')).toBe(GATE_EVENTS.rejected);
    expect(gateEventFor(null)).toBe(GATE_EVENTS.pending);
    expect(gateEventFor('nonsense')).toBe(GATE_EVENTS.pending);
  });
});

describe('initialTabFor — where the app opens', () => {
  it('a pending / rejected / suspended account opens on Home; approved and unknown on the usual tab', () => {
    expect(initialTabFor('pending', 'CreatorsTab')).toBe('HomeTab');
    expect(initialTabFor('rejected', 'CollabsTab')).toBe('HomeTab');
    expect(initialTabFor('suspended', 'CreatorsTab')).toBe('HomeTab');
    expect(initialTabFor('approved', 'CreatorsTab')).toBe('CreatorsTab');
    expect(initialTabFor(null, 'CollabsTab')).toBe('CollabsTab');
  });
});

describe('the API client feeds the store', () => {
  const respond = (status, body) => Promise.resolve({ status, ok: status < 400, text: () => Promise.resolve(JSON.stringify(body)) });
  afterEach(() => { delete global.fetch; });

  it('a successful GET /brands/me or /influencers/me records user_status; other paths and failures do not', async () => {
    global.fetch = jest.fn()
      .mockImplementationOnce(() => respond(200, { success: true, data: { brand: { id: 'b1' }, user_status: 'pending' } }))
      .mockImplementationOnce(() => respond(200, { success: true, data: { user_status: 'approved' } }))
      .mockImplementationOnce(() => respond(200, { success: true, data: { brand: { id: 'b1' }, user_status: 'pending' } }))
      .mockImplementationOnce(() => respond(200, { success: true, data: { user_status: 'rejected' } }))
      .mockImplementationOnce(() => respond(404, { success: false, error: { code: 'NOT_FOUND', message: 'no' } }));
    await api.api.get('/brands/me');
    expect(store.getAccountStatus()).toBe('pending');
    await api.api.get('/brands/me/wallet');                 // a sub-path is not the profile
    expect(store.getAccountStatus()).toBe('pending');
    await api.api.get('/influencers/me?x=1');               // the query string does not matter
    expect(store.getAccountStatus()).toBe('pending');
    await api.api.get('/influencers/me');
    expect(store.getAccountStatus()).toBe('rejected');
    await api.api.get('/brands/me');                        // a failure leaves it alone
    expect(store.getAccountStatus()).toBe('rejected');
    expect(seen).toEqual([]);                               // recording is not a gate event
  });

  it('clearSession forgets the status', async () => {
    store.setAccountStatus('pending');
    await api.clearSession();
    expect(store.getAccountStatus()).toBeNull();
  });
});
