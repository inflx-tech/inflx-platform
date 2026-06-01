import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { creatorVibe as C } from '../../theme/tokens';

// Flow 52.D — Creator Vibe: was dark-themed. Remap darkColors → cream/terracotta.
const darkColors = {
  bg: C.screenBg, bg2: C.screenBg, card: C.card, input: C.soft,
  text: C.ink, textSecondary: C.muted, textMuted: C.muted,
  border: C.line, borderAccent: C.line,
  amber: C.brown, amberDim: C.soft, green: '#1E9E5A', greenDim: C.soft,
  red: C.offer, redDim: C.soft, blue: C.verify, blueDim: C.soft,
  pink: C.brown, pinkDim: C.soft, teal: C.verify, tealDim: C.soft,
  purple: C.brown, purpleDim: C.soft, orange: C.brown, orangeDim: C.soft,
};

/**
 * LookbookCard — Fashion-2 outfit-collage card.
 *
 * Renders a creator's curated lookbook as a 2×2 collage of product
 * thumbnails + title + product count. Tapping navigates to
 * LookbookDetailScreen.
 *
 * Visual hierarchy: the creator's POV is the headline ("Aman's summer
 * essentials") — the products are evidence beneath. Different from a
 * standard product card which leads with the product.
 */

export default function LookbookCard({ lookbook, creatorName, onPress, accent = '#ec4899' }) {
  const previews = Array.isArray(lookbook?.preview_products) ? lookbook.preview_products : [];
  const slots = [0, 1, 2, 3].map(i => previews[i] || null);
  const total = lookbook?.product_count || previews.length;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Collage */}
      <View style={styles.collage}>
        {slots.map((p, i) => (
          <View key={i} style={[
            styles.tile,
            i === 0 && styles.tileTL,
            i === 1 && styles.tileTR,
            i === 2 && styles.tileBL,
            i === 3 && styles.tileBR,
          ]}>
            {p?.image_url
              ? <Image source={{ uri: p.image_url }} style={styles.tileImg} />
              : <View style={styles.tileEmpty}><Text style={styles.tileEmptyIcon}>👗</Text></View>}
          </View>
        ))}
        {/* Lookbook badge */}
        <View style={[styles.badge, { backgroundColor: accent }]}>
          <Text style={styles.badgeText}>LOOK · {total} items</Text>
        </View>
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{lookbook?.title || 'Curated look'}</Text>
        {creatorName && (
          <Text style={[styles.creator, { color: accent }]} numberOfLines={1}>
            by {creatorName}
          </Text>
        )}
        {lookbook?.description ? (
          <Text style={styles.desc} numberOfLines={2}>{lookbook.description}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: darkColors.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  collage: { aspectRatio: 1, position: 'relative', backgroundColor: '#142438' },
  tile: { position: 'absolute', width: '50%', height: '50%', backgroundColor: '#0D1D2E', borderColor: '#0B1A2A', borderWidth: 1 },
  tileTL: { top: 0, left: 0 },
  tileTR: { top: 0, right: 0 },
  tileBL: { bottom: 0, left: 0 },
  tileBR: { bottom: 0, right: 0 },
  tileImg: { width: '100%', height: '100%' },
  tileEmpty: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  tileEmptyIcon: { fontSize: 26, opacity: 0.3 },
  badge: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  body: { padding: 11 },
  title: { fontSize: 13, fontWeight: '800', color: '#fff' },
  creator: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  desc: { fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 5, lineHeight: 14 },
});
