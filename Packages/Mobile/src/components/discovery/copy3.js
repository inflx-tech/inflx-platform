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
    creatorWallet:  { title: 'Wallet is coming soon', body: 'Your earnings and payouts will show here. Payment & tax details are in Profile for now.', button: 'Open Payment & tax' },
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
    rows: { details: ['Business details', 'Name, logo, about, contact, GSTIN'], subs: 'Sub-categories', branches: 'Branches', pitch: 'Pitch settings', overview: ['Brand overview', 'See what creators see'], links: ['Links', 'Website, Instagram'], legal: 'Legal & policies' },
    subsWarning: 'Choose your sub-categories so creators who filter by category can find you.',
    mainCityWarning: 'Add your main branch address so creators can see your city.',
    logout: 'Log out',
    details: { title: 'Business details', logo: 'Brand logo', logoHint: 'JPG or PNG, square, up to 5 MB', change: 'Change', remove: 'Remove', name: 'Brand name *', about: 'About', aboutHint: 'Shown on your brand overview.', contact: 'Contact person *', gstin: 'GSTIN', phone: 'Phone', major: 'Major category', lockedHint: "Phone and major category can't be changed here. Contact INFLX support to change them.", save: 'Save changes' },
    subs: { title: 'Sub-categories', intro: 'Pick everything you sell. Creators who choose categories in their invitation settings are matched against these.', major: 'Major category', label: 'Sub-categories *' },
    branches: { title: 'Branches', main: 'Main', edit: 'Edit', maps: 'Open in Maps', remove: 'Remove', add: 'Add a branch', hint: 'Store Visit shoots happen at one of these branches. Creators see only the city names.',
      removeTitle: (n) => `Remove ${n}?`, removeBody: "It won't be used for new Store Visit shoots. Shoots already planned there don't change.", removeConfirm: 'Remove', keep: 'Keep',
      addTitle: 'Add a branch', editTitle: 'Edit branch', name: 'Branch name *', address: 'Address *', makeMain: 'Make this the main branch', save: 'Save branch', locations: (n) => `${n} ${n === 1 ? 'location' : 'locations'}`,
      // Item 10: an address may be typed as well as searched (the Google search is not always answering).
      typeInstead: 'Type the address instead', searchInstead: 'Search on Google instead',
      typedLabel: 'Street address *', typedPlaceholder: 'Shop no., street, area — as a creator would need to find it', pin: 'PIN code', pinPlaceholder: '6 digits',
      typedHint: 'A typed address has no map pin. Open in Maps will search the words you type.',
      noAddressYet: 'No street address yet — tap Edit to add one. A Store Visit set needs it.' },
    linksScreen: { title: 'Links', website: 'Website', instagram: 'Instagram' },
  },
  creatorProfile: {
    rows: { info: ['Profile info', 'Photo, name, bio, city, social accounts'], niche: 'Niche & languages', invitation: 'Invitation settings', payment: 'Payment & tax', legal: 'Legal & policies' },
    logout: 'Log out',
    info: { title: 'Profile info', photo: 'Profile photo', photoHint: 'JPG or PNG, up to 5 MB', change: 'Change', name: 'Full name *', bio: 'Bio', city: 'City *', cityHint: 'Search with Google. New cities are added to INFLX automatically.', ig: 'Instagram', yt: 'YouTube', numbers: 'Your numbers', measured: 'Measured by INFLX', numbersHint: (d) => `Updated ${d}. These come from your connected accounts and can't be typed in.`, numbersHintNoDate: "These come from your connected accounts and can't be typed in.", save: 'Save changes' },
    niche: { title: 'Niche & languages', yours: 'Your niche *', hint: 'Pick the one that describes most of your content.', languages: 'Languages you create in', warning: 'Pick your niche. Brands use it to find creators like you.' },
    payment: { title: 'Payment & tax' },
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
