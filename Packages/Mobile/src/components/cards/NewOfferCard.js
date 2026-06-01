import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { creatorVibe as C, fonts } from '../../theme/tokens';

// Flow 52.1 — Creator Vibe recolor shim, terracotta-banner variant. The shop-
// level deal banner becomes brown (ink→brown) to match the mockup's warm deal
// banner; accents → amber. White text on brown preserved. Logic untouched.
const P = {
  ink: C.brown,
  white: C.card,
  yellow: C.star,
  border: C.line, muted: C.muted, muted2: C.muted, muted3: C.muted,
  yellowText: C.brown, yellowPale: C.soft, success: C.verify, danger: C.offer,
};

/**
 * NewOfferCard — full-width shop/category-level deal banner.
 *
 * Flow 38 (F0) restyle (2026-05-27): ink + yellow brand banner (replaces the
 * per-business gradient). Yellow tag + white title + big yellow discount +
 * ink/yellow influencer strip. The per-business accent is intentionally NOT
 * used here — shop-level deals are a brand moment, so they wear the master
 * yellow.
 */

export default function NewOfferCard({
  store,         // { name, logo_initial, category }
  dealType,      // 'shop' | 'category'
  dealLabel,     // e.g. "Shop ₹3,000+ · All categories"
  discountValue, // e.g. "15%"
  tags,          // ['Sarees', "Men's", 'Bridal']
  influencer,    // { name, avatar_initial }
  validTill,     // e.g. "Apr 15"
  onPress,
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.glow} />

      {/* Main content row */}
      <View style={styles.inner}>
        {/* Store logo — yellow tile, ink initial */}
        <View style={styles.logo}>
          <Text style={styles.logoText}>{store?.logo_initial || store?.name?.[0] || '?'}</Text>
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.tag}>{dealType === 'shop' ? '⚡ SHOP-LEVEL DEAL' : '⚡ CATEGORY DEAL'}</Text>
          <Text style={styles.storeName} numberOfLines={1}>{store?.name}</Text>
          <Text style={styles.dealDesc} numberOfLines={1}>{dealLabel}</Text>

          {tags && tags.length > 0 && (
            <View style={styles.tags}>
              {tags.map((tag, i) => (
                <View key={i} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Big discount % */}
        <View style={styles.dealRight}>
          <Text style={styles.dealValue}>{discountValue}</Text>
          <Text style={styles.dealOff}>OFF</Text>
        </View>
      </View>

      {/* Influencer strip */}
      {influencer && (
        <View style={styles.infStrip}>
          <View style={styles.infAvatar}>
            <Text style={styles.infAvatarText}>{influencer.avatar_initial || influencer.name?.[0] || '?'}</Text>
          </View>
          <Text style={styles.infLine} numberOfLines={1}>
            <Text style={styles.infName}>VIA @{influencer.name}</Text>
            <Text style={styles.infMeta}> · {dealType === 'shop' ? 'SHOP-LEVEL' : 'CATEGORY'} · WALK-IN &amp; PAY</Text>
          </Text>
          {validTill && <Text style={styles.validity}>TILL {validTill}</Text>}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: P.ink,
    overflow: 'hidden',
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    right: -30,
    top: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: P.yellow,
    opacity: 0.12,
  },
  inner: { flexDirection: 'row', alignItems: 'center', padding: 15, gap: 13 },
  logo: {
    width: 48, height: 48, borderRadius: 13,
    backgroundColor: P.yellow,
    alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontSize: 19, fontWeight: '900', color: P.ink, fontFamily: fonts.displayBlack },
  info: { flex: 1, minWidth: 0 },
  tag: { fontSize: 9, color: P.yellow, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', fontFamily: fonts.monoBold },
  storeName: { fontSize: 15, fontWeight: '900', color: P.white, marginTop: 3, fontFamily: fonts.displayBlack },
  dealDesc: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontWeight: '700', fontFamily: fonts.monoMedium },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  tagChip: { backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  tagText: { fontSize: 8.5, fontWeight: '800', color: P.white, fontFamily: fonts.monoBold },
  dealRight: { alignItems: 'center' },
  dealValue: { fontSize: 24, fontWeight: '900', color: P.yellow, fontFamily: fonts.monoBold },
  dealOff: { fontSize: 9, fontWeight: '800', color: P.yellow, letterSpacing: 0.5, fontFamily: fonts.monoBold },
  infStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 15, paddingVertical: 9,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  infAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: P.yellow, alignItems: 'center', justifyContent: 'center' },
  infAvatarText: { fontSize: 8, fontWeight: '900', color: P.ink, fontFamily: fonts.displayBlack },
  infLine: { flex: 1, fontSize: 9 },
  infName: { fontWeight: '800', color: P.yellow, fontFamily: fonts.monoBold },
  infMeta: { color: 'rgba(255,255,255,0.55)', fontFamily: fonts.monoMedium, fontWeight: '700' },
  validity: { fontSize: 8.5, color: 'rgba(255,255,255,0.5)', fontWeight: '700', fontFamily: fonts.monoMedium },
});
