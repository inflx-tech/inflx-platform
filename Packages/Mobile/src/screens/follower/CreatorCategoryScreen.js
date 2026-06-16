import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { creatorVibe as C, fonts } from '../../theme/tokens';
import { ShelfProductCard, ShelfHeader } from '../../components/vibe';
import { emojiFor } from '../../components/vibe/palette';

/**
 * CreatorCategoryScreen — rebuilt to creator-category-comprehensive.html.
 * Contract: features/follower-creator-category-rebuild.
 *
 * The same creator drilled into ONE vertical: header "{Creator} · {Category}" +
 * curated-by line, sticky sub-type chips (product types within the vertical),
 * Partner Brands, a 2-col "{Creator}'s Picks in {Category}" grid, and a
 * "{Creator}'s Top in {Category} 🔥" rail. Runs on the creator's offers passed
 * from the Creator Store (filtered to the tapped vertical) — no new fetch.
 *
 * Route params: { influencer, offers, category, label }.
 * Every pick tap carries the creator's 4-ID tracking + store-context.
 */

const discountVal = (o) => Number(o?.discount_value ?? o?.discount?.value ?? 0) || 0;

export default function CreatorCategoryScreen({ route, navigation }) {
  const { influencer = {}, offers = [], category, label } = route.params || {};
  const [sub, setSub] = useState('all');

  const firstName = (influencer.name || influencer.instagram_handle || 'Creator').split(' ')[0];
  const catOffers = useMemo(() => (offers || []).filter(o => (o.brand_category || 'other') === category), [offers, category]);

  // distinct partner brands in this vertical
  const partners = useMemo(() => {
    const m = {};
    catOffers.forEach(o => { const id = o.brand_id; if (id && !m[id]) m[id] = { id, name: o.brand_name, category: o.brand_category }; });
    return Object.values(m);
  }, [catOffers]);

  // flatten offers → product picks (dedupe per product, best discount)
  const picks = useMemo(() => {
    const m = {};
    catOffers.forEach(o => {
      (o.products || []).forEach(p => {
        const pid = p.id || p.product_id; if (!pid) return;
        const dv = discountVal(o);
        if (!m[pid] || dv > m[pid].discount_value) {
          m[pid] = { product: p, brand: { id: o.brand_id, name: o.brand_name, category: o.brand_category, city: o.brand_city }, discount_value: dv, section: p.section || null, offer: o };
        }
      });
    });
    return Object.values(m);
  }, [catOffers]);

  // sub-type chips from product sections (e.g. Breads / Rice / Biryani)
  const subTypes = useMemo(() => {
    const seen = new Set(); const out = [];
    picks.forEach(p => { const sct = p.section; if (sct && !seen.has(sct)) { seen.add(sct); out.push(sct); } });
    return out;
  }, [picks]);

  const visiblePicks = useMemo(
    () => (sub === 'all' ? picks : picks.filter(p => p.section === sub)),
    [picks, sub]
  );
  const topPicks = useMemo(
    () => [...visiblePicks].filter(p => p.discount_value > 0).sort((a, b) => b.discount_value - a.discount_value).slice(0, 6),
    [visiblePicks]
  );

  const onPick = (pk) => {
    const o = pk.offer;
    const tracking = {
      campaign_id: o.campaign_id, set_id: o.set_id, offer_id: o.offer_id,
      campaign_influencer_id: o.campaign_influencer_id,
      influencer_id: influencer.id, influencer_handle: influencer.instagram_handle, influencer_name: influencer.name,
    };
    navigation.navigate('ProductDetail', {
      offer: { id: o.offer_id, offer_type: o.offer_type, discount_value: o.discount_value, availing_modes: o.availing_modes,
               campaign_id: o.campaign_id, set_id: o.set_id, campaign_influencer_id: o.campaign_influencer_id },
      brand: pk.brand,
      store: { instagram_handle: influencer.instagram_handle, name: influencer.name },
      influencer, selectedProductId: pk.product.id || pk.product.product_id, product: pk.product,
      tracking, trackingParams: tracking,
      via_store_influencer_id: influencer.id,
    });
  };

  const openBrand = (b) => navigation.navigate('BrandStore', { brandId: b.id, brandName: b.name });

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={s.header}>
        <TouchableOpacity style={s.ib} onPress={() => navigation.goBack()}><Text style={s.ibTxt}>←</Text></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{firstName} · {label}</Text>
          <Text style={s.sub} numberOfLines={1}>curated by @{influencer.instagram_handle || influencer.name}</Text>
        </View>
        <TouchableOpacity style={s.ib} onPress={() => navigation.navigate('Find')}><Text style={s.ibTxt}>🔍</Text></TouchableOpacity>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* sub-type chips */}
        {subTypes.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
            {['all', ...subTypes].map(k => (
              <TouchableOpacity key={k} style={[s.chip, sub === k && s.chipOn]} onPress={() => setSub(k)}>
                <Text style={[s.chipTxt, sub === k && s.chipTxtOn]}>{k === 'all' ? 'All' : k}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Partner brands */}
        {partners.length > 0 && (
          <View>
            <ShelfHeader title={`Partner ${label}`} sub={`brands @${influencer.instagram_handle || 'they'} collab with`} count={partners.length} tag="brands" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.partnerRow}>
              {partners.map(b => (
                <TouchableOpacity key={b.id} style={s.partner} onPress={() => openBrand(b)}>
                  <View style={s.partnerAv}><Text style={{ fontSize: 25 }}>{emojiFor(b.category)}</Text></View>
                  <Text style={s.partnerNm} numberOfLines={1}>{b.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Picks grid */}
        <ShelfHeader title={`${firstName}'s Picks in ${label}`} sub="everything they promote here" count={visiblePicks.length} tag="products" />
        {visiblePicks.length === 0 ? (
          <Text style={s.empty}>No picks in this category yet.</Text>
        ) : (
          <View style={s.grid}>
            {visiblePicks.map((pk, i) => (
              <ShelfProductCard
                key={`${pk.product.id || pk.product.product_id}_${i}`}
                product={pk.product}
                brand={pk.brand}
                discountValue={pk.discount_value || undefined}
                onPress={() => onPick(pk)}
              />
            ))}
          </View>
        )}

        {/* Top in {category} */}
        {topPicks.length > 1 && (
          <View>
            <ShelfHeader title={`${firstName}'s Top in ${label} 🔥`} sub="their best here" count={topPicks.length} tag="products" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
              {topPicks.map((pk, i) => (
                <ShelfProductCard
                  key={`top_${pk.product.id || pk.product.product_id}_${i}`}
                  product={pk.product}
                  brand={pk.brand}
                  discountValue={pk.discount_value || undefined}
                  rank={i + 1}
                  onPress={() => onPick(pk)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={s.note}><Text style={s.noteTxt}>🎬 {firstName}'s reels in {label} — coming with the Reels feature</Text></View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.screenBg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, backgroundColor: C.screenBg },
  ib: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  ibTxt: { fontSize: 15, color: C.ink },
  title: { fontFamily: fonts.serifDisplay, fontWeight: '600', fontSize: 18, color: C.ink, textAlign: 'center' },
  sub: { fontFamily: fonts.sansMedium, fontSize: 10, color: C.muted, marginTop: 2, textAlign: 'center' },
  chipRow: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  chipOn: { backgroundColor: C.brown, borderColor: C.brown },
  chipTxt: { fontSize: 11.5, fontWeight: '700', color: C.ink, fontFamily: fonts.sansBold },
  chipTxtOn: { color: C.onGold },
  partnerRow: { paddingHorizontal: 16, paddingBottom: 4, gap: 14 },
  partner: { width: 74, alignItems: 'center', gap: 6 },
  partnerAv: { width: 60, height: 60, borderRadius: 18, backgroundColor: C.soft, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  partnerNm: { fontSize: 10, fontWeight: '700', color: C.ink, textAlign: 'center', fontFamily: fonts.sansSemiBold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 16, gap: 12 },
  rail: { paddingHorizontal: 16, paddingBottom: 6, gap: 12 },
  empty: { fontFamily: fonts.sansMedium, fontSize: 12, color: C.muted, paddingHorizontal: 16 },
  note: { marginHorizontal: 16, marginTop: 14, backgroundColor: C.soft, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 11 },
  noteTxt: { fontSize: 11, fontWeight: '600', color: '#5e5345', fontFamily: fonts.sansMedium },
});
