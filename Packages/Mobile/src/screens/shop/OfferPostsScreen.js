/**
 * F10 → the posts that carry one offer. You shop from a post, so its creator is credited (P1).
 * Contract: features/follower-app-v2 · board F10 · rules v1.7 §5.10
 */
import React, { useEffect, useState } from 'react';
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
  const { seenProps, playingId } = useAutoplay('offers', posts);

  useEffect(() => {
    (async () => {
      const r = await followerApi.brandPosts(brandId, { offer: offerId });
      setPosts(r && r.success ? r.data.posts : []);
    })();
  }, [brandId, offerId]);

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
          testID="offer-posts"
          {...seenProps}
        />
      )}
      <ShopSheet post={nav.shopPost} visible={!!nav.shopPost} onClose={nav.closeShop} surface="offers" />
      <SignInSheet visible={nav.signIn} onClose={nav.closeSignIn} onSignIn={nav.goSignIn} />
    </SafeAreaView>
  );
}
