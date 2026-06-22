/**
 * TileSection — Template Catalog #1: an image-tile carousel.
 *
 * A placeable section (shelf_type 'tiles') whose tiles are admin-composed in
 * config.tiles = [{ image_url, label, badge?, library_section_id }]. Each tile
 * is an uploaded image wired to a product GROUP (a Section Library rule); a tap
 * runs that group on the shared Results screen. Pure config — no backend rule.
 *
 * Props: section { title, config: { tiles[], style? } }, onTile(tile).
 * style: 'carousel' (default) — rounded image cards in a horizontal rail.
 */

import React from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { toing as T, fonts } from '../../theme/tokens';

export default function TileSection({ section, onTile }) {
  const cfg = section?.config || {};
  const tiles = Array.isArray(cfg.tiles) ? cfg.tiles.filter((t) => t && (t.image_url || t.label)) : [];
  if (tiles.length === 0) return null;

  return (
    <View style={s.wrap}>
      {section.title ? <Text style={s.title} numberOfLines={1}>{section.title}</Text> : null}
      {cfg.sub ? <Text style={s.sub} numberOfLines={1}>{cfg.sub}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
        {tiles.map((t, i) => (
          <TouchableOpacity key={i} style={s.tile} activeOpacity={0.85} onPress={() => onTile?.(t)}>
            <View style={s.imgBox}>
              {t.image_url
                ? <Image source={{ uri: t.image_url }} style={s.img} resizeMode="cover" />
                : <View style={s.imgFallback}><Text style={s.imgFallbackTxt}>{(t.label || '?')[0]}</Text></View>}
              {t.badge ? <View style={s.badge}><Text style={s.badgeTxt}>{t.badge}</Text></View> : null}
            </View>
            {t.label ? <Text style={s.label} numberOfLines={2}>{t.label}</Text> : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: T.white, paddingTop: 14, paddingBottom: 6 },
  title: { fontSize: 17, color: T.ink, fontFamily: fonts.displayBold, letterSpacing: -0.3, paddingHorizontal: 16 },
  sub: { fontSize: 12, color: T.muted, fontFamily: fonts.sansMedium, paddingHorizontal: 16, marginTop: 2 },
  rail: { gap: 13, paddingHorizontal: 16, paddingTop: 12 },
  tile: { width: 132 },
  imgBox: { width: 132, height: 132, borderRadius: 16, overflow: 'hidden', backgroundColor: T.yellowTint, borderWidth: 1, borderColor: T.line, position: 'relative' },
  img: { width: '100%', height: '100%' },
  imgFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imgFallbackTxt: { fontSize: 34, color: T.yellowDeep, fontFamily: fonts.displayBold },
  badge: { position: 'absolute', top: 8, left: 8, backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeTxt: { fontSize: 10, color: T.pink, fontFamily: fonts.monoBold },
  label: { fontSize: 13, color: T.ink, fontFamily: fonts.sansBold, marginTop: 8, lineHeight: 16 },
});
