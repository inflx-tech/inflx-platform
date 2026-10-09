/**
 * Item 19 — BH6, the brand's notices. The creator app has had this list since creator-terms-v2
 * (screens/influencer/CreatorNotificationsScreen); the brand app had none, although the server
 * has always sent a brand its notices with the screen each is about.
 *
 * A notice is a RECORD that something happened, not a to-do: the to-do is the row in Needs you,
 * and it stays there whether or not its notice has been read (rules v1.32 §24). Tapping a notice
 * opens the screen it names; an order notice opens the website's orders page, because the phone
 * has no orders screen (H5). Opening the list marks everything read, as the creator's does.
 * Contract: features/item19-home
 */
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { setHomeCount, getHomeCount } from '../../services/homeCount';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { H19 } from '../../components/home/copy19';
import { brandNoticeTarget, jumpFromHome } from '../../components/home/open19';

export const ago = (iso, now = Date.now()) => {
  const t = new Date(iso).getTime();
  if (!t) return '';
  const m = Math.round((now - t) / 60000);
  if (m < 60) return m <= 1 ? 'just now' : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
};

export default function BrandNotificationsScreen({ navigation }) {
  const [status, setStatus] = useState('loading');
  const [rows, setRows] = useState([]);

  const load = useCallback(async () => {
    setStatus((st) => (st === 'ready' ? 'ready' : 'loading'));
    const r = await brandApi.getNotifications();
    if (!r || !r.success) { setStatus('error'); return; }
    setRows(r.data.notifications || []);
    setStatus('ready');
    brandApi.markAllNotificationsRead().then(() => setHomeCount({ ...getHomeCount(), unread: 0 })).catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const back = () => navigation.goBack();
  if (status === 'loading') return <View style={base.screen}><Header title={H19.notifications} onBack={back} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={H19.notifications} onBack={back} /><LoadError onRetry={load} /></View>;

  return (
    <View style={base.screen} testID="brand-notifications">
      <Header title={H19.notifications} onBack={back} />
      <FlatList
        data={rows}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}
        ListEmptyComponent={<Text style={st.empty}>{H19.noNotices}</Text>}
        renderItem={({ item }) => {
          const to = brandNoticeTarget(item);
          return (
            <TouchableOpacity style={st.row} disabled={!to} onPress={() => to && jumpFromHome(navigation, to)} testID={`notice-${item.id}`} accessibilityRole={to ? 'button' : undefined}>
              {!item.is_read ? <View style={st.dot} /> : <View style={st.dotOff} />}
              <View style={{ flex: 1 }}>
                <Text style={st.title}>{item.title}</Text>
                <Text style={st.body}>{item.body}{item.created_at ? ` · ${ago(item.created_at)}` : ''}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.border },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.state.yourMove.fg, marginTop: 5, marginRight: 10 },
  dotOff: { width: 8, height: 8, marginTop: 5, marginRight: 10 },
  title: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink },
  body: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, marginTop: 2, lineHeight: 16 },
  empty: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, textAlign: 'center', marginTop: 40, lineHeight: 18 },
});
