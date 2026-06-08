import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { creatorVibe as C, fonts, getBusinessAccentLight } from '../../theme/tokens';
import RankBadge from './RankBadge';

/**
 * ShelfBrandCard — the brand rail card from the comprehensive mockups
 * (`.card` w/ 104px hero): image hero (heart + rank), brand name, cuisine/category
 * line. Image falls back to the category emoji over a pale tint.
 *
 * BACKEND-FIRST: the mockup shows "★ 4.5 · 1.2 km" but the brand item shape
 * (mapBrandItem) carries NO rating or distance — so this card OMITS them rather
 * than fabricate. Re-added in a later explicit data step when reviews/geo are wired.
 *
 * Props: brand { id, name, category, city, image_url?, cuisines? }, rank?, saved?,
 *        onPress, onHeart.
 */
export default function ShelfBrandCard({ brand, rank, saved, onPress, onHeart }) {
  if (!brand) return null;
  const cfg = getBusinessAccentLight(brand.category);
  const meta = Array.isArray(brand.cuisines) && brand.cuisines.length
    ? brand.cuisines.slice(0, 2).join(' · ')
    : (brand.category ? String(brand.category).replace(/_/g, ' ') : (brand.city || ''));

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={[styles.hero, { backgroundColor: cfg.pale }]}>
        {brand.image_url
          ? <Image source={{ uri: brand.image_url }} style={styles.heroImg} resizeMode="cover" />
          : <Text style={styles.heroIcon}>{cfg.icon}</Text>}
        {rank ? <View style={styles.rank}><RankBadge rank={rank} /></View> : null}
        <TouchableOpacity style={styles.heart} onPress={onHeart} hitSlop={8}>
          <Text style={[styles.heartTxt, saved && { color: C.offer }]}>{saved ? '♥' : '♡'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{brand.name}</Text>
        {meta ? <Text style={styles.meta} numberOfLines={1}>{meta}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 162, borderRadius: 18, overflow: 'hidden',
    backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 8 }, shadowRadius: 14, elevation: 2,
  },
  hero: { height: 104, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  heroIcon: { fontSize: 42 },
  rank: { position: 'absolute', top: 9, left: 9 },
  heart: {
    position: 'absolute', top: 9, right: 9, width: 27, height: 27, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center',
  },
  heartTxt: { fontSize: 13, color: '#C34' },
  body: { padding: 11 },
  name: { fontSize: 13, fontWeight: '800', color: C.ink, fontFamily: fonts.displayBold },
  meta: { fontSize: 11, color: C.muted, fontWeight: '600', marginTop: 1, fontFamily: fonts.monoMedium, textTransform: 'capitalize' },
});
