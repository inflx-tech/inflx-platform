/**
 * What she has liked, bookmarked and hearted since the app was opened (shopper-app-fixes · F14).
 *
 * A post is handed from screen to screen as it was when its feed loaded: Home passes its card to the
 * post's page, a store passes its tile to Play. So a like given on one screen looked undone on the
 * next, which drew the same post from an older copy. This is the one record every card, reel and
 * products sheet reads FIRST and writes to, so what she did stays done on every screen until she
 * undoes it.
 *
 * Kept in memory only. Her account (or, for a guest, the phone — shopStore) is still where a save
 * really lives; this only stops an older copy of a post from contradicting what she just did.
 *
 *   a post      { liked, likes, saved }     — only the fields she has touched
 *   a product   { on, post_id, collection_item_id }
 *               A product is saved once, with the post or collection it was hearted in (rules 5.8),
 *               so hearting it somewhere else moves it there.
 */
const posts = new Map();
const hearts = new Map();
const listeners = new Set();

export const engaged = {
  /** What she has done to this post this session, or null. */
  post(id) { return posts.get(id) || null; },

  /** Records it and tells every card of that post that is on a screen. */
  setPost(id, patch) {
    if (!id) return null;
    const next = { ...(posts.get(id) || {}), ...patch };
    posts.set(id, next);
    for (const fn of [...listeners]) { try { fn(id, next); } catch { /* a closed screen */ } }
    return next;
  },

  /** `fn(postId, record)` on every change. Returns the way to stop. */
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  /** She hearted (or un-hearted) a product, from a post or from a collection item. */
  setHeart(productId, on, from = {}) {
    if (!productId) return;
    hearts.set(productId, { on: !!on, post_id: (on && from.post_id) || null, collection_item_id: (on && from.collection_item_id) || null });
  },

  /** Is this product hearted with this post? `loaded` is what the page was told when it loaded. */
  heartedInPost(postId, productId, loaded) {
    const h = hearts.get(productId);
    return h ? h.on && h.post_id === postId : !!loaded;
  },

  /** The same for a product of a collection. */
  heartedInCollection(itemId, productId, loaded) {
    const h = hearts.get(productId);
    return h ? h.on && h.collection_item_id === itemId : !!loaded;
  },

  /** Log out: the next person on this phone starts clean. Also used by tests. */
  clear() { posts.clear(); hearts.clear(); },
};
