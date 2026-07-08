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

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { toing as T, fonts } from '../../theme/tokens';

export default function TileSection({ section, onTile }) {
  const cfg = section?.config || {};
  // Optional countdown timer (any Frame style). Hook runs before any early return.
  const timer = cfg.timer && cfg.timer.ends_at ? cfg.timer : null;
  const cd = useCountdown(timer ? timer.ends_at : null);
  // An expired countdown NO LONGER hides the frame — it just stops showing the timer.
  // A stale/past end-time should never make a whole section vanish.
  const activeTimer = timer && !cd.expired ? timer : null;

  const tiles = Array.isArray(cfg.tiles) ? cfg.tiles.filter((t) => t && (t.image_url || t.label)) : [];
  if (tiles.length === 0) return null;
  const style = cfg.style || 'carousel';

  const body =
    style === 'hero_slider' ? <HeroSliderStyle section={section} tiles={tiles} onTile={onTile} />
    : style === 'strip' ? <StripStyle section={section} tiles={tiles} onTile={onTile} />
    : style === 'split' ? <SplitStyle section={section} tiles={tiles} onTile={onTile} />
    : style === 'fullbleed' ? <FullBleedStyle section={section} tiles={tiles} onTile={onTile} />
    : style === 'banner' ? <BannerStyle section={section} tiles={tiles} onTile={onTile} />
    : style === 'themed_rail' ? <ThemedRailStyle section={section} tiles={tiles} onTile={onTile} timer={activeTimer} cd={cd} />
    : style === 'mosaic' ? <MosaicStyle section={section} tiles={tiles} onTile={onTile} />
    : style === 'grid' ? <GridStyle section={section} tiles={tiles} onTile={onTile} />
    : style === 'featured' ? <FeaturedStyle section={section} tiles={tiles} onTile={onTile} />
    : <CarouselStyle section={section} tiles={tiles} onTile={onTile} />;

  // themed_rail renders its own boxed timer inside the frame header; other styles get the thin bar.
  if (!activeTimer || style === 'themed_rail') return body;
  return <View>{<CountdownBar text={cd.text} label={activeTimer.label} />}{body}</View>;
}

