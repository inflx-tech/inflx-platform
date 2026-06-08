import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { creatorVibe as C, fonts } from '../../theme/tokens';
import Gradient from './Gradient';
import ViaCreatorChip from './ViaCreatorChip';
import RankBadge from './RankBadge';
import { gradientFor, emojiFor } from './palette';

/**
 * DealCard — the gradient deal tile from the comprehensive mockups (`.deal`):
 * a colour header band with the big discount + emoji (+ optional "⏳ Nh left"
 * clock), over a white body with the item name, brand, and a "via @creator" chip.
 * Header gradient + emoji derive from the brand category. Discount text derives
 * from the offer's real type/value (no fabrication — renders "DEAL" when unknown).
 *
 * Props: offer { offer_type, discount_value, offer_expires_at }, title, brand,
 *        category, creator, rank, onPress.
 */

function discountText(offer) {
  const t = String(offer?.offer_type || '').toLowerCase();
  const v = offer?.discount_value;
  if (t === 'percentage' && v) return `${Math.round(v)}%\nOFF`;
  if (t === 'flat' && v) return `₹${Math.round(v)}\nOFF`;
  if (t === 'bogo') return 'B2G1';
  if (t === 'bundle') return 'BUNDLE';
  if (t === 'volume' || t === 'volume_discount') return 'VOLUME\nDEAL';
  if (t === 'prebook') return 'PRE-\nBOOK';
  if (v) return `${Math.round(v)}%\nOFF`;
  return 'DEAL';
}

// Hours-left clock from a real expiry; null (hidden) when absent/expired/>72h.
function clockLabel(expiresAt) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!(ms > 0)) return null;
  const hrs = ms / 3.6e6;
  if (hrs > 72) return null;
  if (hrs < 1) return `⏳ ${Math.max(1, Math.round(ms / 6e4))}m left`;
  if (hrs < 24) return `⏳ ${Math.round(hrs)}h left`;
  return `⏳ ${Math.round(hrs / 24)}d left`;
}

export default function DealCard({ offer, title, brand, category, creator, rank, onPress }) {
  const clock = clockLabel(offer?.offer_expires_at);
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={onPress}>
      <Gradient colors={gradientFor(category)} direction="diagonal" style={styles.header}>
        {clock ? <View style={styles.clock}><Text style={styles.clockTxt}>{clock}</Text></View> : null}
        {rank ? <View style={styles.rank}><RankBadge rank={rank} /></View> : null}
        <Text style={styles.big}>{discountText(offer)}</Text>
        <Text style={styles.emoji}>{emojiFor(category)}</Text>
      </Gradient>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{title || brand || 'Deal'}</Text>
        {brand ? <Text style={styles.brand} numberOfLines={1}>{brand}</Text> : null}
        {creator ? <ViaCreatorChip creator={creator} /> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 182, borderRadius: 18, overflow: 'hidden',
    backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 8 }, shadowRadius: 14, elevation: 2,
  },
  header: { height: 78, justifyContent: 'flex-end', padding: 10 },
  big: { fontSize: 23, fontWeight: '700', color: '#fff', lineHeight: 23, fontFamily: fonts.serifDisplay },
  emoji: { position: 'absolute', right: 9, top: 7, fontSize: 36, opacity: 0.9 },
  clock: {
    position: 'absolute', top: 9, left: 9,
    backgroundColor: 'rgba(20,12,6,0.8)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
  },
  clockTxt: { fontSize: 8.5, fontWeight: '800', color: '#fff', fontFamily: fonts.monoBold },
  rank: { position: 'absolute', top: 9, right: 9 },
  body: { padding: 11 },
  title: { fontSize: 12, fontWeight: '800', color: C.ink, fontFamily: fonts.displayBold },
  brand: { fontSize: 11, color: C.muted, fontWeight: '600', marginTop: 1, fontFamily: fonts.monoMedium },
});
