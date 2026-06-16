import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Alert,
} from 'react-native';
import { creatorVibe as C, fonts, fmtRupees, getBusinessAccentLight } from '../../theme/tokens';

// Flow 52.4 — Creator Vibe recolor shim. Per-business accent stays wayfinding-only
// (hero/more-card tints, via getBusinessAccentLight). Chrome → cream/ink; primary +
// secondary CTAs overridden to terracotta-brown below. Visual only — price math,
// availing_modes → CTA dispatch (getModeConfig/dispatchCta), getStoreProducts,
// tracking, and More-from-brand replace-nav all untouched.
const P = {
  white: C.card, bg: C.screenBg, bg2: C.soft,
  border: C.line, ink: C.ink, ink2: C.ink,
  muted: C.muted, muted2: C.muted, muted3: C.muted,
  yellow: C.star, yellowPale: C.soft,
  successText: C.brown,
};
import { followerApi } from '../../services/api';
import OfferBlock from '../../components/OfferBlock';
import { composeCart } from '../../utils/offerMechanics';

/**
 * ProductDetailScreen — single-product detail page reached from any product
 * tap in the follower app (creator store, deals tab, category list, home feed).
 *
 * The previous version was a multi-product cart picker that defaulted to the
 * first product in the influencer's store. That conflated two screens: a
 * "single product detail" and a "build your cart" picker. Today the user
 * expects: tap one product → see THAT product + its CTAs. We redesigned
 * around that.
 *
 * Layout:
 *   • Hero image (or category emoji fallback)
 *   • Title + brand line + section
 *   • Creator's note (when present)
 *   • MRP + discounted price
 *   • Description
 *   • CTAs derived from offer.availing_modes:
 *       - online_order → "Buy Now"        (→ OnlineOrder)
 *       - pay_at_store / walkin_pay → "Pay at Venue"  (→ PayAtStore)
 *       - prebook → "Book Slot"           (→ PreBook)
 *       - enquiry → "Enquire"             (→ Enquiry)
 *   • "More from <brand>" — horizontal scroll of other products from the
 *     same offer (loaded on-demand from the same getStoreProducts call,
 *     filtered to !== selectedProductId)
 *
 * Route params expected:
 *   {
 *     offer: { id, offer_type, discount_value, availing_modes, title? },
 *     brand: { id, name, category, locality, city? },
 *     store: { instagram_handle, name },
 *     influencer: { id, name, instagram_handle, ... },
 *     selectedProductId: <uuid>,           // REQUIRED — the tapped product
 *     product?: { ... },                   // OPTIONAL preview — used while loading
 *     tracking / trackingParams: { campaign_id, set_id, offer_id, campaign_influencer_id },
 *   }
 */

const CATEGORY_EMOJI = {
  restaurant:     '🍽️',
  salon:          '💇',
  car_rental:     '🚗',
  bike_rental:    '🏍️',
  fashion:        '👗',
  fashion_walkin: '👗',
  fashion_online: '👕',
  bakery:         '🧁',
  florist:        '💐',
};

// Generic labels — fallback for categories without category-specific verbs.
const MODE_LABELS = {
  online_order:  { label: 'Buy Now',     screen: 'OnlineOrder',  emoji: '🛒' },
  pay_at_store:  { label: 'Pay at Venue', screen: 'PayAtStore',   emoji: '💸' },
  walkin_pay:    { label: 'Pay at Venue', screen: 'PayAtStore',   emoji: '💸' },
  prebook:       { label: 'Book Slot',   screen: 'PreBook',      emoji: '📅' },
  enquiry:       { label: 'Enquire',     screen: 'Enquiry',      emoji: '✉️' },
};

