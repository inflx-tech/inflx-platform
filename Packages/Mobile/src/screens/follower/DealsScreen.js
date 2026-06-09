import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator,
} from 'react-native';
import { creatorVibe as C, fonts } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { DealCard, ShelfHeader, Gradient } from '../../components/vibe';
import { emojiFor } from '../../components/vibe/palette';

/**
 * DealsScreen (Offers tab) — rebuilt to design/wave4-creator-vibe/offers-comprehensive.html.
 * Contract: features/follower-offers-screen-rebuild.
 *
 * One screen, three behaviours over the live offers data
 * (GET /v1/follower/section/offers, already powered by brandOffers.adapter):
 *   • All + a non-creator sort  → hero "Today's Best Deal" + per-super-category rails
 *   • a super-category chip      → filtered 2-col grid, sorted
 *   • "By Creator" sort          → offers grouped under each backing creator
 *
 * Every card carries its 4-ID tracking (item.tracking) straight through on tap.
 * Pure-JS / OTA-safe (vibe kit gradients). Degrades to an empty state, never throws.
 */

// super-category chips (mockup: All · Eat · Shop · Groom · Travel)
const SUPERCATS = [
  { key: 'all',    label: 'All',    icon: '' },
  { key: 'eat',    label: 'Eat',    icon: '🍽️' },
  { key: 'shop',   label: 'Shop',   icon: '🛍️' },
  { key: 'groom',  label: 'Groom',  icon: '✨' },
  { key: 'travel', label: 'Travel', icon: '✈️' },
];

const SORTS = [
  { key: 'discount', label: 'Best Discount' },
  { key: 'ending',   label: 'Ending Soon' },
  { key: 'creator',  label: 'By Creator' },
];

// brand.category → super-category bucket (mirrors backend CATEGORY_MAP groupings)
const CAT_MAP = {
  eat:    ['restaurant', 'bakery', 'grocery', 'packaged_food', 'meals'],
  shop:   ['fashion', 'fashion_walkin', 'fashion_online', 'florist', 'flowers_gifting',
           'electronics', 'jewellery', 'footwear', 'furniture'],
  groom:  ['salon'],
  travel: ['car_rental', 'bike_rental'],
};
function superCatOf(category) {
  const c = String(category || '').toLowerCase();
  for (const key of Object.keys(CAT_MAP)) if (CAT_MAP[key].includes(c)) return key;
  return null;
}
function superCatLabel(key) {
  return (SUPERCATS.find(s => s.key === key) || {}).label || 'More';
}

const discountVal = (o) => Number(o?.discount_value ?? o?.discount?.value ?? 0) || 0;

