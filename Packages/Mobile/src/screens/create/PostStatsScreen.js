/**
 * PostStatsScreen — L6 a post's stats: visits, orders and what she earned; visits by channel (a typed
 * code is "Post code"); orders by channel ("In INFLX" when no tap on her links came first). Never
 * who bought. The brand opens the same screen from its set's posts (L7), with its own numbers.
 * Contract: features/post-links-codes · rules §4.14
 */
import React, { useCallback, useState } from 'react';
import { View, ScrollView, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { influencerApi, brandApi } from '../../services/api';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { CL } from '../../components/create/copyLinks';
import { rupeesP } from '../../components/create/copyCreate';
import { s as b } from '../../components/create/bitsCreate';

export default function PostStatsScreen({ navigation, route }) {
  const { postId, brand } = route.params || {};
  const [d, setD] = useState(null);
  const [status, setStatus] = useState('loading');

  const load = useCallback(async () => {
    const r = brand ? await brandApi.setPostStats(brand.campaignId, brand.setId, postId) : await influencerApi.postStats(postId);
    if (!r.success) { setStatus('error'); return; }
    setD(r.data); setStatus('ready');
  }, [postId, brand]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const top = d ? Math.max(1, ...d.visits.map(v => v.visits)) : 1;
  return (
    <View style={base.screen} testID="post-stats">
      <Header title={d ? CL.statsTitle(d.title) : ''} onBack={() => navigation.goBack()} />
      {status === 'loading' ? <Skeleton /> : status === 'error' ? <LoadError onRetry={load} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text style={b.rowMeta}>{CL.statsSub(d.brand_name, d.code, d.live_since)}</Text>
          <View style={st.kpi}>
            <View style={st.k}><Text style={st.kv}>{d.totals.visits.toLocaleString('en-IN')}</Text><Text style={st.kl}>{CL.visits}</Text></View>
            <View style={st.k}><Text style={st.kv}>{d.totals.orders}</Text><Text style={st.kl}>{CL.orders}</Text></View>
            <View style={st.k}><Text style={st.kv}>{rupeesP(d.totals.commission)}</Text><Text style={st.kl}>{brand ? CL.commissionWord : CL.toYou}</Text></View>
          </View>
          <Text style={b.label}>{CL.visitsBy}</Text>
          {d.visits.length ? d.visits.map(v => (
            <View key={v.channel} style={st.bar} testID={`visits-${v.channel}`}>
              <Text style={st.bl}>{v.label}</Text>
              <View style={st.track}><View style={[st.fill, { width: `${Math.round((v.visits / top) * 100)}%` }]} /></View>
              <Text style={st.bv}>{v.visits.toLocaleString('en-IN')}</Text>
            </View>
          )) : <Text style={b.hint}>{CL.noVisits}</Text>}
          <Text style={b.label}>{CL.ordersBy}</Text>
          {d.orders.length ? d.orders.map((o, i) => (
            <View key={o.channel} style={st.line} testID={`orders-${o.channel}`}>
              <Text style={b.rowMeta}>{o.label}</Text>
              <Text style={st.lv}>{CL.orderLine(o, i === 0)}</Text>
            </View>
          )) : <Text style={b.hint}>{CL.noOrders}</Text>}
          <Text style={[b.hint, { marginTop: 10 }]}>{CL.inflxHint}</Text>
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  kpi: { flexDirection: 'row', marginTop: 12 },
  k: { flex: 1, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingVertical: 8, alignItems: 'center', marginRight: 6 },
  kv: { fontFamily: fonts.sansBold, fontSize: 16, color: T.ink },
  kl: { fontFamily: fonts.sansRegular, fontSize: 10.5, color: T.ink3 },
  bar: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  bl: { width: 78, fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2 },
  track: { flex: 1, height: 8, borderRadius: 99, backgroundColor: T.surface, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: T.ink, borderRadius: 99 },
  bv: { width: 60, textAlign: 'right', fontFamily: fonts.sansBold, fontSize: 11.5, color: T.ink },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  lv: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink },
});
