import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { brandPalette as P, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import ScreenHeader from '../../components/brand/ScreenHeader';
import EmptyState from '../../components/brand/EmptyState';

/**
 * BrandInfluencerBrowseScreen — influencer search + filter + nav to profile.
 * Flow 21 (2026-05-25): navy + orange legacy → brandPalette + extracted
 * components (ScreenHeader + EmptyState).
 */

const NICHES = ['Food', 'Fashion', 'Beauty', 'Lifestyle', 'Fitness', 'Travel', 'Tech', 'Gaming', 'Finance', 'Parenting', 'Education'];
const TIERS  = [
  { key: '',      label: 'Any tier' },
  { key: 'nano',  label: 'Nano' },
  { key: 'micro', label: 'Micro' },
  { key: 'macro', label: 'Macro' },
  { key: 'mega',  label: 'Mega' },
];

const SORTS = [
  { key: 'rank',         label: 'Best fit' },
  { key: 'view_er',      label: 'Best ER' },
  { key: 'followers',    label: 'Most followers' },
  { key: 'active',       label: 'Most active' },
  { key: 'growth',       label: 'Highest growth' },
  { key: 'cheapest',     label: 'Lowest rate' },
  { key: 'most_collabs', label: 'Most collabs' },
];

export default function BrandInfluencerBrowseScreen({ navigation }) {
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandFilters, setExpandFilters] = useState(false);

  const [q, setQ]                 = useState('');
  const [niche, setNiche]         = useState('');
  const [tier, setTier]           = useState('');
  const [minFollowers, setMinFollowers] = useState('');
  const [minER, setMinER]         = useState('');
  const [city, setCity]           = useState('');
  const [sort, setSort]           = useState('rank');

  async function load(overrides = {}) {
    const params = { limit: 50, sort: overrides.sort != null ? overrides.sort : sort };
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
    if (!res?.success) return;
    // Response normalization (creators[] from v_searchable_creators OR legacy influencers[])
    const raw = res.data?.creators || res.data?.influencers || [];
    setInfluencers(raw.map(r => ({
      ...r,
      id:                r.id || r.row_id,
      instagram_handle:  r.instagram_handle || r.ig_handle,
      verified:          r.verified != null ? r.verified : r.ig_verified,
      engagement_rate:   r.engagement_rate != null ? r.engagement_rate
                          : (r.view_based_er != null ? r.view_based_er : r.follower_based_er),
    })));
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  function handleSearchSubmit() {
    setLoading(true);
    load();
  }

  function changeSort(newSort) {
    if (newSort === sort) return;
    setSort(newSort);
    setLoading(true);
    load({ sort: newSort });
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
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScreenHeader
        title="Find Influencers"
        sub="Search, request collabs, invite to campaigns"
        back onBack={() => navigation.goBack()}
      />

      {/* collab-part2 — sent requests + agreed creators live one tap away from search,
          mirroring the web Influencers tab. */}
      <TouchableOpacity
        style={{ marginHorizontal: 16, marginTop: 8, backgroundColor: P.ink, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}
        onPress={() => navigation.navigate('BrandCollabRequests')}
        activeOpacity={0.85}>
        <Text style={{ fontFamily: fonts.sansBold, fontSize: 12, color: P.white }}>Collab requests & agreed creators →</Text>
      </TouchableOpacity>

      <View style={s.searchBar}>
        <TextInput
          style={s.searchInput}
          value={q}
          onChangeText={setQ}
          onSubmitEditing={handleSearchSubmit}
          placeholder="Search by name or @handle"
          placeholderTextColor={P.muted3}
          returnKeyType="search"
          autoCapitalize="none"
        />
        <TouchableOpacity style={s.searchBtn} onPress={handleSearchSubmit} activeOpacity={0.85}>
          <Text style={s.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={s.sortRow}
        contentContainerStyle={{ paddingHorizontal: 14, gap: 6 }}
      >
        {SORTS.map(item => (
          <TouchableOpacity
            key={item.key}
            style={[s.sortChip, sort === item.key && s.sortChipActive]}
            onPress={() => changeSort(item.key)}
            activeOpacity={0.7}
          >
            <Text style={[s.sortChipText, sort === item.key && s.sortChipTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={s.filterToggle} onPress={() => setExpandFilters(!expandFilters)} activeOpacity={0.7}>
        <Text style={s.filterToggleText}>
          Filters{activeFilterCount > 0 ? ` · ${activeFilterCount} active` : ''}
        </Text>
        <Text style={s.filterToggleArrow}>{expandFilters ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expandFilters && (
        <View style={s.filtersCard}>
          <Text style={s.filterLabel}>Niche</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ gap: 5 }}>
            <TouchableOpacity
              style={[s.chipSm, niche === '' && s.chipSmActive]}
              onPress={() => setNiche('')}
            >
              <Text style={[s.chipSmText, niche === '' && s.chipSmTextActive]}>Any</Text>
            </TouchableOpacity>
            {NICHES.map(n => (
              <TouchableOpacity
                key={n}
                style={[s.chipSm, niche === n && s.chipSmActive]}
                onPress={() => setNiche(niche === n ? '' : n)}
              >
                <Text style={[s.chipSmText, niche === n && s.chipSmTextActive]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.filterLabel}>Tier</Text>
          <View style={s.tierRow}>
            {TIERS.map(t => (
              <TouchableOpacity
                key={t.key || 'any'}
                style={[s.chipSm, tier === t.key && s.chipSmActive]}
                onPress={() => setTier(t.key)}
              >
                <Text style={[s.chipSmText, tier === t.key && s.chipSmTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.filterTwoCol}>
            <View style={{ flex: 1 }}>
              <Text style={s.filterLabel}>Min Followers</Text>
              <TextInput
                style={s.filterInput}
                value={minFollowers}
                onChangeText={t => setMinFollowers(t.replace(/\D/g, ''))}
                placeholder="e.g. 10000"
                placeholderTextColor={P.muted3}
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.filterLabel}>Min ER %</Text>
              <TextInput
                style={s.filterInput}
                value={minER}
                onChangeText={setMinER}
                placeholder="e.g. 3.5"
                placeholderTextColor={P.muted3}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <Text style={s.filterLabel}>City</Text>
          <TextInput
            style={s.filterInput}
            value={city}
            onChangeText={setCity}
            placeholder="e.g. Bangalore"
            placeholderTextColor={P.muted3}
          />

          <View style={s.filterActions}>
            <TouchableOpacity style={s.clearBtn} onPress={() => { clearFilters(); setLoading(true); setTimeout(load, 0); }} activeOpacity={0.85}>
              <Text style={s.clearBtnText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.applyBtn} onPress={() => { setLoading(true); load(); }} activeOpacity={0.85}>
              <Text style={s.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.ink} colors={[P.ink]} />}
      >
        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator color={P.ink} size="large" />
          </View>
        ) : influencers.length === 0 ? (
          <View style={{ margin: 16 }}>
            <EmptyState
              icon="[NONE]"
              title="No influencers match"
              sub="Try loosening your filters or searching by handle."
            />
          </View>
        ) : (
          influencers.map(inf => (
            <TouchableOpacity
              key={inf.id}
              style={s.card}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('BrandInfluencerProfile', { influencerId: inf.id })}
            >
              <View style={s.avatar}>
                <Text style={s.avatarText}>
                  {(inf.instagram_handle || inf.full_name || 'IN').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={s.cardTop}>
                  <Text style={s.cardHandle} numberOfLines={1}>
                    @{inf.instagram_handle || 'handle'}
                    {inf.verified ? ' ✓' : ''}
                  </Text>
                  {inf.tier ? <Text style={s.cardTier}>{inf.tier}</Text> : null}
                </View>
                {inf.full_name && <Text style={s.cardName} numberOfLines={1}>{inf.full_name}</Text>}
                <View style={s.cardStatsRow}>
                  {inf.followers_count != null && (
                    <Text style={s.cardStat}>{fmtCompact(inf.followers_count)} followers</Text>
                  )}
                  {inf.engagement_rate != null && (
                    <Text style={s.cardStat}>{parseFloat(inf.engagement_rate).toFixed(1)}% ER</Text>
                  )}
                </View>
                {(inf.niche || inf.city) && (
                  <Text style={s.cardMeta} numberOfLines={1}>
                    {[Array.isArray(inf.niche) ? inf.niche.join(', ') : inf.niche, inf.city].filter(Boolean).join(' · ')}
                  </Text>
                )}
              </View>
              <Text style={s.chev}>›</Text>
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

const s = StyleSheet.create({
  searchBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6, backgroundColor: P.bg },
  searchInput: { flex: 1, backgroundColor: P.white, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontFamily: fonts.sansMedium, fontSize: 13, color: P.ink, borderWidth: 1, borderColor: P.border },
  searchBtn: { backgroundColor: P.ink, borderRadius: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  searchBtnText: { fontFamily: fonts.monoBold, color: P.white, fontWeight: '800', fontSize: 11.5 },

  sortRow: { backgroundColor: P.bg, paddingTop: 6, paddingBottom: 4, flexGrow: 0 },
  sortChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: P.white, borderWidth: 1, borderColor: P.border },
  sortChipActive: { backgroundColor: P.ink, borderColor: P.ink },
  sortChipText: { fontFamily: fonts.sansBold, fontSize: 10.5, fontWeight: '700', color: P.muted },
  sortChipTextActive: { color: P.white, fontFamily: fonts.monoBold, fontWeight: '800' },

  filterToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8, backgroundColor: P.bg },
  filterToggleText: { fontFamily: fonts.sansBold, fontSize: 11.5, fontWeight: '700', color: P.ink2 },
  filterToggleArrow: { fontFamily: fonts.monoBold, fontSize: 10, color: P.muted3 },

  filtersCard: { marginHorizontal: 14, backgroundColor: P.white, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: P.border, marginBottom: 6 },
  filterLabel: { fontFamily: fonts.monoBold, fontSize: 9, fontWeight: '800', color: P.muted2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5, marginTop: 6 },
  filterInput: { fontFamily: fonts.monoMedium, borderWidth: 1, borderColor: P.border, backgroundColor: P.white, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12, color: P.ink },
  filterTwoCol: { flexDirection: 'row', gap: 10 },
  filterActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  clearBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: P.bg2, alignItems: 'center' },
  clearBtnText: { fontFamily: fonts.sansBold, fontSize: 11, fontWeight: '800', color: P.muted },
  applyBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: P.ink, alignItems: 'center' },
  applyBtnText: { fontFamily: fonts.displayBold, fontSize: 11, fontWeight: '800', color: P.white},

  tierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 10 },
  chipSm: { backgroundColor: P.bg2, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: P.border },
  chipSmActive: { backgroundColor: P.ink, borderColor: P.ink },
  chipSmText: { fontFamily: fonts.sansBold, fontSize: 10.5, fontWeight: '700', color: P.muted },
  chipSmTextActive: { color: P.white, fontFamily: fonts.monoBold },

  card: { backgroundColor: P.white, borderRadius: 14, padding: 12, marginHorizontal: 14, marginTop: 8, borderWidth: 1, borderColor: P.border, flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: P.ink, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.displayBold, fontSize: 14, fontWeight: '900', color: P.white},
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  cardHandle: { fontFamily: fonts.displayBold, fontSize: 13.5, fontWeight: '800', color: P.ink, flex: 1 },
  cardTier: { fontFamily: fonts.monoBold, fontSize: 9, fontWeight: '800', color: P.ink, backgroundColor: P.bg2, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, textTransform: 'capitalize' },
  cardName: { fontFamily: fonts.sansMedium, fontSize: 10.5, color: P.muted2, marginTop: 1 },
  cardStatsRow: { flexDirection: 'row', gap: 11, marginTop: 4 },
  cardStat: { fontFamily: fonts.monoBold, fontSize: 10.5, color: P.ink, fontWeight: '700' },
  cardMeta: { fontFamily: fonts.sansMedium, fontSize: 9.5, color: P.muted3, marginTop: 3 },
  chev: { fontFamily: fonts.monoBold, fontSize: 22, color: P.muted3, fontWeight: '800' },
});
