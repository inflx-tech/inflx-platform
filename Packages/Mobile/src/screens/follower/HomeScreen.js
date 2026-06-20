import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { toing as T, fonts } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { useAppLocation } from '../../contexts/LocationContext';

/**
 * HomeScreen — Follower v2 main home (world switcher).
 *
 * Pure-white Swiggy-style home: address + avatar header · the 5-business
 * folder-tab switcher · search with a per-world cycling placeholder · veg/
 * non-veg toggle · sticky "What's on your mind?" category rail. Tabs + rails
 * come from /follower/verticals (admin-managed: name / image / order / enabled;
 * image_url falls back to the emoji icon until admin uploads a 3D image).
 * Deeper per-world sections (creators carousel, cards) = next pass.
 * Contract: features/follower-location-redesign (home slice).
 */

export default function HomeScreen({ navigation }) {
  const { location } = useAppLocation();
  const [verticals, setVerticals] = useState([]);
  const [activeKey, setActiveKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [veg, setVeg] = useState(false);
  const [phIdx, setPhIdx] = useState(0);

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

  const openCategory = (cat) =>
    navigation.navigate('CategoryList', { superCategory: active?.key, label: cat.name, icon: cat.icon });

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
        {/* Sticky category rail */}
        <View style={s.railWrap}>
          <Text style={s.railTitle}>What's on your mind?</Text>
          {cats.length === 0 ? (
            <Text style={s.railEmpty}>Categories for {active?.name || 'this'} coming soon.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingRight: 8 }}>
              {cats.map((c) => (
                <TouchableOpacity key={c.key} style={s.cat} onPress={() => openCategory(c)} activeOpacity={0.8}>
                  <View style={s.catImgBox}>
                    {c.image_url
                      ? <Image source={{ uri: c.image_url }} style={s.catImg} resizeMode="contain" />
                      : <Text style={s.catEmoji}>{c.icon || '🍽️'}</Text>}
                  </View>
                  <Text style={s.catName} numberOfLines={1}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Next-pass sections placeholder */}
        <View style={s.feed}>
          <View style={s.feedStub}>
            <Icon name="layers-outline" size={26} color={T.hint} />
            <Text style={s.feedStubText}>Creators · top picks · {active?.name || ''} stores — next pass</Text>
          </View>
          <View style={{ height: 24 }} />
        </View>
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
  railEmpty: { fontSize: 12, color: T.muted, fontFamily: fonts.sansRegular, paddingRight: 14 },
  cat: { alignItems: 'center', width: 74 },
  catImgBox: { width: 66, height: 66, alignItems: 'center', justifyContent: 'center' },
  catImg: { width: 66, height: 66 },
  catEmoji: { fontSize: 42 },
  catName: { fontSize: 11, color: T.ink, fontFamily: fonts.sansMedium, marginTop: 6, textAlign: 'center' },

  feed: { backgroundColor: T.white, paddingHorizontal: 14, paddingTop: 14 },
  feedStub: { borderWidth: 1, borderStyle: 'dashed', borderColor: T.line, borderRadius: 12, paddingVertical: 26, alignItems: 'center', gap: 8 },
  feedStubText: { fontSize: 12, color: T.hint, fontFamily: fonts.sansRegular },
});