// Category-aware overrides — drive the verbs from the user's mental model
// of what they're buying. Restaurants book tables, salons book slots, cars
// get reserved. Fall through to MODE_LABELS when no override exists.
const CATEGORY_LABELS = {
  restaurant: {
    online_order: { label: 'Add to Cart',     screen: 'OnlineOrder', emoji: '🛒' },
    walkin_pay:   { label: 'Pay at Restaurant', screen: 'PayAtStore',  emoji: '💸' },
    pay_at_store: { label: 'Pay at Restaurant', screen: 'PayAtStore',  emoji: '💸' },
    prebook:      { label: 'Book a Table',    screen: 'PreBook',     emoji: '📅' },
  },
  bakery: {
    online_order: { label: 'Order Online', screen: 'OnlineOrder', emoji: '🧁' },
    walkin_pay:   { label: 'Pay at Bakery', screen: 'PayAtStore',  emoji: '💸' },
    pay_at_store: { label: 'Pay at Bakery', screen: 'PayAtStore',  emoji: '💸' },
  },
  salon: {
    walkin_pay:   { label: 'Pay at Salon',  screen: 'PayAtStore', emoji: '💸' },
    pay_at_store: { label: 'Pay at Salon',  screen: 'PayAtStore', emoji: '💸' },
    prebook:      { label: 'Book Appointment', screen: 'PreBook',  emoji: '✂️' },
  },
  car_rental: {
    prebook:      { label: 'Book These Dates', screen: 'PreBook',  emoji: '🚗' },
    walkin_pay:   { label: 'Pay at Garage', screen: 'PayAtStore',  emoji: '💸' },
    pay_at_store: { label: 'Pay at Garage', screen: 'PayAtStore',  emoji: '💸' },
  },
  bike_rental: {
    prebook:      { label: 'Reserve Bike',  screen: 'PreBook',     emoji: '🏍️' },
    walkin_pay:   { label: 'Pay at Pickup', screen: 'PayAtStore',  emoji: '💸' },
    pay_at_store: { label: 'Pay at Pickup', screen: 'PayAtStore',  emoji: '💸' },
  },
  fashion:        { online_order: { label: 'Order Online', screen: 'OnlineOrder', emoji: '👗' }, walkin_pay: { label: 'Pay at Store', screen: 'PayAtStore', emoji: '💸' }, pay_at_store: { label: 'Pay at Store', screen: 'PayAtStore', emoji: '💸' } },
  fashion_walkin: { online_order: { label: 'Order Online', screen: 'OnlineOrder', emoji: '👗' }, walkin_pay: { label: 'Pay at Store', screen: 'PayAtStore', emoji: '💸' }, pay_at_store: { label: 'Pay at Store', screen: 'PayAtStore', emoji: '💸' } },
  fashion_online: { online_order: { label: 'Order Online', screen: 'OnlineOrder', emoji: '👕' }, walkin_pay: { label: 'Pay at Store', screen: 'PayAtStore', emoji: '💸' }, pay_at_store: { label: 'Pay at Store', screen: 'PayAtStore', emoji: '💸' } },
  furniture:      { online_order: { label: 'Order Online', screen: 'OnlineOrder', emoji: '🛋️' }, walkin_pay: { label: 'Pay at Store', screen: 'PayAtStore', emoji: '💸' }, pay_at_store: { label: 'Pay at Store', screen: 'PayAtStore', emoji: '💸' } },
};

// Founder-locked PRODUCT-page CTA order per business (Docs/CTA_SPEC.md,
// 2026-06-11) — first entry = primary. Filtered to the offer's availing
// modes when it carries any; categories not listed keep availing-mode order.
const CATEGORY_CTA_ORDER = {
  restaurant:     ['online_order', 'pay_at_store'],
  fashion:        ['pay_at_store', 'online_order'],
  fashion_walkin: ['pay_at_store', 'online_order'],
  fashion_online: ['pay_at_store', 'online_order'],
  furniture:      ['pay_at_store', 'online_order'],
  salon:          ['prebook', 'pay_at_store'],
  car_rental:     ['prebook'],
};

function getModeConfig(mode, category) {
  const catOverrides = CATEGORY_LABELS[category];
  if (catOverrides && catOverrides[mode]) return catOverrides[mode];
  return MODE_LABELS[mode] || null;
}

