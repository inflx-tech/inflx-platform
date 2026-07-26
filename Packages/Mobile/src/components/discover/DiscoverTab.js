/**
 * DiscoverTab — Stage B3, locked board b1-discover.html frame 1.
 * Contract: features/concept-stageb-discover/.
 *
 * Paints the resolved /follower/discover payload: sections (title + chips +
 * swipeable banners, each ONE concept with its live post count) · category
 * circles (Category Images source) · creator rails · store rails. Banner
 * taps land on ConceptPosts (the existing concept-filtered feed). White law:
 * chrome is white/black; colour lives inside banner art. CTA chips are
 * app-drawn overlays at the admin-chosen position — exactly what the
 * Builder preview shows.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { followerApi } from '../../services/api';
import { RingAvatar } from '../posts/PostCard';

const TALL_W = 110, TALL_H = 146;   // price / category / collection cards
const WIDE_W = 240, WIDE_H = 120;   // offer banners (family 3/5)

function ctaStyle(pos) {
  if (pos === 'bottom-right') return { right: 8, bottom: 8 };
  if (pos === 'bottom-center') return { alignSelf: 'center', bottom: 8 };
  return { left: 8, bottom: 8 };
}

function Banner({ b, wide, onPress }) {
  const src = b.image_url || b.cover_url;
  const custom = !!b.image_url;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}
      style={[st.banner, { width: wide ? WIDE_W : TALL_W, height: wide ? WIDE_H : TALL_H }]}>
      {src
        ? <Image source={{ uri: src }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        : <View style={[StyleSheet.absoluteFill, { backgroundColor: '#F5F2EC' }]} />}
      {/* cover-fallback banners carry the concept text; custom art speaks for itself */}
      {!custom && (
        <View style={st.bannerShade}>
          <Text style={st.bannerTitle} numberOfLines={2}>{b.title}</Text>
          <Text style={st.bannerCount}>{b.post_count} posts</Text>
        </View>
      )}
      {b.cta ? (
        <View style={[st.cta, ctaStyle(b.cta_pos)]}><Text style={st.ctaTxt}>{b.cta}</Text></View>
      ) : null}
    </TouchableOpacity>
  );
}

