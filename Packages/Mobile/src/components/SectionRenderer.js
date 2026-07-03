import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { creatorVibe as C, fonts } from '../theme/tokens';
import NewOfferCard from './cards/NewOfferCard';
import { followerApi } from '../services/api';
import {
  ShelfHeader, StoryRail, CategoryRail,
  ShelfBrandCard, ShelfBrandListRow, ShelfProductCard, DealCard, FeatureCard,
} from './vibe';
import FoodDishCard from './food/FoodDishCard';
import { useFoodOrder } from '../services/FoodOrderContext';
import RestaurantSection from './food/RestaurantSection';
import TileSection from './sections/TileSection';

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

// all → Find; a category carrying a category_node_id → the Type-1 browser
// (contract: listing-category-browser; populated by Phase 2/5); else CategoryList.
function navigateCategory(navigation, cat) {
  const key = cat?.key;
  if (cat?.category_node_id) {
    return navigation.navigate('CategoryBrowser', { nodeId: cat.category_node_id, vertical: cat.vertical, title: cat.label });
  }
  // The "All" tile on a category rail → ALL categories of that world (stays in
  // the world's browser), not the legacy global Find screen.
  if (key === 'all' && cat?.vertical) {
    return navigation.navigate('CategoryBrowser', { vertical: cat.vertical, title: 'All categories' });
  }
  if (!key || key === 'all') return navigation.navigate('Find');
  return navigation.navigate('CategoryList', { superCategory: key, label: cat.label, icon: cat.icon });
}

// Build the explicit offer identity ProductDetail needs (contract:
// features/sprint1-offer-pipeline). Assignments resolve via ci_id
// (/store/:handle/products); store/showcase library offers via
// brand_offer_id (/follower/store-offer/:id). Never send the library oid
// as a campaign offer id — that was the "Offer not found" 404.
export function offerNavParam(item) {
  const isAssignment = item.source ? item.source === 'assignment' : !!item.tracking;
  return {
    id: item.id,
    source: item.source || (isAssignment ? 'assignment' : 'store'),
    ci_id: isAssignment ? item.id : null,
    brand_offer_id: isAssignment ? (item.tracking?.oid || null) : item.id,
    offer_type: item.offer_type,
    discount_value: item.discount_value,
    discount: item.discount || null,
    config: item.config || null,
    availing_modes: item.availing_modes,
  };
}

