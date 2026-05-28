import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { brandPalette as lightColors, fonts } from '../../theme/tokens';
import CreatorChip from './CreatorChip';
import OfferPill from './OfferPill';
import StatusPill from './StatusPill';

/**
 * RestaurantCard — feed/browse card for a single restaurant.
 *
 * Composes CreatorChip + OfferPill + StatusPill. Outfit font for the
 * brand name, JetBrains Mono for the cost-for-two / distance / rating,
 * yellow accents for open status and offer, ink chips for vibes.
 *
 * Two density modes:
 *   - 'feed'  (default) — full card with hero photo, heart, full meta row
 *   - 'list'  — compact horizontal row for browse results
 *
 * Props:
 *   restaurant — {
 *     id, business_name, cover_image_url,
 *     cuisines[], vibes[], cost_for_two, locality,
 *     distance_km, rating, is_open, open_until,
 *     active_offer? : { label, icon },
 *     creator?      : { handle, name, verified } | null
 *   }
 *   variant — 'feed' | 'list'
 *   liked   — bool, default false
 *   onPress — () => void
 *   onLike  — () => void  (heart tap)
 */

export default function RestaurantCard({ restaurant: r, variant = 'feed', liked, onPress, onLike }) {
  if (!r) return null;

  const cuisinesLine = (r.cuisines || []).slice(0, 3).join(' · ');
  const distance = r.distance_km != null ? `${Number(r.distance_km).toFixed(1)} km` : null;
  const cost = r.cost_for_two != null ? `₹${Math.round(r.cost_for_two)}/2` : null;
  // Wave 5 — prefer real aggregate (avg_rating/review_count). Show "New"
  // when a restaurant has no published reviews instead of a blank slot.
  const avg = r.rating != null ? r.rating : r.avg_rating;
  const rating = avg != null ? Number(avg).toFixed(1) : null;
  const reviewCount = r.review_count || 0;

  if (variant === 'list') return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.85 }]}>
      <View style={styles.listImg}>
        {r.cover_image_url
          ? <Image source={{ uri: r.cover_image_url }} style={styles.listImgInner} />
          : <Text style={styles.listImgEmoji}>🍽️</Text>}
      </View>
      <View style={styles.listBody}>
        <Text style={styles.name} numberOfLines={1}>{r.business_name}</Text>
        <Text style={styles.metaMono} numberOfLines={1}>
          {cuisinesLine}{cost ? `  ·  ${cost}` : ''}{distance ? `  ·  ${distance}` : ''}
        </Text>
        <View style={styles.listChipRow}>
          {r.is_open && <StatusPill variant="open" label={r.open_until ? `Open till ${r.open_until}` : 'Open'} />}
          {r.active_offer && <OfferPill label={r.active_offer.label} icon={r.active_offer.icon || '🏷'} />}
        </View>
      </View>
      <View style={styles.ratingTag}>
        <Text style={styles.ratingText}>
          {rating ? `★ ${rating}` : 'New'}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.95 }]}>
      <View style={styles.hero}>
        {r.cover_image_url
          ? <Image source={{ uri: r.cover_image_url }} style={styles.heroImg} />
          : <View style={[styles.heroImg, styles.heroFallback]}>
              <Text style={styles.heroEmoji}>🍽️</Text>
            </View>}

        {/* Overlay row top */}
        <View style={styles.heroTop}>
          <View style={styles.ratingPill}>
            <Text style={styles.ratingPillText}>
              {rating ? `★ ${rating}` : 'New'}
            </Text>
          </View>
          <Pressable onPress={onLike} hitSlop={10} style={styles.heart}>
            <Text style={styles.heartGlyph}>{liked ? '♥' : '♡'}</Text>
          </Pressable>
        </View>

        {/* Overlay row bottom */}
        <View style={styles.heroBottom}>
          {r.is_open
            ? <StatusPill variant="open" label={r.open_until ? `Open till ${r.open_until}` : 'Open'} />
            : <StatusPill variant="closed" label="Closed" />}
          {r.active_offer && (
            <OfferPill label={r.active_offer.label} icon={r.active_offer.icon || '🏷'} />
          )}
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{r.business_name}</Text>

        <Text style={styles.metaMono} numberOfLines={1}>
          {cuisinesLine}
          {cost && <Text>  ·  {cost}</Text>}
          {distance && <Text>  ·  {distance}</Text>}
        </Text>

        {(r.vibes || []).length > 0 && (
          <View style={styles.vibeRow}>
            {(r.vibes || []).slice(0, 4).map(v => (
              <View key={v} style={styles.vibeChip}>
                <Text style={styles.vibeText}>{String(v).replace(/_/g, ' ')}</Text>
              </View>
            ))}
          </View>
        )}

        {r.creator && (
          <View style={styles.creatorRow}>
            <CreatorChip
              handle={r.creator.handle}
              name={r.creator.name}
              verified={r.creator.verified}
              size="sm"
            />
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // === FEED CARD ===
  card: {
    backgroundColor: lightColors.white,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: lightColors.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
    marginBottom: 12,
  },
  hero: { height: 180, position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  heroFallback: {
    backgroundColor: lightColors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: { fontSize: 56 },

  heroTop: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroBottom: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },

  ratingPill: {
    backgroundColor: lightColors.success,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratingPillText: {
    fontFamily: fonts.monoBold,
    color: lightColors.white,
    fontSize: 11,
  },

  heart: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartGlyph: { fontSize: 18, color: lightColors.ink },

  body: { padding: 12, gap: 6 },
  name: {
    fontFamily: fonts.displayBold,
    fontSize: 17,
    color: lightColors.ink,
    letterSpacing: -0.3,
  },
  metaMono: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    color: lightColors.muted,
  },

  vibeRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginTop: 2 },
  vibeChip: {
    backgroundColor: lightColors.bg2,
    borderColor: lightColors.border,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  vibeText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: lightColors.ink2,
  },

  creatorRow: { marginTop: 4 },

  // === LIST ROW ===
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: 10,
    gap: 12,
    marginBottom: 8,
  },
  listImg: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: lightColors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listImgInner: { width: '100%', height: '100%' },
  listImgEmoji: { fontSize: 26 },
  listBody: { flex: 1, minWidth: 0, gap: 3 },
  listChipRow: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },

  ratingTag: {
    backgroundColor: lightColors.success,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  ratingText: {
    fontFamily: fonts.monoBold,
    color: lightColors.white,
    fontSize: 11,
  },
});
