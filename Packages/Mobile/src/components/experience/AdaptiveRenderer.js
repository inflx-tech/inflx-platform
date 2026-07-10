import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * AdaptiveRenderer — Creator Experience Engine Phase 4b
 * (contract: features/adaptive-renderer/).
 *
 * Draws ONE render spec (from GET /v1/admin/experience-preview, resolved by the
 * pure renderSpec.service in 4a) into the layout its aspect implies, obeying the
 * Layout Contract: it renders exactly `spec.resolved.visible_slots` — required
 * always, optional only when present, hidden never. Colours/typography come from
 * the theme's preset tokens; the featured image is auto-picked by aspect upstream.
 *
 * Real creator photos arrive in Phase 7 — the featured slot renders a token-tinted
 * placeholder for now (sample pack). No network; a pure presentational component.
 */

const RATIO = { '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5, '3:4': 3 / 4, '2x1:1': 2 };

function aspectGroup(hint) {
  if (hint === '9:16') return 'tall';
  if (hint === '1:1' || hint === '2x1:1') return 'square';
  if (hint === '4:5' || hint === '3:4') return 'card';
  return 'wide'; // 16:9, flex
}

export default function AdaptiveRenderer({ spec }) {
  if (!spec) return null;
  const { theme = {}, design = {}, tokens = {}, pack = {}, resolved = {} } = spec;
  const visible = Array.isArray(resolved.visible_slots) ? resolved.visible_slots : [];
  const has = (slot) => visible.includes(slot);

  const pal = tokens.palette || {};
  const grp = aspectGroup(design.aspect_hint);
  const overlay = grp !== 'card';
  const ratio = RATIO[design.aspect_hint] || 16 / 9;
  const radius = tokens.radius || 12;

  const bg = (tokens.background && tokens.background.avg_color) || pal.bg || '#222';
  const featuredTint = pal.secondary || '#555';
  const accent = pal.accent || '#FFC400';
  const onOverlayText = pal.text || '#FFFFFF';
  const onCardText = '#1A1A1A';
  const textColor = overlay ? onOverlayText : onCardText;

  if (resolved.blocked) {
    return (
      <View style={[styles.blocked, { borderRadius: radius }]}>
        <Text style={styles.blockedText}>Can’t render — missing: {(resolved.missing || []).join(', ')}</Text>
      </View>
    );
  }

  const Avatar = has('avatar') ? (
    <View style={[styles.avatar, { borderColor: '#fff' }]}>
      <Text style={styles.avatarTxt}>{(pack.creator_name || '?').slice(0, 1)}</Text>
    </View>
  ) : null;

  const Offer = has('offer_badge') && pack.offer_badge ? (
    <View style={styles.offer}><Text style={styles.offerTxt}>{pack.offer_badge}</Text></View>
  ) : null;

  const Featured = has('featured_image') ? (
    <View style={[styles.featured, { backgroundColor: featuredTint }]}>
      <Text style={styles.featuredTag}>photo</Text>
    </View>
  ) : null;

  const Title = has('title') && theme.title ? (
    <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>{theme.title}</Text>
  ) : null;
  const Subtitle = has('subtitle') && theme.subtitle ? (
    <Text style={[styles.subtitle, { color: overlay ? '#e5e5e5' : '#555' }]} numberOfLines={2}>{theme.subtitle}</Text>
  ) : null;
  const Creator = has('creator_name') && pack.creator_name ? (
    <Text style={[styles.creator, { color: overlay ? '#e5e5e5' : '#666' }]}>by {pack.creator_name}</Text>
  ) : null;
  const Cta = has('cta') && theme.cta ? (
    <View style={[styles.cta, { backgroundColor: accent }]}><Text style={styles.ctaTxt}>{theme.cta}</Text></View>
  ) : null;

  // ── OVERLAY layouts (wide / tall / square): featured fills, content over it ──
  if (overlay) {
    return (
      <View style={[styles.box, { aspectRatio: ratio, backgroundColor: bg, borderRadius: radius }]}>
        {Featured ? <View style={StyleSheet.absoluteFill}>{Featured}</View> : null}
        <View style={styles.overTop}>
          {Avatar}
          {Offer}
        </View>
        <View style={styles.scrim}>
          {Title}
          {Subtitle}
          {Creator}
          {Cta ? <View style={{ marginTop: 6 }}>{Cta}</View> : null}
        </View>
      </View>
    );
  }

  // ── CARD layout (4:5 / 3:4): image on top, text on a light panel below ──
  return (
    <View style={[styles.box, { aspectRatio: ratio, backgroundColor: '#fff', borderRadius: radius, borderWidth: 1, borderColor: '#eee' }]}>
      <View style={{ flex: 1 }}>{Featured}</View>
      <View style={styles.cardBody}>
        {Title}
        {Subtitle}
        {Creator}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', overflow: 'hidden' },
  featured: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  featuredTag: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '600' },
  overTop: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  scrim: { position: 'absolute', left: 10, right: 10, bottom: 10, backgroundColor: 'transparent' },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 11, marginTop: 2 },
  creator: { fontSize: 10, marginTop: 3 },
  cardBody: { padding: 10 },
  avatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontWeight: '800', fontSize: 12 },
  offer: { backgroundColor: '#1D9E75', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  offerTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  cta: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  ctaTxt: { color: '#1a1a1a', fontSize: 11, fontWeight: '800' },
  blocked: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#D4537E', padding: 16, alignItems: 'center' },
  blockedText: { color: '#D4537E', fontSize: 12, fontWeight: '700' },
});
