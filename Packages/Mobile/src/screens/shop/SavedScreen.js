/**
 * F11 Saved — Posts and Products. A saved product names the post it came from and its offer; when
 * that post has gone it says so and points to other live posts with the same product. It can't be
 * bought outside a post (P1). A guest's saves stay on this phone until she signs in.
 * Contract: features/follower-app-v2 · board F11 · rules v1.7 §5.8
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { followerApi } from '../../services/api';
import { CS, inr } from '../../components/shop/copyShop';
import { TopBar, TileGrid, Loading, Empty, C, s as bs } from '../../components/shop/bitsShop';
import { useShopNav } from '../../components/shop/useShopNav';
import { shopStore, isSignedIn, ensureDeviceHeader } from '../../components/shop/shopStore';
import { fonts } from '../../theme/tokens';

export default function SavedScreen({ navigation }) {
  const nav = useShopNav(navigation);
  const [tab, setTab] = useState('posts');
  const [data, setData] = useState(null);
  const [guest, setGuest] = useState(false);

  const load = useCallback(async () => {
    await ensureDeviceHeader();
    const signed = await isSignedIn();
    setGuest(!signed);
    let res;
    if (signed) res = await followerApi.saved();
    else {
      const st = await shopStore.get();
      res = await followerApi.resolveSaved({ posts: st.savedPosts, products: st.savedProducts });
    }
    setData(res && res.success ? res.data : { posts: [], products: [], error: true });
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!data) return <SafeAreaView style={st.safe}><TopBar title={CS.saved} /><Loading /></SafeAreaView>;

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <TopBar title={CS.saved} onSearch={() => navigation.navigate('Search')} />
      <View style={st.seg}>
        {[['posts', CS.savedPosts(data.posts.length)], ['products', CS.savedProducts(data.products.length)]].map(([k, label]) => (
          <TouchableOpacity key={k} style={[st.segBtn, tab === k && st.segOn]} onPress={() => setTab(k)} testID={`saved-tab-${k}`}>
            <Text style={[st.segText, tab === k && { color: C.ink }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 30 }}>
        {data.error ? <Empty title={CS.loadError} action={CS.retry} onAction={load} /> : null}
        {tab === 'posts' ? (
          data.posts.length ? <TileGrid posts={data.posts} onOpen={nav.openPost} testIDPrefix="saved-tile" /> : <Text style={st.mut}>{CS.noSavedPosts}</Text>
        ) : data.products.length ? data.products.map((p) => (
          <View key={`${p.product_id}`} style={[bs.pline, { alignItems: 'flex-start' }]} testID={`saved-product-${p.product_id}`}>
            {p.image_url ? <Image source={{ uri: p.image_url }} style={bs.pthumb} /> : <View style={bs.pthumb} />}
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={bs.pname} numberOfLines={2}>{p.name}</Text>
              {p.available ? (
                <>
                  <Text style={bs.pprice}>
                    <Text style={{ fontFamily: fonts.sansBold, color: C.ink }}>{inr(p.shopper_price)}</Text>
                    {p.struck ? <Text style={bs.struck}>  {inr(p.price)}</Text> : null}
                  </Text>
                  <Text style={bs.hint}>{p.from}</Text>
                  {p.post_id ? (
                    <TouchableOpacity onPress={() => navigation.navigate('Post', { postId: p.post_id })} testID={`saved-open-${p.product_id}`}>
                      <Text style={st.link}>{CS.openPost} ›</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : (
                <View style={st.unav}>
                  <Text style={bs.hint}>{p.gone_line}</Text>
                  {p.other_line ? (
                    <TouchableOpacity onPress={() => navigation.navigate('Post', { postId: p.other_posts[0] })} testID={`saved-others-${p.product_id}`}>
                      <Text style={st.link}>{CS.otherPosts(p.other_line)}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </View>
          </View>
        )) : <Text style={st.mut}>{CS.noSavedProducts}</Text>}
        {guest ? <Text style={[st.mut, { marginTop: 6 }]} testID="saved-guest">{CS.savedGuest}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  seg: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 12, padding: 3, marginHorizontal: 14, gap: 2 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 9 },
  segOn: { backgroundColor: '#fff' },
  segText: { fontFamily: fonts.sansBold, fontSize: 12, color: C.ink2 },
  mut: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: C.ink2 },
  link: { fontFamily: fonts.sansBold, fontSize: 12, color: C.ink, textDecorationLine: 'underline', marginTop: 2 },
  unav: { backgroundColor: C.surface, borderRadius: 12, padding: 9, gap: 4 },
});