export function goToOffer(navigation, item) {
  navigation.navigate('ProductDetail', {
    offer: offerNavParam(item),
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
export function goToProduct(navigation, item) {
  const product = item.product || { id: item.id, name: item.name, price: item.price, image_url: item.image_url };
  navigation.navigate('ProductDetail', {
    offer: item.discount_value ? offerNavParam(item) : null,
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

export function goToBrand(navigation, item) {
  navigation.navigate('BrandStore', { brandId: item.id, name: item.name, tracking: item.tracking || null });
}

// Food 3C-3 — the brand identity FoodOrderProvider.openDish needs to add a dish
// to the cart + land in the storefront. store_offers is absent on home cards
// (populated once the follower adds inside the storefront).
function foodCardBrand(b) {
  if (!b) return null;
  return { id: b.id, name: b.name, category: b.category || 'restaurant', city: b.city, store_offers: b.store_offers };
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

// Chips may arrive as plain strings OR objects ({label,value}/{name}/{key}).
// Rendering the raw value blanked the chip (object child) — normalise to a
// display string and drop empties (walkthrough P6).
const chipLabel = (l) => (typeof l === 'string' ? l : (l?.label || l?.name || l?.value || l?.key || ''));

function ChipRow({ section }) {
  const cfg = section.config || {};
  const raw =
    (Array.isArray(cfg.chips) && cfg.chips) ||
    (Array.isArray(cfg.sorts) && cfg.sorts) ||
    (Array.isArray(cfg.filters) && cfg.filters) ||
    (Array.isArray(cfg.verticals) && cfg.verticals) ||
    [];
  const labels = raw.map(chipLabel).filter(Boolean);
  if (!labels.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {labels.map((l, i) => (
        <View key={i} style={styles.chip}><Text style={styles.chipTxt}>{l}</Text></View>
      ))}
    </ScrollView>
  );
}

function HeroOffer({ section, navigation, onOfferTap }) {
  const tapOffer = onOfferTap || ((it) => goToOffer(navigation, it));
  const item = section.items[0];
  if (!item) return null;
  // Cream banner per the recolored Home mockup (.banner): terracotta eyebrow,
  // serif headline (discount or brand), ink-on-gold SHOP NOW, limited badge.
  const pct = Number(item.discount_value) > 0 ? Number(item.discount_value) : 0;
  const eyebrow = item.via_creator ? `VIA @${String(item.via_creator.handle).toUpperCase()}` : 'FEATURED DEAL';
  const headline = pct > 0 ? `FLAT ${pct}% OFF` : (item.brand?.name || 'Top Deal');
  return (
    <View>
      <ShelfHeader title={section.title} sub={section.config?.sub} />
      <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
        <TouchableOpacity activeOpacity={0.92} style={styles.banner} onPress={() => tapOffer(item)}>
          <View style={styles.bannerCopy}>
            <Text style={styles.bannerEyebrow} numberOfLines={1}>{eyebrow}</Text>
            <Text style={styles.bannerTitle} numberOfLines={2}>{headline}</Text>
            {pct > 0 && item.brand?.name ? <Text style={styles.bannerSub} numberOfLines={1}>{item.brand.name}</Text> : null}
            <View style={styles.bannerBtn}><Text style={styles.bannerBtnTxt}>SHOP NOW</Text></View>
          </View>
          {pct > 0 ? (
            <View style={styles.bannerBadge}><Text style={styles.bannerBadgeTxt}>Limited{'\n'}Time</Text></View>
          ) : null}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function OfferGrid({ section, navigation, onOfferTap }) {
  const tapOffer = onOfferTap || ((it) => goToOffer(navigation, it));
  return (
    <View>
      <ShelfHeader title={section.title} sub={section.config?.sub} />
      <View style={styles.grid}>
        {section.items.map((item, i) => (
          <TouchableOpacity key={item.id || i} activeOpacity={0.85} style={styles.gridCell} onPress={() => tapOffer(item)}>
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

const DATA_TYPES = ['offers', 'products', 'brands', 'creators', 'mixed', 'restaurant_list', 'category_rail'];
// Presentational shelves carry their content in config (not `items`) — a screen
// composed only of these is still "engine content" (Phase 6 banner/hero-tiles).
const PRESENTATION_TYPES = ['banner_gateway', 'hero_tiles', 'tiles'];
export function hasEngineContent(sections) {
  return Array.isArray(sections) &&
    sections.some(s =>
      PRESENTATION_TYPES.includes(s?.type) ||
      (DATA_TYPES.includes(s?.type) && Array.isArray(s?.items) && s.items.length > 0));
}

// ── per-shelf render ──────────────────────────────────────────────────────────

function renderSection(section, navigation, canFollow, context = {}) {
  if (!section || !Array.isArray(section.items)) return null;
  const sub = section.config?.sub;
  const count = section.items.length;

  // Universal "View all" → the shared Results screen, re-running THIS shelf's rule with the
  // same surface context (creator/category/brand/city stack). Only for list-bearing shelves.
  const ctx = context || {};
  // App Builder D — admin-chosen section-level tap destination (config.tap_destination).
  // 'category' → the left-rail browser · 'page' → a custom page · 'grid'/'default'/absent
  // → the shared Results product grid (today's behaviour). Individual cards keep their
  // own detail navigation regardless.
  const dest = section.config?.tap_destination || null;
  // P5 (section-analytics-city) — fire-and-forget engagement capture. The
  // screen is derived from the surface context; a dead endpoint can never
  // affect navigation (recordSectionEvent swallows every failure).
  const emit = (event, item) => followerApi.recordSectionEvent({
    section_key: section.key || section.shelf_key || 'unknown',
    screen: ctx.brandId ? 'business' : ctx.creatorHandle ? 'creator_store' : ctx.superCategory ? 'category' : 'home',
    scope_value: ctx.superCategory || null,
    event,
    entity_type: item?.entity_type || null,
    entity_id: item?.id != null ? String(item.id) : (item?.label || null),
  });
  const tapOffer = (it) => { emit('tap', it); goToOffer(navigation, it); };
  const tapProduct = (it) => { emit('tap', it); goToProduct(navigation, it); };
  const tapBrand = (it) => { emit('tap', it); goToBrand(navigation, it); };
  const seeAll = () => {
    emit('see_all', null);
    if (dest && dest.type === 'category') {
      return navigation.navigate('CategoryBrowser', {
        nodeId: dest.node_id || null,
        vertical: dest.vertical || ctx.superCategory || null,
        title: section.title,
      });
    }
    if (dest && dest.type === 'page' && dest.page_key) {
      return navigation.navigate('FollowerPage', { pageKey: dest.page_key, title: section.title });
    }
    return navigation.navigate('SectionResults', {
      title: section.title,
      rule: section.rule,
      // banner_gateway is a presentation, not a data type — its rule is library_products
      // (a product list), so Results must render the product grid.
      item_type: section.type === 'banner_gateway' ? 'products' : section.type,
      library_section_id: section.config?.library_section_id || null,
      category_key: ctx.superCategory || null,
      creator_handle: ctx.creatorHandle || null,
      brand_id: ctx.brandId || null,
      lat: ctx.lat ?? null,
      lng: ctx.lng ?? null,
    });
  };

  if (section.type === 'controls') return <ChipRow section={section} />;

  // Category rail (food 3C) is rendered by the host home screen (it owns the
  // in-page craving filter + sticky), so the generic renderer skips it.
  if (section.type === 'category_rail') return null;

  // Collection header band (Phase 4a) — renders even with no items (it's a title,
  // not a data shelf); placed before the empty-items guard below.
  if (section.type === 'collection_header') return <CollectionHeader section={section} />;

  // Banner-Gateway (Phase 6 B) — a tappable marketing banner; tap → the shared
  // Results screen re-runs THIS section's rule with the surface context.
  if (section.type === 'banner_gateway') return <BannerGateway section={section} onPress={seeAll} />;

  // Template Catalog #1 — image-tile carousel; each tile is an uploaded image
  // wired to a Section Library group (config.tiles[].library_section_id). Tap →
  // Results runs that group. Renders before the empty-items guard (content is
  // in config, not items).
  if (section.type === 'tiles') {
    const onTile = (t) => {
      emit('tap', { entity_type: 'tile', id: t.library_section_id || null, label: t.label });
      // Per-tile destination (admin "On tap →"): category browser / a page / default grid.
      const d = t.tap_destination;
      if (d?.type === 'category') return navigation.navigate('CategoryBrowser', { nodeId: d.node_id || null, vertical: d.vertical || ctx.superCategory || null, title: t.label || section.title });
      if (d?.type === 'page' && d.page_key) return navigation.navigate('FollowerPage', { pageKey: d.page_key, title: t.label || section.title });
      // Inline banner rule (App Builder Frame) wins; else the wired library group.
      const rj = t.rule_json && typeof t.rule_json === 'object'
        && Object.keys(t.rule_json).filter(k => k !== 'business_type').length > 0 ? t.rule_json : null;
      navigation.navigate('SectionResults', {
        title: t.label || section.title,
        rule: 'library_products',
        item_type: 'products',
        rule_json: rj,
        library_section_id: rj ? null : (t.library_section_id || null),
        category_key: ctx.superCategory || null,
        lat: ctx.lat ?? null,
        lng: ctx.lng ?? null,
      });
    };
    return <TileSection section={section} onTile={onTile} />;
  }

  // Hero + Tiles (Phase 6 C) — a hero band + one tile per collection member; each
  // tile taps through to Results for that member section's rule. Renders before the
  // empty-items guard (its content is the tiles in config, not `items`).
  if (section.type === 'hero_tiles') {
    const tiles = Array.isArray(section.config?.tiles) ? section.config.tiles : [];
    const onTile = (t) => { emit('tap', { entity_type: 'tile', id: t.library_section_id || null, label: t.label }); return navigation.navigate('SectionResults', {
      title: t.label,
      rule: 'library_products',
      item_type: 'products',
      library_section_id: t.library_section_id || null,
      category_key: ctx.superCategory || null,
      creator_handle: ctx.creatorHandle || null,
      brand_id: ctx.brandId || null,
      lat: ctx.lat ?? null,
      lng: ctx.lng ?? null,
    }); };
    return <HeroTiles section={section} tiles={tiles} onTile={onTile} />;
  }

  if ((section.type === 'offers' || section.type === 'mixed') && section.items.length) {
    if (section.config?.hero) return <HeroOffer section={section} navigation={navigation} onOfferTap={tapOffer} />;
    if (section.config?.grid) return <OfferGrid section={section} navigation={navigation} onOfferTap={tapOffer} />;
  }

  if (!section.items.length) return null;

  switch (section.type) {
    case 'creators':
      return (
        <View>
          <ShelfHeader title={section.title} sub={sub} count={count} tag="creators" onSeeAll={seeAll} />
          <StoryRail
            items={section.items.map(s => ({
              id: s.id, handle: s.handle, name: s.name, avatar: s.avatar,
              has_live_deal: s.has_live_deal, followers_count: s.followers_count, is_followed: s.is_followed,
            }))}
            onPressStory={(story) => { emit('tap', { entity_type: 'creator', id: story.id || story.handle }); navigation.navigate('InfluencerStore', { handle: story.handle }); }}
            onPressMore={() => navigation.navigate('Find')}
            showFollow={canFollow}
            onFollow={(story) => { if (story?.id) followerApi.follow(story.id).catch(() => {}); }}
          />
        </View>
      );

    case 'nav_tiles':
      return (
        <View>
          <ShelfHeader title={section.title} sub={sub} count={count} tag="nav_tiles" />
          <CategoryRail
            items={section.items.map(n => ({ key: n.key, label: n.label, icon: n.icon, category_node_id: n.category_node_id, vertical: n.vertical }))}
            onPressCategory={(cat) => navigateCategory(navigation, cat)}
          />
        </View>
      );

    case 'brands':
      // config.main_list (Category "All Businesses") → full-width list; else a rail.
      if (section.config?.main_list) {
        return (
          <View>
            <ShelfHeader title={section.title} sub={sub} count={count} tag="brands" onSeeAll={seeAll} />
            {section.items.map((item, i) => (
              <ShelfBrandListRow key={item.id || i} brand={item} distanceKm={item.distance_km} onPress={() => tapBrand(item)} />
            ))}
          </View>
        );
      }
      return (
        <View>
          <ShelfHeader title={section.title} sub={sub} count={count} tag="brands" onSeeAll={seeAll} />
          <Rail>
            {section.items.map((item, i) => (
              <ShelfBrandCard key={item.id || i} brand={item} distanceKm={item.distance_km} onPress={() => tapBrand(item)} />
            ))}
          </Rail>
        </View>
      );

    case 'products': {
      // Food World 3C-1 — restaurant dish shelves (Type A, e.g. "Meals under
      // ₹99") use the Toing FoodDishCard (veg dot, badge, ＋, by-restaurant,
      // rating·ETA, struck MRP). Other verticals keep the shared ShelfProductCard.
      const isFood = section.items[0]?.brand?.category === 'restaurant';
      return (
        <View>
          <ShelfHeader title={section.title} sub={sub} count={count} tag="products" onSeeAll={seeAll} />
          <Rail>
            {section.items.map((item, i) => (
              isFood ? (
                <FoodDishCard
                  key={item.id || i}
                  product={item.product || item}
                  brand={item.brand}
                  onPress={ctx.openDish
                    ? () => ctx.openDish(item.product || item, foodCardBrand(item.brand), navigation, 'detail')
                    : () => tapProduct(item)}
                  onAdd={ctx.openDish
                    ? () => ctx.openDish(item.product || item, foodCardBrand(item.brand), navigation, 'add')
                    : undefined}
                />
              ) : (
                <ShelfProductCard
                  key={item.id || i}
                  product={item.product || item}
                  brand={item.brand}
                  discountValue={item.discount_value}
                  distanceKm={item.distance_km}
                  onPress={() => tapProduct(item)}
                  // ＋ on every shop product card (consistency) → opens the PDP to
                  // pick variant + add (section payload carries no variant data, so
                  // we can't silently add a size-less fashion item).
                  onAdd={() => tapProduct(item)}
                />
              )
            ))}
          </Rail>
        </View>
      );
    }

    case 'restaurant_list':
      // Food World 3C-1 — Type B: one card per restaurant + nested featured-dish
      // carousel. Fed by the `restaurants_with_featured` rule.
      return (
        <View>
          <ShelfHeader title={section.title} sub={sub} count={count} tag="brands" onSeeAll={seeAll} />
          {section.items.map((rest, i) => (
            <RestaurantSection
              key={rest.id || i}
              restaurant={rest}
              onOpenStore={(r) => tapBrand(r)}
              onOpenDish={(p, r, mode = 'add') => ctx.openDish
                ? ctx.openDish(p, { id: r.id, name: r.name, category: r.category || 'restaurant', city: r.city, store_offers: r.store_offers }, navigation, mode)
                : tapProduct({ ...p, brand: p.brand || { id: r.id, name: r.name, category: r.category, city: r.city } })}
            />
          ))}
        </View>
      );

    case 'offers':
    case 'mixed':
      return (
        <View>
          <ShelfHeader title={section.title} sub={sub} count={count} tag={section.type} onSeeAll={seeAll} />
          <Rail>
            {section.items.map((item, i) => (
              isFeatureShelf(section) ? (
                <FeatureCard
                  key={item.id || i}
                  title={item.brand?.name || 'Featured'}
                  chip={catLabel(item.brand?.category)}
                  category={item.brand?.category}
                  creator={item.via_creator}
                  onPress={() => tapOffer(item)}
                />
              ) : (
                <DealCard
                  key={item.id || i}
                  offer={item}
                  title={item.brand?.name}
                  brand={catLabel(item.brand?.category)}
                  category={item.brand?.category}
                  creator={item.via_creator}
                  onPress={() => tapOffer(item)}
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

// Collection header band (Phase 4a) — a titled group header above the collection's
// member section shelves. Optional banner image; otherwise a soft branded band.
function CollectionHeader({ section }) {
  const img = section.config?.image_url;
  return (
    <View style={styles.collHeader}>
      {img ? <View style={styles.collImgWrap}><Text style={styles.collImgFallback}>🛍️</Text></View> : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.collName}>{section.title}</Text>
        {section.config?.sub ? <Text style={styles.collSub}>{section.config.sub}</Text> : null}
      </View>
      <Text style={styles.collTag}>COLLECTION</Text>
    </View>
  );
}

// Banner-Gateway (Phase 6 B) — reuses the 5b cream-banner styling; an optional
// right-side image. The whole card is the tap target → Results.
function BannerGateway({ section, onPress }) {
  const b = section.config?.banner || {};
  const headline = b.headline || section.title || 'Shop now';
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
      <TouchableOpacity activeOpacity={0.92} style={styles.banner} onPress={onPress}>
        {b.image_url ? <Image source={{ uri: b.image_url }} style={styles.bannerImg} resizeMode="cover" /> : null}
        <View style={styles.bannerCopy}>
          {b.eyebrow ? <Text style={styles.bannerEyebrow} numberOfLines={1}>{b.eyebrow}</Text> : null}
          <Text style={styles.bannerTitle} numberOfLines={2}>{headline}</Text>
          {b.sub ? <Text style={styles.bannerSub} numberOfLines={1}>{b.sub}</Text> : null}
          <View style={styles.bannerBtn}><Text style={styles.bannerBtnTxt}>{b.cta_label || 'SHOP NOW'}</Text></View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// Hero + Tiles (Phase 6 C) — a gold hero band (ink text) + a rail of tiles, each
// carrying a member section's rule.
function HeroTiles({ section, tiles, onTile }) {
  const h = section.config?.hero || {};
  return (
    <View>
      <View style={styles.heroBand}>
        {h.eyebrow ? <Text style={styles.heroEyebrow} numberOfLines={1}>{h.eyebrow}</Text> : null}
        <Text style={styles.heroTitle2} numberOfLines={2}>{h.title || section.title}</Text>
      </View>
      <Rail>
        {tiles.map((t, i) => (
          <TouchableOpacity key={t.library_section_id || i} style={styles.tile} activeOpacity={0.85} onPress={() => onTile(t)}>
            <View style={styles.tileImg}>
              {t.image_url
                ? <Image source={{ uri: t.image_url }} style={styles.tileImgFill} resizeMode="cover" />
                : <Text style={styles.tileEmoji}>🛍️</Text>}
            </View>
            <View style={styles.tileBody}>
              <Text style={styles.tileLabel} numberOfLines={1}>{t.label}</Text>
              <Text style={styles.tileView}>View →</Text>
            </View>
          </TouchableOpacity>
        ))}
      </Rail>
    </View>
  );
}

// Render ONE section as a standalone element — lets a host screen lay sections
// out as direct ScrollView children (needed for per-section sticky headers).
export function SectionItem({ section, navigation, canFollow, context }) {
  const { openDish } = useFoodOrder();
  return renderSection(section, navigation, canFollow, { ...context, openDish });
}

export default function SectionRenderer({ sections, navigation, canFollow, context }) {
  const { openDish } = useFoodOrder();
  if (!Array.isArray(sections)) return null;
  const ctx = { ...context, openDish };
  return (
    <View>
      {sections.map((section, i) => (
        <View key={section.key || i}>{renderSection(section, navigation, canFollow, ctx)}</View>
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
  banner: {
    backgroundColor: C.cream, borderRadius: 18, padding: 18, minHeight: 150,
    overflow: 'hidden', justifyContent: 'center', position: 'relative',
  },
  bannerCopy: { maxWidth: '74%' },
  bannerEyebrow: { fontSize: 11, fontWeight: '800', color: C.offer, letterSpacing: 0.5, fontFamily: fonts?.sansBold },
  bannerTitle: { fontSize: 25, fontWeight: '800', color: C.ink, marginTop: 4, lineHeight: 27, fontFamily: fonts?.serifDisplay },
  bannerSub: { fontSize: 13, fontWeight: '700', color: C.ink, marginTop: 3, fontFamily: fonts?.sansBold },
  bannerBtn: {
    marginTop: 14, alignSelf: 'flex-start', backgroundColor: C.brown,
    borderRadius: 10, paddingHorizontal: 20, paddingVertical: 11,
  },
  bannerBtnTxt: { fontSize: 12, fontWeight: '800', color: C.onGold, letterSpacing: 0.5, fontFamily: fonts?.sansBold },
  bannerBadge: {
    position: 'absolute', top: 16, right: 14, width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.brown, alignItems: 'center', justifyContent: 'center',
  },
  bannerBadgeTxt: { fontSize: 10, fontWeight: '800', color: C.onGold, textAlign: 'center', lineHeight: 12, fontFamily: fonts?.sansBold },
  bannerImg: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '44%' },
  // Hero + Tiles (Phase 6 C)
  heroBand: {
    marginHorizontal: 16, marginTop: 10, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 16, backgroundColor: C.brown,
  },
  heroEyebrow: { fontSize: 10, fontWeight: '800', color: 'rgba(26,26,26,0.65)', letterSpacing: 0.5, fontFamily: fonts?.sansBold },
  heroTitle2: { fontSize: 20, fontWeight: '800', color: C.onGold, marginTop: 3, fontFamily: fonts?.serifDisplay },
  tile: {
    width: 122, borderRadius: 14, overflow: 'hidden',
    backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
  },
  tileImg: { height: 72, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  tileImgFill: { width: '100%', height: '100%' },
  tileEmoji: { fontSize: 26 },
  tileBody: { paddingVertical: 9, paddingHorizontal: 8, alignItems: 'center' },
  tileLabel: { fontSize: 12, fontWeight: '800', color: C.ink, fontFamily: fonts?.sansBold },
  tileView: { fontSize: 10, fontWeight: '700', color: C.goldDeep, marginTop: 2, fontFamily: fonts?.sansBold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10 },
  gridCell: { width: '47%' },
  collHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 14, marginBottom: 2,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: C.soft, borderRadius: 14, borderWidth: 1, borderColor: C.line,
  },
  collImgWrap: {
    width: 38, height: 38, borderRadius: 9, backgroundColor: C.card,
    alignItems: 'center', justifyContent: 'center',
  },
  collImgFallback: { fontSize: 18 },
  collName: { fontSize: 17, fontWeight: '800', color: C.ink, fontFamily: fonts?.serifDisplay },
  collSub: { fontSize: 11, color: C.muted, marginTop: 1, fontFamily: fonts?.sansRegular },
  collTag: { fontSize: 9, fontWeight: '800', color: C.brown, letterSpacing: 0.4 },
});
