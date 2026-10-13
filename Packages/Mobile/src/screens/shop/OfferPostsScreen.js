/**
 * F10 → the posts that carry one offer. You shop from a post, so its creator is credited (P1).
 * Contract: features/follower-app-v2 · board F10 · rules v1.7 §5.10
 *
 * shopper-app-fixes (N5): the list goes on past the first 20 — the next posts load as she reaches
 * its end (no button).
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { followerApi } from '../../services/api';
import { CS } from '../../components/shop/copyShop';
import { TopBar, PostCard, ShopSheet, SignInSheet, Loading, Empty } from '../../components/shop/bitsShop';
import { useShopNav } from '../../components/shop/useShopNav';
import { useAutoplay } from '../../components/shop/useAutoplay';

export default function OfferPostsScreen({ navigation, route }) {
  const { brandId, offerId, title } = route.params || {};
  const nav = useShopNav(navigation);
  const [posts, setPosts] = useState(null);
  const { seenProps, playingId } = useAutoplay('offers', posts, nav.covered);   // nothing plays behind the products of a post
  const page = useRef({ more: false, next: 0, busy: false });

  useEffect(() => {
    (async () => {
      const r = await followerApi.brandPosts(brandId, { offer: offerId });
      const first = r && r.success ? r.data.posts || [] : [];
      page.current = { more: !!(r && r.success && r.data.more), next: r && r.success && r.data.next != null ? r.data.next : first.length, busy: false };
      setPosts(first);
    })();
  }, [brandId, offerId]);

  // N5 — the end of the list: the next posts carrying this offer.
  async function loadMore() {
    const at = page.current;
    if (!at.more || at.busy) return;
    at.busy = true;
    const r = await followerApi.brandPosts(brandId, { offer: offerId, offset: at.next });
    at.busy = false;
    if (!r || !r.success) return;                           // asked again at the next reach of the end
    const more = r.data.posts || [];
    at.more = !!r.data.more && more.length > 0;
    at.next = r.data.next != null ? r.data.next : at.next + more.length;
    setPosts((prev) => {
      const have = new Set((prev || []).map((p) => p.id));
      return [...(prev || []), ...more.filter((p) => !have.has(p.id))];
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <TopBar title={title} onBack={() => navigation.goBack()} />
      {posts === null ? <Loading /> : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={({ item, index }) => (
            <PostCard post={item} surface="offers" position={index} active={playingId === item.id} onOpen={nav.openPost} onShop={nav.openShop} onComments={nav.openComments}
              onCreator={nav.openCreator} onBrand={nav.openBrand} onNeedSignIn={nav.needSignIn} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={<Empty title={CS.noPosts} />}
          contentContainerStyle={{ padding: 14 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          testID="offer-posts"
          {...seenProps}
        />
      )}
      <ShopSheet post={nav.shopPost} visible={!!nav.shopPost} onClose={nav.closeShop} surface="offers" />
      <SignInSheet visible={nav.signIn} onClose={nav.closeSignIn} onSignIn={nav.goSignIn} />
    </SafeAreaView>
  );
}
