import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { creatorVibe as C, fonts } from '../theme/tokens';
import NewOfferCard from './cards/NewOfferCard';
import {
  ShelfHeader, StoryRail, CategoryRail,
  ShelfBrandCard, ShelfBrandListRow, ShelfProductCard, DealCard, FeatureCard,
} from './vibe';

/**
 * SectionRenderer — renders the backend section-engine payload
 * (GET /v1/follower/<screen> → { sections:[…] }) using the mockup-accurate
 * `components/vibe` card kit (Phase 1 of the follower rebuild). Screens stay thin:
 * fetch { sections } → <SectionRenderer sections=… navigation=… />.
 *
 * Shared by Home, Category, Offers, Creator Store, Creator's Category, SchemaDetail.
 * Each item carries its 4-ID tracking block (item.tracking) straight from the
 * backend — passed through untouched on navigation.
 *
 * Defensive by design: unknown shelf_type or empty items render nothing (never
 * throws), so a stray/misconfigured shelf can't blank or crash the screen.
 */

// ── navigation helpers (targets preserved; Eat re-pointed to agreed Category) ──

// all → Find; dining/eat → the AGREED Category screen (was DiningHome); else CategoryList.
function navigateCategory(navigation, cat) {
  const key = cat?.key;
  if (!key || key === 'all') return navigation.navigate('Find');
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
    store: item.via_creator ? { instagram_handle: item.via_creator.handle, name: item.via_creator.name } : null,
    influencer: item.via_creator || null,
    tracking: item.tracking || null,
    trackingParams: item.tracking || null,
  });
}

// Listing/product tap → ProductDetail with the product (+ any offer/4-ID it carries).
function goToProduct(navigation, item) {
  const product = item.product || { id: item.id, name: item.name, price: item.price, image_url: item.image_url };
  navigation.navigate('ProductDetail', {
    offer: item.discount_value
      ? { id: item.tracking?.oid || item.id, offer_type: item.offer_type, discount_value: item.discount_value, availing_modes: item.availing_modes }
      : null,
    brand: item.brand
      ? { id: item.brand.id, name: item.brand.name, category: item.brand.category, locality: item.brand.city }
      : null,
    store: item.via_creator ? { instagram_handle: item.via_creator.handle, name: item.via_creator.name } : null,
    influencer: item.via_creator || null,
    selectedProductId: product.id,
    product,
    tracking: item.tracking || null,
    trackingParams: item.tracking || null,
  });
}

function goToBrand(navigation, item) {
  navigation.navigate('BrandStore', { brandId: item.id, name: item.name, tracking: item.tracking || null });
}

// Horizontal rail wrapper for the card variants that don't bring their own scroll.
function Rail({ children }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {children}
    </ScrollView>
  );
}

function catLabel(category) {
  return category ? String(category).replace(/_/g, ' ') : '';
}

// "What's Hot"-style shelves render as big feature tiles; other offer shelves as deal cards.
function isFeatureShelf(section) {
  return section.shelf_key === 'whats_hot' || section.config?.card === 'feature';
}

// ── controls / hero / grid (offers screen variants — preserved) ───────────────

function ChipRow({ section }) {
  const cfg = section.config || {};
  const labels =
    (Array.isArray(cfg.chips) && cfg.chips) ||
    (Array.isArray(cfg.sorts) && cfg.sorts) ||
    (Array.isArray(cfg.filters) && cfg.filters) ||
    (Array.isArray(cfg.verticals) && cfg.verticals.map(v => v.label)) ||
    [];
  if (!labels.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {labels.map((l, i) => (
        <View key={i} style={styles.chip}><Text style={styles.chipTxt}>{l}</Text></View>
      ))}
    </ScrollView>
  );
}

