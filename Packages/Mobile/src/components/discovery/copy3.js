/**
 * Item 3 — every label and sentence the discovery, profile, groups and overview screens show.
 * Contract: features/item3-discovery-profiles-groups · prompt §6, §7 (copy is exact)
 */

export const MSG3 = {
  BRAND_NAME: 'Enter your brand name.',
  CONTACT: 'Enter a contact person.',
  ABOUT: 'Keep it under 200 characters.',
  IMAGE: 'Upload a JPG or PNG under 5 MB.',
  SUB_CATEGORIES: 'Pick at least one sub-category.',
  BRANCH_NAME: 'Enter a branch name.',
  BRANCH_ADDRESS: 'Search and pick your branch address, or type it.',
  BRANCH_ADDRESS_LONG: 'Keep the address under 200 characters.',
  BRANCH_PIN: 'Enter a 6-digit PIN code.',
  MAIN_BRANCH: "The main branch can't be removed. Make another branch the main one first.",
  FULL_NAME: 'Enter your full name.',
  BIO: 'Keep it under 150 characters.',
  CITY: 'Search and pick your city.',
  NICHE: 'Pick your niche to save.',
  GROUP_NAME: 'Enter a group name.',
  GROUP_NAME_LONG: 'Keep it under 40 characters.',
  GROUP_NAME_TAKEN: 'You already have a group with this name.',
  GROUP_FULL: (g) => `${g} is full (100 creators). Remove someone or use another group.`,
  STATE_UNKNOWN: "We couldn't match this address to a state. Try a nearby address.",
};

