/**
 * F8 A collection, opened — its name and its posts (as tiles) or products (as rows).
 * Contract: features/follower-app-v2 · board F8 · rules v1.7 §4.11, M6
 *
 * Each product sells like a one-product post: its own offer applies and the creator earns her
 * commission. The ♡ keeps the product with this collection. Also where a collection link lands.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { followerApi } from '../../services/api';
import { CS, inr } from '../../components/shop/copyShop';
import { TopBar, TileGrid, Loading, Empty, C, s as bs } from '../../components/shop/bitsShop';
import { useShopNav } from '../../components/shop/useShopNav';
import { shopStore, isSignedIn, toggleSaveProductLocal } from '../../components/shop/shopStore';
import { fonts } from '../../theme/tokens';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function CollectionScreen({ navigation, route }) {
  const { id } = route.params || {};
  const nav = useShopNav(navigation);
  const [c, setC] = useState(null);
  const [status, setStatus] = useState('loading');
  const [hearts, setHearts] = useState({});

  useEffect(() => {
    (async () => {
      const res = await followerApi.collection(id);
      if (!res || !res.success) { setStatus('error'); return; }
      setC(res.data); setStatus('ready');
      if (!(await isSignedIn())) {
        const st = await shopStore.get();
        const on = {};
        for (const x of st.savedProducts) if (x.collection_item_id) on[x.collection_item_id] = true;
        setHearts(on);
      }
    })();
  }, [id]);

  async function heart(p) {
    const on = !hearts[p.collection_item_id];
    setHearts((h) => ({ ...h, [p.collection_item_id]: on }));
    if (await isSignedIn()) {
      const r = on ? await followerApi.saveProduct({ product_id: p.id, collection_item_id: p.collection_item_id }) : await followerApi.unsaveProduct(p.id);
      if (!r || !r.success) setHearts((h) => ({ ...h, [p.collection_item_id]: !on }));
    } else {
      await toggleSaveProductLocal({ product_id: p.id, collection_item_id: p.collection_item_id }, on);
    }
  }

  if (status === 'loading') return <SafeAreaView style={st.safe}><TopBar onBack={() => navigation.goBack()} /><Loading /></SafeAreaView>;
  if (status === 'error') return <SafeAreaView style={st.safe}><TopBar onBack={() => navigation.goBack()} /><Empty title={CS.loadError} /></SafeAreaView>;

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
            <Text style={[bs.hint, { marginTop: 10 }]}>{CS.collectionFoot(first)}</Text>
            <View style={[bs.soon, { marginTop: 8 }]}><Text style={bs.soonText}>{CS.checkoutSoon}</Text></View>
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
