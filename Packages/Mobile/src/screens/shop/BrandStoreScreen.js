/**
 * F9 Brand store — only this brand's posts; category circles (only categories it has posts in),
 * creator circles (only creators who worked with it); a floating Offers button that stays in place.
 * Contract: features/follower-app-v2 · board F9 · rules v1.7 §5.10, §4.13
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { followerApi } from '../../services/api';
import { CS } from '../../components/shop/copyShop';
import { TopBar, CircleRow, TileGrid, Loading, Empty, Chip, C } from '../../components/shop/bitsShop';
import { useShopNav } from '../../components/shop/useShopNav';
import { ensureDeviceHeader } from '../../components/shop/shopStore';
import { track } from '../../services/events';
import { fonts } from '../../theme/tokens';

export default function BrandStoreScreen({ navigation, route }) {
  const { id, name } = route.params || {};
  const nav = useShopNav(navigation);
  const [store, setStore] = useState(null);
  const [status, setStatus] = useState('loading');
  const [category, setCategory] = useState(null);
  const [creator, setCreator] = useState(null);
  const [posts, setPosts] = useState(null);

  const load = useCallback(async () => {
    await ensureDeviceHeader();
    const res = await followerApi.brandStore(id);
    if (!res || !res.success) { setStatus('error'); return; }
    setStore(res.data); setStatus('ready');
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!store) return;
    (async () => {
      setPosts(null);
      const r = await followerApi.brandPosts(id, { category: category || undefined, creator: creator || undefined });
      setPosts(r && r.success ? r.data.posts : []);
    })();
  }, [store, id, category, creator]);

  if (status === 'loading') return <SafeAreaView style={st.safe}><TopBar title={name} onBack={() => navigation.goBack()} /><Loading /></SafeAreaView>;
  if (status === 'error') return <SafeAreaView style={st.safe}><TopBar title={name} onBack={() => navigation.goBack()} /><Empty title={CS.loadError} action={CS.retry} onAction={load} /></SafeAreaView>;

  const openTile = (p) => { track('open', p.id, 'brand_store'); nav.openPost(p); };
  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <TopBar title={store.brand.name} onBack={() => navigation.goBack()} onSearch={() => navigation.navigate('Search')} />
      <ScrollView contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: 90 }}>
        <Text style={st.sub} testID="brand-line">{store.line}</Text>
        {store.categories.length ? (
          <View style={{ gap: 6 }}>
            <Text style={st.rowLbl}>{CS.categories}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {store.categories.map((x) => <Chip key={x.id} label={x.name} on={category === x.id} onPress={() => setCategory(category === x.id ? null : x.id)} testID={`brand-cat-${x.name}`} />)}
            </View>
          </View>
        ) : null}
        <CircleRow label={CS.creators} items={store.creators.map((x) => ({ ...x, ring: creator === x.id }))}
          onPress={(x) => setCreator(creator === x.id ? null : x.id)} testIDPrefix="brand-creator" />
        {posts === null ? <Loading /> : posts.length === 0 ? <Text style={st.sub}>{CS.noPosts}</Text> : (
          <TileGrid posts={posts} onOpen={openTile} testIDPrefix="brand-tile" />
        )}
      </ScrollView>
      {store.offers_count ? (
        <TouchableOpacity style={st.fab} onPress={() => navigation.navigate('BrandOffers', { id, name: store.brand.name })} testID="brand-offers">
          <Text style={st.fabText}>{CS.offersButton}</Text>
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  sub: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: C.ink2 },
  rowLbl: { fontFamily: fonts.sansBold, fontSize: 10.5, letterSpacing: 0.6, color: C.ink3, textTransform: 'uppercase' },
  fab: { position: 'absolute', right: 16, bottom: 20, backgroundColor: C.ink, borderRadius: 99, paddingHorizontal: 18, paddingVertical: 11, elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
  fabText: { color: '#fff', fontFamily: fonts.sansBold, fontSize: 13 },
});
