/**
 * Item 19 — the words on Home, both phones (board item19-home-v3; rules v1.32 §24).
 *
 * A row's SENTENCE is the server's (backend homeCopy.js). Its BUTTON word is not written here
 * either: it is the set screen's own constant (C5, C6), looked up by the row's kind, so a Home row
 * and the screen it opens cannot read differently. Money uses the Wallet's own words (W17).
 * Contract: features/item19-home
 */
import { C5 } from '../invitations/copy5';
import { C6 } from '../negotiation/copy6';
import { W17, inr, dayMon } from '../wallet/copy17';
import { C4, countsLine4 } from '../campaigns/copy4';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** The brand's button for each kind of row — the set row's words (setRowStep). */
export const BRAND_BUTTON = {
  sign: C5.set.signChip,
  send_agreement: C5.set.sendAgreement,
  reply: C6.set.reply, reply_move: C6.set.reply, reply_time: C6.set.reply,
  plan_visit: C5.set.planVisit,
  confirm_shoot: C5.set.confirmShoot,
  review: C5.set.reviewIt,
  confirm_live: C5.set.confirmLive,
  book_parcel: C5.set.openStep, rebook: C5.set.openStep, difference: C5.set.openStep, confirm_return: C5.set.openStep,
  pitches: C5.set.openStep, pool: C5.set.openStep, withdrawal_failed: C5.set.openStep, add_bank: C5.set.openStep,
  orders: C5.set.openStep,
};

/** The creator's button — her Collabs card's words (cardStep), and the Create tab's two. */
export const CREATOR_BUTTON = {
  sign: C5.creator.reviewSign,
  post_needed: 'Start',
  post_sent_back: 'Fix',
};
const CREATOR_DEFAULT = C5.creator.open;

export const buttonFor = (side, kind) => (side === 'creator' ? (CREATOR_BUTTON[kind] || CREATOR_DEFAULT) : (BRAND_BUTTON[kind] || C5.set.openStep));

export const H19 = {
  needs: 'Needs you',
  waiting: 'Waiting on others',
  money: 'Money',
  campaigns: 'Campaigns',
  running: 'Running now',
  seeAll: 'See all',
  wallet: 'Wallet',
  delayed: 'Delayed',
  notifications: 'Notifications',

  nothingNeeds: 'Nothing needs you right now.',
  nothingWaiting: 'Nobody is holding you up.',
  noCampaignLive: 'No campaign is live right now.',
  nothingRunning: 'No collaboration is running yet.',
  order: {
    brand: 'Dates in the next three days come first, then what holds up someone’s payment or next step, then the oldest.',
    creator: 'Dates in the next three days come first, then what a brand is waiting on, then the oldest.',
  },
  emptyNeeds: { title: 'Nothing needs you', body: 'You’re up to date. Anything new will show here.' },
  emptyWaiting: { title: 'Nothing waiting on others', body: 'When you are waiting for someone, it shows here.' },
  groups: { creators: 'Creators', brands: 'Brands', inflx: 'INFLX', pitches: 'Pitches' },
  groupTab: (key, n) => `${H19.groups[key] || key} · ${n}`,

  // Campaigns (brand) — the Campaigns card's own lines.
  liveCount: (n) => `${n} live`,
  setsLine: (c) => (c.nextPostingDate ? C4.list.setsLine(c.setCount, c.nextPostingDate) : C4.list.setsLineNoNext(c.setCount)),
  countsLine: (c) => countsLine4(c.counts) || '',
  liveChip: C4.chips.live,

  // Running now (creator)
  runLine1: (r) => [r.campaignName, r.aim].filter(Boolean).join(' · '),
  runLine2: (r) => [r.postingDate ? `Posts ${dayMon(r.postingDate)}` : null, r.earn ? `you earn ${r.earn}` : null].filter(Boolean).join(' · '),
  copy: 'Copy', copied: 'Copied',

  // Money — the Wallet's words.
  moneyLabel: { available: W17.available, locked: W17.locked, sales: W17.sales, payments: W17.payments, commission: W17.commission },
  moneySub: (l) => {
    if (l.key === 'locked') return W17.lockedSub(l.count);
    if (l.key === 'sales') return W17.salesSub(l.count);
    if (l.key === 'payments') return W17.paymentsSub(l.count, l.nextAt ? dayMon(l.nextAt) : null);
    if (l.key === 'commission') return W17.commissionSub(l.count);
    return null;
  },
  inr,

  // First day
  brandFirst: {
    approved: 'Your account is approved.', lead: 'Three steps to your first collaboration.',
    steps: [
      ['Create a campaign', 'Name it and add a set: aim, mode and posting date.'],
      ['Pick creators', 'Search by city, niche and numbers, or use a saved group.'],
      ['Send invitations', 'Each creator gets your terms and answers from her app.'],
    ],
    create: 'Create a campaign', find: 'Find creators',
  },
  creatorFirst: {
    approved: 'Your account is approved.',
    lead: 'Brands invite creators whose profile and numbers fit. You can also pitch a brand yourself.',
    find: 'Find brands',
    settings: 'Invitation settings',
    settingsSub: (s) => {
      if (!s) return '';
      const AIM = { conversion: 'Pay for Sale', engagement: 'Pay for Content', hybrid: 'Hybrid' };
      const MODE = { visit: 'Store Visit', shipment: 'Remote' };
      const aims = (s.aims || []).map((a) => AIM[a]).filter(Boolean).join(', ');
      const modes = (s.modes || []).map((m) => MODE[m]).filter(Boolean).join(', ');
      return [s.state === 'paused' ? 'Paused' : 'Open', aims, modes].filter(Boolean).join(' · ');
    },
    numbers: 'Your numbers',
    numbersSub: (n) => {
      const k = (v) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 100000 ? 0 : 1).replace(/\.0$/, '')}K` : String(v));
      const bits = [n && n.instagram != null ? `Instagram ${k(n.instagram)}` : null, n && n.youtube != null ? `YouTube ${k(n.youtube)}` : null].filter(Boolean);
      return bits.length ? bits.join(' · ') : 'Not measured yet';
    },
  },
  hi: (name) => (name ? `Hi ${name}` : 'Home'),
  noNotices: 'Nothing yet. You’ll be told here when something changes on a campaign, a collaboration or your wallet.',
  bellLabel: (n) => (n ? `Notifications, ${plural(n, 'unread', 'unread')}` : 'Notifications'),
};