export default function DealsScreen({ navigation }) {
  const [sections, setSections] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chip, setChip] = useState('all');
  const [sort, setSort] = useState('discount');

  const load = useCallback(async () => {
    try {
      const r = await followerApi.getOffersSections();
      setSections(r?.data?.sections || r?.sections || []);
    } catch (e) {
      console.error('[DealsScreen] load error:', e.message);
      setSections([]);
    }
  }, []);

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  // Flatten every offer item across the offer shelves into one deduped list.
  const offers = useMemo(() => {
    const out = [];
    const seen = new Set();
    (sections || []).forEach(sec => {
      if (!['offers', 'mixed'].includes(sec.type) || !Array.isArray(sec.items)) return;
      sec.items.forEach(it => {
        const id = `${it.source || ''}:${it.id}`;
        if (it.id && !seen.has(id)) { seen.add(id); out.push(it); }
      });
    });
    return out;
  }, [sections]);

  const areaName = offers[0]?.brand?.city || null;

  const sortFn = useCallback((a, b) => {
    if (sort === 'ending') {
      const ea = a.offer_expires_at ? new Date(a.offer_expires_at).getTime() : Infinity;
      const eb = b.offer_expires_at ? new Date(b.offer_expires_at).getTime() : Infinity;
      return ea - eb;
    }
    return discountVal(b) - discountVal(a); // default: biggest discount
  }, [sort]);

  const goToOffer = useCallback((item) => {
    navigation.navigate('ProductDetail', {
      offer: {
        id: item.tracking?.oid || item.id,
        offer_type: item.offer_type,
        discount_value: item.discount_value,
        availing_modes: item.availing_modes,
      },
      brand: item.brand
        ? { id: item.brand.id, name: item.brand.name, category: item.brand.category, locality: item.brand.city }
        : null,
      store: item.via_creator ? { instagram_handle: item.via_creator.handle, name: item.via_creator.name } : null,
      influencer: item.via_creator || null,
      tracking: item.tracking || null,
      trackingParams: item.tracking || null,
    });
  }, [navigation]);

  const dealCard = (item, i) => (
    <DealCard
      key={`${item.id}_${i}`}
      offer={item}
      title={item.brand?.name}
      brand={String(item.brand?.category || '').replace(/_/g, ' ')}
      category={item.brand?.category}
      creator={item.via_creator}
      onPress={() => goToOffer(item)}
    />
  );

  // ── body builders ───────────────────────────────────────────────────────────
  const renderAll = () => {
    const sorted = [...offers].sort(sortFn);
    const hero = sorted[0];
    // group into super-category rails (in SUPERCATS order, skipping 'all')
    const byCat = {};
    sorted.forEach(o => { const k = superCatOf(o.brand?.category) || 'more'; (byCat[k] = byCat[k] || []).push(o); });
    const railKeys = SUPERCATS.filter(s => s.key !== 'all' && byCat[s.key]?.length).map(s => s.key)
      .concat(byCat.more?.length ? ['more'] : []);
    return (
      <>
        {hero ? (
          <View style={s.heroWrap}>
            <TouchableOpacity activeOpacity={0.92} onPress={() => goToOffer(hero)}>
              <Gradient colors={['#8a4f2d', '#6e3a24']} direction="diagonal" style={s.hero}>
                <Text style={s.heroLbl}>⚡ TODAY'S BEST DEAL</Text>
                <Text style={s.heroTitle} numberOfLines={2}>{hero.brand?.name || 'Top deal'}</Text>
                <Text style={s.heroVia}>
                  {hero.via_creator ? `via @${hero.via_creator.handle} · ` : ''}
                  {discountVal(hero) > 0 ? `${Math.round(discountVal(hero))}% off` : 'Tap to view'}
                </Text>
                <Text style={s.heroEmoji}>{emojiFor(hero.brand?.category)}</Text>
                <View style={s.heroGrab}><Text style={s.heroGrabTxt}>Grab →</Text></View>
              </Gradient>
            </TouchableOpacity>
          </View>
        ) : null}
        {railKeys.map(k => (
          <View key={k}>
            <ShelfHeader title={`${superCatLabel(k)} Offers`} sub="top deals" count={byCat[k].length} tag="offers" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
              {byCat[k].map((o, i) => dealCard(o, i))}
            </ScrollView>
          </View>
        ))}
      </>
    );
  };

  const renderGrid = () => {
    const filtered = offers.filter(o => superCatOf(o.brand?.category) === chip).sort(sortFn);
    if (!filtered.length) return <Empty />;
    return (
      <View>
        <ShelfHeader title={`${superCatLabel(chip)} Offers`} sub={`sorted by ${sort === 'ending' ? 'ending soon' : 'biggest discount'}`} count={filtered.length} tag="offers" />
        <View style={s.grid}>
          {filtered.map((o, i) => dealCard(o, i))}
        </View>
      </View>
    );
  };

  const renderByCreator = () => {
    const scoped = chip === 'all' ? offers : offers.filter(o => superCatOf(o.brand?.category) === chip);
    const groups = {};
    scoped.forEach(o => {
      if (!o.via_creator?.id) return; // store-direct deals have no creator → omitted from this view
      const g = groups[o.via_creator.id] || (groups[o.via_creator.id] = { creator: o.via_creator, items: [] });
      g.items.push(o);
    });
    const list = Object.values(groups).sort((a, b) => b.items.length - a.items.length);
    if (!list.length) return <Empty text="No creator-backed deals here yet." />;
    return (
      <>
        {list.map(g => (
          <View key={g.creator.id}>
            <TouchableOpacity
              style={s.cgrp} activeOpacity={0.85}
              onPress={() => navigation.navigate('InfluencerStore', { handle: g.creator.handle })}
            >
              <View style={s.ring}>
                <View style={s.avatar}><Text style={s.avatarTxt}>{g.creator.handle ? g.creator.handle[0].toUpperCase() : '★'}</Text></View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cName}>@{g.creator.handle}</Text>
                <Text style={s.cMeta}>{g.items.length} live deal{g.items.length > 1 ? 's' : ''}</Text>
              </View>
              <Text style={s.cView}>View →</Text>
            </TouchableOpacity>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
              {g.items.sort(sortFn).map((o, i) => dealCard(o, i))}
            </ScrollView>
          </View>
        ))}
      </>
    );
  };

  const body = () => {
    if (!offers.length) return <Empty />;
    if (sort === 'creator') return renderByCreator();
    if (chip !== 'all') return renderGrid();
    return renderAll();
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Offers</Text>
          <Text style={s.subtitle}>📍 best deals{areaName ? ` in ${areaName}` : ' near you'}</Text>
        </View>
        <TouchableOpacity style={s.searchBtn} onPress={() => navigation.navigate('Find')}>
          <Text style={{ fontSize: 15 }}>🔍</Text>
        </TouchableOpacity>
      </View>

      {/* sticky super-category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
        {SUPERCATS.map(sc => (
          <TouchableOpacity key={sc.key} style={[s.chip, chip === sc.key && s.chipOn]} onPress={() => setChip(sc.key)}>
            <Text style={[s.chipTxt, chip === sc.key && s.chipTxtOn]}>{sc.icon ? `${sc.icon} ` : ''}{sc.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* sort / filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow}>
        {SORTS.map(so => (
          <TouchableOpacity key={so.key} style={[s.pill, sort === so.key && s.pillOn]} onPress={() => setSort(so.key)}>
            <Text style={[s.pillTxt, sort === so.key && s.pillTxtOn]}>{so.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.brown} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brown} />}
        >
          {body()}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  );
}

function Empty({ text }) {
  return (
    <View style={s.empty}>
      <Text style={{ fontSize: 40, marginBottom: 10 }}>🏷️</Text>
      <Text style={s.emptyTitle}>No deals here yet</Text>
      <Text style={s.emptyText}>{text || 'Pull to refresh or try another filter.'}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.screenBg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 50, paddingBottom: 6, backgroundColor: C.screenBg,
  },
  title: { fontSize: 22, fontWeight: '600', color: C.ink, fontFamily: fonts.serifDisplay },
  subtitle: { fontSize: 11, color: C.muted, fontWeight: '600', marginTop: 2, fontFamily: fonts.sansMedium },
  searchBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: C.card,
    borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center',
  },
  chipRow: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginRight: 8,
    borderWidth: 1, borderColor: C.line, backgroundColor: C.card,
  },
  chipOn: { backgroundColor: C.brown, borderColor: C.brown },
  chipTxt: { fontSize: 12, fontWeight: '700', color: C.ink, fontFamily: fonts.sansBold },
  chipTxtOn: { color: '#fff' },
  pillRow: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 7 },
  pill: {
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, marginRight: 7,
    borderWidth: 1, borderColor: C.line, backgroundColor: C.card,
  },
  pillOn: { backgroundColor: C.brown, borderColor: C.brown },
  pillTxt: { fontSize: 11, fontWeight: '700', color: C.muted, fontFamily: fonts.sansSemiBold },
  pillTxtOn: { color: '#fff' },
  rail: { paddingHorizontal: 16, paddingBottom: 6, gap: 12 },
  heroWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 2 },
  hero: { borderRadius: 20, padding: 16, minHeight: 110, justifyContent: 'center', overflow: 'hidden' },
  heroLbl: { fontSize: 9.5, fontWeight: '800', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.6, fontFamily: fonts.sansBold },
  heroTitle: { fontSize: 22, fontWeight: '600', color: '#fff', marginTop: 6, maxWidth: 210, fontFamily: fonts.serifDisplay },
  heroVia: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.92)', marginTop: 8, fontFamily: fonts.sansSemiBold },
  heroEmoji: { position: 'absolute', right: -4, top: -6, fontSize: 78, opacity: 0.16 },
  heroGrab: { position: 'absolute', right: 16, bottom: 16, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  heroGrabTxt: { color: C.brown, fontSize: 11.5, fontWeight: '800', fontFamily: fonts.sansBold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10 },
  gridCell: { width: '47%' },
  cgrp: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  ring: { padding: 2, borderRadius: 26, backgroundColor: C.brown },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#ecdfc9', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.screenBg },
  avatarTxt: { fontSize: 18, fontWeight: '800', color: C.brown, fontFamily: fonts.sansBold },
  cName: { fontSize: 13.5, fontWeight: '800', color: C.ink, fontFamily: fonts.displayBold },
  cMeta: { fontSize: 10, color: C.muted, fontWeight: '600', marginTop: 1, fontFamily: fonts.sansMedium },
  cView: { fontSize: 11, fontWeight: '800', color: C.brown, fontFamily: fonts.sansBold },
  empty: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.ink, marginBottom: 4 },
  emptyText: { fontSize: 12, color: C.muted, textAlign: 'center' },
});
