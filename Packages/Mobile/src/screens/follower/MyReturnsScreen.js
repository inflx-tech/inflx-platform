import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, RefreshControl, StyleSheet, ActivityIndicator, TouchableOpacity, Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { brandPalette as P, fonts, fmtRupees } from '../../theme/tokens';
import { followerApi } from '../../services/api';

/**
 * MyReturnsScreen — Fashion-1b customer return history.
 *
 * Shows all returns the logged-in follower has initiated, with status
 * badge + admin notes when present. Tap into a row to see full detail
 * (V1: just expands inline since the row already has everything).
 */

// brandPalette status pales — pale bg + dark text (light theme). Same 5 return
// states; only recoloured (NOT swapped to the canonical 43-StatusPill — F4 decision).
const STATUS_THEME = {
  requested: { label: 'Awaiting review',  color: P.yellowText,  bg: P.yellowPale },
  approved:  { label: 'Approved',         color: P.successText, bg: P.successPale },
  received:  { label: 'Goods received',   color: P.info,        bg: P.infoPale },
  refunded:  { label: 'Refunded',         color: P.successText, bg: P.successPale },
  rejected:  { label: 'Declined',         color: P.dangerText,  bg: P.dangerPale },
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
    return <View style={s.center}><ActivityIndicator color={P.ink} /></View>;
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.ink} />}
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
  container: { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: P.bg },
  // ink hero header
  header: { paddingTop: 50, paddingHorizontal: 18, paddingBottom: 14, backgroundColor: P.ink },
  back: { marginBottom: 8 },
  backText: { fontFamily: fonts.monoBold, fontSize: 11, color: 'rgba(255,255,255,0.65)', letterSpacing: 0.3 },
  title: { fontFamily: fonts.displayBlack, fontSize: 22, color: '#FFFFFF' },
  subtitle: { fontFamily: fonts.monoMedium, fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 3 },

  row: { backgroundColor: P.white, borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: P.border },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  thumbBox: { width: 50, height: 50, borderRadius: 9, backgroundColor: P.bg2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  thumbIcon: { fontSize: 22 },
  productName: { fontFamily: fonts.displayBold, fontSize: 13, color: P.ink },
  brand: { fontFamily: fonts.sansMedium, fontSize: 11, color: P.muted, marginTop: 1 },
  date: { fontFamily: fonts.monoMedium, fontSize: 10, color: P.muted3, marginTop: 3 },
  statusPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontFamily: fonts.monoBold, fontSize: 10 },

  detailBlock: { marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: P.borderSoft },
  reasonLabel: { fontFamily: fonts.monoBold, fontSize: 9, color: P.muted2, textTransform: 'uppercase', letterSpacing: 0.3 },
  reasonText: { fontFamily: fonts.sansMedium, fontSize: 12, color: P.ink2, marginTop: 3, textTransform: 'capitalize' },

  refundRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 9 },
  refundLabel: { fontFamily: fonts.monoBold, fontSize: 10, color: P.muted2, textTransform: 'uppercase' },
  refundAmount: { fontFamily: fonts.monoBold, fontSize: 14 },

  notesBox: { marginTop: 9, padding: 10, borderRadius: 9, backgroundColor: P.yellowPale, borderWidth: 1, borderColor: '#F0DA88' },
  notesLabel: { fontFamily: fonts.monoBold, fontSize: 9, color: P.yellowText, textTransform: 'uppercase', letterSpacing: 0.3 },
  notesText: { fontFamily: fonts.sansMedium, fontSize: 11, color: P.ink2, marginTop: 3 },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 50, color: P.muted4 },
  emptyTitle: { fontFamily: fonts.displayBold, fontSize: 15, color: P.ink, marginTop: 14 },
  emptyText: { fontFamily: fonts.monoMedium, fontSize: 11, color: P.muted2, marginTop: 4 },
});
