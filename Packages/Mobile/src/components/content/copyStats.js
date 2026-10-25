/**
 * post-performance-v2 — the one line under every link, in the board's words (S1), and the numbers
 * in full with Indian grouping (M1). The creator is "you"; the brand reads "she".
 * Contract: features/post-performance-v2 · master rules v1.35 §13A · board v1 (locked 25 Oct 2026)
 *
 * No Intl: Hermes ships without the locale data, so the grouping and the clock are written here.
 */
import { day10 } from '../shoot/copy10';

/** 847937 → "8,47,937" (Indian grouping: the last three, then twos). null → "—". */
export function indian(n) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '—';
  const neg = Number(n) < 0;
  const s = String(Math.abs(Math.round(Number(n))));
  if (s.length <= 3) return `${neg ? '-' : ''}${s}`;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${rest},${last3}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** The phone's own clock: "6:10 am". */
function clock(d) {
  const h = d.getHours(); const m = d.getMinutes();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}
/** "today 6:10 am" · "yesterday 6:10 am" · "3 days ago" · "14 Jan" past a month. */
export function whenWords(iso, now = new Date()) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dayOf = (x) => Math.floor((x.getTime() - x.getTimezoneOffset() * 60000) / 86400000);
  const days = dayOf(now) - dayOf(d);
  if (days <= 0) return `today ${clock(d)}`;
  if (days === 1) return `yesterday ${clock(d)}`;
  if (days < 31) return `${days} days ago`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const plural = (n, one, many) => `${indian(n)} ${n === 1 ? one : many}`;

export const STATS = {
  // S1 — the states
  waitingHers: 'Numbers come the morning after you mark it posted',
  waitingBrand: 'Numbers come the morning after she marks it posted',
  story: "Screenshot · stories can't be tracked",
  stories: "Screenshots · stories can't be tracked",
  facebook: 'Facebook numbers come later',
  unreadable: "Couldn't read this link · we'll try again tomorrow",
  gone: 'This post is no longer public',
  likesHidden: 'Likes hidden',
  commentsOff: 'Comments off',
  updated: (iso) => `Updated ${whenWords(iso)}`,
  lastRead: (iso) => `Last read ${day10(iso)}`,
  fromChannel: (side, iso) => `From ${side === 'brand' ? 'her' : 'your'} channel numbers, ${day10(iso)}`,
  otherBrand: (found) => `Posted from @${found}, not her account`,
  otherHers: (mine, found) => `This link isn't on your account${mine ? ` @${mine}` : ''} — it's @${found}'s. If you're a co-author we'll see it on the next read; otherwise INFLX will ask.`,
  // the words on the post screens
  onSocial: 'On social media',
  notAdded: 'Social links not added yet',
  links: (n) => plural(n, 'link', 'links'),
  views: 'views', likes: 'likes', comments: 'comments',
  viewsOnSocial: 'views on social media',
  whereShared: 'Where you shared it',
  // Update now (M2)
  updateNow: 'Update now',
  updateHintBrand: 'Reads her links once · once a day',
  updateHintHers: 'Once a day',
  // C1 — the note under the links, said once
  note: 'Instagram and YouTube numbers are read on day 1, 2, 3, 5, 7, 10, 14, 21 and 30, then every two weeks for three months. They never change what you\'re paid.',
  yourLinks: 'Your links',
  herLinks: 'Her links',
};

/** "48,200 views · 3,910 likes · 212 comments" — a photo post has no views; hidden likes and comments off say so. */
export function numbersLine(st) {
  if (!st) return '';
  const parts = [];
  if (st.views != null) parts.push(`${indian(st.views)} ${STATS.views}`);
  parts.push(st.likesHidden ? STATS.likesHidden : `${indian(st.likes)} ${STATS.likes}`);
  parts.push(st.commentsOff ? STATS.commentsOff : `${indian(st.comments)} ${STATS.comments}`);
  return parts.join(' · ');
}

/**
 * The one line under a link, as the board's S1 table gives it. Returns { text, tone, numbers }:
 * tone 'wait' (blue) · 'warn' (orange) · 'gone' (red) · 'plain'; `numbers` is the bold part, when any.
 * `side` is 'creator' | 'brand'.
 */
export function statLine(st, side = 'creator') {
  if (!st) return null;
  const hers = side !== 'brand';
  switch (st.state) {
    case 'story': return { text: STATS.story, tone: 'plain' };
    case 'facebook': return { text: STATS.facebook, tone: 'plain' };
    case 'waiting': return { text: hers ? STATS.waitingHers : STATS.waitingBrand, tone: 'wait' };
    case 'gone': return { text: STATS.gone, tone: 'gone' };
    case 'unreadable': return { text: STATS.unreadable, tone: 'warn', numbers: st.updatedAt ? numbersLine(st) : null };
    case 'other_account': return { text: hers ? STATS.otherHers(st.myHandle, st.ownerHandle) : STATS.otherBrand(st.ownerHandle), tone: 'warn', numbers: hers ? null : numbersLine(st) };
    case 'stopped': return { numbers: numbersLine(st), text: STATS.lastRead(st.updatedAt), tone: 'plain' };
    case 'ok':
      return { numbers: numbersLine(st), text: st.source === 'level1' ? STATS.fromChannel(side, st.sourceAt || st.updatedAt) : STATS.updated(st.updatedAt), tone: 'plain' };
    default: return null;
  }
}

/** The post's one line: "On social media · 60,900 views · 4,790 likes · 253 comments · 2 links" or "Social links not added yet". */
export function socialLine(sum, side = 'creator') {
  if (!sum) return null;
  if (sum.missing) return { text: STATS.notAdded, tone: 'wait' };
  if (!sum.links) return null;
  // links handed in, none read yet: the waiting sentence, in blue, after the count
  if (!sum.read) return { text: STATS.onSocial, tail: `${STATS.links(sum.links)} · ${side === 'brand' ? STATS.waitingBrand : STATS.waitingHers}`, tone: 'wait' };
  const parts = [`${indian(sum.views)} ${STATS.views}`, `${indian(sum.likes)} ${STATS.likes}`, `${indian(sum.comments)} ${STATS.comments}`, STATS.links(sum.links)];
  if (sum.stopped && sum.lastReadAt) parts.push(STATS.lastRead(sum.lastReadAt));
  return { text: STATS.onSocial, tail: parts.join(' · '), tone: 'plain' };
}

export default STATS;
