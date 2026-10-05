/**
 * F8 A collection, opened — its name and its posts (as tiles) or products (as rows).
 * Contract: features/follower-app-v2 · board F8 · rules v1.7 §4.11, M6
 *
 * Each product shows its own offer. The ♡ keeps the product with this collection; to buy one she
 * opens it from a creator's post. Also where a collection link lands.
 *
 * shopper-app-fixes:
 *   F14 A signed-in shopper's hearts come from the server's `saved` flag on each product (she never
 *       saw them: only a guest's, kept on the phone, were read). What she hearts here this session
 *       is remembered too.
 *   N8  The line "each product sells like a one-product post" is gone: it sat directly above the
 *       true one, "To buy one, open it from a creator's post".
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { followerApi } from '../../services/api';
import { CS, inr } from '../../components/shop/copyShop';
import { TopBar, TileGrid, Loading, Empty, C, s as bs } from '../../components/shop/bitsShop';
import { useShopNav } from '../../components/shop/useShopNav';
import { shopStore, isSignedIn, toggleSaveProductLocal } from '../../components/shop/shopStore';
import { engaged } from '../../components/shop/engaged';
import { fonts } from '../../theme/tokens';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function CollectionScreen({ navigation, route }) {
  const { id } = route.params || {};
  const nav = useShopNav(navigation);
  const [c, setC] = useState(null);
  const [status, setStatus] = useState('loading');
  const [hearts, setHearts] = useState({});
  const [gone, setGone] = useState(null);       // S5: the server's own sentence when it is no longer there
  const [again, setAgain] = useState(0);

  useEffect(() => {
    (async () => {
      const res = await followerApi.collection(id);
      if (!res || !res.success) {
        setGone(res && res.error && res.error.code === 'NOT_FOUND' && res.error.message ? res.error.message : null);
        setStatus('error');
        return;
      }
      setC(res.data); setStatus('ready');
      const on = {};
      if (await isSignedIn()) {
        // F14: her account's hearts arrive on the products themselves.
        for (const p of res.data.products || []) if (p.saved) on[p.collection_item_id] = true;
      } else {
        const st = await shopStore.get();
        for (const x of st.savedProducts) if (x.collection_item_id) on[x.collection_item_id] = true;
      }
      // …and what she hearted (or took off) since the app opened is the newer word.
      for (const p of res.data.products || []) on[p.collection_item_id] = engaged.heartedInCollection(p.collection_item_id, p.id, on[p.collection_item_id]);
      setHearts(on);
    })();
  }, [id, again]);

  async function heart(p) {
    const on = !hearts[p.collection_item_id];
    setHearts((h) => ({ ...h, [p.collection_item_id]: on }));
    if (await isSignedIn()) {
      const r = on ? await followerApi.saveProduct({ product_id: p.id, collection_item_id: p.collection_item_id }) : await followerApi.unsaveProduct(p.id);
      if (!r || !r.success) { setHearts((h) => ({ ...h, [p.collection_item_id]: !on })); return; }
    } else {
      await toggleSaveProductLocal({ product_id: p.id, collection_item_id: p.collection_item_id }, on);
    }
    engaged.setHeart(p.id, on, { collection_item_id: p.collection_item_id });
  }

  if (status === 'loading') return <SafeAreaView style={st.safe}><TopBar onBack={() => navigation.goBack()} /><Loading /></SafeAreaView>;
  if (status === 'error') {
    return (
      <SafeAreaView style={st.safe}>
        <TopBar onBack={() => navigation.goBack()} />
        {gone ? <Empty title={gone} testID="collection-gone" />
          : <Empty title={CS.loadError} action={CS.retry} onAction={() => { setStatus('loading'); setAgain((n) => n + 1); }} testID="collection-failed" />}
      </SafeAreaView>
    );
  }

  const first = c.creator ? c.creator.name.split(' ')[0] : '';
  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <TopBar title={c.creator ? c.creator.name : ''} onBack={() => navigation.goBack()} onSearch={() => navigation.navigate('Search')} />
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 30 }}>
        <Text style={st.h} testID="collection-title">{c.line}</Text>
        {c.hidden ? (
          <Empty title={CS.collectionHidden} action={c.creator ? `See ${first}'s store` : null} onAction={() => navigation.replace('CreatorStore', { id: c.creator.id })} testID="collection-hidden" />
        ) : c.kind === 'posts' ? (
          <TileGrid posts={c.posts || []} onOpen={nav.openPost} testIDPrefix="collection-tile" />
        ) : (
          <View>
            {(c.products || []).map((p) => (
              <View key={p.collection_item_id} style={bs.pline} testID={`collection-product-${p.id}`}>
                {p.image_url ? <Image source={{ uri: p.image_url }} style={bs.pthumb} /> : <View style={bs.pthumb} />}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={bs.pname} numberOfLines={2}>{p.name}</Text>
                  <Text style={bs.pprice}>
                    <Text style={{ fontFamily: fonts.sansBold, color: C.ink }}>{inr(p.shopper_price)}</Text>
                    {p.struck ? <Text style={bs.struck}>  {inr(p.price)}</Text> : null}
                    {p.offer ? <Text> · {p.offer.line ? p.offer.line.replace(' applied', '') : ''}</Text> : null}
                  </Text>
                  <Text style={bs.hint}>{p.brand ? p.brand.name : ''}</Text>
                </View>
                <TouchableOpacity onPress={() => heart(p)} style={bs.heartBtn} testID={`collection-heart-${p.id}`} accessibilityState={{ selected: !!hearts[p.collection_item_id] }}>
                  <Icon name={hearts[p.collection_item_id] ? 'heart' : 'heart-outline'} size={22} color={hearts[p.collection_item_id] ? '#C42B2B' : C.ink} />
                </TouchableOpacity>
              </View>
            ))}
            <View style={[bs.soon, { marginTop: 10 }]}><Text style={bs.soonText} testID="collection-how-to-buy">{CS.checkoutSoon}</Text></View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  h: { fontFamily: fonts.sansBold, fontSize: 15, color: C.ink },
});
