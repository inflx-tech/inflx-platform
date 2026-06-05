import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { creatorVibe as C, fonts, getBusinessAccentLight } from '../../theme/tokens';
import { isEnabled } from '../../config/featureFlags';
import SectionRenderer, { hasEngineContent } from '../../components/SectionRenderer';
import { followerApi } from '../../services/api';

/**
 * CreatorCategoryScreen — Flow 52.7 (mockup screen 4a).
 *
 * Creator-SCOPED category view: tapping a category inside a creator's store
 * lands here, showing ONLY what that creator promotes in that category —
 * their partner businesses + their picks. Distinct from the global
 * CategoryListScreen (everyone's stores).
 *
 * Runs entirely on data the Creator Store (`getStore`) already returns: the
 * influencer + their offers. We receive them via route params and filter to
 * the tapped category client-side — NO new endpoint, NO backend change.
 *
 * Route params: { influencer, offers, category, label }
 *   - influencer : the creator object from getStore
 *   - offers     : the creator's full offer list (filtered here by category)
 *   - category   : raw brand_category key (e.g. 'restaurant', 'fashion')
 *   - label      : display label (e.g. 'Restaurants')
 *
 * Offer dispatch + 4-ID tracking mirror InfluencerStoreScreen.onPickPress so
 * commission attribution is identical.
 */

