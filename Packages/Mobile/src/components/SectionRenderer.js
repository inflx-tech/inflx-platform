import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { creatorVibe as C, fonts } from '../theme/tokens';
import InfluencerStoryRow from './InfluencerStoryRow';
import CategoryGrid from './CategoryGrid';
import NewOfferCard from './cards/NewOfferCard';
import ProductCard from './cards/ProductCard';

/**
 * SectionRenderer — renders the backend section-engine payload
 * (GET /v1/follower/home → { sections:[…] }, Phase A) using the EXISTING Creator
 * Vibe card components, so the look matches the current app. Screens become thin:
 * fetch { sections } → <SectionRenderer sections=… navigation=… />.
 *
 * Gated by config/featureFlags SECTION_ENGINE_HOME. Contract:
 * features/follower-section-home/. Each item carries its 4-ID tracking block
 * (item.tracking) straight from the backend — passed through on navigation.
 *
 * Defensive by design: unknown shelf_type or empty items render nothing (never
 * throws), so a stray/misconfigured shelf can't blank or crash the screen.
 */

function SectionHeading({ title, sub }) {
  if (!title) return null;
  return (
    <View style={styles.head}>
      <Text style={styles.headTitle}>{title}</Text>
      {sub ? <Text style={styles.headSub}>{sub}</Text> : null}
    </View>
  );
}

// dining/eat → DiningHome; all → Find; otherwise the legacy CategoryList.
function navigateCategory(navigation, cat) {
  const key = cat?.key;
  if (!key || key === 'all') return navigation.navigate('Find');
  if (key === 'dining' || key === 'eat') return navigation.navigate('DiningHome');
  return navigation.navigate('CategoryList', { superCategory: key, label: cat.label, icon: cat.icon });
}

function goToOffer(navigation, item) {
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
    store: item.via_creator
      ? { instagram_handle: item.via_creator.handle, name: item.via_creator.name }
      : null,
    influencer: item.via_creator || null,
    tracking: item.tracking || null,
    trackingParams: item.tracking || null,
  });
}

function OfferRail({ section, navigation }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {section.items.map((item, i) => (
        <TouchableOpacity
          key={item.id || i}
          activeOpacity={0.85}
          style={styles.railItem}
          onPress={() => goToOffer(navigation, item)}
        >
          <NewOfferCard
            store={{ name: item.brand?.name, category: item.brand?.category }}
            dealType="shop"
            dealLabel={item.via_creator ? `via @${item.via_creator.handle}` : 'Deal'}
            discountValue={item.discount_value ? `${item.discount_value}%` : 'Offer'}
            tags={[]}
          />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function ProductRail({ section, navigation }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {section.items.map((item, i) => (
        <View key={item.id || i} style={styles.railItem}>
          <ProductCard
            product={item.product || { name: item.name, price: item.price }}
            brand={item.brand || { name: item.brand?.name, category: item.brand?.category }}
            discount={item.discount_value ? { type: item.offer_type || 'percentage', value: item.discount_value } : null}
            influencer={item.via_creator || null}
            onPress={() => goToOffer(navigation, item)}
          />
        </View>
      ))}
    </ScrollView>
  );
}

function BrandRail({ section, navigation }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {section.items.map((item, i) => (
        <TouchableOpacity
          key={item.id || i}
          activeOpacity={0.85}
          style={styles.brandCard}
          onPress={() => navigation.navigate('BrandStore', { brandId: item.id, name: item.name })}
        >
          <View style={styles.brandLogo}><Text style={styles.brandLogoTxt}>{(item.name || '?')[0]}</Text></View>
          <Text style={styles.brandName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.brandMeta} numberOfLines={1}>{item.category || ''}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function renderSection(section, navigation) {
  if (!section || !Array.isArray(section.items)) return null;
  const sub = section.config?.sub;

  switch (section.type) {
    case 'creators':
      if (!section.items.length) return null;
      return (
        <View>
          <SectionHeading title={section.title} sub={sub} />
          <InfluencerStoryRow
            stories={section.items.map(s => ({
              id: s.id,
              handle: s.handle,
              name: s.name,
              avatar_initial: s.name?.[0],
              has_live_deal: s.has_live_deal,
            }))}
            onPressStory={(story) => navigation.navigate('InfluencerStore', { handle: story.handle })}
            onPressMore={() => navigation.navigate('Find')}
          />
        </View>
      );

    case 'nav_tiles':
      if (!section.items.length) return null;
      return (
        <View>
          <SectionHeading title={section.title} sub={sub} />
          <CategoryGrid
            categories={section.items.map(n => ({ key: n.key, label: n.label, icon: n.icon }))}
            onPressCategory={(cat) => navigateCategory(navigation, cat)}
          />
        </View>
      );

    case 'offers':
    case 'mixed':
      if (!section.items.length) return null;
      return (
        <View>
          <SectionHeading title={section.title} sub={sub} />
          <OfferRail section={section} navigation={navigation} />
        </View>
      );

    case 'products':
      if (!section.items.length) return null;
      return (
        <View>
          <SectionHeading title={section.title} sub={sub} />
          <ProductRail section={section} navigation={navigation} />
        </View>
      );

    case 'brands':
      if (!section.items.length) return null;
      return (
        <View>
          <SectionHeading title={section.title} sub={sub} />
          <BrandRail section={section} navigation={navigation} />
        </View>
      );

    // 'controls' (chips/sort bars) + unknown types render nothing in v1.
    default:
      return null;
  }
}

export default function SectionRenderer({ sections, navigation }) {
  if (!Array.isArray(sections)) return null;
  return (
    <View>
      {sections.map((section) => (
        <View key={section.key}>{renderSection(section, navigation)}</View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 },
  headTitle: { fontSize: 16, fontWeight: '800', color: C.ink, fontFamily: fonts?.serifDisplay },
  headSub: { fontSize: 11, color: C.muted, fontWeight: '600', marginTop: 2 },
  rail: { paddingHorizontal: 12, gap: 12 },
  railItem: { marginRight: 4 },
  brandCard: {
    width: 132, marginRight: 4, padding: 12, borderRadius: 16,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: 'center',
  },
  brandLogo: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: C.soft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  brandLogoTxt: { fontSize: 20, fontWeight: '800', color: C.brown },
  brandName: { fontSize: 13, fontWeight: '800', color: C.ink },
  brandMeta: { fontSize: 11, color: C.muted, fontWeight: '600', marginTop: 2 },
});