function HeroOffer({ section, navigation }) {
  const item = section.items[0];
  if (!item) return null;
  return (
    <View>
      <ShelfHeader title={section.title} sub={section.config?.sub} />
      <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
        <TouchableOpacity activeOpacity={0.9} style={styles.hero} onPress={() => goToOffer(navigation, item)}>
          <Text style={styles.heroLabel}>{item.via_creator ? `via @${item.via_creator.handle}` : 'FEATURED DEAL'}</Text>
          <Text style={styles.heroTitle} numberOfLines={2}>{item.brand?.name || 'Top Deal'}</Text>
          <Text style={styles.heroDiscount}>{item.discount_value ? `${item.discount_value}% OFF` : 'Tap to view'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function OfferGrid({ section, navigation }) {
  return (
    <View>
      <ShelfHeader title={section.title} sub={section.config?.sub} />
      <View style={styles.grid}>
        {section.items.map((item, i) => (
          <TouchableOpacity key={item.id || i} activeOpacity={0.85} style={styles.gridCell} onPress={() => goToOffer(navigation, item)}>
            <NewOfferCard
              store={{ name: item.brand?.name, category: item.brand?.category }}
              dealType="shop"
              dealLabel={item.via_creator ? `via @${item.via_creator.handle}` : 'Deal'}
              discountValue={item.discount_value ? `${item.discount_value}%` : 'Offer'}
              tags={[]}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── content detection (unchanged contract — screens depend on this) ───────────

const DATA_TYPES = ['offers', 'products', 'brands', 'creators', 'mixed'];
export function hasEngineContent(sections) {
  return Array.isArray(sections) &&
    sections.some(s => DATA_TYPES.includes(s?.type) && Array.isArray(s?.items) && s.items.length > 0);
}

// ── per-shelf render ──────────────────────────────────────────────────────────

function renderSection(section, navigation) {
  if (!section || !Array.isArray(section.items)) return null;
  const sub = section.config?.sub;
  const count = section.items.length;

  if (section.type === 'controls') return <ChipRow section={section} />;

  if ((section.type === 'offers' || section.type === 'mixed') && section.items.length) {
    if (section.config?.hero) return <HeroOffer section={section} navigation={navigation} />;
    if (section.config?.grid) return <OfferGrid section={section} navigation={navigation} />;
  }

  if (!section.items.length) return null;

  switch (section.type) {
    case 'creators':
      return (
        <View>
          <ShelfHeader title={section.title} sub={sub} count={count} tag="creators" />
          <StoryRail
            items={section.items.map(s => ({
              id: s.id, handle: s.handle, name: s.name, avatar: s.avatar, has_live_deal: s.has_live_deal,
            }))}
            onPressStory={(story) => navigation.navigate('InfluencerStore', { handle: story.handle })}
            onPressMore={() => navigation.navigate('Find')}
          />
        </View>
      );

    case 'nav_tiles':
      return (
        <View>
          <ShelfHeader title={section.title} sub={sub} count={count} tag="nav_tiles" />
          <CategoryRail
            items={section.items.map(n => ({ key: n.key, label: n.label, icon: n.icon }))}
            onPressCategory={(cat) => navigateCategory(navigation, cat)}
          />
        </View>
      );

    case 'brands':
      // config.main_list (Category "All Businesses") → full-width list; else a rail.
      if (section.config?.main_list) {
        return (
          <View>
            <ShelfHeader title={section.title} sub={sub} count={count} tag="brands" />
            {section.items.map((item, i) => (
              <ShelfBrandListRow key={item.id || i} brand={item} onPress={() => goToBrand(navigation, item)} />
            ))}
          </View>
        );
      }
      return (
        <View>
          <ShelfHeader title={section.title} sub={sub} count={count} tag="brands" />
          <Rail>
            {section.items.map((item, i) => (
              <ShelfBrandCard key={item.id || i} brand={item} onPress={() => goToBrand(navigation, item)} />
            ))}
          </Rail>
        </View>
      );

    case 'products':
      return (
        <View>
          <ShelfHeader title={section.title} sub={sub} count={count} tag="products" />
          <Rail>
            {section.items.map((item, i) => (
              <ShelfProductCard
                key={item.id || i}
                product={item.product || item}
                brand={item.brand}
                discountValue={item.discount_value}
                onPress={() => goToProduct(navigation, item)}
              />
            ))}
          </Rail>
        </View>
      );

    case 'offers':
    case 'mixed':
      return (
        <View>
          <ShelfHeader title={section.title} sub={sub} count={count} tag={section.type} />
          <Rail>
            {section.items.map((item, i) => (
              isFeatureShelf(section) ? (
                <FeatureCard
                  key={item.id || i}
                  title={item.brand?.name || 'Featured'}
                  chip={catLabel(item.brand?.category)}
                  category={item.brand?.category}
                  creator={item.via_creator}
                  onPress={() => goToOffer(navigation, item)}
                />
              ) : (
                <DealCard
                  key={item.id || i}
                  offer={item}
                  title={item.brand?.name}
                  brand={catLabel(item.brand?.category)}
                  category={item.brand?.category}
                  creator={item.via_creator}
                  onPress={() => goToOffer(navigation, item)}
                />
              )
            ))}
          </Rail>
        </View>
      );

    default:
      return null;
  }
}

export default function SectionRenderer({ sections, navigation }) {
  if (!Array.isArray(sections)) return null;
  return (
    <View>
      {sections.map((section, i) => (
        <View key={section.key || i}>{renderSection(section, navigation)}</View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { paddingHorizontal: 16, paddingBottom: 4, gap: 14 },
  chipRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: C.line, backgroundColor: C.card, marginRight: 8,
  },
  chipTxt: { fontSize: 12, fontWeight: '700', color: C.ink, fontFamily: fonts?.sansBold },
  hero: { backgroundColor: C.brown, borderRadius: 18, padding: 18 },
  heroLabel: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.5 },
  heroTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 4, fontFamily: fonts?.serifDisplay },
  heroDiscount: { fontSize: 14, fontWeight: '800', color: '#fff', marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10 },
  gridCell: { width: '47%' },
});