export const C3 = {
  comingSoon: {
    brandHome:      { title: 'Home is coming soon', body: 'Your to-dos across campaigns and creators will show here.', button: 'Explore creators' },
    brandWallet:    { title: 'Wallet is coming soon', body: 'Funds, payments and sales settlements will show here.', button: 'Explore creators' },
    creatorHome:    { title: 'Home is coming soon', body: 'Your to-dos and new invitations will show here.', button: 'Find brands' },
    creatorCreate:  { title: 'Shoppable posts are coming soon', body: "You'll create posts that link to products here.", button: 'Find brands' },
    creatorWallet:  { title: 'Wallet is coming soon', body: 'Your earnings and payouts will show here.', button: 'Open Wallet' },
  },
  toasts: {
    // Item 4 built campaigns; choosing and inviting creators is item 5.
    inviteSoon: 'Inviting creators is coming soon.',
    inviteGroupSoon: 'Inviting a group to a set is coming soon.',
    cityAdded: (city) => `${city} is new on INFLX. We've added it to the city list.`,
  },
  tabs: { brand: ['Home', 'Campaigns', 'Creators', 'Wallet', 'Profile'], creator: ['Home', 'Collabs', '', 'Wallet', 'Profile'] },
  states: {
    noCreatorsTitle: 'No creators match these filters', noCreatorsBody: 'Try fewer filters or a wider follower range.',
    noBrandsTitle: 'No brands match these filters', noBrandsBody: 'Try fewer filters.',
    clearFilters: 'Clear filters',
    couldntLoad: (what) => `Couldn't load ${what}`, couldntLoadBody: 'Check your connection and try again.', tryAgain: 'Try again',
  },
  discover: {
    segments: ['Discover', 'Groups', 'Pitches', 'Worked with'],
    search: 'Search by name or @handle',
    openOnly: 'Open to invitations', openOnlyLong: 'Open to invitations only',
    filters: 'Filters', filtersN: (n) => `Filters · ${n}`, clearAll: 'Clear all',
    showN: (n) => `Show ${n} ${n === 1 ? 'creator' : 'creators'}`,
    count: (n) => `${n} ${n === 1 ? 'creator' : 'creators'}`,
    sorts: { followers: 'Most followers', engagement: 'Highest engagement', newest: 'Newest' },
    filterTitles: { niche: 'Niche', ig: 'Instagram followers', yt: 'YouTube subscribers', er: 'Engagement', city: 'City', language: 'Language', aims: 'Open to Aims', modes: 'Mode of work' },
    buckets: { followers: [['', 'Any'], ['1000', '1K+'], ['10000', '10K+'], ['50000', '50K+'], ['100000', '100K+']], er: [['', 'Any'], ['2', '2%+'], ['4', '4%+'], ['6', '6%+']] },
    chips: { OK: 'Open', NOT_ACCEPTING: 'Not taking invitations', NOT_MATCHING: 'Not open to your brand', blocked: 'Blocked by you' },
  },
  worked: {
    intro: "Creators you've signed at least one agreement with.",
    row: (n, d) => n === 1 ? `1 collaboration · signed ${d}` : `${n} collaborations · last signed ${d}`,
    emptyTitle: 'No creators yet', emptyBody: 'Creators appear here once you both sign an agreement.',
    // Item 8 — retired: the Pitches segment is the real list now. Kept out of the
    // copy file entirely rather than left saying something that is no longer true.
  },
  groups: {
    newGroup: 'New group', countN: (n) => `${n} ${n === 1 ? 'group' : 'groups'}`, sort: 'Recently updated',
    card: (n, when) => `${n} ${n === 1 ? 'creator' : 'creators'} · ${when}`,
    updated: (d) => `updated ${d}`, created: (d) => `created ${d}`, today: 'today',
    openN: (n) => `${n} open to invitations`, noneYet: 'No creators yet',
    emptyTitle: 'No groups yet', emptyBody: 'Save creators you like into groups, then invite a whole group to a set in one go.',
    sheetTitle: 'New group', renameTitle: 'Rename group', nameLabel: 'Group name *', namePlaceholder: 'e.g. Diwali shortlist',
    nameHint: "Only your brand sees group names. Creators are never told they're in a group.",
    create: 'Create group', save: 'Save', cancel: 'Cancel',
    header: (n, m, when) => `${n} ${n === 1 ? 'creator' : 'creators'} · ${m} open to invitations · ${when}`,
    invite: 'Invite to a set', newCampaign: 'New campaign', addCreators: 'Add creators',
    emptyGroupTitle: 'No creators in this group yet', emptyGroupBody: 'Add creators from Discover or Worked with.',
    addTitle: 'Add creators', addingTo: (g, n) => `Adding to ${g} · ${n} ${n === 1 ? 'creator' : 'creators'}`,
    tabs: ['All creators', 'Worked with'], alreadyIn: 'Already in this group',
    capacity: (g, k) => `${g} can take ${k} more ${k === 1 ? 'creator' : 'creators'}.`,
    addN: (n) => `Add ${n} ${n === 1 ? 'creator' : 'creators'}`, addedN: (n, g) => `Added ${n} ${n === 1 ? 'creator' : 'creators'} to ${g}.`,
    toTitle: (name) => `Add ${name} to groups`, rowN: (n) => `${n} ${n === 1 ? 'creator' : 'creators'}`, alreadyInShort: '· already in',
    addedTo: (g) => `Added to ${g}.`, removedFrom: (g) => `Removed from ${g}.`, updatedMany: 'Groups updated.',
    menuRename: 'Rename group', menuDelete: 'Delete group', memberView: 'View profile', memberRemove: 'Remove from this group',
    removedMember: (n, g) => `${n} removed from ${g}.`,
    deleteTitle: (g) => `Delete "${g}"?`, deleteBody: (n) => `The ${n} ${n === 1 ? 'creator stays' : 'creators stay'} on INFLX and in your other groups. Invitations you already sent aren't affected.`,
    keep: 'Keep', del: 'Delete', deleted: 'Group deleted.',
    inYourGroups: (names) => `In your groups: ${names}`,
  },
  profile: {
    measured: (d) => `Measured by INFLX · updated ${d}`, measuredNoDate: 'Measured by INFLX',
    openTo: 'Open to invitations for', invite: 'Invite to a set', addToGroup: 'Add to group',
    notTakingTitle: 'Not taking invitations right now', notTakingBody: (f) => `You can still view ${f}'s posts.`,
    notOpenTitle: 'Not open to your brand', notOpenBody: (f) => `${f} isn't taking invitations from brands like yours right now.`,
    collabsWithYou: 'Collaborations with you', collabLine: (aim, d) => `${aim} · signed ${d}`,
    postsTitle: 'Posts on INFLX', postsEmptyTitle: 'No posts yet', postsEmptyBody: (f) => `${f}'s shoppable posts will show here.`,
    openIg: 'Open Instagram', openYt: 'Open YouTube',
  },
  collabs: {
    segments: ['Invites', 'Active', 'Pitches', 'Done'],
    cardTitle: 'Pitch a brand', cardBody: 'Find brands that accept pitches and match you.', cardButton: 'Find brands',
    empty: { Invites: ['No invitations yet', 'When a brand invites you to a set, it shows up here.'], Active: ['No active collaborations yet', ''], Pitches: ['No pitches yet', ''], Done: ['Nothing finished yet', ''] },
  },
  findBrands: {
    title: 'Find brands', search: 'Search brands', canPitchOnly: 'Brands I can pitch',
    count: (n) => `${n} ${n === 1 ? 'brand' : 'brands'}`, showN: (n) => `Show ${n} ${n === 1 ? 'brand' : 'brands'}`,
    sorts: { newest: 'Newest', az: 'A–Z', products: 'Most products' },
    filterTitles: { category: 'Category', city: 'City', aims: 'Accepts pitches for', modes: 'Mode of work' },
    chips: { OK: 'Accepting', NOT_ACCEPTING: 'Not accepting', NOT_MATCHING: "You don't match",
      // Item 8 (approval §2.1, E1): two states that are not refusals. A cooldown
      // ends, and an unmeasured number says nothing about her at all.
      COOLDOWN: 'On cooldown', BEING_MEASURED: 'Being measured' },
  },
  overview: {
    header: (city, n) => [`Fashion`, city, n != null ? `${n} ${n === 1 ? 'branch' : 'branches'}` : null].filter(Boolean).join(' · '),
    accepts: 'Accepts pitches for', pitch: 'Pitch this brand',
    measuringBody: "We're still measuring your Instagram and YouTube. Once that's done we can tell you whether you meet what this brand is looking for.",
    products: (n) => `Products ${n}`, seeAll: 'See all', outOfStock: 'Out of stock',
    posts: 'Posts by creators · Brand Store', postsEmptyTitle: 'No posts yet', postsEmptyBody: (b) => `Shoppable posts creators make for ${b} will show here.`,
    branches: (n) => `Branches ${n}`, branchesHint: 'Store Visit shoots happen at one of these branches. The exact address comes with the shoot plan.',
    links: 'Links',
    ownTitle: 'Brand overview', ownInfo: 'This is what creators see.', editDetails: 'Edit details', pitchSettings: 'Pitch settings',
    ownProductsHint: 'Products are added and edited on the brand website.',
    productInfo: 'You can add products to your posts once you have a Pay for Sale or Hybrid collaboration with this brand.',
    sizes: 'Sizes',
  },
  brandProfile: {
    // features/registration-and-profile B3 — GSTIN left this list for the Wallet tab; "What you sell" is the mockup's row name.
    rows: { details: ['Business details', 'Logo, name, about, contact'], subs: 'What you sell', branches: 'Branches', pitch: 'Pitch settings', overview: ['Brand overview', 'See what creators see'], links: ['Links', 'Website, Instagram'], legal: 'Legal & policies' },
    subsWarning: 'Choose your sub-categories so creators who filter by category can find you.',
    mainCityWarning: 'Add your main branch address so creators can see your city.',
    logout: 'Log out',
    // features/registration-and-profile B4 — GSTIN out (Wallet), email in; the login phone IS the business phone.
    details: { title: 'Business details', logo: 'Brand logo', logoHint: 'JPG or PNG, under 5 MB', change: 'Change', remove: 'Remove', name: 'Business name *', about: 'About', aboutHint: 'Shown on your brand overview.', contact: 'Contact person *', email: 'Email', phone: 'Phone', phoneHint: 'Your login number. This is your business number too.', changeNumber: 'Change number', major: 'Business type', save: 'Save' },
    subs: { title: 'Sub-categories', intro: 'Pick everything you sell. Creators who choose categories in their invitation settings are matched against these.', major: 'Major category', label: 'Sub-categories *' },
    // features/registration-and-profile B5–B7 — the four-part address (street · pincode · state ·
    // city) everywhere; the Google search, the Maps link and the map pin are gone.
    branches: { title: 'Branches', main: 'Main', edit: 'Edit', makeMain: 'Make main', remove: 'Remove', add: 'Add a branch',
      hint: 'Creators only ever see the city — never the street address, until a store visit is planned.',
      removeTitle: (n) => `Remove ${n}?`, removeBody: "It won't be used for new Store Visit shoots. Shoots already planned there don't change.", removeConfirm: 'Remove', keep: 'Keep',
      addTitle: 'Add a branch', editTitle: 'Edit branch', name: 'Branch name *', save: 'Save branch', locations: (n) => `${n} ${n === 1 ? 'location' : 'locations'}`,
      street: 'Street address *', streetPlaceholder: 'Shop no., street, area — as a creator would need to find it', pin: 'Pincode *', pinPlaceholder: '6 digits',
      streetNote: "A store visit can't be planned to a branch with no street address — so this one is required.",
      noAddressYet: 'No street address yet — tap Edit to add one. A Store Visit set needs it.',
      mainSheet: { title: 'Which is your main branch?', body: 'The main branch is the city creators see, and where a store visit goes by default.',
        first: 'your first branch', fresh: 'new', save: 'Save both' } },
    linksScreen: { title: 'Links', website: 'Website', instagram: 'Instagram' },
  },
  creatorProfile: {
    // features/registration-and-profile C4–C6 — Payment & tax left the profile for the Wallet tab;
    // the city is picked (State → nearest major city), and age, gender, email are new.
    rows: { info: ['Profile info', 'Photo, name, city, age, gender'], niche: 'Niche & languages', invitation: 'Invitation settings', legal: 'Legal & policies' },
    logout: 'Log out',
    info: { title: 'Profile info', photo: 'Add a photo', photoHint: 'JPG or PNG, under 5 MB', change: 'Change', name: 'Full name *', bio: 'Bio', age: 'Age', gender: 'Gender', email: 'Email', emailHint: "We won't show this to brands.", phone: 'Phone', phoneHint: 'Your login number.', changeNumber: 'Change number', ig: 'Instagram', yt: 'YouTube', numbers: 'Your numbers', measured: 'Measured by INFLX', numbersHint: (d) => `Updated ${d}. These come from your connected accounts and can't be typed in.`, numbersHintNoDate: "These come from your connected accounts and can't be typed in.", save: 'Save' },
    niche: { title: 'Niche & languages', yours: 'Your niche *', hint: "Pick one — the thing you're known for.", other: 'What kind of content? *', otherNote: "We'll add this to the list so brands can find you by it. Until then you're found every other way.", otherRequired: 'Tell us what kind of content you make.', otherLong: 'Keep it under 80 characters.', languages: 'Languages *', warning: 'Pick your niche. Brands use it to find creators like you.' },
  },
};

