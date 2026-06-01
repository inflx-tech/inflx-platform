import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { creatorVibe as C, spacing, radius, fmtMoney } from '../theme/tokens';

// Flow 52.G — Creator Vibe recolor shim. OfferCard was on the legacy navy/teal/
// orange `colors` palette; remap → creatorVibe. All mode CTAs collapse to the
// terracotta action color (enquiry stays an outline). Visual only; discount/
// price math + CTA dispatch unchanged.
const colors = {
  white: C.card, border: C.line, border2: C.line,
  t1: C.ink, t2: C.muted, t3: C.muted,
  navy: C.brown, tealDeep: C.brown, orange: C.brown, orangeDeep: C.brown,
  orangePale: C.soft, red: C.offer, redPale: C.soft,
};

/**
 * OfferCard — the core card used throughout the Follower app.
 * Product-centric with optional influencer strip on top.
 *
 * Props:
 *   brand       { name, category, city }
 *   offer       { offer_type, discount_value, availing_modes, prebook_advance }
 *   product     { name, price, image_url, description } — price in paise
 *   influencer  { name, handle, note_text, is_followed } — null to hide strip
 *   influencer_count  number — shows "N influencers promoting" badge
 *   tracking    { campaign_id, set_id, offer_id, campaign_influencer_id }
 *   isSaved     boolean
 *   onSave      () => void
 *   onPressCTA  (mode) => void — 'pay_at_store' | 'prebook' | 'online_order' | 'enquiry'
 *   onPressInfluencer () => void
 *   onPressBrand      () => void
 *   onPressCard       () => void
 */
