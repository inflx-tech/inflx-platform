/**
 * Every sentence on the shopper app's screens (follower-app-v2), in one place.
 * Contract: features/follower-app-v2 · boards F1–F13 · rules v1.7 §5
 */
export const CS = {
  wordmark: 'INFLX',
  // tabs
  home: 'Home', discover: 'Discover', play: 'Play', saved: 'Saved', profile: 'Profile',
  // F1 Welcome
  skip: 'Skip',
  welcomeTitle: "Let's make your feed yours",
  shopFor: 'I shop for',
  styles: 'Styles I like',
  myCity: 'My city',
  useLocation: 'Use my location',
  pickCity: 'Pick my city',
  locationLine: "We use your phone's location to show creators and stores near you. We never store it.",
  locationOn: 'Using your location',
  locationDenied: "Location is off. Pick your city instead.",
  showFeed: 'Show my feed',
  searchCity: 'Search a city',
  // F2 Home
  creators: 'Creators',
  brands: 'Brands',
  shopThisPost: 'Shop this post',
  shopThisVideo: 'Shop this video',
  items: (n) => `${n} item${n === 1 ? '' : 's'}`,
  caughtUp: "You're all caught up",
  caughtUpSub: 'Here are posts you saw before, the oldest first.',
  emptyFeed: 'No posts yet',
  emptyFeedSub: 'When creators you like go live, their posts show up here.',
  retry: 'Try again',
  loadError: "Couldn't load. Check your connection.",
  // F3 Shop this post
  shopTitle: 'Shop this post',
  noCodeNeeded: (name) => `No code needed. Buying here pays ${name} her commission.`,
  heartKeepsOffer: 'The ♡ saves the product with this post, so it keeps this offer.',
  checkoutSoon: 'Adding to the bag comes with checkout. Save what you like for now.',
  outOfStock: 'Out of stock',
  // F4 / F5
  moreFrom: (name) => `More from ${name}`,
  similar: 'Similar posts',
  more: 'More to see',
  videoNeedsUpdate: 'Update INFLX to play videos',
  videoNeedsUpdateSub: 'Videos play in the next app update from the Play Store.',
  // F6 Comments
  comments: (n) => `Comments · ${n}`,
  reply: 'Reply',
  report: 'Report',
  reported: 'Reported',
  creatorTag: 'creator',
  addComment: 'Add a comment',
  send: 'Send',
  signInTitle: 'Sign in to like and comment',
  signInBody: 'Your likes and comments are public. Saving and following work without signing in.',
  signInCta: 'Sign in with your number',
  noComments: 'No comments yet. Be the first.',
  counter: (n) => `${n}/300`,
  // F7–F10 stores
  follow: 'Follow',
  following: 'Following',
  followersOnInflx: (n) => `${fmtCount(n)} follower${n === 1 ? '' : 's'} on INFLX`,
  brandsSheWorksWith: 'Brands she works with',
  categories: 'Categories',
  posts: 'Posts', videos: 'Videos', collections: 'Collections',
  noPosts: 'Nothing live here right now.',
  noCollections: 'No collections yet.',
  offersButton: '% Offers',
  offersTitle: (brand) => `Offers · ${brand}`,
  all: 'All',
  price: 'Price', category: 'Category', theme: 'Theme',
  offersFoot: 'Tapping an offer shows the posts that carry it. You shop from a post, so the creator is credited. Offers with no live posts aren’t listed.',
  noOffers: 'No offers with live posts right now.',
  collectionFoot: (name) => `A collection can mix brands. Each product sells like a one-product post: its own offer, and ${name} earns her commission.`,
  collectionHidden: 'This collection is empty right now.',
  // F11 Saved
  savedPosts: (n) => `Posts · ${n}`,
  savedProducts: (n) => `Products · ${n}`,
  savedGuest: 'Not signed in? Your saves stay on this phone and move to your account when you sign in.',
  noSavedPosts: 'Tap 🔖 on a post to keep it here.',
  noSavedProducts: 'Tap ♡ on a product in Shop this post to keep it here, with its offer.',
  otherPosts: (line) => `${line} →`,
  // F12 Search
  searchPlaceholder: 'Search or enter a post code',
  searchHint: "Search or enter a post code. Capitals don't matter.",
  codeMatch: 'POST CODE MATCH',
  openPost: 'Open post',
  orSearchFor: 'Or search for',
  searchWhat: 'Creators, brands, posts',
  searchExample: 'Type a name: "Priya", "Sri Lakshmi", "saree"',
  noResults: 'Nothing found. Try another name.',
  // F13 Profile
  guestTitle: 'Browsing as guest',
  guestBody: 'Sign in to like, comment and see your orders. Your saves and follows move with you.',
  signIn: 'Sign in with phone number',
  orders: 'Orders',
  followingRow: 'Following',
  myCityRow: 'My city',
  shopForRow: 'What I shop for',
  settingsRow: 'Settings',
  settingsSub: 'Notifications, video sound',
  policies: 'Policies and help',
  policiesSub: 'Returns, privacy, terms',
  returnsAddresses: 'Returns · Addresses',
  returnsAddressesSub: 'Designed with checkout, next',
  logOut: 'Log out',
  edit: 'Edit',
  notSet: 'Not set',
  videoSound: 'Start videos with sound',
  // Discover
  discoverSoon: 'Discover is coming soon',
  discoverSoonSub: 'INFLX is designing it. Until then, Home and Play show everything live.',
};

export function fmtCount(n) {
  const v = Number(n || 0);
  if (v >= 100000) return `${(v / 100000).toFixed(v % 100000 === 0 ? 0 : 1)}L`;
  if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K`;
  return String(v);
}

export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const initialsOf = (name) => String(name || '').trim().split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '·';
