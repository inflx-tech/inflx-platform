import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { influencerApi } from '../../services/api';
import { aggregateSocialStats } from '../../utils/socialStats';

/* ════════════════════════════════════════════════════════════════════════
   CollabTrackingScreen — features/tracking-social. Per-collab performance.
   SOCIAL axis (Phase 1, backed by deliverable_stats). The INFLX/platform axis
   is a labelled Phase-2 placeholder — NO fabricated numbers.
   ══════════════════════════════════════════════════════════════════════ */

const TYPE_LABELS = { reel: 'Reel', post: 'Post', story: 'Story', youtube_video: 'YouTube', youtube_short: 'Short' };

function fmtNum(n) {
  if (n == null) return '—';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

export default function CollabTrackingScreen({ route, navigation }) {
  const ciId = route.params?.campaignInfluencerId;
  const [brand, setBrand] = useState(route.params?.brandName || '');
  const [campaign, setCampaign] = useState(route.params?.campaignName || '');
  const [live, setLive] = useState([]);
  const [agg, setAgg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    const res = await influencerApi.getMyCampaignDetail(ciId);
    if (!res.success) { setLoading(false); return; }
    const c = res.data?.campaign || {};
    setBrand(c.brand_name || ''); setCampaign(c.campaign_name || '');
    const dels = (res.data?.deliverables || []).filter(d => d.status === 'live' || d.live_url);
    const results = await Promise.all(dels.map(async (d) => {
      const r = refresh ? await influencerApi.refreshStats(d.id) : await influencerApi.getDeliverable(d.id);
      return { deliverable: d, stats: r.success ? (r.data?.stats || null) : null };
    }));
    setLive(results);
    setAgg(aggregateSocialStats(results.map(x => x.stats).filter(Boolean)));
    setLoading(false);
  }, [ciId]);

  useFocusEffect(useCallback(() => { load(false); }, [load]));
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(true); setRefreshing(false); }, [load]);

  if (loading) return <View style={s.center}><ActivityIndicator color={ig.text} /></View>;

  const hasLive = live.length > 0;

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ig.text} />}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}><Icon name="chevron-left" size={18} color={ig.mut} /><Text style={s.backTxt}>Back</Text></TouchableOpacity>
        <Text style={s.title}>{brand || 'Performance'}</Text>
        <Text style={s.sub}>{campaign ? `${campaign} · tracking` : 'Tracking performance'}</Text>
      </View>

      <View style={s.body}>
        {/* SOCIAL panel */}
        <View style={s.panel}>
          <View style={s.pHead}>
            <View style={[s.pIco, { backgroundColor: ig.purpleBg }]}>
              <Icon name="instagram" size={16} color={ig.purple} />
            </View>
            <Text style={s.pName}>On social media</Text>
            {hasLive ? <TouchableOpacity style={s.refresh} onPress={onRefresh}><Text style={s.refreshTxt}>Refresh</Text></TouchableOpacity> : null}
          </View>

          {hasLive && agg ? (
            <>
              <View style={s.bigRow}>
                <Text style={s.bigV}>{fmtNum(agg.reach)}</Text>
                <Text style={s.bigL}>total reach · {agg.postCount} post{agg.postCount === 1 ? '' : 's'}</Text>
              </View>
              <View style={s.grid}>
                {[['Likes', agg.likes], ['Comments', agg.comments], ['Saves', agg.saves], ['Shares', agg.shares], ['Impr.', agg.impressions]].map(([l, v]) => (
                  <View key={l} style={s.sb}><Text style={s.sv}>{fmtNum(v)}</Text><Text style={s.sl}>{l}</Text></View>
                ))}
                <View style={s.sb}><Text style={[s.sv, { color: ig.yInk }]}>{agg.avgEngagementRate != null ? `${agg.avgEngagementRate.toFixed(1)}%` : '—'}</Text><Text style={s.sl}>Avg ER</Text></View>
              </View>

              {/* per-post breakdown */}
              <Text style={s.breakLbl}>Per post</Text>
              {live.map(({ deliverable: d, stats }) => (
                <View key={d.id} style={s.postRow}>
                  <Text style={s.postType}>{TYPE_LABELS[d.type] || d.type}</Text>
                  <Text style={s.postMetric}>{stats ? `${fmtNum(stats.reach)} reach` : 'No stats yet'}</Text>
                  <Text style={s.postMetric}>{stats ? `${fmtNum(stats.likes)} likes` : ''}</Text>
                </View>
              ))}
            </>
          ) : (
            <View style={s.empty}>
              <Icon name="chart-line" size={26} color={ig.mut2} />
              <Text style={s.emptyT}>No live posts yet</Text>
              <Text style={s.emptyS}>Once your content goes live, engagement shows up here.</Text>
            </View>
          )}
        </View>

        {/* PLATFORM panel — honest Phase-2 placeholder */}
        <View style={s.panel}>
          <View style={s.pHead}>
            <View style={[s.pIco, { backgroundColor: ig.yBg }]}><Icon name="storefront-outline" size={16} color={ig.yInk} /></View>
            <Text style={s.pName}>On INFLX</Text>
            <View style={s.soon}><Text style={s.soonTxt}>Coming soon</Text></View>
          </View>
          <Text style={s.phTxt}>
            Views, saves and <Text style={{ fontWeight: '700', color: ig.text }}>sales from your on-platform post</Text> will show here once platform tracking ships.
          </Text>
          <View style={s.phRow}>
            <View style={s.phStat}><Text style={s.phV}>—</Text><Text style={s.phL}>Post views</Text></View>
            <View style={s.phStat}><Text style={s.phV}>—</Text><Text style={s.phL}>Saves</Text></View>
            <View style={s.phStat}><Text style={s.phV}>—</Text><Text style={s.phL}>Sales</Text></View>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: ig.bg },
  header: { backgroundColor: ig.bg, paddingHorizontal: 16, paddingTop: 50, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: ig.line },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: -4 },
  backTxt: { fontSize: 12.5, color: ig.mut, fontWeight: '600' },
  title: { fontSize: 19, fontWeight: '800', color: ig.text, letterSpacing: -0.2 },
  sub: { fontSize: 11.5, color: ig.mut, marginTop: 3 },

  body: { padding: 14 },
  panel: { borderWidth: 1, borderColor: ig.line, borderRadius: 13, padding: 13, marginBottom: 11 },
  pHead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 },
  pIco: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  pName: { fontSize: 13, fontWeight: '800', color: ig.text },
  refresh: { marginLeft: 'auto', backgroundColor: ig.bgSoft, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 6 },
  refreshTxt: { fontSize: 10.5, fontWeight: '800', color: ig.text },

  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginBottom: 12 },
  bigV: { fontSize: 28, fontWeight: '900', color: ig.text, letterSpacing: -0.5 },
  bigL: { fontSize: 11, color: ig.mut, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sb: { width: '31.5%', backgroundColor: ig.bgSoft, borderRadius: 10, padding: 10, alignItems: 'center' },
  sv: { fontSize: 15, fontWeight: '900', color: ig.text },
  sl: { fontSize: 8, fontWeight: '800', color: ig.mut, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.3 },

  breakLbl: { fontSize: 10, fontWeight: '800', color: ig.mut, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 14, marginBottom: 6 },
  postRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderTopWidth: 1, borderTopColor: ig.lineSoft },
  postType: { flex: 1, fontSize: 12.5, fontWeight: '700', color: ig.text },
  postMetric: { fontSize: 11.5, color: ig.mut, marginLeft: 12 },

  empty: { alignItems: 'center', paddingVertical: 18 },
  emptyT: { fontSize: 13.5, fontWeight: '700', color: ig.text, marginTop: 10 },
  emptyS: { fontSize: 11.5, color: ig.mut, textAlign: 'center', marginTop: 4, lineHeight: 16 },

  soon: { marginLeft: 'auto', backgroundColor: ig.yBg, borderWidth: 1, borderColor: '#F0DA88', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  soonTxt: { fontSize: 8.5, fontWeight: '800', color: ig.yInk, textTransform: 'uppercase', letterSpacing: 0.3 },
  phTxt: { fontSize: 12, color: ig.mut, lineHeight: 17, marginBottom: 12 },
  phRow: { flexDirection: 'row', gap: 6 },
  phStat: { flex: 1, backgroundColor: ig.bgSoft, borderRadius: 10, padding: 11, alignItems: 'center' },
  phV: { fontSize: 17, fontWeight: '900', color: ig.mut2 },
  phL: { fontSize: 8.5, fontWeight: '800', color: ig.mut, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.3 },
});
