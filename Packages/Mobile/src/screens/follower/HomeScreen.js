import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { toing as T, fonts } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { useAppLocation } from '../../contexts/LocationContext';
import SectionRenderer, { hasEngineContent } from '../../components/SectionRenderer';
import RestaurantResultCard from '../../components/food/RestaurantResultCard';

/**
 * HomeScreen — Follower v2 main home = the per-world page (Swiggy model).
 *
 * Pure-white home: address + avatar · 5-business folder-tab switcher · search ·
 * veg toggle · sticky "What's on your mind?" craving rail · and the ACTIVE
 * world's full section feed rendered inline (the section engine: category
 * shelves like "Food under 400", Trending, restaurants…). Tapping a craving
 * tile filters the page IN-PLACE to restaurants serving it; tapping it again
 * clears. The tab IS the page — no separate tap-through screen.
 * Tabs/rail/images come from /follower/verticals (Home Builder). Section feed
 * comes from /follower/section/category/:world (App Sections, per-world scope).
 * Contract: features/food-discovery-cleanup (home-as-page).
 */

export default function HomeScreen({ navigation }) {
  const { location } = useAppLocation();
  const latitude = location?.latitude;
  const longitude = location?.longitude;
  const [verticals, setVerticals] = useState([]);
  const [activeKey, setActiveKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [veg, setVeg] = useState(false);
  const [phIdx, setPhIdx] = useState(0);
  const [seeAllOpen, setSeeAllOpen] = useState(false);

  // Active world's section feed (the inline page body).
  const [sections, setSections] = useState(null);
  const [feedLoading, setFeedLoading] = useState(false);

  // In-page craving filter.
  const [craving, setCraving] = useState(null);          // { key, name } or null
  const [cravingResults, setCravingResults] = useState([]);
  const [cravingLoading, setCravingLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    followerApi.getVerticals?.()
      .then((r) => {
        const list = (r?.data || r)?.verticals || [];
        if (!alive) return;
        setVerticals(list);
        if (list.length) setActiveKey(list[0].key);
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const active = verticals.find((v) => v.key === activeKey) || null;
  const cats = active?.categories || [];

  // Per-world cycling search placeholder.
  useEffect(() => {
    setPhIdx(0);
    if (cats.length < 2) return;
    const t = setInterval(() => setPhIdx((i) => (i + 1) % cats.length), 2000);
    return () => clearInterval(t);
  }, [activeKey, cats.length]);

  const placeholder = cats.length ? `Search for '${cats[phIdx % cats.length].name}'` : 'Search';

  // Load the active world's section feed; clear any craving on world switch.
  useEffect(() => {
    if (!activeKey) return;
    setCraving(null); setCravingResults([]);
    let alive = true;
    setFeedLoading(true);
    followerApi.getCategorySections?.(activeKey, { latitude, longitude })
      .then((r) => { if (alive) setSections(r?.data?.sections || []); })
      .catch(() => { if (alive) setSections([]); })
      .finally(() => { if (alive) setFeedLoading(false); });
    return () => { alive = false; };
  }, [activeKey, latitude, longitude]);

  const onCraving = useCallback(async (tile) => {
    if (craving?.key === tile.key) { setCraving(null); setCravingResults([]); return; }
    setCraving({ key: tile.key, name: tile.name });
    setCravingLoading(true);
    try {
      const r = await followerApi.getCategoryRestaurants(tile.name, { lat: latitude, lng: longitude });
      setCravingResults((r?.data || r)?.restaurants || []);
    } catch { setCravingResults([]); }
    finally { setCravingLoading(false); }
  }, [craving?.key, latitude, longitude]);

  // Veg toggle prunes restaurant dish shelves (Type A products + Type B nested).
  const vegSections = useMemo(() => {
    if (!veg || !Array.isArray(sections)) return sections;
    const isVeg = (p) => p.veg_flag === 'veg' || p.veg_flag === 'Veg' || p.veg_flag === true;
    return sections
      .map((sec) => {
        if (sec.type === 'products' && sec.items?.[0]?.brand?.category === 'restaurant')
          return { ...sec, items: (sec.items || []).filter(isVeg) };
        if (sec.type === 'restaurant_list')
          return { ...sec, items: (sec.items || []).map((r) => ({ ...r, products: (r.products || []).filter(isVeg) })).filter((r) => r.products.length) };
        return sec;
      })
      .filter((sec) => !['products', 'restaurant_list'].includes(sec.type) || (Array.isArray(sec.items) && sec.items.length));
  }, [sections, veg]);

  const feedActive = hasEngineContent(vegSections);

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={T.yellowDeep} /></View>;
  }

  return (
    <View style={s.container}>
      {/* Header — address + avatar */}
      <View style={s.header}>
        <TouchableOpacity style={s.addr} onPress={() => navigation.navigate('LocationSearch')} activeOpacity={0.7}>
          <Icon name="map-marker" size={17} color={T.yellowDeep} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={s.addrLabel} numberOfLines={1}>{location.label || 'Set location'} <Text style={s.caret}>▾</Text></Text>
            <Text style={s.addrSub} numberOfLines={1}>{location.sublabel || 'Tap to change'}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={s.avatar} onPress={() => navigation.navigate('ProfileTab')} activeOpacity={0.8}>
          <Icon name="account" size={18} color={T.white} />
        </TouchableOpacity>
      </View>

      {/* World switcher — folder tabs */}
      <View style={s.tabs}>
        {verticals.map((v) => {
          const on = v.key === activeKey;
          return (
            <TouchableOpacity key={v.key} style={[s.tab, on && s.tabOn]} onPress={() => setActiveKey(v.key)} activeOpacity={0.85}>
              {v.image_url
                ? <Image source={{ uri: v.image_url }} style={s.tabImg} />
                : <Text style={s.tabEmoji}>{v.icon || '•'}</Text>}
              <Text style={[s.tabLabel, on && s.tabLabelOn]} numberOfLines={1}>{v.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Search + veg toggle */}
      <View style={s.searchRow}>
        <TouchableOpacity style={s.search} onPress={() => navigation.navigate('Find')} activeOpacity={0.8}>
          <Icon name="magnify" size={17} color={T.muted} />
          <Text style={s.searchText} numberOfLines={1}>{placeholder}</Text>
          <Icon name="microphone" size={16} color={T.pink} />
        </TouchableOpacity>
        <TouchableOpacity style={s.vegBox} onPress={() => setVeg((x) => !x)} activeOpacity={0.85}>
          <Text style={s.vegLabel}>VEG</Text>
          <View style={[s.vegTrack, veg && s.vegTrackOn]}>
            <View style={[s.vegKnob, veg && s.vegKnobOn]} />
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} stickyHeaderIndices={[0]} showsVerticalScrollIndicator={false}>
        {/* Sticky category rail (craving filter) */}
        <View style={s.railWrap}>
          <Text style={s.railTitle}>What's on your mind?</Text>
          {cats.length === 0 ? (
            <Text style={s.railEmpty}>Categories for {active?.name || 'this'} coming soon.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingRight: 8 }}>
              {cats.map((c) => {
                const sel = craving?.key === c.key;
                return (
                  <TouchableOpacity key={c.key} style={s.cat} onPress={() => onCraving(c)} activeOpacity={0.8}>
                    <View style={[s.catImgBox, sel && s.catImgBoxOn]}>
                      {c.image_url
                        ? <Image source={{ uri: c.image_url }} style={s.catImg} resizeMode="contain" />
                        : <Text style={s.catEmoji}>{c.icon || '🍽️'}</Text>}
                    </View>
                    <Text style={[s.catName, sel && s.catNameOn]} numberOfLines={1}>{c.name}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={s.cat} onPress={() => setSeeAllOpen(true)} activeOpacity={0.8}>
                <View style={s.seeAllCircle}>
                  <Icon name="view-grid-outline" size={26} color={T.yellowDeep} />
                </View>
                <Text style={s.seeAllLabel}>SEE ALL ⌄</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>

        {/* Body — craving filter results OR the world's section feed */}
        <View style={s.feed}>
          {craving ? (
            <>
              <View style={s.cravingBar}>
                <Text style={s.cravingTitle} numberOfLines={1}>
                  {craving.name}
                  {!cravingLoading ? <Text style={s.cravingCount}>  · {cravingResults.length} place{cravingResults.length !== 1 ? 's' : ''}</Text> : null}
                </Text>
                <TouchableOpacity onPress={() => onCraving(craving)} hitSlop={8}>
                  <Text style={s.cravingClear}>✕ Clear</Text>
                </TouchableOpacity>
              </View>
              {cravingLoading ? (
                <ActivityIndicator color={T.yellowDeep} style={{ marginTop: 26 }} />
              ) : cravingResults.length === 0 ? (
                <View style={s.stateBox}>
                  <Text style={s.stateEmoji}>🍱</Text>
                  <Text style={s.stateTitle}>No one nearby serves this yet</Text>
                  <Text style={s.stateBody}>Try another craving.</Text>
                </View>
              ) : (
                cravingResults.map((r) => (
                  <RestaurantResultCard key={r.brand_id} restaurant={r}
                    onOpen={(rest) => navigation.navigate('BrandStore', { brandId: rest.brand_id, brandName: rest.business_name })} />
                ))
              )}
            </>
          ) : feedLoading ? (
            <ActivityIndicator color={T.yellowDeep} style={{ marginTop: 30 }} />
          ) : feedActive ? (
            <SectionRenderer sections={vegSections} navigation={navigation}
              context={{ superCategory: activeKey, lat: latitude, lng: longitude }} />
          ) : (
            <View style={s.stateBox}>
              <Icon name="storefront-outline" size={26} color={T.hint} />
              <Text style={s.stateBody}>Nothing in {active?.name || 'this world'} near you yet.</Text>
            </View>
          )}
          <View style={{ height: 24 }} />
        </View>
      </ScrollView>

      {/* See-all category grid (bottom sheet) — taps filter in-place */}
      <Modal visible={seeAllOpen} transparent animationType="slide" onRequestClose={() => setSeeAllOpen(false)}>
        <View style={s.sheetWrap}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setSeeAllOpen(false)} />
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>What's on your mind?</Text>
              <TouchableOpacity onPress={() => setSeeAllOpen(false)} hitSlop={10} style={s.sheetClose} activeOpacity={0.7}>
                <Icon name="close" size={18} color={T.ink} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={s.sheetGrid} showsVerticalScrollIndicator={false}>
              {cats.map((c) => (
                <TouchableOpacity key={c.key} style={s.gridCat} onPress={() => { setSeeAllOpen(false); onCraving(c); }} activeOpacity={0.8}>
                  <View style={s.catImgBox}>
                    {c.image_url
                      ? <Image source={{ uri: c.image_url }} style={s.catImg} resizeMode="contain" />
                      : <Text style={s.catEmoji}>{c.icon || '🍽️'}</Text>}
                  </View>
                  <Text style={s.catName} numberOfLines={1}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.white },
  center: { flex: 1, backgroundColor: T.white, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 50, paddingBottom: 8 },
  addr: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  addrLabel: { fontSize: 15, color: T.ink, fontFamily: fonts.sansBold },
  caret: { color: T.muted },
  addrSub: { fontSize: 11, color: T.muted, fontFamily: fonts.sansRegular },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: T.ink, alignItems: 'center', justifyContent: 'center' },

  tabs: { flexDirection: 'row', gap: 4, paddingHorizontal: 10, alignItems: 'flex-end' },
  tab: { flex: 1, alignItems: 'center', backgroundColor: T.pageBg, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 2, marginBottom: 3 },
  tabOn: { backgroundColor: T.yellow, borderRadius: 12, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingVertical: 9, paddingBottom: 11, marginBottom: 0 },
  tabImg: { width: 26, height: 26, borderRadius: 6 },
  tabEmoji: { fontSize: 19 },
  tabLabel: { fontSize: 10, color: T.muted, fontFamily: fonts.sansMedium, marginTop: 3 },
  tabLabelOn: { color: T.yellowInk, fontFamily: fonts.sansBold },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, paddingTop: 10, paddingBottom: 11, backgroundColor: T.white },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.pageBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 },
  searchText: { flex: 1, fontSize: 13, color: T.muted, fontFamily: fonts.sansRegular },
  vegBox: { borderWidth: 1, borderColor: T.line, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, alignItems: 'center' },
  vegLabel: { fontSize: 9, color: T.muted, letterSpacing: 0.5, fontFamily: fonts.sansMedium },
  vegTrack: { width: 28, height: 15, borderRadius: 8, backgroundColor: T.line, marginTop: 3, justifyContent: 'center' },
  vegTrackOn: { backgroundColor: T.veg },
  vegKnob: { width: 11, height: 11, borderRadius: 6, backgroundColor: T.white, marginLeft: 2 },
  vegKnobOn: { marginLeft: 15 },

  railWrap: { backgroundColor: T.white, paddingTop: 6, paddingBottom: 12, paddingLeft: 14, borderTopWidth: 6, borderTopColor: T.pageBg },
  railTitle: { fontSize: 16, color: T.ink, fontFamily: fonts.displayBold, marginBottom: 11 },
  seeAllCircle: { width: 66, height: 66, borderRadius: 33, backgroundColor: T.yellowTint, alignItems: 'center', justifyContent: 'center' },
  seeAllLabel: { fontSize: 11, color: T.yellowDeep, fontFamily: fonts.sansBold, marginTop: 6, textAlign: 'center', letterSpacing: 0.3 },
  railEmpty: { fontSize: 12, color: T.muted, fontFamily: fonts.sansRegular, paddingRight: 14 },
  cat: { alignItems: 'center', width: 74 },
  catImgBox: { width: 66, height: 66, alignItems: 'center', justifyContent: 'center', borderRadius: 33 },
  catImgBoxOn: { borderWidth: 2.5, borderColor: T.yellowDeep },
  catImg: { width: 66, height: 66 },
  catEmoji: { fontSize: 42 },
  catName: { fontSize: 11, color: T.ink, fontFamily: fonts.sansMedium, marginTop: 6, textAlign: 'center' },
  catNameOn: { color: T.yellowDeep, fontFamily: fonts.sansBold },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: T.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '78%', paddingBottom: 20 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  sheetTitle: { fontSize: 18, color: T.ink, fontFamily: fonts.displayBold },
  sheetClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: T.pageBg, alignItems: 'center', justifyContent: 'center' },
  sheetGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingTop: 14 },
  gridCat: { width: '25%', alignItems: 'center', marginBottom: 18 },

  feed: { backgroundColor: T.white, paddingTop: 6, minHeight: 200 },
  cravingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 2 },
  cravingTitle: { flex: 1, fontSize: 17, color: T.ink, fontFamily: fonts.displayBold, letterSpacing: -0.3 },
  cravingCount: { fontSize: 12, color: T.muted, fontFamily: fonts.sansSemiBold },
  cravingClear: { fontSize: 12, color: T.yellowDeep, fontFamily: fonts.sansBold },
  stateBox: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 30, gap: 8 },
  stateEmoji: { fontSize: 40 },
  stateTitle: { fontSize: 15, color: T.ink, fontFamily: fonts.displayBold },
  stateBody: { fontSize: 12, color: T.muted, fontFamily: fonts.sansRegular, textAlign: 'center' },
});
