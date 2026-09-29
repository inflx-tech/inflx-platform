/**
 * Where taps go in the shopper app (follower-app-v2 · rules v1.7 §5.5–5.10):
 *   a photo post → it opens, and the feed carries on with that creator, then similar (F4)
 *   a video      → full screen in Play, then all creators' videos (F5)
 *   a creator    → her store (F7) · a brand → its store (F9) · comments → F6
 * Plus the two sheets every post screen needs: Shop this post (F3) and Sign in (F6).
 */
import { useCallback, useState } from 'react';

export function useShopNav(navigation) {
  const [shopPost, setShopPost] = useState(null);
  const [signIn, setSignIn] = useState(false);

  const openPost = useCallback((post) => {
    if (!post) return;
    if (post.media_kind === 'video') navigation.navigate('PlayTab', { start: post.id, at: Date.now() });
    else navigation.navigate('Post', { postId: post.id, post });
  }, [navigation]);
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
