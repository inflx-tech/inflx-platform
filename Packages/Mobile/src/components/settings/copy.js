/**
 * Item 2 — every label and sentence the settings screens show, in one place.
 * Contract: features/item2-pitch-invitation-settings · prompt §5 (copy is exact)
 *
 * Rules-doc words on screen, code words underneath:
 *   Aim   conversion → Pay for Sale · engagement → Pay for Content · hybrid → Hybrid
 *   Mode  visit → Store Visit · shipment → Remote
 */

export const AIMS = ['conversion', 'engagement', 'hybrid'];
export const MODES = ['visit', 'shipment'];

export const AIM_LABEL = {
  conversion: 'Pay for Sale',
  engagement: 'Pay for Content',
  hybrid: 'Hybrid',
};
export const MODE_LABEL = {
  visit: 'Store Visit',
  shipment: 'Remote',
  remote: 'Remote',
};

export const aimLabel = (a) => AIM_LABEL[a] || a;
export const modeLabel = (m) => MODE_LABEL[m] || m;

/** "all Aims" or the accepted ones, in canonical order. */
export function aimsPhrase(aims) {
  const list = AIMS.filter(a => (aims || []).includes(a));
  if (list.length === AIMS.length) return 'all Aims';
  return list.map(aimLabel).join(', ');
}
/** "Store Visit and Remote" | "Store Visit" | "Remote". */
export function modesPhrase(modes) {
  const list = MODES.filter(m => (modes || []).includes(m));
  if (list.length === 2) return 'Store Visit and Remote';
  return list.map(modeLabel).join('');
}

/** "Fix N things above to save" / "Fix 1 thing above to save". */
export function fixCount(n) {
  return `Fix ${n} ${n === 1 ? 'thing' : 'things'} above to save`;
}

/** "11 Sep" — the date style the mockups use for paused-since and blocked-on. */
export function shortDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

/** Indian grouping without a currency sign: 8000 → "8,000". */
export function groupIndian(n) {
  if (n == null || n === '') return '';
  const s = String(Math.round(Number(n)));
  const last = s.length > 3 ? s.slice(-3) : s;
  const rest = s.length > 3 ? s.slice(0, -3) : '';
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + (rest ? ',' : '') + last;
}

// Validation messages — must match the server word for word (prompt §4).
export const MSG = {
  AIMS_BRAND:   'Pick at least one Aim. To stop all pitches, turn off Accepting pitches instead.',
  AIMS_CREATOR: 'Pick at least one Aim. To stop all invitations, turn off Open to invitations instead.',
  MODES:        'Pick at least one mode of work.',
  WHOLE_NUMBER: 'Enter a whole number.',
  RATE_RANGE:   'Enter a rate between 0 and 100.',
  VISIT_CITIES: 'Pick at least one city, or turn off Store Visit.',
  WHOLE_RUPEES: 'Enter an amount in whole rupees.',
  COMMISSION:   'Commission must be between 1 and 100%.',
};

