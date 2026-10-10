/**
 * Every word item 20 says on the phone: linking a creator to the brand he runs, posting for it,
 * where he shared a post, and the brand's side. The server's refusals arrive in its own words
 * (backend/src/services/ownBrandCopy.js) and are shown as they come.
 * Contract: features/item20-own-brand · rules v1.33 §2D · board L1–L6, B1–B3, C1–C5, S1–S3, M1–M2
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '2026-10-10' or an ISO time → '10 Oct' (the day as stored; no time-zone arithmetic on the phone). */
export const day20 = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}` : '';
};
export const dayYear20 = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
};
const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1).replace(/_/g, ' ') : '');
const SITE = { ig: 'Instagram', yt: 'YouTube', fb: 'Facebook' };
const SITE_OF_PLACE = { reel: 'Instagram', post: 'Instagram', story: 'Instagram', youtube_video: 'YouTube', youtube_short: 'YouTube', facebook_post: 'Facebook' };

export const O20 = {
  // L1–L4 — the link steps
  askTitle: 'Do you run a brand on INFLX?',
  sameLede: 'This number also has a brand account.',
  sameBody: 'Link it and you can post for your own store from this app. No campaign or agreement needed.',
  linkMine: 'Yes, link my brand',
  notNow: 'Not now',
  askLede: 'If you own a store that is on INFLX, link it and post for it yourself.',
  no: "No, I'm a creator only",
  noSub: 'You can link a brand later from Profile.',
  yes: 'Yes, I run a brand',
  yesSub: "You'll confirm with a code sent to the brand's number.",
  cont: 'Continue',
  numberTitle: "Your brand's number",
  numberLede: "The mobile number your brand signs in with on INFLX. We'll text it a code.",
  numberLabel: "Brand's mobile number",
  numberPlaceholder: '10-digit mobile number',
  numberBad: 'Enter a valid Indian mobile number.',
  noBrandYet: 'No brand on INFLX yet? Register it in the INFLX Brand app first, then link it from Profile.',
  sendCode: 'Send code',
  codeTitle: 'Enter the code',
  sentTo: (p) => `Sent to ${p}`,
  codeNote: "The code goes to the brand's phone. If someone else holds it, ask them for the code.",
  link: 'Link my brand',
  back: '‹ Back',
  startAgain: 'Start again',
  otherBrand: 'Link a different brand',
  generic: 'Something went wrong. Please try again.',
  brandLine: (b) => [cap(b.category), b.city].filter(Boolean).join(' · '),
  // L5, L6 — Profile row and My brand
  row: 'My brand',
  rowAsk: 'Do you run a brand on INFLX?',
  linked: 'Linked',
  title: 'My brand',
  intro: 'Link the brand you run, then post for it from Create. No campaign or agreement needed.',
  linkedOn: 'Linked',
  postsFor: 'Your posts for it',
  postsLine: (p) => `${p.live} live · ${p.in_review} with INFLX`,
  can: "Post any running offer or listed product of this store from Create. INFLX checks each post. There is no commission on your own brand: the sale goes to the brand's wallet.",
  createPost: 'Create a post',
  remove: 'Remove link',
  oneBrand: 'You can link one brand. You work with other brands as usual.',
  removeQ: (name) => `Remove your link to ${name}?`,
  removeBody: "Your live posts for it stay live. You can't make new ones until you link again.",
  keep: 'Keep it',
  removed: 'Link removed.',
  linkedToast: (name) => `Linked to ${name}.`,
  // B2, B3 — the brand's side
  linkedRow: 'Linked creators',
  linkedRowSub: (n) => (n ? `${n} ${n === 1 ? 'person posts' : 'people post'} for your brand` : 'People who post for your brand themselves'),
  linkedTitle: 'Linked creators',
  linkedHint: 'People who post for your brand as its own team. They need no campaign, agreement or commission. Each one linked with a code sent to your number.',
  linkedFooter: 'To add someone: in the INFLX Creator app they open Profile › My brand and enter the code sent to your number.',
  linkedOnDay: (d) => `Linked ${day20(d)}`,
  linkedEmptyTitle: 'Nobody is linked yet',
  removeOne: 'Remove',
  removeOneQ: (name) => `Remove ${name}?`,
  removeOneBody: "Their live posts for your brand stay live. They can't make new ones, and they are told.",
  removeOneYes: 'Remove link',
  removeOneNo: 'Keep',
  removedOne: (name) => `${name} removed.`,
  // C1–C5 — posting for his own brand
  yourBrand: 'Your brand',
  step: (n) => `Step ${n} of 7`,
  offerCount: (n) => `${n} ${n === 1 ? 'offer' : 'offers'} running in your store`,
  cantPostYet: 'Posting opens when INFLX approves your brand.',
  nothingYet: (brand) => `No posts yet. Make your first one for ${brand}.`,
  whoChecksBody: "INFLX. We check the products and offer are from your store, and that there's no copyrighted music.",
  canChangeBody: 'Photos and videos, caption, products, theme tags. Not the brand, post type or offer. For those, start a new post.',
  deleteBody: 'It goes for good.',
  noEdits: "An approved post can't be changed. You can take it down: it leaves the shop and keeps its sales history.",
  takeDownBody: "It leaves the shop and can't come back. What it sold stays in your history.",
  itSold: 'It sold',
  // S1–S3 — where he shared it
  whereTitle: 'Where did you share it?',
  whereHint: 'Add your reel, post or video. Nobody approves this. It is for your own numbers.',
  addPlace: '+ Add a place',
  noLink: 'no link',
  sheetAdd: 'Where did you share it?',
  sheetEdit: 'Change this place',
  linkLabel: (optional) => (optional ? 'Link (optional)' : 'Link'),
  linkPlaceholder: 'Paste the link',
  linkHint: (place) => `Put your ${SITE_OF_PLACE[place] || 'post'} link from Share in the caption or bio. Visits and orders are counted from that link.`,
  save: 'Save',
  removePlace: 'Remove this place',
  placeLine: (p) => `${p.short} · ${day20(p.shared_on)}`,
  salesWord: 'sales',
  inflxHint: '"In INFLX" = the shopper found your post inside INFLX, with no tap on your links in the 30 days before buying.',
  site: (channel) => SITE[channel] || '',
  // M1, M2 — the brand's Sales money
  ownPost: 'Your own',
};

export default O20;