export default function ProductDetailScreen({ navigation, route }) {
  const {
    offer,
    brand,
    store,
    influencer,
    selectedProductId,
    product: previewProduct,   // optional — drawn from the card the user tapped
    products: routeProducts,   // optional — ORGANIC path: caller already has them
    tracking,
    trackingParams,
  } = route.params || {};

  const handle = store?.instagram_handle || influencer?.instagram_handle || '';
  const trk = tracking || trackingParams || null;
  // Offer identity (contract: features/sprint1-offer-pipeline). Feed taps pass
  // explicit ci_id (assignments) / brand_offer_id (store + showcase library
  // offers). Feed tracking uses SHORT keys {cid,sid,oid,iid} — iid is the
  // INFLUENCER id, never a campaign_influencer id, and oid is the LIBRARY
  // offer id, never a campaign_offers id. Legacy entry points (BrandStore et
  // al) still pass long-form tracking and real campaign offer ids — kept.
  const ciId = offer?.ci_id || trk?.campaign_influencer_id || null;
  const brandOfferId = offer?.brand_offer_id || null;
  const legacyOfferId = (!offer?.ci_id && !offer?.brand_offer_id)
    ? (offer?.id || offer?.offer_id || trk?.offer_id || null)
    : null;

  const [products, setProducts] = useState(previewProduct ? [previewProduct] : []);
  const [offerExtra, setOfferExtra] = useState(null); // discount/config enrich from the store-offer fetch
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAddons, setSelectedAddons] = useState({}); // conditional Customize (food add-ons)
  const [selectedSize, setSelectedSize] = useState(null);     // conditional Variants (fashion size)
  const [selectedColour, setSelectedColour] = useState(null); // fashion/furniture colour (variants_json.colors[])

  // Per-business accent: WAYFINDING tints only (hero / card image bg). Chrome,
  // CTAs, prices stay ink + yellow per the F0 design language.
  const acc = getBusinessAccentLight(brand?.category);
  const accent = acc.accent;     // e.g. fashion pink — used only for tints below
  const accentPale = acc.pale;   // hero / "more" image tint

  useEffect(() => {
    async function load() {
      // Path 0 — ORGANIC (walkthrough W9): the business page already handed us
      // the products; no creator, no offer, nothing to fetch.
      if (Array.isArray(routeProducts) && routeProducts.length) {
        setProducts(routeProducts);
        setLoading(false);
        return;
      }
      // Path 1 — creator context (assignment or legacy campaign offer):
      // products scoped via the creator's store endpoint.
      if (handle && (ciId || legacyOfferId)) {
        const res = await followerApi.getStoreProducts(handle, {
          offerId: ciId ? null : legacyOfferId, // never send a library oid here
          ciId,
        });
        setLoading(false);
        if (res.success) setProducts(res.data?.products || []);
        else setError(res.error?.message || 'Failed to load product');
        return;
      }
      // Path 2 — library offer with no creator (store-direct / showcase):
      // dedicated detail endpoint; also enriches the offer mechanics for
      // the OfferBlock when the feed item didn't carry them.
      if (brandOfferId) {
        const res = await followerApi.getStoreOffer(brandOfferId);
        setLoading(false);
        if (res.success) {
          setProducts(res.data?.products || []);
          if (res.data?.offer) {
            const o = res.data.offer;
            setOfferExtra({ discount: o.discount, config: o.config, availing_modes: o.availing_modes, offer_type: o.offer_type });
          }
        } else {
          setError(res.error?.message || 'Failed to load offer');
        }
        return;
      }
      // Path 3 — plain product tap (library / platform shelf, e.g. Section Results,
      // banner-gateway, hero tile): no creator and no offer to fetch. Render the
      // product we were handed directly instead of erroring.
      if (previewProduct) {
        setProducts([previewProduct]);
        setLoading(false);
        return;
      }
      setError(!handle
        ? 'Missing creator handle'
        : 'Missing offer context — the tap source did not pass an offer or campaign assignment id');
      setLoading(false);
    }
    load();
  }, [handle, legacyOfferId, ciId, brandOfferId]);

  const selected = products.find(p => p.id === selectedProductId) || products[0] || previewProduct || null;
  const others = products.filter(p => p.id !== selected?.id);

  // The offer the screen computes with: route param + any mechanics enrich
  // fetched from the store-offer endpoint (route values win when present).
  const offerFull = offerExtra ? { ...offerExtra, ...offer, config: offer?.config || offerExtra.config, discount: offer?.discount || offerExtra.discount } : offer;

  // ── Compute prices ─────────────────────────────────────────────────────
  const price = parseFloat(selected?.price || 0);
  const discountValue = parseFloat(offerFull?.discount_value ?? offerFull?.discount?.value ?? 0);
  let finalPrice = price;
  let savings = 0;
  let badgeLabel = null;
  if (offerFull && discountValue > 0) {
    const ot = (offerFull.offer_type || '').toLowerCase();
    if (ot === 'percentage' || ot === 'discount' || ot === '') {
      savings = parseFloat((price * (discountValue / 100)).toFixed(2));
      finalPrice = parseFloat((price - savings).toFixed(2));
      badgeLabel = `${discountValue}% OFF`;
    } else if (ot === 'flat') {
      savings = Math.min(discountValue, price);
      finalPrice = parseFloat((price - savings).toFixed(2));
      badgeLabel = `${fmtRupees(discountValue)} OFF`;
    } else if (ot === 'bogo') {
      badgeLabel = 'BOGO';
    } else if (ot === 'bundle') {
      badgeLabel = 'BUNDLE';
    } else if (ot === 'volume' || ot === 'volume_discount') {
      badgeLabel = 'VOLUME DEAL';
    } else if (ot === 'free_gift' || ot === 'gift') {
      badgeLabel = '+ FREE GIFT';
    }
  }

  // ── Conditional Customize / Variants (brand-defined; auto-hidden when absent) ──
  const variantsJson = (() => {
    const v = selected?.variants_json;
    if (!v) return {};
    if (typeof v === 'string') { try { return JSON.parse(v); } catch { return {}; } }
    return v;
  })();
  const addons = Array.isArray(selected?.addons) ? selected.addons
    : (Array.isArray(variantsJson.addons) ? variantsJson.addons : []);
  // Fashion/furniture matrix lives in variants_json.colors[] =
  // [{ color, sizes:[{ sku, size, price, stock }], images }] — there are no
  // product_variants rows. Legacy/food shape is a flat variants_json.sizes |
  // .options list with no colour. Support both; colour-first when present.
  const colours = Array.isArray(variantsJson.colors) ? variantsJson.colors : [];
  const hasColourMatrix = colours.length > 0;
  const colourName = (c) => (c && (c.color ?? c.colour)) || null;
  const activeColour = hasColourMatrix
    ? (colours.find(c => colourName(c) === selectedColour) || colours[0])
    : null;
  const sizes = hasColourMatrix
    ? (Array.isArray(activeColour?.sizes) ? activeColour.sizes : [])
    : (Array.isArray(variantsJson.sizes) ? variantsJson.sizes
       : (Array.isArray(variantsJson.options) ? variantsJson.options : []));
  const sizeLabel = (sz) => (typeof sz === 'string' ? sz : (sz?.label || sz?.value || sz?.size));
  const selectedSizeObj = sizes.find(sz => sizeLabel(sz) === selectedSize) || null;
  // Variant identity = SKU (string); price is base (overrides are null today).
  const variantSku = (selectedSizeObj && selectedSizeObj.sku) || null;
  const variantLabel = [hasColourMatrix ? colourName(activeColour) : null, selectedSize]
    .filter(Boolean).join(' · ') || null;
  const needsSize = sizes.length > 0 && !selectedSize;
  const addonPrice = (a) => parseFloat(a?.price ?? a?.amount ?? 0) || 0;
  const addonsTotal = addons.reduce((sum, a, i) => sum + (selectedAddons[i] ? addonPrice(a) : 0), 0);
  const addonsCount = Object.values(selectedAddons).filter(Boolean).length;
  const runningTotal = parseFloat((finalPrice + addonsTotal).toFixed(2));

  // rating (per-product when present, else the brand's) — shown only if real
  const ratingVal = selected?.rating ?? brand?.avg_rating ?? brand?.rating ?? null;
  const reviewCount = selected?.review_count ?? brand?.review_count ?? null;

  // ── CTA list from availing_modes — category-aware ─────────────────────
  // For restaurants/salons/cars we use category-specific verbs (Book a Table,
  // Pay at Restaurant, Reserve Car) instead of generic ones (Book Slot,
  // Pay at Venue). Falls back to generic labels for other categories.
  const rawModes = Array.isArray(offerFull?.availing_modes) && offerFull.availing_modes.length
    ? offerFull.availing_modes
    : ['online_order'];
  // Founder-locked rule (W9 rev): for the 5 specced categories the CATEGORY
  // spec WINS OUTRIGHT — a creator offer that happens to carry fewer availing
  // modes must not shrink the product page's buttons. Offer modes only drive
  // unspecced categories.
  const specOrder = CATEGORY_CTA_ORDER[brand?.category] || null;
  const availSet = new Set(rawModes.map(m => (m === 'walkin_pay' ? 'pay_at_store' : m)));
  let availingModes = specOrder ? [...specOrder] : [...availSet];
  if (!availingModes.length) availingModes = [...availSet];
  const ctaList = [];
  const seenScreens = new Set();
  for (const m of availingModes) {
    const cfg = getModeConfig(m, brand?.category);
    if (!cfg || seenScreens.has(cfg.screen)) continue;
    seenScreens.add(cfg.screen);
    ctaList.push({ mode: m, ...cfg });
  }
  if (ctaList.length === 0) {
    const fallback = getModeConfig('online_order', brand?.category) || MODE_LABELS.online_order;
    ctaList.push({ mode: 'online_order', ...fallback });
  }
  const primaryCta = ctaList[0];
  const secondaryCtas = ctaList.slice(1);

  // Long-form attribution for the transact screens. Feed tracking carries
  // SHORT keys {cid,sid,oid,iid}; payAtStore/orders validate the LONG keys —
  // and the library oid is NOT a campaign offer id, so it is never forwarded
  // as offer_id (contract: features/sprint1-offer-pipeline).
  const txTracking = (ciId || trk?.campaign_id || trk?.cid) ? {
    campaign_id: trk?.campaign_id || trk?.cid || null,
    set_id: trk?.set_id || trk?.sid || null,
    offer_id: trk?.offer_id || null,
    campaign_influencer_id: trk?.campaign_influencer_id || ciId || null,
  } : null;

  function dispatchCta(cta) {
    if (!selected) return;
    // Block checkout until a size is chosen (when the product offers sizes) —
    // the brand can't fulfill "some size".
    if (needsSize) { Alert.alert('Select a size', 'Please pick a size before continuing.'); return; }
    // Compose the cart for offer-type mechanics: BOGO adds the free item, bundle
    // adds all set products, free_gift adds the gift. Discount/Volume → just the
    // picked item. The SERVER re-prices authoritatively (resolveOfferDiscount).
    const composed = composeCart(offerFull, {
      id: selected.id,
      name: selected.name,
      price: parseFloat(selected.price || finalPrice || 0),
      quantity: 1,
    });
    // Attach the chosen colour·size + SKU to the picked line so the cart can
    // display it and the order records what to fulfill (variant_id stays null —
    // these products have no product_variants rows; price is base).
    const lines = (composed.items.length ? composed.items : [selected]).map(it =>
      it.id === selected.id ? { ...it, variant_sku: variantSku, variant_label: variantLabel } : it
    );
    const params = {
      offer: offerFull,
      brand,
      store: store || { name: brand?.name, instagram_handle: handle },
      influencer,
      product: selected,
      products: lines,
      offer_composed: composed,   // { items, note, freeIds } — checkout can show free lines
      selected_addons: addons.filter((_, i) => selectedAddons[i]),
      selected_size: selectedSize,
      selected_colour: hasColourMatrix ? colourName(activeColour) : null,
      tracking: txTracking,
      trackingParams: txTracking,
      // Store-direct buy (Offer Engine D3 + W9 organic): PayAtStore routes
      // through POST /follower/store-offer/pay when this is set. With NO
      // offer at all (organic browse) brand_offer_id is omitted — the
      // backend now accepts a plain direct payment (zero discount).
      storeOffer: (!txTracking && brand?.id)
        ? { brand_id: brand.id, ...(brandOfferId ? { brand_offer_id: brandOfferId } : {}) }
        : undefined,
    };
    navigation.navigate(cta.screen, params);
  }

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading && !selected) {
    return <View style={styles.center}><ActivityIndicator size="large" color={P.ink} /></View>;
  }

  if (error || !selected) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 32, marginBottom: 8 }}>📦</Text>
        <Text style={styles.emptyText}>{error || 'Product not available'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackBtn}>
          <Text style={styles.goBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.outer}>
      <ScrollView style={styles.container}>
        {/* Back button (floats over the hero) */}
        <TouchableOpacity style={styles.backFloating} onPress={() => navigation.goBack()}>
          <Text style={styles.backFloatingText}>←</Text>
        </TouchableOpacity>
        {/* ♡ + share (contract: universal-share-links) */}
        <View style={styles.heroIconsRight}>
          <View style={styles.heroIcon}><Text style={styles.heroIconGlyph}>♡</Text></View>
          <TouchableOpacity style={styles.heroIcon}
            onPress={() => shareTarget(
              brandOfferId
                ? { type: 'offer', id: brandOfferId, cid: trk?.cid || trk?.campaign_id, sid: trk?.sid || trk?.set_id }
                : { type: 'product', id: selected?.id, cid: trk?.cid || trk?.campaign_id, sid: trk?.sid || trk?.set_id },
              `Check this out on INFLX${selected?.name ? ` — ${selected.name}` : ''}`)}>
            <Text style={styles.heroIconGlyph}>↗</Text>
          </TouchableOpacity>
        </View>

        {/* Hero image */}
        <View style={[styles.hero, { backgroundColor: accentPale }]}>
          {selected.image_url ? (
            <Image source={{ uri: selected.image_url }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <Text style={styles.heroEmoji}>{CATEGORY_EMOJI[brand?.category] || '📦'}</Text>
          )}
          {badgeLabel && (
            <View style={[styles.heroBadge, { backgroundColor: P.ink }]}>
              <Text style={styles.heroBadgeText}>{badgeLabel}</Text>
            </View>
          )}
        </View>

        {/* Title + brand + creator note */}
        <View style={styles.body}>
          <Text style={styles.productName}>{selected.name}</Text>

          {ratingVal != null ? (
            <View style={styles.ratingRow}>
              <Text style={styles.ratingStars}>★</Text>
              <Text style={styles.ratingVal}>{Number(ratingVal).toFixed(1)}</Text>
              {reviewCount != null ? <Text style={styles.ratingCount}>({reviewCount} reviews)</Text> : null}
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.brandRow}
            onPress={() => navigation.navigate('BrandStore', {
              brandId: brand?.id,
              brandName: brand?.name,
              tracking: trk,
            })}
          >
            <Text style={styles.brandLine} numberOfLines={1}>
              from {brand?.name}{brand?.city || brand?.locality ? ` · ${brand.city || brand.locality}` : ''}
            </Text>
            <Text style={[styles.brandChevron, { color: P.muted2 }]}>{'›'}</Text>
          </TouchableOpacity>

          {selected.section ? (
            <Text style={styles.section}>{selected.section}</Text>
          ) : null}

          {/* Creator's vibe */}
          {selected.influencer_note ? (
            <View style={styles.noteBox}>
              <Text style={[styles.noteAttribution, { color: P.yellow }]}>
                {influencer?.name || influencer?.instagram_handle ? `@${influencer.instagram_handle || influencer.name}'s take` : "Creator's take"}
              </Text>
              <Text style={styles.noteQuote}>"{selected.influencer_note}"</Text>
            </View>
          ) : null}

          {/* Price block */}
          <View style={styles.priceBlock}>
            <View style={styles.priceRow}>
              <Text style={styles.priceFinal}>{fmtRupees(finalPrice)}</Text>
              {savings > 0 ? (
                <Text style={styles.priceMRP}>{fmtRupees(price)}</Text>
              ) : null}
            </View>
            {savings > 0 ? (
              <Text style={[styles.savings, { color: P.successText }]}>You save {fmtRupees(savings)}</Text>
            ) : null}
          </View>

          {/* Offer mechanics — type-specific block (discount / volume / bogo / bundle / gift) */}
          <OfferBlock offer={offerFull} />

          {/* Customize — food add-ons (conditional, brand-defined) */}
          {addons.length > 0 ? (
            <View style={styles.customizeBlock}>
              <Text style={styles.blockTitle}>Customize</Text>
              {addons.map((a, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.addonRow}
                  activeOpacity={0.8}
                  onPress={() => setSelectedAddons(s => ({ ...s, [i]: !s[i] }))}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addonName}>{a.name || a.label}</Text>
                    <Text style={styles.addonPrice}>+ {fmtRupees(addonPrice(a))}{a.note ? ` · ${a.note}` : ''}</Text>
                  </View>
                  <View style={[styles.toggle, selectedAddons[i] && styles.toggleOn]}>
                    <View style={[styles.toggleKnob, selectedAddons[i] && styles.toggleKnobOn]} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {/* Colour — fashion/furniture matrix (variants_json.colors[]) */}
          {hasColourMatrix ? (
            <View style={styles.customizeBlock}>
              <Text style={styles.blockTitle}>Select Colour</Text>
              <View style={styles.sizeRow}>
                {colours.map((c, i) => {
                  const name = colourName(c);
                  const on = (selectedColour || colourName(activeColour)) === name;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.sizeChip, on && styles.sizeChipOn]}
                      onPress={() => { setSelectedColour(name); setSelectedSize(null); }}
                    >
                      <Text style={[styles.sizeChipTxt, on && styles.sizeChipTxtOn]}>{name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Variants — size/options (conditional, brand-defined) */}
          {sizes.length > 0 ? (
            <View style={styles.customizeBlock}>
              <Text style={styles.blockTitle}>Select Size</Text>
              <View style={styles.sizeRow}>
                {sizes.map((sz, i) => {
                  const label = sizeLabel(sz);
                  const on = selectedSize === label;
                  return (
                    <TouchableOpacity key={i} style={[styles.sizeChip, on && styles.sizeChipOn]} onPress={() => setSelectedSize(label)}>
                      <Text style={[styles.sizeChipTxt, on && styles.sizeChipTxtOn]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Description */}
          {selected.description ? (
            <View style={styles.descBlock}>
              <Text style={styles.descTitle}>Details</Text>
              <Text style={styles.descBody}>{selected.description}</Text>
            </View>
          ) : null}

          {/* More from this brand */}
          {others.length > 0 && (
            <View style={styles.moreBlock}>
              <Text style={styles.moreTitle}>More from {brand?.name}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
                {others.slice(0, 10).map(other => (
                  <TouchableOpacity
                    key={other.id}
                    style={styles.moreCard}
                    onPress={() => navigation.replace('ProductDetail', {
                      offer,
                      brand,
                      store,
                      influencer,
                      selectedProductId: other.id,
                      product: other,
                      tracking: trk,
                      trackingParams: trk,
                    })}
                  >
                    <View style={[styles.moreImg, { backgroundColor: accentPale }]}>
                      {other.image_url ? (
                        <Image source={{ uri: other.image_url }} style={styles.moreImgFill} resizeMode="cover" />
                      ) : (
                        <Text style={styles.moreEmoji}>{CATEGORY_EMOJI[brand?.category] || '📦'}</Text>
                      )}
                    </View>
                    <Text style={styles.moreName} numberOfLines={2}>{other.name}</Text>
                    <Text style={[styles.morePrice, { color: P.ink }]}>{fmtRupees(other.discounted_price || other.price)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* In-store nudge (founder W9 model): offline pay via INFLX carries the
          deal discount — shown only when both pay paths are on offer. */}
      {ctaList.some(c => c.screen === 'PayAtStore') && ctaList.some(c => c.screen === 'OnlineOrder') && (
        <View style={styles.instoreHint}>
          <Text style={styles.instoreHintText} numberOfLines={2}>
            🏬 At the store? Pay via INFLX{discountValue > 0 ? ' — the deal discount applies' : ''}. Not there? Order online.
          </Text>
        </View>
      )}

      {/* Sticky bottom CTA bar — ALL modes side-by-side (founder sprint-2
          revision: tabs at the bottom, not stacked mid-page). */}
      <View style={styles.footer}>
        <View style={{ flex: 1, minWidth: 76 }}>
          <Text style={styles.footerPrice}>{fmtRupees(runningTotal)}</Text>
          <Text style={styles.footerName} numberOfLines={1}>
            {addonsCount > 0 ? `incl. ${addonsCount} add-on${addonsCount > 1 ? 's' : ''}` : (selectedSize ? `size ${selectedSize}` : selected.name)}
          </Text>
        </View>
        {secondaryCtas.map(cta => (
          <TouchableOpacity
            key={cta.mode}
            style={[styles.footerSecondaryCta, { borderColor: C.brown }]}
            onPress={() => dispatchCta(cta)}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}
              style={[styles.footerSecondaryCtaText, { color: C.brown }]}>
              {cta.emoji} {cta.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.primaryCta, { backgroundColor: C.brown }]}
          onPress={() => dispatchCta(primaryCta)}
        >
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}
            style={styles.primaryCtaText}>{primaryCta.emoji} {primaryCta.label}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: P.bg },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.bg },
  emptyText: { fontFamily: fonts.sansMedium, fontSize: 14, color: P.muted, marginBottom: 16, paddingHorizontal: 32, textAlign: 'center' },
  goBackBtn: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: P.bg2, borderRadius: 12 },
  goBackBtnText: { fontFamily: fonts.sansBold, fontSize: 14, color: P.ink },

  backFloating: {
    position: 'absolute', top: 44, left: 16, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  backFloatingText: { fontSize: 18, color: P.ink, fontWeight: '700' },

  hero: { height: 280, alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  heroImage: { width: '100%', height: '100%' },
  heroEmoji: { fontSize: 96 },
  heroBadge: {
    position: 'absolute', top: 56, right: 16,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
  },
  heroBadgeText: { fontFamily: fonts.monoBold, fontSize: 12, color: P.yellow },

  heroIconsRight: { position: 'absolute', top: 44, right: 16, zIndex: 10, flexDirection: 'row', gap: 8 },
  heroIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  heroIconGlyph: { fontSize: 16, color: P.ink },

  body: { padding: 20 },
  productName: { fontFamily: fonts.serifDisplay, fontWeight: '600', fontSize: 22, color: P.ink, marginBottom: 6 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  ratingStars: { fontSize: 12, color: C.star },
  ratingVal: { fontFamily: fonts.sansBold, fontSize: 12, color: P.ink },
  ratingCount: { fontFamily: fonts.sansMedium, fontSize: 11, color: P.muted },

  customizeBlock: { marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: P.border },
  blockTitle: { fontFamily: fonts.displayBold, fontSize: 13, color: P.ink, marginBottom: 8 },
  addonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: P.border },
  addonName: { fontFamily: fonts.sansBold, fontSize: 13, color: P.ink },
  addonPrice: { fontFamily: fonts.sansMedium, fontSize: 11, color: P.muted, marginTop: 1 },
  toggle: { width: 44, height: 25, borderRadius: 30, backgroundColor: '#d8cebd', justifyContent: 'center' },
  toggleOn: { backgroundColor: C.brown },
  toggleKnob: { width: 19, height: 19, borderRadius: 10, backgroundColor: '#fff', marginLeft: 3 },
  toggleKnobOn: { marginLeft: 22 },
  sizeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sizeChip: { minWidth: 42, height: 42, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1.5, borderColor: P.border, alignItems: 'center', justifyContent: 'center' },
  sizeChipOn: { borderColor: C.brown, backgroundColor: C.soft },
  sizeChipTxt: { fontFamily: fonts.sansBold, fontSize: 13, color: P.muted },
  sizeChipTxtOn: { color: C.brown },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  brandLine: { fontFamily: fonts.sansMedium, fontSize: 13, color: P.muted, flexShrink: 1 },
  brandChevron: { fontSize: 16, fontWeight: '300' },
  section: { fontFamily: fonts.monoMedium, fontSize: 11, color: P.muted2, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },

  // creator-vibe note bar — ink bg + yellow attribution + yellowPale quote
  noteBox: {
    marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: P.ink,
  },
  noteAttribution: { fontFamily: fonts.monoBold, fontSize: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  noteQuote: { fontFamily: fonts.sansMedium, fontSize: 13, color: P.yellowPale, fontStyle: 'italic', lineHeight: 19 },

  priceBlock: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: P.border },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  priceFinal: { fontFamily: fonts.monoBold, fontSize: 28, color: P.ink },
  priceMRP: { fontFamily: fonts.monoMedium, fontSize: 14, color: P.muted3, textDecorationLine: 'line-through' },
  savings: { fontFamily: fonts.monoBold, fontSize: 12, marginTop: 4 },

  descBlock: { marginTop: 18, paddingTop: 18, borderTopWidth: 1, borderTopColor: P.border },
  descTitle: { fontFamily: fonts.monoBold, fontSize: 11, color: P.muted2, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  descBody: { fontFamily: fonts.sansRegular, fontSize: 13, color: P.ink2, lineHeight: 20 },

  secondaryCtaRow: { flexDirection: 'row', gap: 8, marginTop: 18, flexWrap: 'wrap' },
  secondaryCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1.5,
  },
  secondaryCtaEmoji: { fontSize: 14 },
  secondaryCtaText: { fontFamily: fonts.sansBold, fontSize: 13 },

  moreBlock: { marginTop: 22 },
  moreTitle: { fontFamily: fonts.displayBold, fontSize: 13, color: P.ink, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  moreCard: { width: 130 },
  moreImg: { width: 130, height: 100, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  moreImgFill: { width: '100%', height: '100%' },
  moreEmoji: { fontSize: 36 },
  moreName: { fontFamily: fonts.sansBold, fontSize: 12, color: P.ink, marginTop: 6, lineHeight: 15 },
  morePrice: { fontFamily: fonts.monoBold, fontSize: 13, marginTop: 2 },

  footer: {
    backgroundColor: P.white, borderTopWidth: 1, borderTopColor: P.border,
    paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  footerPrice: { fontFamily: fonts.monoBold, fontSize: 20, color: P.ink },
  footerName: { fontFamily: fonts.sansMedium, fontSize: 11, color: P.muted, marginTop: 2 },
  primaryCta: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, maxWidth: '52%' },
  instoreHint: { backgroundColor: C.soft, paddingHorizontal: 16, paddingVertical: 7 },
  instoreHintText: { fontFamily: fonts.sansMedium, fontSize: 11, color: C.ink, opacity: 0.75 },
  footerSecondaryCta: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 13, maxWidth: '34%' },
  footerSecondaryCtaText: { fontSize: 11.5, fontWeight: '800' },
  primaryCtaText: { fontFamily: fonts.displayBlack, fontSize: 14, color: C.onGold, textTransform: 'uppercase', letterSpacing: 0.3 },
});
