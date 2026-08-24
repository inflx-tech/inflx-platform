import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { brandPalette as P, fonts, fmtMoney } from '../../theme/tokens';
import { brandApi } from '../../services/api';

/**
 * Influencer market analytics — mobile mirror of brand-web
 * /dashboard/influencers/analytics (read-only): overview tiles, tier split,
 * top cities/niches bars, rate benchmarks, leaderboards.
 * Contract: features/brand-mobile-parity-pack.
 */

const TIERS = ['all', 'nano', 'micro', 'mid', 'macro', 'mega'];

export default function BrandInfluencerAnalyticsScreen({ navigation }) {
  const [data, setData]         = useState(null);
  const [tier, setTier]         = useState('all');
  const [city, setCity]         = useState('');
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(t = tier, c = city) {
    const params = {};
    if (t !== 'all') params.tier = t;
    if (c.trim()) params.city = c.trim();
    const res = await brandApi.getInfluencerAnalytics(Object.keys(params).length ? params : null);
    if (res?.success) setData(res.data || null);
    setLoading(false); setRefreshing(false);
  }
  useFocusEffect(useCallback(() => { setLoading(true); load(tier, city); }, [tier]));

  const ov = data?.overview || {};

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
          <Text style={s.backText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={s.title}>Creator market</Text>
        <Text style={s.subtitle}>Who's out there, what they cost, who performs</Text>
      </View>

      <View style={s.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {TIERS.map(t => (
            <TouchableOpacity key={t} style={[s.chip, tier === t && s.chipOn]} onPress={() => setTier(t)}>
              <Text style={[s.chipTxt, tier === t && s.chipTxtOn]}>{t[0].toUpperCase() + t.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TextInput style={s.cityInput} value={city} onChangeText={setCity} placeholder="Filter by city…"
          placeholderTextColor={P.muted3} returnKeyType="search" onSubmitEditing={() => { setLoading(true); load(tier, city); }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" color={P.ink} /></View>
      ) : (
        <ScrollView
          style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={P.ink} />}
        >
          <View style={s.tilesRow}>
            <Tile label="Creators" value={ov.total ?? '—'} />
            <Tile label="Avg ER" value={ov.avg_view_er != null ? `${Number(ov.avg_view_er).toFixed(1)}%` : '—'} />
            <Tile label="Cities" value={ov.distinct_cities ?? '—'} />
            <Tile label="Rate range" value={ov.min_rate != null ? `${fmtMoney(ov.min_rate)}–${fmtMoney(ov.max_rate)}` : '—'} small />
          </View>

          <Bars title="TIER SPLIT" rows={(data?.tier_distribution || []).map(r => ({ label: r.tier, n: r.n }))} />
          <Bars title="TOP CITIES" rows={(data?.city_distribution || []).slice(0, 6).map(r => ({ label: r.city, n: r.n }))} />
          <Bars title="TOP NICHES" rows={(data?.niche_distribution || []).slice(0, 6).map(r => ({ label: r.niche, n: r.n }))} />

          {(data?.rate_by_tier || []).length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>RATE BENCHMARKS</Text>
              {data.rate_by_tier.map((r, i) => (
                <View key={i} style={s.rateRow}>
                  <Text style={s.rateTier}>{String(r.tier || '').toUpperCase()}</Text>
                  <Text style={s.rateVal}>{fmtMoney(r.avg_min || 0)} – {fmtMoney(r.avg_max || 0)}</Text>
                  <Text style={s.rateN}>{r.n} creators</Text>
                </View>
              ))}
            </View>
          )}

          <Leaderboard title="⭐ TOP RANKED" rows={data?.top_rank} navigation={navigation} />
          <Leaderboard title="💸 BEST VALUE (views per ₹1k)" rows={data?.cost_efficient} metric={r => r.views_per_1k_inr ? `${Math.round(r.views_per_1k_inr)} views/₹1k` : ''} navigation={navigation} />
        </ScrollView>
      )}
    </View>
  );
}

function Tile({ label, value, small }) {
  return (
    <View style={s.tile}>
      <Text style={[s.tileVal, small && { fontSize: 11 }]} numberOfLines={1}>{value}</Text>
      <Text style={s.tileLbl}>{label}</Text>
    </View>
  );
}

function Bars({ title, rows }) {
  if (!rows || rows.length === 0) return null;
  const max = Math.max(...rows.map(r => Number(r.n) || 0), 1);
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{title}</Text>
      {rows.map((r, i) => (
        <View key={i} style={{ marginBottom: 7 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={s.barLbl} numberOfLines={1}>{r.label || '—'}</Text>
            <Text style={s.barN}>{r.n}</Text>
          </View>
          <View style={s.track}><View style={[s.fill, { width: `${Math.round((Number(r.n) / max) * 100)}%` }]} /></View>
        </View>
      ))}
    </View>
  );
}

function Leaderboard({ title, rows, metric, navigation }) {
  if (!rows || rows.length === 0) return null;
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{title}</Text>
      {rows.slice(0, 5).map((r, i) => (
        <TouchableOpacity key={i} style={s.lbRow}
          disabled={!r.linked_influencer_id}
          onPress={() => r.linked_influencer_id && navigation.navigate('BrandInfluencerProfile', { influencerId: r.linked_influencer_id })}>
          <Text style={s.lbRank}>{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.lbHandle} numberOfLines={1}>@{r.ig_handle}{r.is_inflx_verified ? ' ✓' : ''}</Text>
            <Text style={s.lbMeta} numberOfLines={1}>
              {[r.tier, r.city, r.niche].filter(Boolean).join(' · ')}
              {metric && metric(r) ? ` · ${metric(r)}` : ''}
            </Text>
          </View>
          {!!r.linked_influencer_id && <Text style={s.lbGo}>→</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  header:    { backgroundColor: P.white, paddingHorizontal: 18, paddingTop: 52, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  back:      { paddingBottom: 6 },
  backText:  { fontFamily: fonts.sansMedium, fontSize: 11.5, fontWeight: '600', color: P.muted2 },
  title:     { fontFamily: fonts.displayBold, fontSize: 22, fontWeight: '700', color: P.ink, letterSpacing: -0.3 },
  subtitle:  { fontFamily: fonts.sansMedium, fontSize: 11, color: P.muted2, marginTop: 6 },
  filters:   { paddingHorizontal: 14, paddingTop: 10 },
  chip:      { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn:    { backgroundColor: P.bg2, borderColor: P.ink },
  chipTxt:   { fontSize: 11.5, fontWeight: '600', color: P.muted },
  chipTxtOn: { color: P.ink },
  cityInput: { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: P.ink2, marginTop: 8 },
  tilesRow:  { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tile:      { flex: 1, backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  tileVal:   { fontSize: 14, fontWeight: '800', color: P.ink },
  tileLbl:   { fontSize: 9.5, color: P.muted2, marginTop: 2 },
  card:      { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 12, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 10.5, fontWeight: '800', color: P.muted2, letterSpacing: 0.6, marginBottom: 8 },
  barLbl:    { fontSize: 12, color: P.ink2, fontWeight: '600', maxWidth: '75%' },
  barN:      { fontSize: 12, color: P.muted2, fontWeight: '700' },
  track:     { height: 5, backgroundColor: P.bg2, borderRadius: 3, marginTop: 3 },
  fill:      { height: 5, backgroundColor: P.ink, borderRadius: 3 },
  rateRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: P.borderSoft },
  rateTier:  { width: 64, fontSize: 10.5, fontWeight: '800', color: P.muted },
  rateVal:   { flex: 1, fontSize: 12.5, fontWeight: '700', color: P.ink },
  rateN:     { fontSize: 10.5, color: P.muted3 },
  lbRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: P.borderSoft },
  lbRank:    { width: 24, fontSize: 13, fontWeight: '800', color: P.ink },
  lbHandle:  { fontSize: 13, fontWeight: '700', color: P.ink },
  lbMeta:    { fontSize: 11, color: P.muted2, marginTop: 1 },
  lbGo:      { fontSize: 14, color: P.muted3, paddingLeft: 8 },
});
