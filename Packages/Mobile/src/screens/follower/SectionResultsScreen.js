import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, StyleSheet,
} from 'react-native';
import { creatorVibe as C, fonts, fmtMoney } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { DealCard, ShelfBrandListRow } from '../../components/vibe';
import { goToProduct, goToOffer, goToBrand } from '../../components/SectionRenderer';

/**
 * SectionResultsScreen — the shared "View all" full list for one shelf's rule
 * (contract: merch-engine-results-view-all). Re-runs the shelf's rule on the
 * backend with the SAME surface context (creator/category/brand/city) but a larger
 * limit, and renders the full set: 2-column grid for products, a list for
 * offers/brands/creators. Also the Phase-6 banner-gateway / hero-tile target.
 * v1 = capped list (≤100); palette is the current vibe kit (gold/cream re-skin = Phase 5).
 */

export default function SectionResultsScreen({ navigation, route }) {
  const p = route.params || {};
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [capped, setCapped] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await followerApi.getSectionResults({
        rule: p.rule, item_type: p.item_type, library_section_id: p.library_section_id,
        rule_json: p.rule_json,
        category_key: p.category_key, creator_handle: p.creator_handle, brand_id: p.brand_id,
        lat: p.lat, lng: p.lng, limit: 100,
      });
      const d = res.data || res;
      setItems(Array.isArray(d.items) ? d.items : []);
      setCapped(!!d.capped);
    } catch (e) {
      console.error('[SectionResults] load error:', e.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [p.rule, p.library_section_id, p.category_key, p.creator_handle, p.brand_id]);

  useEffect(() => { load(); }, [load]);

  const type = p.item_type;
  const isProducts = type === 'products';

  function renderProduct({ item }) {
    return (
      <TouchableOpacity style={s.pcard} activeOpacity={0.85} onPress={() => goToProduct(navigation, item)}>
        <View style={s.pthumb}>
          {item.image_url
            ? <Image source={{ uri: item.image_url }} style={s.pimg} resizeMode="cover" />
            : <Text style={{ fontSize: 30 }}>🛍️</Text>}
          {item.discount_value ? <View style={s.badge}><Text style={s.badgeTxt}>{item.discount_value}% OFF</Text></View> : null}
        </View>
        <Text style={s.pname} numberOfLines={2}>{item.name}</Text>
        <Text style={s.pbrand} numberOfLines={1}>{item.brand?.name || ''}</Text>
        <Text style={s.pprice}>{fmtMoney(item.price)}</Text>
      </TouchableOpacity>
    );
  }

  function renderRow({ item }) {
    if (type === 'brands') {
      return <ShelfBrandListRow brand={item} distanceKm={item.distance_km} onPress={() => goToBrand(navigation, item)} />;
    }
    if (type === 'creators') {
      return (
        <TouchableOpacity style={s.crow} activeOpacity={0.85} onPress={() => navigation.navigate('InfluencerStore', { handle: item.handle })}>
          <View style={s.cavatar}>{item.avatar ? <Image source={{ uri: item.avatar }} style={s.cavatarImg} /> : <Text style={{ fontSize: 20 }}>🧑</Text>}</View>
          <View style={{ flex: 1 }}>
            <Text style={s.cname}>{item.name || `@${item.handle}`}</Text>
            <Text style={s.chandle}>@{item.handle}{item.followers_count ? ` · ${item.followers_count} followers` : ''}</Text>
          </View>
          {item.has_live_deal ? <View style={s.live}><Text style={s.liveTxt}>LIVE</Text></View> : null}
        </TouchableOpacity>
      );
    }
    // offers / mixed
    return (
      <View style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
        <DealCard offer={item} title={item.brand?.name} brand={String(item.brand?.category || '').replace(/_/g, ' ')}
          category={item.brand?.category} creator={item.via_creator} onPress={() => goToOffer(navigation, item)} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}><Text style={{ fontSize: 16, color: C.ink }}>←</Text></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{p.title || 'Results'}</Text>
          {!loading ? <Text style={s.sub}>{items.length}{capped ? '+' : ''} {isProducts ? 'products' : 'results'}{p.creator_handle ? ` · @${p.creator_handle}` : ''}</Text> : null}
        </View>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.brown} /></View>
      ) : items.length === 0 ? (
        <View style={s.center}><Text style={s.empty}>Nothing here yet.</Text></View>
      ) : isProducts ? (
        <FlatList
          data={items}
          keyExtractor={(it, i) => String(it.id || i)}
          renderItem={renderProduct}
          numColumns={2}
          columnWrapperStyle={s.col}
          contentContainerStyle={s.gridPad}
          ListFooterComponent={capped ? <Text style={s.cap}>Showing the first 100</Text> : null}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it, i) => String(it.id || i)}
          renderItem={renderRow}
          contentContainerStyle={{ paddingVertical: 8 }}
          ListFooterComponent={capped ? <Text style={s.cap}>Showing the first 100</Text> : null}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.screenBg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  empty: { fontSize: 13, color: C.muted, fontFamily: fonts.sansRegular },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 11, paddingTop: 50, paddingBottom: 12,
    paddingHorizontal: 16, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.line,
  },
  back: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },
  title: { fontSize: 16, fontWeight: '900', color: C.ink, fontFamily: fonts.serifDisplay },
  sub: { fontSize: 11, color: C.muted, marginTop: 2, fontFamily: fonts.sansRegular },
  gridPad: { padding: 12, paddingBottom: 40 },
  col: { gap: 10 },
  pcard: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 8, marginBottom: 10, backgroundColor: C.card, maxWidth: '48.5%' },
  pthumb: { height: 110, borderRadius: 8, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 7, position: 'relative' },
  pimg: { width: '100%', height: '100%' },
  badge: { position: 'absolute', top: 6, left: 6, backgroundColor: C.offer, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  badgeTxt: { fontSize: 8, fontWeight: '900', color: '#fff', fontFamily: fonts.monoBold },
  pname: { fontSize: 12, fontWeight: '700', color: C.ink, fontFamily: fonts.sansBold },
  pbrand: { fontSize: 10.5, color: C.muted, marginTop: 1, fontFamily: fonts.sansRegular },
  pprice: { fontSize: 13, fontWeight: '900', color: C.ink, marginTop: 3, fontFamily: fonts.monoBold },
  crow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  cavatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cavatarImg: { width: 44, height: 44 },
  cname: { fontSize: 13, fontWeight: '800', color: C.ink, fontFamily: fonts.sansBold },
  chandle: { fontSize: 11, color: C.muted, marginTop: 1, fontFamily: fonts.sansRegular },
  live: { backgroundColor: C.offer, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  liveTxt: { fontSize: 8, fontWeight: '900', color: '#fff', fontFamily: fonts.monoBold },
  cap: { fontSize: 11, color: C.muted, textAlign: 'center', paddingVertical: 14, fontFamily: fonts.sansRegular },
});