/** Under 1,000 in full (612); thousands as 48.2K and millions as 2.3M, always one decimal (item 3b §3.6); null → "—" */
export function fmtCompact(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
}
export function fmtPct(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `${Number(n).toFixed(1).replace(/\.0$/, '')}%`;
}
export function subCategoryLabel(code) {
  const map = { MEN: 'Men', WOMEN: 'Women', KIDS: 'Kids', PLUS_SIZE: 'Plus Size', WATCHES: 'Watches', IMITATION_JEWELLERY: 'Imitation Jewellery', FOOTWEAR: 'Footwear', BAGS_ACCESSORIES: 'Bags & Accessories' };
  return map[code] || String(code || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
/** "today" or "d Mon". */
export function whenLabel(value, shortDate) {
  if (!value) return '';
  const d = new Date(value);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'today';
  return shortDate(value);
}
/** Item 3b: "9 Sep", with the year when it isn't the current one ("9 Sep 2025"). */
export function fmtDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const base = `${d.getDate()} ${months[d.getMonth()]}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`;
}
/** Item 3b: "12 Jun – 9 Sep". */
export function windowLabel(start, end) {
  if (!start || !end) return '';
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}
export function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || 'They'; }
export function maskPhone(p) {
  const s = String(p || '').replace(/^\+91/, '').replace(/\D/g, '');
  if (s.length < 4) return s ? '••••' : '';
  return `${s.slice(0, 2)}${'•'.repeat(Math.max(0, s.length - 4))}${s.slice(-2)}`;
}
export const AIM_ORDER = ['conversion', 'engagement', 'hybrid'];
export const MODE_ORDER = ['visit', 'shipment'];
