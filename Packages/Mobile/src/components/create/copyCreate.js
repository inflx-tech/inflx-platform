/**
 * Every word the Create tab says (Level 3). The server's refusals (backend/src/services/postsCopy.js)
 * arrive in its own words and are shown as they come.
 * Contract: features/shoppable-posts-v2 · boards P1–P20 · rules Docs/OFFER_TERMS_POSTS_RULES.md §4
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '2026-10-10' → '10 Oct' */
export const dayMonthP = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}` : '';
};
export const rupeesP = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const STATE_LABEL = {
  live: 'Live', approved: 'Approved', in_review: 'In review', sent_back: 'Sent back', removed: 'Removed', draft: 'Draft',
};

export const CP = {
  // P1
  create: 'Create',
  needs: (n) => `Needs a shoppable post · ${n}`,
  needsLine: (done, min, date) => `${done} of ${min}${date ? ` · before ${dayMonthP(date)}` : ''}`,
  start: 'Start',
  newPost: 'New shoppable post',
  newCollection: 'New collection',
  yourPosts: (n) => `Your posts · ${n}`,
  seeAll: 'See all ›',
  collections: (n) => `Collections · ${n}`,
  collectionsSub: 'Group your posts or products',
  nothingYet: 'No posts yet. Make your first one for a signed collaboration.',
  cantPostYet: 'Posting opens after both signatures and your shoot plan.',
  // P16
  whatMake: 'What do you want to make?',
  makePost: 'Shoppable post',
  makePostSub: 'Photos or a video with products, for one brand. INFLX checks it before it goes live.',
  makeCollection: 'Collection',
  makeCollectionSub: 'Group posts or products you already have under one name. Any brands. Live straight away.',
  // steps
  newTitle: 'New shoppable post',
  step: (n) => `Step ${n} of 8`,
  next: 'Next',
  nextN: (n, what) => `Next · ${n} ${what}`,
  // P2
  brandQ: 'Which brand is this post for?',
  brandHint: 'One brand per post. To show several brands together, make a collection.',
  noBrands: 'No signed collaboration to post for yet.',
  // P3
  collabQ: 'Which collaboration?',
  collabHint: 'The post can only use what this collaboration lets you sell.',
  collabLine: (c) => [c.sell_words, c.posting_date ? `live by ${dayMonthP(c.posting_date)}` : null].filter(Boolean).join(' · '),
  collabDone: (c) => [`${c.posts_done} of ${c.posts_min} posts done`, c.earning].filter(Boolean).join(' · '),
  // P4
  typeQ: 'What kind of post?',
  offerPost: 'Offer post',
  offerPostSub: 'Show one of your offers, like "Any 2 jeans for ₹2,999". Your post appears in offer rails.',
  offerPostCount: (n) => `${n} ${n === 1 ? 'offer' : 'offers'} in this collaboration`,
  pricePost: 'Price post',
  pricePostSub: 'Show products at their normal price, grouped by price, like "Under ₹999".',
  pricePostCount: (n) => `${n} ${n === 1 ? 'product' : 'products'} without offers`,
  // P5
  offerTitle: 'Offer post',
  kindQ: 'Which kind of offer?',
  pickOne: (type) => `Pick one ${type.toLowerCase()} offer`,
  offerLine: (o) => `${o.type_label.split(' · ')[1] || o.type_label} · ${o.products} ${o.products === 1 ? 'product' : 'products'} · till ${dayMonthP(o.ends_on)}`,
  // P6 / P7
  pickTitle: 'Pick products',
  picked: (n) => `${n} picked`,
  pickAtLeast: (n) => (n > 1 ? `Pick at least ${n} so a shopper can complete the bundle from this post.` : 'Any products from the pool, at least 1. Discount prices are shown as shoppers will pay them.'),
  fixedAll: (n) => `All ${n} products are added for you`,
  fixedSub: 'Nothing to pick. The shopper only chooses size and colour.',
  products: (n) => `${n} ${n === 1 ? 'product' : 'products'}`,
  // P8
  priceTitle: 'Price post',
  band: 'Price band',
  bandHint: (label) => (label.startsWith('Under')
    ? `Shows your products up to ${label.replace('Under ', '')}, including cheaper ones.`
    : `Shows your products from ${label.replace('+', '')} up.`),
  category: 'Category',
  allCategories: 'All',
  noneInBand: 'None of your products without offers are in this band and category.',
  // P9
  themeTitle: 'Theme',
  themeHint: "Pick at least 1 tag, and at most 1 from each group. Tags can't be changed once the post is live.",
  groups: { season: 'Season', occasion: 'Occasion', style: 'Style', use: 'Use' },
  groupPicked: 'picked', optional: 'optional',
  tags: (n) => `${n} ${n === 1 ? 'tag' : 'tags'}`,
  // P10
  mediaTitle: 'Format and media',
  type: 'Type', photo: 'Photo', video: 'Video',
  layout: 'Layout', single: 'Single', carousel: 'Carousel',
  mediaHint: (kind) => (kind === 'video' ? 'Up to 10 clips in a carousel, each up to 90 seconds.' : 'Up to 10 in a carousel. Tap a photo to tag products on it.'),
  music: 'No copyrighted music. INFLX checks every post, and one with copyrighted music is sent back.',
  tagLook: 'Product tags look',
  tagStyles: { soft_editorial: 'Soft editorial', minimal: 'Minimal', hidden: 'Hidden' },
  uploading: (i, n) => `Uploading ${i} of ${n}…`,
  uploadFailed: "A file didn't upload. Try again.",
  tooLong: 'Each video can be up to 90 seconds.',
  // P11a
  tagTitle: (i) => `Tag products · photo ${i}`,
  tagHint: (done, n) => `Tap the photo where a product is, then pick it. ${done} of ${n} products tagged on this photo.`,
  onPhoto: (i) => `on photo ${i}`,
  notTagged: 'not tagged on a photo yet, still in the post',
  pickProduct: 'Which product is here?',
  done: 'Done',
  // P11
  reviewTitle: 'Review',
  caption: 'Caption',
  captionPlaceholder: 'Write what shoppers should know.',
  howFound: 'How shoppers will find it',
  fCategory: 'Category', fOffer: 'Offer', fPrice: 'Price', fTheme: 'Theme', fFor: 'For', fProducts: 'Products',
  fromProducts: 'from your products', fromOffer: 'from your offer', costliest: (n) => `costliest item ${rupeesP(n)}`,
  priceWord: 'Price post · normal price',
  edit: 'Edit',
  send: 'Send to INFLX for review',
  sendAgain: 'Fix and send again',
  sent: 'Sent to INFLX.',
  // P12
  withInflx: 'With INFLX',
  inReviewSince: (d) => `In review since ${dayMonthP(d)}`,
  usually: 'Usually within a day.',
  whoChecks: 'Who checks it',
  whoChecksBody: "INFLX, not the brand. We check the products and offer match your collaboration, and that there's no copyrighted music.",
  goesLive: 'Goes live',
  // posting-date-last-day: an approved post is in the shop at once; the posting date is the last day.
  goesLiveBody: (d) => (d ? `As soon as INFLX approves it. Your last day to go live is ${dayMonthP(d)}.` : 'As soon as INFLX approves it.'),
  // P13
  sentBackTitle: 'Sent back',
  whatSaid: 'What INFLX said',
  canChange: 'What you can change',
  canChangeBody: 'Photos and videos, caption, products, theme tags. Not the brand, collaboration, post type or offer. For those, start a new post.',
  startOver: 'Start over',
  postingNotMoved: "Your posting date hasn't moved",
  stillOn: (d, days) => `Still ${dayMonthP(d)}.${days != null && days >= 0 ? ` You have ${days} ${days === 1 ? 'day' : 'days'}.` : ''}`,
  deleteIt: 'Delete',
  deleteQ: 'Delete this post?',
  deleteBody: 'It goes for good. Nothing about your collaboration changes.',
  deleted: 'Deleted.',
  // approved / live
  approvedTitle: 'Approved',
  approvedBody: (d) => `Approved by INFLX. It goes live on ${dayMonthP(d)}, when its offer starts.`,
  liveBody: 'In the shop now.',
  noEdits: "An approved post can't be changed. You can take it down: it leaves the shop and keeps its earnings history.",
  takeDown: 'Take it down',
  takeDownQ: 'Take this post down?',
  takeDownBody: "It leaves the shop and can't come back. What it earned stays in your history.",
  keepIt: 'Keep it',
  takenDown: 'Taken down.',
  // P15
  removedOn: (d) => `Removed from the shop on ${dayMonthP(d)}`,
  salesWhileLive: 'Sales while live',
  youEarned: 'You earned',
  otherReasons: 'Other reasons you might see: "The brand removed all its products from the offer" or "Every product sold out".',
  returnWindow: 'Commission on its sales still follows the usual return window before you can withdraw it.',
  // P14
  yourPostsTitle: 'Your posts',
  drafts: 'Drafts',
  savedAt: (step, d) => `Saved at step ${step} · ${dayMonthP(d)}`,
  priceRow: 'Price post · normal price',
  offerRow: (o) => `${o.type} · ${o.deal}${o.ends_on ? ` · till ${dayMonthP(o.ends_on)}` : ''}`,
  offerEndedRow: (d) => `Offer ended ${dayMonthP(d)}`,
  emptyState: (label) => `No ${label.toLowerCase()} posts.`,
  // P17–P20
  collectionsTitle: 'Collections',
  collectionsHint: 'Shoppers see these in your store.',
  hiddenLine: 'Hidden from shoppers',
  hiddenHint: 'A collection is hidden when nothing in it is still in the shop. Add something new and it shows again.',
  hidden: 'Hidden', live: 'Live',
  newCollectionTitle: 'New collection',
  name: 'Name',
  whatGoesIn: 'What goes in',
  myPosts: 'My posts', productsTab: 'Products',
  onlyLive: 'Only your live posts. Posts that leave the shop drop out of the collection by themselves.',
  searchProducts: 'Search your products',
  createN: (n, kind) => `Create collection · ${n} ${kind === 'posts' ? (n === 1 ? 'post' : 'posts') : (n === 1 ? 'product' : 'products')}`,
  noLivePosts: 'No live posts yet. Posts join once INFLX approves them.',
  addPosts: 'Add posts', addProducts: 'Add products',
  rename: 'Rename', save: 'Save',
  collectionHint: 'A post that leaves the shop drops out for shoppers but stays greyed here, so you can see what happened. Deleting a collection never touches the posts in it.',
  deleteCollectionQ: 'Delete this collection?',
  deleteCollectionBody: 'The posts and products in it stay as they are.',
  remove: 'Remove',
};

export default CP;
