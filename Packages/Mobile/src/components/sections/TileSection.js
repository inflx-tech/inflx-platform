/**
 * TileSection — Template Catalog. One placeable section (shelf_type 'tiles')
 * with multiple LAYOUT styles, all sharing the same data + wiring:
 *   config.tiles = [{ image_url, label, badge?, library_section_id }]
 *   config.style = 'carousel' | 'featured' | 'grid' | 'banner'   (default carousel)
 *   config.banner_image_url  — background for the 'banner' style
 * Each tile is an uploaded image wired to a Section Library group; tap → that
 * group on the Results screen. Pure config — no backend rule.
 *
 * Styles:
 *   carousel  — rounded image cards + label below (Spotlight / brands)
 *   featured  — bigger image cards, "Featured" badge + label overlay
 *   grid      — 4-col wrap of small image+label tiles (shop by concern)
 *   banner    — a themed banner (uploaded bg) wrapping sub-tiles inside
 *
 * Props: section { title, config }, onTile(tile).
 */

import React from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { toing as T, fonts } from '../../theme/tokens';

export default function TileSection({ section, onTile }) {
  const cfg = section?.config || {};
  const tiles = Array.isArray(cfg.tiles) ? cfg.tiles.filter((t) => t && (t.image_url || t.label)) : [];
  if (tiles.length === 0) return null;
  const style = cfg.style || 'carousel';

  if (style === 'banner') return <BannerStyle section={section} tiles={tiles} onTile={onTile} />;
  if (style === 'grid') return <GridStyle section={section} tiles={tiles} onTile={onTile} />;
  if (style === 'featured') return <FeaturedStyle section={section} tiles={tiles} onTile={onTile} />;
  return <CarouselStyle section={section} tiles={tiles} onTile={onTile} />;
}

function Header({ section }) {
  const cfg = section?.config || {};
  return (
    <>
      {section.title ? <Text style={s.title} numberOfLines={1}>{section.title}</Text> : null}
      {cfg.sub ? <Text style={s.sub} numberOfLines={1}>{cfg.sub}</Text> : null}
    </>
  );
}

