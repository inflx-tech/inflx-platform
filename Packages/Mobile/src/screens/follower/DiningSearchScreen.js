/**
 * DiningSearchScreen — Path C-3 working search.
 *
 * Replaces the decorative search bars. Real debounced query against
 * /follower/search returning brands + dishes. Rotating contextual
 * placeholder ("Search 'Biryani'… 'Pizza'…") and an inline Veg-only
 * toggle, matching the Swiggy pattern but scoped to our model.
 *
 * Brand result → BrandStore (restaurant detail). Dish result →
 * BrandStore for the dish's restaurant (cart/detail handles the rest).
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { brandPalette as lightColors, fonts } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { VegDot } from '../../components/restaurant';

const ROTATING = ['Biryani', 'Pizza', 'Dosa', 'Cakes', 'Rolls', 'Thali', 'Shawarma', 'Noodles'];

export default function DiningSearchScreen({ navigation }) {
  const [q, setQ]           = useState('');
  const [veg, setVeg]       = useState(false);
  const [brands, setBrands] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const [ph, setPh]         = useState(ROTATING[0]);
  const timer = useRef(null);

  // Rotating placeholder — only while the field is empty.
  useEffect(() => {
    if (q) return;
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % ROTATING.length;
      setPh(ROTATING[i]);
    }, 1800);
    return () => clearInterval(id);
  }, [q]);

  const runSearch = useCallback(async (term, vegOnly) => {
    if (!term || term.trim().length < 2) {
      setBrands([]); setDishes([]); return;
    }
    setLoading(true);
    try {
      const res = await followerApi.search(term.trim(), { super: 'eat', veg: vegOnly });
      const d = res?.data || res;
      setBrands(d?.brands || []);
      setDishes(d?.dishes || []);
    } catch {
      setBrands([]); setDishes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce 300ms.
  useEffect(() => {
    setTouched(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(q, veg), 300);
    return () => timer.current && clearTimeout(timer.current);
  }, [q, veg, runSearch]);

  function openBrand(brandId) {
    navigation.navigate('BrandStore', { brandId });
  }

  const empty = !loading && touched && q.trim().length >= 2
    && brands.length === 0 && dishes.length === 0;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.appbar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={6}>
          <Text style={styles.iconBtnGlyph}>←</Text>
        </Pressable>
        <View style={styles.searchBox}>
          <Text style={styles.searchGlyph}>🔍</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={`Search for '${ph}'`}
            placeholderTextColor={lightColors.muted3}
            style={styles.searchInput}
            autoFocus
            returnKeyType="search"
          />
          {q.length > 0 && (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <Text style={styles.clearGlyph}>✕</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>

      {/* Veg toggle */}
      <View style={styles.filterRow}>
        <Pressable onPress={() => setVeg(v => !v)}
          style={[styles.vegToggle, veg && styles.vegToggleOn]}>
          <VegDot veg size={12} />
          <Text style={[styles.vegToggleText, veg && styles.vegToggleTextOn]}>Veg only</Text>
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}>
        {loading && (
          <ActivityIndicator color={lightColors.ink} style={{ marginTop: 28 }} />
        )}

        {empty && (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyTitle}>No matches for “{q.trim()}”</Text>
            <Text style={styles.emptyBody}>Try a cuisine, dish, or restaurant name.</Text>
          </View>
        )}

        {!loading && q.trim().length < 2 && (
          <View style={styles.hint}>
            <Text style={styles.hintTitle}>Search dining</Text>
            <Text style={styles.hintBody}>
              Find restaurants and dishes near you. Try “{ROTATING[0]}”, “{ROTATING[2]}”…
            </Text>
          </View>
        )}

        {brands.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>RESTAURANTS · {brands.length}</Text>
            {brands.map(b => (
              <Pressable key={b.id} onPress={() => openBrand(b.id)} style={styles.row}>
                <View style={styles.thumb}>
                  {b.cover_image_url
                    ? <Image source={{ uri: b.cover_image_url }} style={styles.thumbImg} />
                    : <Text style={styles.thumbGlyph}>🍽️</Text>}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{b.business_name}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {(b.cuisines || []).slice(0, 3).join(' · ')}
                    {b.cost_for_two ? `  ·  ₹${b.cost_for_two}/2` : ''}
                    {b.locality ? `  ·  ${b.locality}` : ''}
                  </Text>
                </View>
                <Text style={styles.chevron}>→</Text>
              </Pressable>
            ))}
          </>
        )}

        {dishes.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>DISHES · {dishes.length}</Text>
            {dishes.map(d => (
              <Pressable key={d.id} onPress={() => openBrand(d.brand_id)} style={styles.row}>
                <View style={styles.thumb}>
                  {d.image_url
                    ? <Image source={{ uri: d.image_url }} style={styles.thumbImg} />
                    : <Text style={styles.thumbGlyph}>🍴</Text>}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.dishHead}>
                    <VegDot veg={d.veg_flag === 'veg' || d.veg_flag === 'Veg' || d.veg_flag === true} size={10} />
                    <Text style={styles.rowTitle} numberOfLines={1}>{d.name}</Text>
                  </View>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {d.business_name}{d.section ? `  ·  ${d.section}` : ''}
                  </Text>
                </View>
                <Text style={styles.dishPrice}>₹{Math.round(d.price)}</Text>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: lightColors.bg },
  appbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 8, backgroundColor: lightColors.bg },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: lightColors.bg2, alignItems: 'center', justifyContent: 'center' },
  iconBtnGlyph: { fontSize: 16, color: lightColors.ink },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: lightColors.white, borderColor: lightColors.muted4, borderWidth: 1,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9,
  },
  searchGlyph: { fontSize: 14 },
  searchInput: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: lightColors.ink, padding: 0 },
  clearGlyph: { fontSize: 13, color: lightColors.muted },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10 },
  vegToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderColor: lightColors.muted4, borderWidth: 1, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  vegToggleOn: { backgroundColor: lightColors.successPale, borderColor: lightColors.success },
  vegToggleText: { fontFamily: fonts.sansBold, fontSize: 12, color: lightColors.ink2 },
  vegToggleTextOn: { color: lightColors.success },
  sectionLabel: { fontFamily: fonts.monoBold, fontSize: 10, color: lightColors.muted, letterSpacing: 0.6, paddingHorizontal: 16, marginTop: 16, marginBottom: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 11,
    borderBottomColor: lightColors.border, borderBottomWidth: 1,
  },
  thumb: { width: 46, height: 46, borderRadius: 8, backgroundColor: lightColors.bg2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  thumbGlyph: { fontSize: 20 },
  dishHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: lightColors.ink, flexShrink: 1 },
  rowMeta: { fontFamily: fonts.sansMedium, fontSize: 11, color: lightColors.muted, marginTop: 3 },
  chevron: { fontFamily: fonts.displayBold, fontSize: 16, color: lightColors.yellowText },
  dishPrice: { fontFamily: fonts.monoBold, fontSize: 13, color: lightColors.ink },
  empty: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 24 },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontFamily: fonts.displayBold, fontSize: 16, color: lightColors.ink },
  emptyBody: { fontFamily: fonts.sansMedium, fontSize: 12, color: lightColors.muted, marginTop: 4, textAlign: 'center' },
  hint: { paddingHorizontal: 20, paddingVertical: 40 },
  hintTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: lightColors.ink },
  hintBody: { fontFamily: fonts.sansMedium, fontSize: 13, color: lightColors.muted, marginTop: 6, lineHeight: 19 },
});
