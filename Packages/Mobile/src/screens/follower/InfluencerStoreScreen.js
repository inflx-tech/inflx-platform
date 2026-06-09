/**
 * InfluencerStoreScreen (Creator Store) — rebuilt to
 * design/wave4-creator-vibe/creator-store-comprehensive.html.
 * Contract: features/follower-creator-store-rebuild.
 *
 * One template, every creator. Layout:
 *   - top bar (← back · ↗ share)
 *   - profile hero: gradient-ring avatar · @handle ✓ · role · 3 counters
 *     (followers / collabs / picks) · Follow + Share · italic bio
 *   - "My Store Collabs" — the brands this creator partners with (circles)
 *   - sticky category tabs (the verticals they cover) → filter the picks
 *   - "What {creator} Promotes" — their live picks (vibe DealCard rail)
 *   - "Top Picks by {creator} 🔥" — best by discount, ranked
 *   - Reels note (coming with the Reels feature)
 *
 * Driven by followerApi.getStore(handle) → { influencer, offers }. Every pick tap
 * carries the creator's 4-ID tracking straight through to the purchase screen.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { creatorVibe as C, fonts } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { DealCard, ShelfProductCard, ShelfHeader, Gradient } from '../../components/vibe';
import { emojiFor } from '../../components/vibe/palette';

const CATEGORY_LABELS = {
  restaurant: 'Restaurants', bakery: 'Bakery', salon: 'Salon', car_rental: 'Car Rental',
  bike_rental: 'Bike Rental', fashion: 'Fashion', fashion_walkin: 'Fashion', fashion_online: 'Fashion',
  florist: 'Florists', packaged_food: 'Packaged food', electronics: 'Electronics', jewellery: 'Jewellery',
  footwear: 'Footwear', furniture: 'Furniture', function_hall: 'Function halls', wedding_planner: 'Wedding',
};
const labelFor = (k) => CATEGORY_LABELS[k] || (k ? String(k).replace(/_/g, ' ') : 'Other');
const discountVal = (o) => Number(o?.discount_value ?? o?.discount?.value ?? 0) || 0;

export default function InfluencerStoreScreen({ route, navigation }) {
  const { handle } = route.params || {};
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowing, setFollow] = useState(false);
  const [tab, setTab] = useState('all');

  const fetchStore = useCallback(async () => {
    try {
      const res = await followerApi.getStore(handle);
      const data = res.data || res;
      setStore(data);
      if (data?.is_following != null) setFollow(!!data.is_following);
    } catch (e) {
      console.warn('[CreatorStore] fetch failed', e?.message);
    }
  }, [handle]);

  useEffect(() => { setLoading(true); fetchStore().finally(() => setLoading(false)); }, [fetchStore]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchStore(); setRefreshing(false); }, [fetchStore]);

  const influencer = store?.influencer || {};
  const offers = store?.offers || [];

  const onFollow = useCallback(async () => {
    if (!influencer.id) return;
    try {
      if (isFollowing) { await followerApi.unfollow(influencer.id); setFollow(false); }
      else { await followerApi.follow(influencer.id); setFollow(true); }
    } catch {}
  }, [isFollowing, influencer.id]);

  // distinct partner brands (My Store Collabs)
  const collabs = useMemo(() => {
    const m = {};
    offers.forEach(o => {
      const id = o.brand_id; if (!id || m[id]) return;
      m[id] = { id, name: o.brand_name, category: o.brand_category };
    });
    return Object.values(m);
  }, [offers]);

  // category tabs (verticals this creator covers)
  const cats = useMemo(() => {
    const seen = new Set(); const out = [];
    offers.forEach(o => { const k = o.brand_category; if (k && !seen.has(k)) { seen.add(k); out.push(k); } });
    return out;
  }, [offers]);

  // Flatten each offer's products into individual PICK cards (the mockup's
  // "What Promotes" = product cards, not one card per offer). Dedupe by product,
  // keeping the best discount; carry the parent offer for discount + tracking.
  const picks = useMemo(() => {
    const m = {};
    offers.forEach(o => {
      (o.products || []).forEach(p => {
        const pid = p.id || p.product_id;
        if (!pid) return;
        const dv = discountVal(o);
        if (!m[pid] || dv > m[pid].discount_value) {
          m[pid] = {
            product: p,
            brand: { id: o.brand_id, name: o.brand_name, category: o.brand_category, city: o.brand_city },
            discount_value: dv,
            offer: o,
          };
        }
      });
    });
    return Object.values(m);
  }, [offers]);

  const visiblePicks = useMemo(
    () => (tab === 'all' ? picks : picks.filter(p => p.brand.category === tab)),
    [picks, tab]
  );
  const topPicks = useMemo(
    () => [...visiblePicks].filter(p => p.discount_value > 0).sort((a, b) => b.discount_value - a.discount_value).slice(0, 6),
    [visiblePicks]
  );

  const onPickPress = useCallback((pick) => {
    const o = pick.offer;
    const tracking = {
      campaign_id: o.campaign_id, set_id: o.set_id, offer_id: o.offer_id,
      campaign_influencer_id: o.campaign_influencer_id,
      influencer_id: influencer.id, influencer_handle: influencer.instagram_handle, influencer_name: influencer.name,
    };
    navigation.navigate('ProductDetail', {
      offer: { id: o.offer_id, offer_type: o.offer_type, discount_value: o.discount_value, availing_modes: o.availing_modes,
               campaign_id: o.campaign_id, set_id: o.set_id, campaign_influencer_id: o.campaign_influencer_id },
      brand: pick.brand,
      store: { instagram_handle: influencer.instagram_handle, name: influencer.name },
      influencer,
      selectedProductId: pick.product.id || pick.product.product_id,
      product: pick.product,
      tracking, trackingParams: tracking,
      // store-context: opened from inside THIS creator's store.
      via_store_influencer_id: influencer.id,
    });
  }, [navigation, influencer]);

  const pickCard = (pk, i) => (
    <ShelfProductCard
      key={`${pk.product.id || pk.product.product_id}_${i}`}
      product={pk.product}
      brand={pk.brand}
      discountValue={pk.discount_value || undefined}
      onPress={() => onPickPress(pk)}
    />
  );

  if (loading) {
    return <View style={[s.root, s.center]}><ActivityIndicator size="large" color={C.brown} /></View>;
  }

  const initial = (influencer.instagram_handle || influencer.name || '?').charAt(0).toUpperCase();
  const role = influencer.bio_role || (cats.length ? cats.slice(0, 2).map(labelFor).join(' & ') + ' Creator' : 'Creator');

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brown} />}
      >
        <SafeAreaView edges={['top']}>
          {/* top bar */}
          <View style={s.topbar}>
            <TouchableOpacity style={s.ib} onPress={() => navigation.goBack()}><Text style={s.ibTxt}>←</Text></TouchableOpacity>
            <TouchableOpacity style={s.ib}><Text style={s.ibTxt}>↗</Text></TouchableOpacity>
          </View>

          {/* profile hero */}
          <View style={s.prof}>
            <Gradient colors={['#FF6A5F', '#FFB24C']} direction="diagonal" style={s.ring}>
              <View style={s.avatar}>
                {influencer.profile_image_url || influencer.profile_pic_url
                  ? <Image source={{ uri: influencer.profile_image_url || influencer.profile_pic_url }} style={s.avatarImg} />
                  : <Text style={s.avatarTxt}>{initial}</Text>}
              </View>
            </Gradient>
            <View style={{ flex: 1 }}>
              <Text style={s.handle} numberOfLines={1}>@{influencer.instagram_handle || influencer.name} <Text style={s.tick}>✔</Text></Text>
              <Text style={s.role} numberOfLines={1}>{role}</Text>
              <View style={s.counters}>
                <Counter n={fmtCount(influencer.followers_count)} label="followers" />
                <Counter n={collabs.length} label="collabs" />
                <Counter n={offers.length} label="picks" />
              </View>
            </View>
          </View>

          <View style={s.pbtns}>
            <TouchableOpacity style={[s.btn, isFollowing && s.btnOut]} onPress={onFollow}>
              <Text style={[s.btnTxt, isFollowing && s.btnOutTxt]}>{isFollowing ? 'Following' : '+ Follow'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.btnOut]}><Text style={[s.btnTxt, s.btnOutTxt]}>↗ Share</Text></TouchableOpacity>
          </View>
          {influencer.bio ? <Text style={s.bio}>"{influencer.bio}"</Text> : null}
        </SafeAreaView>

        {/* My Store Collabs */}
        {collabs.length > 0 && (
          <View>
            <ShelfHeader title="My Store Collabs" sub="brands they partner with" count={collabs.length} tag="brands" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.collabRow}>
              {collabs.map(b => (
                <TouchableOpacity key={b.id} style={s.collab} activeOpacity={0.85}
                  onPress={() => navigation.navigate('BrandStore', { brandId: b.id, brandName: b.name })}>
                  <View style={s.collabAv}><Text style={s.collabEmoji}>{emojiFor(b.category)}</Text></View>
                  <Text style={s.collabNm} numberOfLines={1}>{b.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* category tabs */}
        {cats.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
            {['all', ...cats].map(k => (
              <TouchableOpacity
                key={k}
                style={[s.chip, tab === k && s.chipOn]}
                onPress={() => k === 'all'
                  ? setTab('all')
                  : navigation.navigate('CreatorCategory', { influencer, offers, category: k, label: labelFor(k) })}
              >
                <Text style={[s.chipTxt, tab === k && s.chipTxtOn]}>{k === 'all' ? 'All' : labelFor(k)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* What {creator} Promotes — individual product picks */}
        {visiblePicks.length > 0 ? (
          <View>
            <ShelfHeader title={`What @${influencer.instagram_handle || 'they'} Promotes`} sub="their live picks" count={visiblePicks.length} tag="products" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
              {visiblePicks.map((pk, i) => pickCard(pk, i))}
            </ScrollView>
          </View>
        ) : (
          <Text style={s.empty}>@{influencer.instagram_handle || influencer.name} hasn't published any picks yet.</Text>
        )}

        {/* Top Picks 🔥 — best by discount */}
        {topPicks.length > 1 && (
          <View>
            <ShelfHeader title={`Top Picks 🔥`} sub="their best deals" count={topPicks.length} tag="products" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
              {topPicks.map((pk, i) => pickCard(pk, i))}
            </ScrollView>
          </View>
        )}

        <View style={s.note}><Text style={s.noteTxt}>🎬 Reels — coming with the Reels feature</Text></View>
      </ScrollView>
    </View>
  );
}

function Counter({ n, label }) {
  return (
    <View style={s.counter}>
      <Text style={s.counterN}>{n}</Text>
      <Text style={s.counterL}>{label}</Text>
    </View>
  );
}

function fmtCount(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.screenBg },
  center: { alignItems: 'center', justifyContent: 'center' },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 2 },
  ib: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  ibTxt: { fontSize: 16, color: C.ink },
  prof: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingTop: 10 },
  ring: { padding: 3, borderRadius: 44 },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#ecdfc9', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 3, borderColor: C.screenBg },
  avatarImg: { width: '100%', height: '100%' },
  avatarTxt: { fontFamily: fonts.displayBold, fontSize: 30, color: C.brown },
  handle: { fontSize: 18, fontWeight: '800', color: C.ink, fontFamily: fonts.displayBold },
  tick: { color: C.verify, fontSize: 13 },
  role: { fontSize: 11, color: C.muted, fontWeight: '600', marginTop: 2, fontFamily: fonts.sansMedium },
  counters: { flexDirection: 'row', gap: 16, marginTop: 8 },
  counter: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  counterN: { fontSize: 14, fontWeight: '800', color: C.ink, fontFamily: fonts.displayBold },
  counterL: { fontSize: 10, color: C.muted, fontWeight: '600', fontFamily: fonts.sansMedium },
  pbtns: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingTop: 14 },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 30, backgroundColor: C.brown },
  btnOut: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.brown },
  btnTxt: { fontSize: 13, fontWeight: '800', color: '#fff', fontFamily: fonts.sansBold },
  btnOutTxt: { color: C.brown },
  bio: { fontStyle: 'italic', fontSize: 12.5, color: '#5e4a37', fontWeight: '500', paddingHorizontal: 18, paddingTop: 12, lineHeight: 18, fontFamily: fonts.sansMedium },
  collabRow: { paddingHorizontal: 16, paddingBottom: 4, gap: 14 },
  collab: { width: 72, alignItems: 'center', gap: 6 },
  collabAv: { width: 58, height: 58, borderRadius: 18, backgroundColor: C.soft, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  collabEmoji: { fontSize: 25 },
  collabNm: { fontSize: 10, fontWeight: '700', color: C.ink, textAlign: 'center', fontFamily: fonts.sansSemiBold },
  tabRow: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  chipOn: { backgroundColor: C.brown, borderColor: C.brown },
  chipTxt: { fontSize: 11.5, fontWeight: '700', color: C.ink, fontFamily: fonts.sansBold },
  chipTxtOn: { color: '#fff' },
  rail: { paddingHorizontal: 16, paddingBottom: 6, gap: 12 },
  empty: { paddingHorizontal: 18, paddingTop: 14, fontSize: 12, color: C.muted, fontFamily: fonts.sansMedium },
  note: { marginHorizontal: 16, marginTop: 14, backgroundColor: C.soft, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 11 },
  noteTxt: { fontSize: 11, fontWeight: '600', color: '#5e5345', fontFamily: fonts.sansMedium },
});