function CarouselStyle({ section, tiles, onTile }) {
  return (
    <View style={s.wrap}>
      <Header section={section} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
        {tiles.map((t, i) => (
          <TouchableOpacity key={i} style={s.cTile} activeOpacity={0.85} onPress={() => onTile?.(t)}>
            <View style={s.cImg}>
              {t.image_url ? <Image source={{ uri: t.image_url }} style={s.fill} resizeMode="cover" /> : <Fallback t={t} />}
              {t.badge ? <View style={s.badge}><Text style={s.badgeTxt}>{t.badge}</Text></View> : null}
            </View>
            {t.label ? <Text style={s.cLabel} numberOfLines={2}>{t.label}</Text> : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function FeaturedStyle({ section, tiles, onTile }) {
  return (
    <View style={s.wrap}>
      <Header section={section} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
        {tiles.map((t, i) => (
          <TouchableOpacity key={i} style={s.fTile} activeOpacity={0.85} onPress={() => onTile?.(t)}>
            <View style={s.fImg}>
              {t.image_url ? <Image source={{ uri: t.image_url }} style={s.fill} resizeMode="cover" /> : <Fallback t={t} />}
              <View style={s.fBadge}><Text style={s.fBadgeTxt}>{t.badge || 'Featured'}</Text></View>
              <View style={s.fScrim} />
              {t.label ? <Text style={s.fLabel} numberOfLines={2}>{t.label}</Text> : null}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function GridStyle({ section, tiles, onTile }) {
  return (
    <View style={s.wrap}>
      <Header section={section} />
      <View style={s.grid}>
        {tiles.map((t, i) => (
          <TouchableOpacity key={i} style={s.gTile} activeOpacity={0.85} onPress={() => onTile?.(t)}>
            <View style={s.gImg}>
              {t.image_url ? <Image source={{ uri: t.image_url }} style={s.fill} resizeMode="cover" /> : <Fallback t={t} small />}
            </View>
            {t.label ? <Text style={s.gLabel} numberOfLines={2}>{t.label}</Text> : null}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function BannerStyle({ section, tiles, onTile }) {
  const cfg = section?.config || {};
  return (
    <View style={s.wrap}>
      <View style={s.banner}>
        {cfg.banner_image_url
          ? <Image source={{ uri: cfg.banner_image_url }} style={s.bannerBg} resizeMode="cover" />
          : <View style={[s.bannerBg, s.bannerBgFallback]} />}
        <View style={s.bannerInner}>
          {section.title ? <Text style={s.bannerTitle} numberOfLines={1}>{section.title}</Text> : null}
          {cfg.sub ? <Text style={s.bannerSub} numberOfLines={1}>{cfg.sub}</Text> : null}
          <View style={s.bannerTiles}>
            {tiles.slice(0, 3).map((t, i) => (
              <TouchableOpacity key={i} style={s.bTile} activeOpacity={0.85} onPress={() => onTile?.(t)}>
                <View style={s.bPic}>
                  {t.image_url ? <Image source={{ uri: t.image_url }} style={s.fill} resizeMode="cover" /> : <Fallback t={t} small />}
                </View>
                {t.label ? <Text style={s.bLabel} numberOfLines={1}>{t.label}</Text> : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function Fallback({ t, small }) {
  return (
    <View style={[s.fallback, small && { borderRadius: 12 }]}>
      <Text style={[s.fallbackTxt, small && { fontSize: 20 }]}>{(t.label || '?')[0]}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: T.white, paddingTop: 14, paddingBottom: 6 },
  title: { fontSize: 17, color: T.ink, fontFamily: fonts.displayBold, letterSpacing: -0.3, paddingHorizontal: 16 },
  sub: { fontSize: 12, color: T.muted, fontFamily: fonts.sansMedium, paddingHorizontal: 16, marginTop: 2 },
  rail: { gap: 13, paddingHorizontal: 16, paddingTop: 12 },
  fill: { width: '100%', height: '100%' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.yellowTint },
  fallbackTxt: { fontSize: 34, color: T.yellowDeep, fontFamily: fonts.displayBold },
  badge: { position: 'absolute', top: 8, left: 8, backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeTxt: { fontSize: 10, color: T.pink, fontFamily: fonts.monoBold },

  // carousel
  cTile: { width: 132 },
  cImg: { width: 132, height: 132, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: T.line, position: 'relative' },
  cLabel: { fontSize: 13, color: T.ink, fontFamily: fonts.sansBold, marginTop: 8, lineHeight: 16 },

  // featured
  fTile: { width: 152 },
  fImg: { width: 152, height: 122, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: '#C9D6FF', position: 'relative', justifyContent: 'flex-end' },
  fBadge: { position: 'absolute', top: 0, alignSelf: 'center', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 2, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  fBadgeTxt: { fontSize: 10, color: T.pink, fontFamily: fonts.monoBold },
  fScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, backgroundColor: 'rgba(0,0,0,0.32)' },
  fLabel: { color: '#fff', fontSize: 14, fontFamily: fonts.displayBold, textAlign: 'center', paddingBottom: 12, paddingHorizontal: 6 },

  // grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingTop: 12, gap: 0 },
  gTile: { width: '25%', alignItems: 'center', paddingHorizontal: 4, marginBottom: 14 },
  gImg: { width: '100%', aspectRatio: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: T.yellowTint },
  gLabel: { fontSize: 10.5, color: T.ink, fontFamily: fonts.sansSemiBold, marginTop: 5, textAlign: 'center' },

  // banner
  banner: { marginHorizontal: 14, borderRadius: 16, overflow: 'hidden', minHeight: 150 },
  bannerBg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  bannerBgFallback: { backgroundColor: T.pink },
  bannerInner: { padding: 14 },
  bannerTitle: { color: '#fff', fontSize: 20, fontFamily: fonts.displayBold, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 4 },
  bannerSub: { color: '#fff', opacity: 0.9, fontSize: 11, fontFamily: fonts.sansSemiBold, textAlign: 'center', marginTop: 2 },
  bannerTiles: { flexDirection: 'row', gap: 10, marginTop: 12 },
  bTile: { flex: 1, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 12, padding: 8, alignItems: 'center' },
  bPic: { width: '100%', height: 54, borderRadius: 8, overflow: 'hidden', backgroundColor: T.pinkTint },
  bLabel: { fontSize: 11, color: T.ink, fontFamily: fonts.sansBold, marginTop: 5, textAlign: 'center' },
});
