/**
 * Item 4 — every string the Campaigns tab shows, word for word from the locked mockups (C1–C11)
 * and the prompt (§6, §7). MSG4 mirrors backend/src/services/campaignCopy.js.
 * Contract: features/item4-campaigns-sets
 */

export const MSG4 = {
  CAMPAIGN_NAME: 'Enter a campaign name.',
  CAMPAIGN_DESC_LONG: 'Keep it under 200 characters.',
  SET_NAME: 'Enter a set name.',
  AIM: 'Pick an Aim.',
  MODE: 'Pick a mode of work.',
  BRANCH: 'Pick the branch for this Store Visit set.',
  DATE: 'Choose a posting date.',
  DATE_TOO_SOON: 'Choose a posting date at least 7 days from today.',
  LOCKED: "This can't be changed after you've sent invitations.",
  DELETE_SET: "This set has invitations, so it can't be deleted.",
  DELETE_CAMPAIGN: "This campaign has invitations, so it can't be deleted.",
  INVITE_DATE_PASSED: 'Pick a new posting date before you invite anyone.',
};

export const AIMS4 = [
  { code: 'conversion', label: 'Pay for Sale', sub: 'Commission on what they sell' },
  { code: 'engagement', label: 'Pay for Content', sub: 'A fixed fee for the content' },
  { code: 'hybrid', label: 'Hybrid', sub: 'A fixed fee plus commission' },
];
export const MODES4 = [
  { code: 'visit', label: 'Store Visit' },
  { code: 'shipment', label: 'Remote' },
];
export const aimLabel4 = (code) => (AIMS4.find(a => a.code === code) || {}).label || '—';
export const modeLabel4 = (code) => (MODES4.find(m => m.code === code) || {}).label || '—';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const parts = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? { y: +m[1], mo: +m[2], d: +m[3] } : null; };
/** "20 Oct 2026" — fields and detail rows. */
export const longDate4 = (v) => { const p = parts(v); return p ? `${p.d} ${MONTHS[p.mo - 1]} ${p.y}` : '—'; };
/** "20 Oct" in lists, with the year added only when it is not this year. */
export const shortDate4 = (v) => { const p = parts(v); if (!p) return '—'; const y = new Date().getFullYear(); return `${p.d} ${MONTHS[p.mo - 1]}${p.y === y ? '' : ` ${p.y}`}`; };
/** "27 Aug" from an instant (created/updated stamps). */
export const stampDate4 = (v) => { if (!v) return '—'; const d = new Date(v); if (Number.isNaN(d.getTime())) return '—'; const y = new Date().getFullYear(); return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() === y ? '' : ` ${d.getFullYear()}`}`; };

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * "{invited} invited · {signed} signed · {waiting} waiting · {n} declined" (APPROVAL.md Q9).
 * Waiting and declined appear only when they are not zero, exactly as the mockups print
 * "7 invited · 7 signed". On the set detail the waiting word is "waiting to answer".
 */
export function countsLine4(c, { detail = false } = {}) {
  if (!c || !c.invited) return null;
  const bits = [`${c.invited} invited`, `${c.signed} signed`];
  if (c.waiting) bits.push(`${c.waiting} ${detail ? 'waiting to answer' : 'waiting'}`);
  if (c.declined) bits.push(`${c.declined} declined`);
  return bits.join(' · ');
}

export const C4 = {
  tabs: ['Live', 'Drafts', 'Past'],
  tabParam: { Live: 'live', Drafts: 'draft', Past: 'past' },
  chips: { draft: 'Draft', live: 'Live', completed: 'Completed', expired: 'Expired', datePassed: 'Date passed' },
  list: {
    title: 'Campaigns',
    newCampaign: 'New campaign',
    setsLine: (n, next) => `${plural(n, 'set', 'sets')} · next posting ${shortDate4(next)}`,
    setsLineNoNext: (n) => `${plural(n, 'set', 'sets')}`,
    draftLine: (n) => `${plural(n, 'set', 'sets')} · no invitations sent`,
    emptyTitle: 'No campaigns yet',
    emptyBody: 'A campaign holds your sets. Each set has one Aim, one posting date and one mode of work.',
    loadWhat: 'your campaigns',
  },
  newCampaign: {
    title: 'New campaign',
    nameLabel: 'Campaign name', namePlaceholder: 'e.g. Diwali Edit 2026', nameMax: 60,
    descLabel: 'Description', descPlaceholder: 'What is this campaign about?', descMax: 200,
    descHint: 'Only your team sees this. Creators never see it.',
    next: 'Next: add a set',
    fromGroup: (name, n) => `Started from ${name}. Its ${plural(n, 'creator is', 'creators are')} ready to pick from in your first set.`,
  },
  set: {
    newTitle: 'New set', editTitle: 'Edit set',
    nameLabel: 'Set name', nameHint: 'Creators see this name in their invitation.', nameMax: 60,
    suggestedName: (letter) => `Set ${letter}`,
    aimLabel: 'Aim', aimHint: "Everyone in this set works to the same Aim. It can't be changed once you invite.",
    modeLabel: 'Mode of work', modeHint: 'Store Visit: the creator shoots at your branch. Remote: you ship the products.',
    branchLabel: 'Branch', branchPlaceholder: 'Choose a branch', branchHint: 'Creators see the city, not the address. Your main branch is listed first.',
    branchSheetTitle: 'Branch',
    dateLabel: 'Posting date', datePlaceholder: 'Choose a date', dateHint: 'The last day for everyone in this set to go live.',
    cutoffLine: (cutoff) => `Invitations close ${longDate4(cutoff)}, three days before posting.`,
    pickerHint: (earliest) => `Dates before ${shortDate4(earliest)} are greyed out: a posting date must be at least seven days from today.`,
    pickerCutoff: (cutoff) => `Invitations would close ${longDate4(cutoff)}.`,
    useDate: 'Use this date',
    save: 'Save set',
    saved: 'Set saved.',
  },
  detail: {
    created: (d) => `Created ${stampDate4(d)}`,
    setsTitle: 'Sets',
    addSet: 'Add another set',
    showPast: (n) => `Show past sets (${n})`,
    hidePast: 'Hide past sets',
    meta: (s) => [aimLabel4(s.goal), modeLabel4(s.shootMode), s.branch && s.branch.name].filter(Boolean).join(' · '),
    dates: (post, cutoff) => `Posts ${shortDate4(post)} · invites close ${shortDate4(cutoff)}`,
    posted: (s) => `${aimLabel4(s.goal)} · ${modeLabel4(s.shootMode)} · posted ${shortDate4(s.postingDate)}`,
    noCreators: 'No creators yet',
    noDate: 'No posting date yet',
    menuRename: 'Rename campaign', menuDesc: 'Edit description', menuDelete: 'Delete campaign', menuDeleteHint: 'Only while every set is a draft',
    renameTitle: 'Rename campaign', descTitle: 'Edit description', save: 'Save', cancel: 'Cancel',
    deleteTitle: (name) => `Delete "${name}"?`,
    deleteBody: 'Nothing has been sent for this campaign, so nothing is lost.',
    deleted: 'Campaign deleted.',
    renamed: 'Campaign renamed.',
    descSaved: 'Description saved.',
  },
  setDetail: {
    cutoffIn: (n, d) => (n === 0 ? 'Invitations close today' : `Invitations close in ${plural(n, 'day', 'days')} · ${shortDate4(d)}`),
    rows: { aim: 'Aim', mode: 'Mode of work', branch: 'Branch', date: 'Posting date', close: 'Invitations close' },
    lockDraft: 'Aim, posting date, mode and branch lock when you send the first invitation.',
    lockLive: 'Locked because invitations have gone out. You can still rename the set.',
    addCreators: 'Add creators', comingSoon: 'Coming soon',
    edit: 'Edit set', duplicate: 'Duplicate',
    creatorsTitle: 'Creators',
    emptyTitle: 'No creators yet', emptyBody: 'Add creators, agree their terms and send invitations.',
    datePassedWarn: 'Posting date has passed. Pick a new date before you invite anyone.',
    chooseNewDate: 'Choose a new date',
    expiredTitle: (cutoff) => `Nobody signed by ${shortDate4(cutoff)}`,
    expiredBody: (n) => (n === 1 ? 'The 1 open invitation was closed automatically at the cutoff.' : `The ${n} open invitations were closed automatically at the cutoff.`),
    duplicateNewDate: 'Duplicate with a new date',
    completedLine: (n) => plural(n, 'collaboration', 'collaborations'),
    menuEdit: 'Edit set', menuRename: 'Rename set', menuDuplicate: 'Duplicate set', menuDelete: 'Delete set',
    renameTitle: 'Rename set',
    deleteTitle: (name) => `Delete "${name}"?`,
    deleteBody: 'Nothing has been sent for this set, so nothing is lost.',
    deleted: 'Set deleted.', renamed: 'Set renamed.',
    keep: 'Keep', del: 'Delete',
  },
  duplicate: {
    title: (name) => `Duplicate ${name}`,
    nameLabel: 'New set name', dateLabel: 'Posting date',
    copiedFrom: (name) => `Copied from ${name}`,
    hint: "Creators and invitations aren't copied. The new set starts as a draft.",
    create: 'Create set', cancel: 'Cancel',
    copyName: (n) => `${n} (copy)`,
    created: 'Set created.',
  },
};

/** Chip tone per state, on the item 2 palette (prompt §8). */
export const STATE_TONE = { draft: 'yourMove', live: 'active', completed: 'completed', expired: 'ended', datePassed: 'declined' };