export const COPY = {
  // shared states (B8)
  loadErrorTitle: "Couldn't load your settings",
  loadErrorBody: 'Check your connection and try again.',
  tryAgain: 'Try again',
  saving: 'Saving',
  saveFailed: "Couldn't save. Your changes are still here, so try again.",
  discardTitle: 'Discard changes?',
  discard: 'Discard',
  keepEditing: 'Keep editing',
  saveChanges: 'Save changes',

  brand: {
    title: 'Pitch settings',
    entryRow: 'Pitch settings',
    acceptingLabel: 'Accepting pitches',
    acceptingHint: 'Creators can send you pitches',
    pausedSince: (d) => `Paused since ${d}`,
    aimsTitle: 'Aims you accept',
    aimsHint: 'Creators see these on your brand overview.',
    modesTitle: 'Mode of work',
    whoTitle: 'Who can pitch',
    whoHint: "Only you see these. Creators who don't match are told they don't meet your criteria.",
    niches: 'Creator niches',
    nicheHint: 'From the niches creators choose when they sign up.',
    minFollowers: 'Minimum followers',
    followersHint: 'Either platform is enough.',
    minEngagement: 'Minimum engagement rate',
    noMinimum: 'No minimum',
    languages: 'Languages',
    cities: 'Cities',
    pastLabel: 'Always allow past creators',
    pastHint: "Creators you've signed with can pitch even if they don't match. Not if you've paused or blocked them.",
    blockedRow: 'Blocked creators',
    keptHint: 'Kept for when you turn pitches back on.',
    savedToast: 'Pitch settings saved.',
    pausedBannerTitle: 'Pitches paused',
    pausedBannerBody: (n) => `Creators see "Not accepting pitches right now". ${n} open ${n === 1 ? 'pitch' : 'pitches'} still ${n === 1 ? 'needs' : 'need'} your answer.`,
    openPitchesRow: 'Open pitches',
    openPitchesValue: (n) => `${n} waiting in Creators → Pitches`,
    // B5
    pauseTitle: 'Pause pitches?',
    pauseBody: 'Creators will see "Not accepting pitches right now" on your brand overview and can\'t send new pitches.',
    // Founder, 2026-09-11: the 30-day reply rule is not built yet — say nothing about it here.
    pauseInfo: "Pitches you've already received stay open for you to answer.",
    pauseConfirm: 'Pause pitches',
    pauseCancel: 'Keep accepting',
    // B7
    blockedTitle: 'Blocked creators',
    blockedHint: "Blocked creators see you as not accepting pitches. They aren't told they're blocked.",
    blockedOn: (d) => `Blocked ${d}`,
    unblock: 'Unblock',
    unblocked: (name) => `${name} unblocked.`,
    blockedFooter: 'To block someone, open their profile and tap ⋯ → Block.',
    blockedEmptyTitle: 'No blocked creators',
    blockedEmptyBody: 'Block a creator from their profile if you never want pitches from them.',
    // X4
    openToTitle: 'Open to invitations for',
    inviteBtn: 'Invite to a set',
    notTakingTitle: 'Not taking invitations right now',
    notTakingBody: (first) => `You can still view ${first}'s posts.`,
    blockMenu: (name) => `Block ${name}`,
    blockTitle: (name) => `Block ${name}?`,
    blockBody: "They won't be able to pitch you. They won't be told. Collaborations you've already signed carry on.",
    blockConfirm: 'Block creator',
    blocked: (name) => `${name} blocked.`,
  },

  creator: {
    title: 'Invitation settings',
    entryRow: 'Invitation settings',
    openLabel: 'Open to invitations',
    openHint: 'Brands can invite you to their sets',
    aimsTitle: 'Aims you accept',
    aimsHint: 'Brands see these on your profile.',
    modesTitle: 'Mode of work',
    visitCities: 'Cities you can visit',
    // creator-distance-and-visit-preference (D3): an empty list means anywhere, and says so.
    visitAnywhere: 'Anywhere',
    visitAnywhereHint: 'Anywhere — any brand can invite you for a store visit. Pick cities to limit it.',
    categoriesTitle: 'Brand categories',
    // ui-walk-fixes U22 (after founder decision D2): a brand she has ruled out is now told which of
    // her rules it was, so "Only you see this." was no longer true. Her LIST is still never shown.
    categoriesHint: "None picked means any category. Brands never see your list — a brand outside it is told only that you aren't taking its category.",
    minimumsTitle: 'Your minimums, by Aim',
    minimumsHint: 'Only you see these. Brands can still invite below them, with a warning.',
    contentCard: 'Pay for Content',
    contentSub: 'fixed fee',
    saleCard: 'Pay for Sale',
    saleSub: 'commission by industry',
    hybridCard: 'Hybrid',
    hybridSub: 'fixed fee + commission',
    noMinimum: 'No minimum',
    noMinimumFixedFee: 'No minimum fixed fee',
    noMinPct: 'No min.',
    allIndustries: 'All industries',
    perIndustryHint: 'Pick brand categories above to set a rate per industry.',
    aimOffInfo: 'Turning an Aim off hides its card. The numbers are kept if you turn it back on.',
    blockedRow: 'Blocked brands',
    savedToast: 'Invitation settings saved.',
    // C5
    pauseTitle: 'Stop taking invitations?',
    pauseBody: 'Brands will see "Not taking invitations right now" on your profile and can\'t invite you.',
    pauseInfo: "Invitations you already have stay open until their set's cutoff. Your active collaborations carry on.",
    pauseConfirm: 'Stop invitations',
    pauseCancel: 'Stay open',
    // C6
    previewTitle: 'Brands see on your profile',
    // ui-walk-fixes U22: was "Your categories, cities, minimum fee and commission stay private." —
    // untrue after D2 (the failed rule is named to the brand), and the minimums half was untrue
    // since item 5 (the brand's terms screen shows them as a warning). The pitch direction
    // (COPY.brand.whoHint) did not change and keeps its own promise.
    previewHint: "Brands never see your category or city lists. A brand you've ruled out is told which rule it was, nothing more.",
    yourMinimums: 'Your minimums',
    blockedEmptyTitle: 'No blocked brands',
    blockedEmptyBody: 'Block a brand from its brand overview if you never want invitations from it.',
    blockedTitle: 'Blocked brands',
    unblocked: (name) => `${name} unblocked.`,
    // X1–X3
    acceptsTitle: 'Accepts pitches for',
    pitchBtn: 'Pitch this brand',
    notAcceptingTitle: 'Not accepting pitches right now',
    notAcceptingBody: 'You can still view products and posts.',
    notMatchingTitle: "You don't match this brand's pitch criteria",
    notMatchingBody: 'Brands can set things like audience size or city. Growing your profile may change this.',
    blockMenu: (name) => `Block ${name}`,
    blockTitle: (name) => `Block ${name}?`,
    blockBody: "They won't be able to invite you. They won't be told. Collaborations you've already signed carry on.",
    blockConfirm: 'Block brand',
    blocked: (name) => `${name} blocked.`,
  },

  picker: {
    clear: 'Clear',
    searchNiches: 'Search niches',
    searchLanguages: 'Search languages',
    apply: (n, noun) => `Apply · ${n} ${noun}`,
    searchCityOrState: 'Search a city or state',
    chooseState: 'CHOOSE A STATE',
    chooseCities: 'CHOOSE CITIES',
    selectAll: 'Select all',
    searchCitiesIn: (state) => `Search cities in ${state}`,
    nSelected: (n) => `${n} selected`,
    any: 'Any',
    none: 'None',
  },
};

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
