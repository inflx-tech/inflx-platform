/**
 * CreatorNotificationsScreen — C5, told when her collaboration changes: an offer ended or was taken
 * out of an invitation, products removed from an offer, a price changed, a product out of stock or
 * off sale — plus every other notice she's sent. Tapping one opens what it's about.
 * Contract: features/creator-terms-v2 · rules Docs/OFFER_TERMS_POSTS_RULES.md §2.8, §2.11
 */
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';

/** Where a notice goes, from its data (the server sends data_json.screen). */
export function targetOf(n) {
  const d = n && n.data_json ? n.data_json : {};
  const ci = d.campaign_influencer_id;
  if (!ci) return null;
  if (d.screen === 'creator_offer' && d.offer_id) return { name: 'CreatorSell', params: { ciId: ci } };
  if (d.screen === 'creator_sell') return { name: 'CreatorSell', params: { ciId: ci } };
  if (d.screen === 'invitation') return { name: 'Invitation', params: { ciId: ci } };
  return null;
}

const ago = (iso) => {
  const t = new Date(iso).getTime();
  if (!t) return '';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 60) return m <= 1 ? 'just now' : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
};

export default function CreatorNotificationsScreen({ navigation }) {
  const [status, setStatus] = useState('loading');
  const [rows, setRows] = useState([]);

  const load = useCallback(async () => {
    setStatus(st => (st === 'ready' ? 'ready' : 'loading'));
    const r = await influencerApi.getNotifications();
    if (!r.success) { setStatus('error'); return; }
    setRows(r.data.notifications || []); setStatus('ready');
    influencerApi.markAllNotificationsRead().catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (status === 'loading') return <View style={base.screen}><Header title="Notifications" onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title="Notifications" onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  return (
    <View style={base.screen} testID="creator-notifications">
      <Header title="Notifications" onBack={() => navigation.goBack()} />
      <FlatList
        data={rows}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        ListEmptyComponent={<Text style={s.empty}>Nothing yet. You'll be told here when a brand's offer or product you sell changes.</Text>}
        renderItem={({ item }) => {
          const to = targetOf(item);
          return (
            <TouchableOpacity style={s.row} disabled={!to} onPress={() => to && navigation.navigate(to.name, to.params)} testID={`notice-${item.id}`}>
              {!item.is_read ? <View style={s.dot} /> : <View style={s.dotOff} />}
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{item.title}</Text>
                <Text style={s.body}>{item.body}{item.created_at ? ` · ${ago(item.created_at)}` : ''}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.border },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.state.yourMove.fg, marginTop: 5, marginRight: 10 },
  dotOff: { width: 8, height: 8, marginTop: 5, marginRight: 10 },
  title: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink },
  body: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, marginTop: 2, lineHeight: 16 },
  empty: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, textAlign: 'center', marginTop: 40, lineHeight: 18 },
});
