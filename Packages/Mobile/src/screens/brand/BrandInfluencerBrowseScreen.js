import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/tokens';
import { brandApi } from '../../services/api';

const NICHES = ['Food', 'Fashion', 'Beauty', 'Lifestyle', 'Fitness', 'Travel', 'Tech', 'Gaming', 'Finance', 'Parenting', 'Education'];
const TIERS  = [
  { key: '',      label: 'Any tier' },
  { key: 'nano',  label: 'Nano' },
  { key: 'micro', label: 'Micro' },
  { key: 'macro', label: 'Macro' },
  { key: 'mega',  label: 'Mega' },
];

export default function BrandInfluencerBrowseScreen({ navigation }) {
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandFilters, setExpandFilters] = useState(false);

  // Filter state
  const [q, setQ]                 = useState('');
  const [niche, setNiche]         = useState('');
  const [tier, setTier]           = useState('');
  const [minFollowers, setMinFollowers] = useState('');
  const [minER, setMinER]         = useState('');
  const [city, setCity]           = useState('');

  async function load() {
    const params = { limit: 50 };
    if (q.trim()) params.q = q.trim();
    if (niche)   params.niche = niche;
    if (tier)    params.tier = tier;
    if (city.trim()) params.city = city.trim();
    const minF = parseInt(minFollowers, 10);
    if (!isNaN(minF) && minF > 0) params.min_followers = minF;
    const minE = parseFloat(minER);
    if (!isNaN(minE) && minE > 0) params.min_er = minE;

    const res = await brandApi.searchInfluencers(params);
    setLoading(false);
    if (res?.success) setInfluencers(res.data?.influencers || []);
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  function handleSearchSubmit() {
    setLoading(true);
    load();
  }

  function clearFilters() {
    setQ(''); setNiche(''); setTier(''); setMinFollowers(''); setMinER(''); setCity('');
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [q, niche, tier, minFollowers, minER, city]);

  const activeFilterCount = [q, niche, tier, minFollowers, minER, city].filter(Boolean).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{'<'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Find Influencers</Text>
        <Text style={styles.subtitle}>Search and invite to your campaigns</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={q}
          onChangeText={setQ}
          onSubmitEditing={handleSearchSubmit}
          placeholder="Search by name or @handle"
          placeholderTextColor={colors.t3}
          returnKeyType="search"
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearchSubmit}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Filter toggle */}
      <TouchableOpacity style={styles.filterToggle} onPress={() => setExpandFilters(!expandFilters)}>
        <Text style={styles.filterToggleText}>
          Filters{activeFilterCount > 0 ? `  ·  ${activeFilterCount} active` : ''}
        </Text>
        <Text style={styles.filterToggleArrow}>{expandFilters ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expandFilters && (
        <View style={styles.filtersCard}>
          <Text style={styles.filterLabel}>Niche</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ gap: 6 }}>
            <TouchableOpacity
              style={[styles.chipSm, niche === '' && styles.chipSmActive]}
              onPress={() => setNiche('')}
            >
              <Text style={[styles.chipSmText, niche === '' && styles.chipSmTextActive]}>Any</Text>
            </TouchableOpacity>
            {NICHES.map(n => (
              <TouchableOpacity
                key={n}
                style={[styles.chipSm, niche === n && styles.chipSmActive]}
                onPress={() => setNiche(niche === n ? '' : n)}
              >
                <Text style={[styles.chipSmText, niche === n && styles.chipSmTextActive]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.filterLabel}>Tier</Text>
          <View style={styles.tierRow}>
            {TIERS.map(t => (
              <TouchableOpacity
                key={t.key || 'any'}
                style={[styles.chipSm, tier === t.key && styles.chipSmActive]}
                onPress={() => setTier(t.key)}
              >
                <Text style={[styles.chipSmText, tier === t.key && styles.chipSmTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.filterTwoCol}>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Min Followers</Text>
              <TextInput
                style={styles.filterInput}
                value={minFollowers}
                onChangeText={t => setMinFollowers(t.replace(/\D/g, ''))}
                placeholder="e.g. 10000"
                placeholderTextColor={colors.t3}
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Min ER %</Text>
              <TextInput
                style={styles.filterInput}
                value={minER}
                onChangeText={setMinER}
                placeholder="e.g. 3.5"
                placeholderTextColor={colors.t3}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <Text style={styles.filterLabel}>City</Text>
          <TextInput
            style={styles.filterInput}
            value={city}
            onChangeText={setCity}
            placeholder="e.g. Bangalore"
            placeholderTextColor={colors.t3}
          />

          <View style={styles.filterActions}>
            <TouchableOpacity style={styles.clearBtn} onPress={() => { clearFilters(); setLoading(true); setTimeout(load, 0); }}>
              <Text style={styles.clearBtnText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} onPress={() => { setLoading(true); load(); }}>
              <Text style={styles.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Results */}
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
      >
        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator color={colors.navy} />
          </View>
        ) : influencers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No influencers match</Text>
            <Text style={styles.emptySub}>Try loosening your filters or searching by handle.</Text>
          </View>
        ) : (
          influencers.map(inf => (
            <TouchableOpacity
              key={inf.id}
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('BrandInfluencerProfile', { influencerId: inf.id })}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(inf.instagram_handle || inf.full_name || 'IN').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardHandle} numberOfLines={1}>
                    @{inf.instagram_handle || 'handle'}
                    {inf.verified ? '  ✓' : ''}
                  </Text>
                  {inf.tier ? <Text style={styles.cardTier}>{inf.tier}</Text> : null}
                </View>
                {inf.full_name && <Text style={styles.cardName} numberOfLines={1}>{inf.full_name}</Text>}
                <View style={styles.cardStatsRow}>
                  {inf.followers_count != null && (
                    <Text style={styles.cardStat}>{fmtCompact(inf.followers_count)} followers</Text>
                  )}
                  {inf.engagement_rate != null && (
                    <Text style={styles.cardStat}>{parseFloat(inf.engagement_rate).toFixed(1)}% ER</Text>
                  )}
                </View>
                {(inf.niche || inf.city) && (
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {[Array.isArray(inf.niche) ? inf.niche.join(', ') : inf.niche, inf.city].filter(Boolean).join(' · ')}
                  </Text>
                )}
              </View>
              <Text style={styles.chev}>›</Text>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

function fmtCompact(n) {
  const num = Number(n);
  if (!isFinite(num)) return '—';
  if (num >= 10000000) return (num / 10000000).toFixed(1) + ' Cr';
  if (num >= 100000)   return (num / 100000).toFixed(1) + ' L';
  if (num >= 1000)     return (num / 1000).toFixed(1) + ' K';
  return String(num);
}

const styles = StyleSheet.create({
  header:   { backgroundColor: colors.navyDeep, paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16 },
  back:     { marginBottom: 8 },
  backText: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  title:    { fontSize: 22, fontWeight: '800', color: colors.white },
  subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 },

  searchBar:  { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, backgroundColor: colors.bg },
  searchInput:{ flex: 1, backgroundColor: colors.white, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: colors.t1, borderWidth: 1, borderColor: colors.border },
  searchBtn:  { backgroundColor: colors.navy, borderRadius: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  searchBtnText: { color: colors.white, fontWeight: '800', fontSize: 12 },

  filterToggle:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8, backgroundColor: colors.bg },
  filterToggleText: { fontSize: 12, fontWeight: '700', color: colors.t2 },
  filterToggleArrow:{ fontSize: 10, color: colors.t3 },

  filtersCard:   { marginHorizontal: 16, backgroundColor: colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 6 },
  filterLabel:   { fontSize: 10, fontWeight: '800', color: colors.t3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 6 },
  filterInput:   { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: colors.t1 },
  filterTwoCol:  { flexDirection: 'row', gap: 10 },
  filterActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  clearBtn:      { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  clearBtnText:  { fontSize: 12, fontWeight: '700', color: colors.t2 },
  applyBtn:      { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.navy, alignItems: 'center' },
  applyBtnText:  { fontSize: 12, fontWeight: '800', color: colors.white },

  tierRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chipSm:        { backgroundColor: colors.bg, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: colors.border },
  chipSmActive:  { backgroundColor: colors.navy, borderColor: colors.navy },
  chipSmText:    { fontSize: 10, fontWeight: '700', color: colors.t2 },
  chipSmTextActive:{ color: colors.white },

  emptyCard: { margin: 16, backgroundColor: colors.white, borderRadius: 16, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  emptyText: { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 6 },
  emptySub:  { fontSize: 11, color: colors.t3, textAlign: 'center', lineHeight: 16 },

  card:      { backgroundColor: colors.white, borderRadius: 14, padding: 12, marginHorizontal: 16, marginTop: 8, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:    { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  avatarText:{ fontSize: 14, fontWeight: '900', color: colors.white },
  cardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  cardHandle:{ fontSize: 14, fontWeight: '800', color: colors.t1, flex: 1 },
  cardTier:  { fontSize: 9, fontWeight: '800', color: colors.navy, backgroundColor: colors.navyPale || '#EDF1FA', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, textTransform: 'capitalize' },
  cardName:  { fontSize: 11, color: colors.t3, marginTop: 1 },
  cardStatsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cardStat:  { fontSize: 11, color: colors.navy, fontWeight: '700' },
  cardMeta:  { fontSize: 10, color: colors.t3, marginTop: 3 },
  chev:      { fontSize: 22, color: colors.t3 },
});
