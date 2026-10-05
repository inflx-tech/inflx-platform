/**
 * Where taps go in the shopper app (follower-app-v2 · rules v1.7 §5.5–5.10):
 *   a photo post → it opens, and the feed carries on with that creator, then similar (F4)
 *   a video      → full screen in Play, then all creators' videos (F5)
 *   a creator    → her store (F7) · a brand → its store (F9) · comments → F6
 * Plus the two sheets every post screen needs: Shop this post (F3) and Sign in (F6).
 *
 * shopper-app-fixes (F8 · decision X4) — where a video opens depends on where she is:
 *   on one of the bottom tabs (Home, Saved)   in the Play tab, as it always did
 *   on a pushed screen (a store, search, a post's page, an offer's posts, a collection)
 *                                             Play is pushed ON TOP (`PlayOver`), with a Back arrow,
 *                                             so Back returns her to where she was. It used to switch
 *                                             to the Play tab, which threw the pushed screens away:
 *                                             Back went to Home.
 * A bottom-tab screen says so with `{ tab: true }`; every other screen is a pushed one.
 */
import { useCallback, useState } from 'react';

export const PLAY_OVER = 'PlayOver';

export function useShopNav(navigation, { tab = false } = {}) {
  const [shopPost, setShopPost] = useState(null);
  const [signIn, setSignIn] = useState(false);

  const openPost = useCallback((post) => {
    if (!post) return;
    if (post.media_kind !== 'video') { navigation.navigate('Post', { postId: post.id, post }); return; }
    const params = { start: post.id, at: Date.now() };
    if (tab) navigation.navigate('PlayTab', params);
    // `push`, not `navigate`: a video opened from a store that was itself opened from a video must
    // be a new Play on top, never a jump back to the one underneath.
    else if (typeof navigation.push === 'function') navigation.push(PLAY_OVER, params);
    else navigation.navigate(PLAY_OVER, params);
  }, [navigation, tab]);
  const openCreator = useCallback((c) => { if (c && c.id) navigation.navigate('CreatorStore', { id: c.id, name: c.name }); }, [navigation]);
  const openBrand = useCallback((b) => { if (b && b.id) navigation.navigate('BrandStore', { id: b.id, name: b.name }); }, [navigation]);
  const openComments = useCallback((post) => navigation.navigate('Comments', { postId: post.id }), [navigation]);
  const goSignIn = useCallback(() => { setSignIn(false); navigation.navigate('FollowerLogin'); }, [navigation]);

  return {
    openPost, openCreator, openBrand, openComments,
    shopPost, openShop: setShopPost, closeShop: () => setShopPost(null),
    signIn, needSignIn: () => setSignIn(true), closeSignIn: () => setSignIn(false), goSignIn,
  };
}