export default function DiscoverTab({ navigation }) {
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [chipSel, setChipSel] = useState({}); // sectionIdx -> chip idx

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    const res = await followerApi.getDiscover?.().catch(() => null);
    setRefreshing(false);
    if (res?.success) setData(res.data);
    else setData((prev) => prev || { rows: [] });
  }, []);
  useEffect(() => { load(); }, [load]);

  const openConcept = (b) => navigation.navigate('ConceptPosts', {
    conceptId: b.concept_id, collectionId: b.collection_id, title: b.title, count: b.post_count,
  });

  if (!data) return <View style={st.center}><ActivityIndicator color="#111" /></View>;

  if (!data.rows.length) {
    return (
      <ScrollView contentContainerStyle={st.center}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
        <Text style={st.emptyTitle}>Discover is being curated</Text>
        <Text style={st.emptySub}>Fresh concepts, creators and stores land here — check back soon.</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      {data.rows.map((row, ri) => {
        if (row.type === 'section') {
          const ci = Math.min(chipSel[ri] || 0, row.chips.length - 1);
          const chip = row.chips[ci];
          const labelled = row.chips.some((c) => c.label);
          const wide = (chip.banners[0]?.family === 3 || chip.banners[0]?.family === 5) || !!chip.banners[0]?.image_url;
          return (
            <View key={ri} style={st.sec}>
              <Text style={st.secTitle}>{row.title}</Text>
              {labelled && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
                  {row.chips.map((c, i) => (
                    <TouchableOpacity key={i} style={[st.chip, i === ci && st.chipOn]}
                      onPress={() => setChipSel((s) => ({ ...s, [ri]: i }))}>
                      <Text style={[st.chipTxt, i === ci && { color: '#FFF' }]}>{c.label || 'All'}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.cards}>
                {chip.banners.map((b, bi) => (
                  <Banner key={bi} b={b} wide={wide} onPress={() => openConcept(b)} />
                ))}
              </ScrollView>
            </View>
          );
        }
        if (row.type === 'category_row') {
          return (
            <View key={ri} style={st.sec}>
              <Text style={st.secTitle}>{row.title}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.cards}>
                {row.categories.map((c) => (
                  <TouchableOpacity key={c.id} style={st.catTile} activeOpacity={0.85}
                    onPress={() => navigation.navigate('CategoryBrowser', { nodeId: c.id, vertical: 'fashion', title: c.name })}>
                    <Image source={{ uri: c.image_url }} style={st.catImg} resizeMode="cover" />
                    <Text style={st.catName} numberOfLines={1}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          );
        }
        if (row.type === 'creator_row') {
          return (
            <View key={ri} style={st.sec}>
              <Text style={st.secTitle}>{row.title}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.cards}>
                {row.creators.map((c) => (
                  <TouchableOpacity key={c.id} style={st.creator} activeOpacity={0.85}
                    onPress={() => navigation.navigate('InfluencerStore', { handle: c.handle })}>
                    <RingAvatar creator={{ handle: c.handle, avatar: c.avatar }} size={56} />
                    <Text style={st.creatorName} numberOfLines={1}>@{c.handle}</Text>
                    <Text style={st.creatorSub} numberOfLines={1}>{c.visible_posts} posts{c.city ? ` · ${c.city}` : ''}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          );
        }
        if (row.type === 'business_row') {
          return (
            <View key={ri} style={st.sec}>
              <Text style={st.secTitle}>{row.title}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.cards}>
                {row.businesses.map((b) => (
                  <TouchableOpacity key={b.id} style={st.biz} activeOpacity={0.85}
                    onPress={() => navigation.navigate('BrandStore', { brandId: b.id, brandName: b.name })}>
                    {b.cover_media_id || b.cover_url
                      ? <Image source={{ uri: b.cover_url || b.cover_media_id }} style={st.bizImg} resizeMode="cover" />
                      : <View style={[st.bizImg, { backgroundColor: '#F5F2EC' }]} />}
                    <Text style={st.bizName} numberOfLines={1}>{b.name}</Text>
                    <Text style={st.bizSub} numberOfLines={1}>{[b.city, `${b.visible_posts} posts`].filter(Boolean).join(' · ')}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          );
        }
        return null;
      })}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingVertical: 80 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#111' },
  emptySub: { fontSize: 12, color: '#9A9A9A', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  sec: { paddingTop: 14 },
  secTitle: { fontSize: 14.5, fontWeight: '800', color: '#111', paddingHorizontal: 16 },
  chips: { gap: 7, paddingHorizontal: 16, paddingTop: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#E4E4E4' },
  chipOn: { backgroundColor: '#111', borderColor: '#111' },
  chipTxt: { fontSize: 11, fontWeight: '700', color: '#555' },
  cards: { gap: 10, paddingHorizontal: 16, paddingTop: 9 },
  banner: { borderRadius: 13, overflow: 'hidden', backgroundColor: '#F5F2EC' },
  bannerShade: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 9, paddingTop: 20, paddingBottom: 8, backgroundColor: 'rgba(0,0,0,0.32)' },
  bannerTitle: { color: '#FFF', fontSize: 12, fontWeight: '800', lineHeight: 15 },
  bannerCount: { color: 'rgba(255,255,255,0.9)', fontSize: 9.5, fontWeight: '700', marginTop: 2 },
  cta: { position: 'absolute', backgroundColor: '#111', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  ctaTxt: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  catTile: { alignItems: 'center', width: 72 },
  catImg: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#F5F2EC' },
  catName: { fontSize: 10.5, fontWeight: '700', color: '#111', marginTop: 5 },
  creator: { alignItems: 'center', width: 84 },
  creatorName: { fontSize: 10.5, fontWeight: '800', color: '#111', marginTop: 5 },
  creatorSub: { fontSize: 9, color: '#8A8A8A', marginTop: 1 },
  biz: { width: 130, borderWidth: 1, borderColor: '#F0F0F0', borderRadius: 13, overflow: 'hidden' },
  bizImg: { width: '100%', height: 70 },
  bizName: { fontSize: 11, fontWeight: '800', color: '#111', paddingHorizontal: 9, paddingTop: 6 },
  bizSub: { fontSize: 9, color: '#8A8A8A', paddingHorizontal: 9, paddingBottom: 8, paddingTop: 1 },
});
