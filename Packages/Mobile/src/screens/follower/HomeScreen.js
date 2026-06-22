import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { toing as T, fonts } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { useAppLocation } from '../../contexts/LocationContext';
import { hasEngineContent, SectionItem } from '../../components/SectionRenderer';
import CategoryRail from '../../components/home/CategoryRail';
import RestaurantResultCard from '../../components/food/RestaurantResultCard';

/**
 * HomeScreen — Follower v2, the per-world page (Swiggy model).
 *
 * The home is a PURE admin-composed section stack. Chrome = fixed location
 * header; inside the scroll: world tabs + search/veg (scroll away) then the
 * active world's sections. Each section is a direct scroll child so admin can
 * mark ANY section sticky (config.sticky → pins on scroll). The category rail
 * is itself a placeable section (shelf_type 'category_rail'); tapping a tile
 * filters the page in-place. Nothing hardcoded, no defaults — empty until the
 * world is composed. Contract: features/food-discovery-cleanup.
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

  const [sections, setSections] = useState(null);
  const [feedLoading, setFeedLoading] = useState(false);

  const [craving, setCraving] = useState(null);
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

  useEffect(() => {
    setPhIdx(0);
    if (cats.length < 2) return;
    const t = setInterval(() => setPhIdx((i) => (i + 1) % cats.length), 2000);
    return () => clearInterval(t);
  }, [activeKey, cats.length]);

  const placeholder = cats.length ? `Search for '${cats[phIdx % cats.length].name}'` : 'Search';

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

  // Veg toggle prunes restaurant dish shelves (Type A + Type B nested).
  const vegSections = useMemo(() => {
    if (!veg || !Array.isArray(sections)) return sections || [];
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

  const ctx = { superCategory: activeKey, lat: latitude, lng: longitude };

  const renderSec = (sec, key) => {
    if (sec.type === 'category_rail') {
      return (
        <CategoryRail key={key} items={sec.items} title={sec.title}
          selectedKey={craving?.key} onPress={onCraving} />
      );
    }
    return <View key={key}><SectionItem section={sec} navigation={navigation} context={ctx} /></View>;
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={T.yellowDeep} /></View>;
  }

  // Build the scroll children + sticky indices. When a craving is active, keep
  // only the rail section(s) (so the rail stays) + the result list below.
  const railSections = (vegSections || []).filter((sec) => sec.type === 'category_rail');
  const secList = craving ? railSections : (vegSections || []);
  const feedActive = hasEngineContent(vegSections);

  const children = [];
  const stickyIdxs = [];
  children.push(
    <View key="tabs" style={s.tabs}>
      {verticals.map((v) => {
        const on = v.key === activeKey;
        return (
          <TouchableOpacity key={v.key} style={[s.tab, on && s.tabOn]} onPress={() => setActiveKey(v.key)} activeOpacity={0.85}>
            {v.image_url ? <Image source={{ uri: v.image_url }} style={s.tabImg} /> : <Text style={s.tabEmoji}>{v.icon || '•'}</Text>}
            <Text style={[s.tabLabel, on && s.tabLabelOn]} numberOfLines={1}>{v.name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
  children.push(
    <View key="search" style={s.searchRow}>
      <TouchableOpacity style={s.search} onPress={() => navigation.navigate('Find')} activeOpacity={0.8}>
        <Icon name="magnify" size={17} color={T.muted} />
        <Text style={s.searchText} numberOfLines={1}>{placeholder}</Text>
        <Icon name="microphone" size={16} color={T.pink} />
      </TouchableOpacity>
      <TouchableOpacity style={s.vegBox} onPress={() => setVeg((x) => !x)} activeOpacity={0.85}>
        <Text style={s.vegLabel}>VEG</Text>
        <View style={[s.vegTrack, veg && s.vegTrackOn]}><View style={[s.vegKnob, veg && s.vegKnobOn]} /></View>
      </TouchableOpacity>
    </View>
  );

  secList.forEach((sec, i) => {
    if (sec.config?.sticky) stickyIdxs.push(children.length);
    children.push(renderSec(sec, `sec-${i}`));
  });

  if (craving) {
    children.push(
      <View key="craving" style={s.feed}>
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
          <View style={s.stateBox}><Text style={s.stateEmoji}>🍱</Text><Text style={s.stateTitle}>No one nearby serves this yet</Text></View>
        ) : (
          cravingResults.map((r) => (
            <RestaurantResultCard key={r.brand_id} restaurant={r}
              onOpen={(rest) => navigation.navigate('BrandStore', { brandId: rest.brand_id, brandName: rest.business_name })} />
          ))
        )}
      </View>
    );
  } else if (feedLoading) {
    children.push(<ActivityIndicator key="fl" color={T.yellowDeep} style={{ marginTop: 30 }} />);
  } else if (!feedActive) {
    children.push(
      <View key="empty" style={s.stateBox}>
        <Icon name="storefront-outline" size={26} color={T.hint} />
        <Text style={s.stateBody}>Nothing in {active?.name || 'this world'} yet.</Text>
      </View>
    );
  }
  children.push(<View key="pad" style={{ height: 28 }} />);

  return (
    <View style={s.container}>
      {/* Fixed location header */}
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

      <ScrollView style={{ flex: 1 }} stickyHeaderIndices={stickyIdxs} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
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

  tabs: { flexDirection: 'row', gap: 4, paddingHorizontal: 10, alignItems: 'flex-end', backgroundColor: T.white, paddingTop: 4 },
  tab: { flex: 1, alignItems: 'center', backgroundColor: T.pageBg, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 2, marginBottom: 3 },
  tabOn: { backgroundColor: T.yellow, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingVertical: 9, paddingBottom: 11, marginBottom: 0 },
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

  feed: { backgroundColor: T.white, paddingTop: 6 },
  cravingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 2 },
  cravingTitle: { flex: 1, fontSize: 17, color: T.ink, fontFamily: fonts.displayBold, letterSpacing: -0.3 },
  cravingCount: { fontSize: 12, color: T.muted, fontFamily: fonts.sansSemiBold },
  cravingClear: { fontSize: 12, color: T.yellowDeep, fontFamily: fonts.sansBold },
  stateBox: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 30, gap: 8 },
  stateEmoji: { fontSize: 40 },
  stateTitle: { fontSize: 15, color: T.ink, fontFamily: fonts.displayBold },
  stateBody: { fontSize: 12, color: T.muted, fontFamily: fonts.sansRegular, textAlign: 'center' },
});
