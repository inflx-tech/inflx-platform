import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, RefreshControl, StyleSheet, ActivityIndicator, TouchableOpacity, Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { darkColors, fmtRupees } from '../../theme/tokens';
import { followerApi } from '../../services/api';

/**
 * MyReturnsScreen — Fashion-1b customer return history.
 *
 * Shows all returns the logged-in follower has initiated, with status
 * badge + admin notes when present. Tap into a row to see full detail
 * (V1: just expands inline since the row already has everything).
 */

const STATUS_THEME = {
  requested: { label: 'Awaiting review',  color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  approved:  { label: 'Approved',         color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  received:  { label: 'Goods received',   color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  refunded:  { label: 'Refunded',         color: '#22c55e', bg: 'rgba(34,197,94,0.2)' },
  rejected:  { label: 'Declined',         color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
};

export default function MyReturnsScreen({ navigation }) {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await followerApi.listMyReturns();
      setReturns(res?.data?.returns || res?.returns || []);
    } catch (e) {
      console.error('[MyReturns]', e?.message);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // Refresh on focus so new returns show up after submission
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={darkColors.amber} /></View>;
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>My Returns</Text>
        <Text style={s.subtitle}>{returns.length} return{returns.length === 1 ? '' : 's'}</Text>
      </View>

      <FlatList
        data={returns}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={darkColors.amber} />}
        renderItem={({ item }) => <ReturnRow r={item} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>↩</Text>
            <Text style={s.emptyTitle}>No returns yet</Text>
            <Text style={s.emptyText}>Items you return will appear here</Text>
          </View>
        }
      />
    </View>
  );
}

function ReturnRow({ r }) {
  const theme = STATUS_THEME[r.return_status] || STATUS_THEME.requested;
  const dateStr = new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  return (
    <View style={s.row}>
      <View style={s.rowTop}>
        <View style={s.thumbBox}>
          {r.product_image_url
            ? <Image source={{ uri: r.product_image_url }} style={s.thumb} />
            : <Text style={s.thumbIcon}>👗</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.productName} numberOfLines={1}>{r.product_name || 'Item'}</Text>
          <Text style={s.brand} numberOfLines={1}>{r.brand_name}</Text>
          <Text style={s.date}>Requested {dateStr}</Text>
        </View>
        <View style={[s.statusPill, { backgroundColor: theme.bg }]}>
          <Text style={[s.statusText, { color: theme.color }]}>{theme.label}</Text>
        </View>
      </View>

      <View style={s.detailBlock}>
        <Text style={s.reasonLabel}>Reason</Text>
        <Text style={s.reasonText}>
          {r.reason.replace(/_/g, ' ')}
          {r.reason_text ? ` — ${r.reason_text}` : ''}
        </Text>
      </View>

      {r.refund_amount != null && (
        <View style={s.refundRow}>
          <Text style={s.refundLabel}>Refund</Text>
          <Text style={[s.refundAmount, { color: theme.color }]}>{fmtRupees(r.refund_amount)}</Text>
        </View>
      )}

      {r.admin_notes && (
        <View style={s.notesBox}>
          <Text style={s.notesLabel}>From INFLX</Text>
          <Text style={s.notesText}>{r.admin_notes}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: darkColors.bg2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: darkColors.bg2 },
  header: { paddingTop: 50, paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  back: { marginBottom: 8 },
  backText: { fontSize: 13, color: darkColors.amber },
  title: { fontSize: 22, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 },

  row: { backgroundColor: '#0D1D2E', borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  thumbBox: { width: 50, height: 50, borderRadius: 9, backgroundColor: '#142438', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  thumbIcon: { fontSize: 22 },
  productName: { fontSize: 13, fontWeight: '700', color: '#fff' },
  brand: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 1 },
  date: { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 3 },
  statusPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '800' },

  detailBlock: { marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  reasonLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.3 },
  reasonText: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 3, textTransform: 'capitalize' },

  refundRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 9 },
  refundLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' },
  refundAmount: { fontSize: 14, fontWeight: '800' },

  notesBox: { marginTop: 9, padding: 10, borderRadius: 9, backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.15)' },
  notesLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(245,158,11,0.9)', textTransform: 'uppercase', letterSpacing: 0.3 },
  notesText: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 3 },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 50, color: 'rgba(255,255,255,0.2)' },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.8)', marginTop: 14 },
  emptyText: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
});