export default function OfferCard({
  brand, offer, product, influencer, influencer_count,
  tracking, isSaved, onSave, onPressCTA, onPressInfluencer, onPressBrand, onPressCard,
}) {
  const discountLabel = getDiscountLabel(offer);
  const discountedPrice = product ? getDiscountedPrice(product.price, offer) : 0;
  const savings = product ? product.price - discountedPrice : 0;
  const modes = offer?.availing_modes || [];
  const primaryMode = modes[0] || 'online_order';

  return (
    <TouchableOpacity style={s.card} activeOpacity={0.9} onPress={onPressCard}>
      {/* Influencer strip */}
      {influencer && (
        <TouchableOpacity style={s.infStrip} onPress={onPressInfluencer} activeOpacity={0.7}>
          <View style={s.infAvatar}>
            <Text style={s.infAvatarText}>{getInitials(influencer.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.infName}>{influencer.name}</Text>
            {influencer.note_text ? (
              <Text style={s.infQuote} numberOfLines={2}>"{influencer.note_text}"</Text>
            ) : (
              <Text style={s.infHandle}>@{influencer.handle}</Text>
            )}
          </View>
          {influencer_count > 1 && (
            <View style={s.multiInfluencerBadge}>
              <Text style={s.multiInfluencerText}>+{influencer_count - 1}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Product image area */}
      <View style={s.imageArea}>
        {product?.image_url ? (
          <Image source={{ uri: product.image_url }} style={s.productImage} />
        ) : (
          <View style={s.imagePlaceholder}>
            <Text style={{ fontSize: 40 }}>{getCategoryEmoji(brand?.category)}</Text>
          </View>
        )}
        {discountLabel && (
          <View style={s.discountBadge}>
            <Text style={s.discountBadgeText}>{discountLabel}</Text>
          </View>
        )}
      </View>

      {/* Body */}
      <View style={s.body}>
        <TouchableOpacity onPress={onPressBrand} activeOpacity={0.7}>
          <Text style={s.brandName}>{brand?.name || 'Brand'}</Text>
        </TouchableOpacity>
        <Text style={s.category}>{brand?.category?.replace(/_/g, ' ')} · {brand?.city || ''}</Text>

        {/* Product name if available */}
        {product?.name && (
          <Text style={s.productName} numberOfLines={1}>{product.name}</Text>
        )}

        {/* Price row */}
        {product && product.price > 0 && (
          <View style={s.priceRow}>
            <Text style={s.discountedPrice}>{fmtMoney(discountedPrice)}</Text>
            {savings > 0 && (
              <>
                <Text style={s.originalPrice}>{fmtMoney(product.price)}</Text>
                <Text style={s.savings}>Save {fmtMoney(savings)}</Text>
              </>
            )}
          </View>
        )}

        {/* CTA buttons */}
        <View style={s.ctaRow}>
          <TouchableOpacity
            style={[s.ctaBtn, getCTAStyle(primaryMode)]}
            onPress={() => onPressCTA?.(primaryMode)}
          >
            <Text style={[s.ctaBtnText, getCTATextStyle(primaryMode)]}>
              {getCTALabel(primaryMode)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.saveBtn} onPress={onSave}>
            <Text style={{ fontSize: 16 }}>{isSaved ? '🔖' : '🏷️'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Helpers ──

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

function getDiscountLabel(offer) {
  if (!offer) return null;
  switch (offer.offer_type) {
    case 'percentage': return `${offer.discount_value}% OFF`;
    case 'flat': return `₹${offer.discount_value} OFF`;
    case 'bogo': return 'BOGO';
    case 'bundle': return 'BUNDLE';
    case 'volume': return 'BULK DEAL';
    case 'prebook': return 'PRE-BOOK';
    default: return null;
  }
}

// All inputs in rupees (post-migration). Discount applied in same unit.
function getDiscountedPrice(price, offer) {
  if (!offer || !price) return price || 0;
  if (offer.offer_type === 'percentage') {
    return parseFloat((price * (1 - (offer.discount_value || 0) / 100)).toFixed(2));
  }
  if (offer.offer_type === 'flat') {
    return Math.max(0, price - (offer.discount_value || 0));
  }
  return price;
}

function getCategoryEmoji(cat) {
  const map = {
    restaurant: '🍽️', bakery: '🎂', salon: '💇', florist: '🌹',
    packaged_food: '📦', car_rental: '🚗', function_hall: '🏛️',
    wedding_planner: '💒', fashion_walkin: '👗', fashion_online: '🛍️',
  };
  return map[cat] || '🏪';
}

function getCTALabel(mode) {
  switch (mode) {
    case 'pay_at_store': return 'Pay at store →';
    case 'prebook': return 'Book now →';
    case 'online_order': return 'Buy online →';
    case 'enquiry': return 'Enquire →';
    default: return 'View →';
  }
}

function getCTAStyle(mode) {
  switch (mode) {
    case 'pay_at_store': return { backgroundColor: colors.tealDeep };
    case 'prebook': return { backgroundColor: colors.navy };
    case 'online_order': return { backgroundColor: colors.orange };
    case 'enquiry': return { backgroundColor: colors.redPale, borderWidth: 1.5, borderColor: 'rgba(232,64,26,0.25)' };
    default: return { backgroundColor: colors.orange };
  }
}

function getCTATextStyle(mode) {
  if (mode === 'enquiry') return { color: colors.red };
  return { color: '#fff' };
}

// ── Styles ──

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  infStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 13,
    backgroundColor: 'rgba(244,121,32,0.04)',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.orangePale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infAvatarText: { fontSize: 10, fontWeight: '700', color: colors.orangeDeep },
  infName: { fontSize: 11, fontWeight: '600', color: colors.t1 },
  infQuote: { fontSize: 10, color: colors.t2, fontStyle: 'italic', lineHeight: 14 },
  infHandle: { fontSize: 10, color: colors.t3 },
  multiInfluencerBadge: {
    backgroundColor: colors.orangePale,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  multiInfluencerText: { fontSize: 10, fontWeight: '700', color: colors.orangeDeep },
  imageArea: {
    width: '100%',
    height: 120,
    backgroundColor: '#FFF3E8',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  productImage: { width: '100%', height: 120, resizeMode: 'cover' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.red,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  discountBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  body: { padding: 13 },
  brandName: { fontSize: 15, fontWeight: '700', color: colors.t1, marginBottom: 2 },
  category: { fontSize: 10, color: colors.t3, marginBottom: 4 },
  productName: { fontSize: 12, fontWeight: '600', color: colors.t2, marginBottom: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginBottom: 10 },
  discountedPrice: { fontSize: 20, fontWeight: '800', color: colors.tealDeep },
  originalPrice: { fontSize: 13, color: colors.t3, textDecorationLine: 'line-through' },
  savings: { fontSize: 11, fontWeight: '700', color: colors.tealDeep },
  ctaRow: { flexDirection: 'row', gap: 7 },
  ctaBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnText: { fontSize: 13, fontWeight: '700' },
  saveBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
