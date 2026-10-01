/**
 * Every word the link and code screens say (Level 4): the Create tab's links card, Share, Where to
 * share what, Store and collection links, a post's Stats, and the brand's posts and codes.
 * Contract: features/post-links-codes · boards L1–L8 · rules Docs/OFFER_TERMS_POSTS_RULES.md §4.14
 */
import { dayMonthP, rupeesP } from './copyCreate';

export const CL = {
  // L1
  createPost: 'Create shoppable post',
  createPostSub: 'Brand, collaboration, offer or price, media',
  createCollection: 'Create collection',
  createCollectionSub: 'Name it, add your posts or products',
  myLinks: 'My store and collection links',
  myPosts: 'My posts',
  share: 'Share', stats: 'Stats',
  codeLive: (brand, code, since) => `${brand} · Code ${code}${since ? ` · live since ${dayMonthP(since)}` : ''}`,
  codeApproved: (date, code) => `Approved · goes live ${dayMonthP(date)}, when its offer starts · Code ${code}`,
  noCodeYet: 'With INFLX · no code until approved',
  // L2 / L3
  shareTitle: 'Share your post',
  postCode: 'POST CODE',
  codeHint: "For captions, where links can't be tapped. Followers type it in INFLX search. It never changes.",
  copy: 'Copy', copied: '✓ Copied',
  captionLine: 'Caption line',
  postLinks: 'Post links, one per channel',
  whereToShare: 'Where to share', followerView: 'Follower view',
  goesLive: (d) => `Goes live on ${dayMonthP(d)}`,
  goesLiveBody: (d) => `Your code and links are ready so you can prepare captions. Anyone who taps before ${dayMonthP(d)} sees "This post goes live on ${dayMonthP(d)}" and your store.`,
  since: (brand, offer, d) => [brand, offer, d ? `since ${dayMonthP(d)}` : null].filter(Boolean).join(' · '),
  // L4
  whereTitle: 'Where to share what',
  // L5
  linksTitle: 'Store and collection links',
  yourStore: 'Your store',
  storeHint: 'Opens your INFLX store with every live post and collection. Best for your bio.',
  storeLinks: 'Store link, one per channel',
  visitsMonth: (n, first) => (first ? `${n} ${n === 1 ? 'visit' : 'visits'} this month` : `${n} ${n === 1 ? 'visit' : 'visits'}`),
  collections: 'Collections',
  collectionLine: (c) => `${c.items} ${c.kind === 'posts' ? (c.items === 1 ? 'post' : 'posts') : (c.items === 1 ? 'product' : 'products')} · ${c.visits} ${c.visits === 1 ? 'visit' : 'visits'}`,
  collectionPay: 'Each order from a collection still pays you under the collaboration its product came from.',
  handleHint: 'Changed your handle? Your old store links keep working and open your store.',
  noHandle: 'Add your Instagram handle in your profile to get your store link.',
  noCollections: 'No collections yet.',
  // L6
  statsTitle: (t) => `Stats · ${t}`,
  statsSub: (brand, code, since) => `${brand} · Code ${code}${since ? ` · live since ${dayMonthP(since)}` : ''}`,
  visits: 'visits', orders: 'orders', toYou: 'to you', commissionWord: 'commission',
  visitsBy: 'Visits by channel', ordersBy: 'Orders by channel',
  orderLine: (o, first) => `${o.orders} · ${rupeesP(o.sales)}${first ? ' sales' : ''}`,
  noVisits: 'No visits yet. Share your code and links to bring shoppers here.',
  noOrders: 'No orders yet.',
  inflxHint: '"In INFLX" = the shopper found your post inside INFLX, with no tap on your links in the 30 days before buying. You earn on every one of these orders either way.',
  // L7 / L8 (brand)
  postsTitle: (set) => `Posts · ${set}`,
  postsSub: (d) => `${d.campaign_name} · ${d.set_name} · ${d.creators} ${d.creators === 1 ? 'creator' : 'creators'} · ${d.live} live ${d.live === 1 ? 'post' : 'posts'}`,
  copyAll: (n) => `Copy all ${n} ${n === 1 ? 'code' : 'codes'}`,
  postRow: (t) => `${t.visits} visits · ${t.orders} orders · ${rupeesP(t.sales)} sales · ${rupeesP(t.commission)} commission`,
  goesLiveRow: (d) => `Goes live ${dayMonthP(d)}`,
  setSoFar: 'This set so far',
  shopOrders: 'Shop orders', creatorsCommission: "Creators' commission", inflxFee: 'INFLX fee', youReceive: 'You receive',
  copiedN: (n) => `Copied ${n} post ${n === 1 ? 'code' : 'codes'}`,
  copiedHint: 'Paste it into WhatsApp, a poster or your own posts. Orders through these codes still pay each creator her commission.',
  shareBtn: 'Share…',
  noPosts: 'No posts yet. A post shows here once INFLX approves it.',
  posts: 'Posts',
};

export default CL;