// Hero slider — full-width paged slides that auto-advance (config.autoplay_ms;
// default 4000ms, 0 = manual only). Pauses while the follower touches it; dots
// track the active slide; each slide taps through via onTile (grid/category/page).
// Unknown 'hero_slider' on a pre-OTA build falls through to CarouselStyle above.
function HeroSliderStyle({ section, tiles, onTile }) {
  const cfg = section?.config || {};
  const raw = cfg.autoplay_ms;
  const autoplay = (raw === 0 || raw === '0') ? 0
    : (Number.isFinite(Number(raw)) && Number(raw) > 0 ? Number(raw) : 4000);
  const width = Dimensions.get('window').width;
  const cardH = Math.round((width - 28) * 0.5185);   // 1080×560 canvas ratio, 14px side margins
  const [idx, setIdx] = useState(0);
  const scRef = useRef(null);
  const idxRef = useRef(0);
  const pausedRef = useRef(false);
  useEffect(() => { idxRef.current = idx; }, [idx]);

  useEffect(() => {
    if (!autoplay || tiles.length < 2) return undefined;
    const t = setInterval(() => {
      if (pausedRef.current) return;
      const next = (idxRef.current + 1) % tiles.length;
      scRef.current?.scrollTo({ x: next * width, animated: true });
      setIdx(next);
    }, autoplay);
    return () => clearInterval(t);
  }, [autoplay, tiles.length, width]);

  const onEnd = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== idxRef.current) setIdx(i);
    pausedRef.current = false;
  };

  return (
    <View style={s.heroWrap}>
      <ScrollView ref={scRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => { pausedRef.current = true; }} onMomentumScrollEnd={onEnd} scrollEventThrottle={16}>
        {tiles.map((t, i) => (
          <View key={i} style={{ width }}>
            <TouchableOpacity activeOpacity={0.9} onPress={() => onTile?.(t)} style={[s.heroCard, { height: cardH }]}>
              {t.image_url ? <Image source={{ uri: t.image_url }} style={s.fill} resizeMode="cover" /> : <Fallback t={t} />}
              {t.badge ? <View style={s.badge}><Text style={s.badgeTxt}>{t.badge}</Text></View> : null}
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
      {tiles.length > 1 ? (
        <View style={s.heroDots} pointerEvents="none">
          {tiles.map((_, i) => <View key={i} style={[s.heroDot, i === idx ? s.heroDotOn : null]} />)}
        </View>
      ) : null}
    </View>
  );
}

// Announcement strip — one thin full-width image (1080×240), single tap.
function StripStyle({ tiles, onTile }) {
  const t = tiles[0] || {};
  const width = Dimensions.get('window').width;
  const h = Math.round((width - 28) * 0.222);
  return (
    <View style={s.wrap}>
      <TouchableOpacity activeOpacity={0.9} onPress={() => onTile?.(t)} style={[s.stripCard, { height: h }]}>
        {t.image_url ? <Image source={{ uri: t.image_url }} style={s.fill} resizeMode="cover" /> : <Fallback t={t} />}
      </TouchableOpacity>
    </View>
  );
}

// Split banner — two half-width tiles side by side, each its own tap.
function SplitStyle({ tiles, onTile }) {
  const list = tiles.slice(0, 2);
  return (
    <View style={s.wrap}>
      <View style={s.splitRow}>
        {list.map((t, i) => (
          <TouchableOpacity key={i} style={s.splitCell} activeOpacity={0.85} onPress={() => onTile?.(t)}>
            <View style={s.splitImg}>
              {t.image_url ? <Image source={{ uri: t.image_url }} style={s.fill} resizeMode="cover" /> : <Fallback t={t} />}
              {t.label ? <View style={s.splitScrim} /> : null}
              {t.label ? <Text style={s.splitLabel} numberOfLines={1}>{t.label}</Text> : null}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// Full-width banner (image fill) — edge-to-edge image(s) at the 1080×720 (3:2)
// ratio. ONE image → a single static banner. MULTIPLE images → a manual
// swipeable carousel with dots (no auto-advance — that's the Hero slider's job),
// so admins who upload several banners get a swipe deck as they expect.
function FullBleedStyle({ tiles, onTile }) {
  const width = Dimensions.get('window').width;
  const h = Math.round((width - 28) * 0.667);
  const list = (tiles || []).filter(t => t && (t.image_url || t.label));
  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0);
  useEffect(() => { idxRef.current = idx; }, [idx]);

  const Card = ({ t }) => (
    <TouchableOpacity activeOpacity={0.9} onPress={() => onTile?.(t)} style={[s.fbCard, { height: h }]}>
      {t.image_url ? <Image source={{ uri: t.image_url }} style={s.fill} resizeMode="cover" /> : <Fallback t={t} />}
      {t.label ? <View style={s.fbScrim} /> : null}
      {t.label ? <Text style={s.fbLabel} numberOfLines={1}>{t.label}</Text> : null}
    </TouchableOpacity>
  );

  if (list.length <= 1) {
    return <View style={s.wrap}><Card t={list[0] || {}} /></View>;
  }
  return (
    <View style={[s.wrap, { position: 'relative' }]}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => { const i = Math.round(e.nativeEvent.contentOffset.x / width); if (i !== idxRef.current) setIdx(i); }}>
        {list.map((t, i) => <View key={i} style={{ width }}><Card t={t} /></View>)}
      </ScrollView>
      <View style={s.heroDots} pointerEvents="none">
        {list.map((_, i) => <View key={i} style={[s.heroDot, i === idx ? s.heroDotOn : null]} />)}
      </View>
    </View>
  );
}

// Themed rail — a themed shell (white / colour / image+scrim) + header (aligned
// title + optional boxed countdown) + a horizontal scroll of medium|large tiles.
function ThemedRailStyle({ section, tiles, onTile, timer, cd }) {
  const cfg = section?.config || {};
  const frame = cfg.frame || {};
  const large = (cfg.tile || {}).size === 'large';
  const hasImg = !!frame.bg_image_url;
  const col = (frame.bg_color || '').toLowerCase();
  const themed = hasImg || (col && col !== '#ffffff' && col !== '#fff');
  const textColor = themed ? '#fff' : T.ink;
  const align = frame.title_align === 'center' ? 'center' : 'left';
  return (
    <View style={s.wrap}>
      <View style={[s.trShell, hasImg ? null : { backgroundColor: frame.bg_color || '#fff' }, !themed && s.trShellWhite]}>
        {hasImg ? <Image source={{ uri: frame.bg_image_url }} style={s.trBg} resizeMode="cover" /> : null}
        {hasImg ? <View style={s.trScrim} /> : null}
        <View style={s.trHead}>
          {section.title ? <Text style={[s.trTitle, { color: textColor, textAlign: align }]} numberOfLines={1}>{section.title}</Text> : <View style={{ flex: 1 }} />}
          {timer && cd?.text ? <CountdownBoxed cd={cd} label={timer.label} onDark={themed} /> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.trRail}>
          {tiles.map((t, i) => (
            <TouchableOpacity key={i} style={large ? s.trTileL : s.trTileM} activeOpacity={0.85} onPress={() => onTile?.(t)}>
              <View style={[s.trImg, { height: large ? 180 : 120 }]}>
                {t.image_url ? <Image source={{ uri: t.image_url }} style={s.fill} resizeMode="cover" /> : <Fallback t={t} />}
                {t.badge ? <View style={s.badge}><Text style={s.badgeTxt}>{t.badge}</Text></View> : null}
                {large && t.label ? <View style={s.trOv} /> : null}
                {large && t.label ? <Text style={s.trOvLabel} numberOfLines={1}>{t.label}</Text> : null}
              </View>
              {!large && t.label ? <Text style={[s.trMlabel, { color: textColor }]} numberOfLines={2}>{t.label}</Text> : null}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

// Boxed countdown ("Ends in [HH]:[MM]:[SS]") for the themed-rail header.
function CountdownBoxed({ cd, label, onDark }) {
  return (
    <View style={s.cbWrap}>
      {label ? <Text style={[s.cbLabel, onDark && { color: 'rgba(255,255,255,0.85)' }]} numberOfLines={1}>{label}</Text> : null}
      <View style={s.cbBox}><Text style={s.cbTxt}>{cd.hh}</Text></View>
      <Text style={[s.cbSep, onDark && { color: '#fff' }]}>:</Text>
      <View style={s.cbBox}><Text style={s.cbTxt}>{cd.mm}</Text></View>
      <Text style={[s.cbSep, onDark && { color: '#fff' }]}>:</Text>
      <View style={s.cbBox}><Text style={s.cbTxt}>{cd.ss}</Text></View>
    </View>
  );
}

// Client-side countdown. Returns { text, expired }; ticks each second while mounted.
// Blank / invalid ends_at → { text:null, expired:false } (no timer).
function useCountdown(endsAt) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  const pad = (n) => String(n).padStart(2, '0');
  const blank = { text: null, expired: false, hh: '00', mm: '00', ss: '00' };
  if (!endsAt) return blank;
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(end)) return blank;
  let diff = Math.floor((end - now) / 1000);
  if (diff <= 0) return { text: '0:00:00', expired: true, hh: '00', mm: '00', ss: '00' };
  const d = Math.floor(diff / 86400); diff -= d * 86400;
  const h = Math.floor(diff / 3600); diff -= h * 3600;
  const m = Math.floor(diff / 60); const sec = diff - m * 60;
  const text = d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
  // hh rolls days into hours for the boxed display (never loses time).
  return { text, expired: false, hh: pad(d * 24 + h), mm: pad(m), ss: pad(sec) };
}

function CountdownBar({ text, label }) {
  if (!text) return null;
  return (
    <View style={s.cdBar}>
      <Text style={s.cdTxt}>⏳ {label || 'Ends in'}  {text}</Text>
    </View>
  );
}

// Mosaic / collage — free-form (per-tile size) OR a fixed slot_template:
// '1big+2small' · '2x2' · '1+3'. Absent/'free' = today's per-tile behavior.
function MosaicStyle({ section, tiles, onTile }) {
  const slot = (section?.config || {}).slot_template || 'free';
  const kindOf = (i, t) => {
    if (slot === '1big+2small') return i === 0 ? 'large' : 'small';
    if (slot === '2x2') return 'small';
    if (slot === '1+3') return i === 0 ? 'large' : 'third';
    return t.size === 'large' ? 'large' : 'small';
  };
  const W = { large: s.mCellLarge, small: s.mCellSmall, third: s.mCellThird };
  const H = { large: 150, small: 112, third: 92 };
  return (
    <View style={s.wrap}>
      <Header section={section} />
      <View style={s.mosaic}>
        {tiles.map((t, i) => {
          const k = kindOf(i, t);
          return (
            <View key={i} style={[s.mCell, W[k]]}>
              <TouchableOpacity style={[s.mInner, { height: H[k] }]} activeOpacity={0.85} onPress={() => onTile?.(t)}>
                {t.image_url ? <Image source={{ uri: t.image_url }} style={s.fill} resizeMode="cover" /> : <Fallback t={t} />}
                {t.badge ? <View style={s.badge}><Text style={s.badgeTxt}>{t.badge}</Text></View> : null}
                {t.label ? <View style={s.mScrim} /> : null}
                {t.label ? <Text style={s.mLabel} numberOfLines={1}>{t.label}</Text> : null}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
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

  // hero slider — full-width paged slides + overlaid dots
  heroWrap: { backgroundColor: T.white, paddingTop: 14, paddingBottom: 10, position: 'relative' },
  heroCard: { marginHorizontal: 14, borderRadius: 16, overflow: 'hidden', backgroundColor: T.yellowTint, position: 'relative' },
  heroDots: { position: 'absolute', bottom: 20, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  heroDotOn: { width: 16, borderRadius: 999, backgroundColor: '#F8CB46' },

  // announcement strip — one thin full-width image
  stripCard: { marginHorizontal: 14, borderRadius: 12, overflow: 'hidden', backgroundColor: T.yellowTint },
  // split banner — two half-width tiles
  splitRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingTop: 8 },
  splitCell: { flex: 1 },
  splitImg: { aspectRatio: 1, borderRadius: 14, overflow: 'hidden', position: 'relative', justifyContent: 'flex-end', backgroundColor: T.yellowTint, borderWidth: 1, borderColor: T.line },
  splitScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 44, backgroundColor: 'rgba(0,0,0,0.34)' },
  splitLabel: { position: 'absolute', left: 10, right: 10, bottom: 9, color: '#fff', fontSize: 14, fontFamily: fonts.displayBold },
  // full-width banner (image fill) — one edge-to-edge image
  fbCard: { marginHorizontal: 14, borderRadius: 16, overflow: 'hidden', backgroundColor: T.yellowTint, position: 'relative', justifyContent: 'flex-end' },
  fbScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, backgroundColor: 'rgba(0,0,0,0.34)' },
  fbLabel: { position: 'absolute', left: 14, right: 14, bottom: 12, color: '#fff', fontSize: 16, fontFamily: fonts.displayBold },

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

  // countdown bar (any frame style)
  cdBar: { marginHorizontal: 16, marginTop: 14, backgroundColor: T.pink, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12, alignItems: 'center' },
  cdTxt: { color: '#fff', fontSize: 12.5, fontFamily: fonts.monoBold, letterSpacing: 0.5 },

  // mosaic — mixed-size tiles (large full-width, small 2-up); percentage cells + 4px gutter
  mosaic: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingTop: 12 },
  mCell: { padding: 4 },
  mCellLarge: { width: '100%' },
  mCellSmall: { width: '50%' },
  mCellThird: { width: '33.333%' },
  mInner: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: T.line, position: 'relative', justifyContent: 'flex-end' },
  mScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 46, backgroundColor: 'rgba(0,0,0,0.34)' },
  mLabel: { position: 'absolute', left: 10, right: 10, bottom: 9, color: '#fff', fontSize: 14, fontFamily: fonts.displayBold },

  // themed rail — shell + header + horizontal tile scroll
  trShell: { marginHorizontal: 14, borderRadius: 16, overflow: 'hidden', paddingBottom: 12, position: 'relative' },
  trShellWhite: { borderWidth: 1, borderColor: T.line, backgroundColor: '#fff' },
  trBg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  trScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.18)' },
  trHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10, gap: 8 },
  trTitle: { flex: 1, fontSize: 17, fontFamily: fonts.displayBold, letterSpacing: -0.2 },
  trRail: { gap: 10, paddingHorizontal: 12 },
  trTileL: { width: 150 },
  trTileM: { width: 120 },
  trImg: { width: '100%', borderRadius: 12, overflow: 'hidden', position: 'relative', justifyContent: 'flex-end', backgroundColor: T.yellowTint, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  trOv: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 44, backgroundColor: 'rgba(0,0,0,0.36)' },
  trOvLabel: { position: 'absolute', left: 10, right: 10, bottom: 8, color: '#fff', fontSize: 13, fontFamily: fonts.sansBold },
  trMlabel: { fontSize: 12.5, fontFamily: fonts.sansBold, marginTop: 7 },
  // boxed countdown (themed-rail header)
  cbWrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cbLabel: { fontSize: 11, color: T.muted, marginRight: 3, fontFamily: fonts.sansMedium, maxWidth: 90 },
  cbBox: { backgroundColor: T.pink, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, minWidth: 24, alignItems: 'center' },
  cbTxt: { color: '#fff', fontSize: 12, fontFamily: fonts.monoBold },
  cbSep: { color: T.pink, fontSize: 12, fontFamily: fonts.monoBold },

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