export default function CreatorCategoryScreen({ route, navigation }) {
  const { influencer = {}, offers = [], category, label } = route.params || {};

  const catOffers = (offers || []).filter(o => (o.brand_category || 'other') === category);

  // Section engine (Phase C2): when on, render shelves from the backend instead
  // of the param-filtered offers. Inert + fallback to the param body on
  // error/empty. Default off → existing behavior.
  const [sections, setSections] = useState(null);
  useEffect(() => {
    if (!isEnabled('SECTION_ENGINE_CREATOR')) return;
    const handle = influencer.instagram_handle;
    if (!handle || !category) return;
    let alive = true;
    followerApi.getCreatorCategorySections(handle, category)
      .then(r => { if (alive) setSections(r?.data?.sections || []); })
      .catch(() => { if (alive) setSections(null); });
    return () => { alive = false; };
  }, [influencer.instagram_handle, category]);
  const sectionsActive = isEnabled('SECTION_ENGINE_CREATOR') && hasEngineContent(sections);

  // Distinct partner businesses the creator promotes in this category.
  const brandsMap = {};
  for (const o of catOffers) {
    const id = o.brand_id || o.brand_name;
    if (id && !brandsMap[id]) {
      brandsMap[id] = { id: o.brand_id, name: o.brand_name, city: o.brand_city, category: o.brand_category };
    }
  }
  const partners = Object.values(brandsMap);

  const accent = getBusinessAccentLight(category);
  const firstName = (influencer.name || influencer.instagram_handle || 'Creator').split(' ')[0];

  function trackingFor(offer) {
    return {
      campaign_id: offer.campaign_id,
      set_id: offer.set_id,
      offer_id: offer.offer_id,
      campaign_influencer_id: offer.campaign_influencer_id,
      influencer_id: influencer.id,
      influencer_handle: influencer.instagram_handle,
      influencer_name: influencer.name,
    };
  }

  // Route by primary availing mode — identical dispatch to the Creator Store.
  function dispatchOffer(offer) {
    const params = {
      offer: { id: offer.offer_id, offer_type: offer.offer_type, discount_value: offer.discount_value, availing_modes: offer.availing_modes },
      brand: { id: offer.brand_id, name: offer.brand_name, category: offer.brand_category, city: offer.brand_city },
      tracking: trackingFor(offer),
      influencer,
    };
    const primary = (offer.availing_modes || [])[0];
    if (primary === 'pay_at_store')    navigation.navigate('PayAtStore', params);
    else if (primary === 'prebook')    navigation.navigate('PreBook', params);
    else if (primary === 'enquiry')    navigation.navigate('Enquiry', params);
    else navigation.navigate('BrandStore', { brandId: offer.brand_id, tracking: params.tracking });
  }

  function openBrand(b, viaOffer) {
    navigation.navigate('BrandStore', {
      brandId: b.id,
      brandName: b.name,
      tracking: viaOffer ? trackingFor(viaOffer) : { influencer_id: influencer.id, influencer_handle: influencer.instagram_handle, influencer_name: influencer.name },
    });
  }

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={s.header}>
        <Pressable style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backText}>←</Text>
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.title} numberOfLines={1}>{accent.icon} {firstName} · {label}</Text>
          <Text style={s.sub} numberOfLines={1}>curated by @{influencer.instagram_handle || influencer.name}</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {sectionsActive ? (
        <SectionRenderer sections={sections} navigation={navigation} />
        ) : (
        <>
        {/* Partner businesses */}
        {partners.length > 0 && (
          <>
            <Text style={s.sectionH}>Partner {label}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.partnerRow}>
              {partners.map((b, i) => (
                <Pressable key={b.id || i} style={s.partnerCell} onPress={() => openBrand(b, catOffers.find(o => (o.brand_id || o.brand_name) === (b.id || b.name)))}>
                  <View style={[s.partnerAvatar, { backgroundColor: accent.pale }]}>
                    <Text style={s.partnerIcon}>{accent.icon}</Text>
                  </View>
                  <Text style={s.partnerName} numberOfLines={1}>{b.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {/* Picks grid */}
        <Text style={s.sectionH}>{firstName}'s picks in {label}</Text>
        {catOffers.length === 0 ? (
          <Text style={s.empty}>No picks in this category yet.</Text>
        ) : (
          <View style={s.grid}>
            {catOffers.map((o, i) => (
              <Pressable key={o.offer_id || i} style={s.card} onPress={() => dispatchOffer(o)}>
                <View style={[s.cardHero, { backgroundColor: accent.pale }]}>
                  <Text style={s.cardEmoji}>{accent.icon}</Text>
                  {o.discount_value > 0 ? (
                    <View style={s.badge}>
                      <Text style={s.badgeText}>{o.discount_value}% OFF</Text>
                    </View>
                  ) : null}
                </View>
                <View style={s.cardBody}>
                  <Text style={s.cardName} numberOfLines={1}>{o.brand_name}</Text>
                  {o.brand_city ? <Text style={s.cardMeta} numberOfLines={1}>{o.brand_city}</Text> : null}
                </View>
              </Pressable>
            ))}
          </View>
        )}
        </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.screenBg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    backgroundColor: C.screenBg,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center',
  },
  backText: { fontSize: 16, color: C.ink },
  title: { fontFamily: fonts.serifDisplay, fontWeight: '600', fontSize: 18, color: C.ink },
  sub: { fontFamily: fonts.sansMedium, fontSize: 11, color: C.muted, marginTop: 1 },

  sectionH: {
    fontFamily: fonts.sansBold, fontSize: 15.5, fontWeight: '800', color: C.ink,
    paddingHorizontal: 16, marginTop: 18, marginBottom: 10,
  },
  partnerRow: { paddingHorizontal: 16, gap: 14 },
  partnerCell: { width: 74, alignItems: 'center', gap: 6 },
  partnerAvatar: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  partnerIcon: { fontSize: 26 },
  partnerName: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: C.ink, textAlign: 'center' },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 12,
  },
  card: {
    width: '47%',
    backgroundColor: C.card,
    borderRadius: 16, borderWidth: 1, borderColor: C.line,
    overflow: 'hidden',
  },
  cardHero: {
    height: 96, alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  cardEmoji: { fontSize: 40 },
  badge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: C.offer, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  badgeText: { fontFamily: fonts.sansBold, fontSize: 9, fontWeight: '800', color: '#fff' },
  cardBody: { padding: 10 },
  cardName: { fontFamily: fonts.sansBold, fontSize: 12.5, fontWeight: '800', color: C.ink },
  cardMeta: { fontFamily: fonts.sansMedium, fontSize: 10, color: C.muted, marginTop: 2 },

  empty: { fontFamily: fonts.sansMedium, fontSize: 12, color: C.muted, paddingHorizontal: 16 },
});
