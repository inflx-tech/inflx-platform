import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { brandPalette as P, fonts, fmtMoney } from '../../theme/tokens';
import { brandApi } from '../../services/api';

/**
 * Orders inbox — mirror of brand-web /dashboard/orders (walk-ins, pre-bookings,
 * online orders from followers). Contract: features/brand-mobile-parity-pack.
 * Reads GET /brands/me/transactions with type/status filters; expandable rows.
 */

const TYPE_FILTERS = [
  { key: 'all',          label: 'All' },
  { key: 'pay_at_store', label: 'Walk-ins' },
  { key: 'prebook',      label: 'Pre-bookings' },
  { key: 'online_order', label: 'Online orders' },
];
const STATUS_FILTERS = [
  { key: 'all',       label: 'Any status' },
  { key: 'completed', label: 'Completed' },
  { key: 'initiated', label: 'Initiated' },
  { key: 'returned',  label: 'Returned' },
  { key: 'refunded',  label: 'Refunded' },
];
const TYPE_LABEL = { pay_at_store: 'WALK-IN', prebook: 'PRE-BOOK', online_order: 'ONLINE' };
const STATUS_PILL = {
  completed: { bg: P.successPale, fg: P.successText },
  initiated: { bg: P.warnPale,  fg: P.warnText },
  returned:  { bg: P.dangerPale,  fg: P.dangerText },
  refunded:  { bg: P.bg2,         fg: P.muted },
};

export default function BrandOrdersScreen({ navigation }) {
  const [items, setItems]         = useState([]);
  const [page, setPage]           = useState(1);
  const [total, setTotal]         = useState(0);
  const [type, setType]           = useState('all');
  const [status, setStatus]       = useState('all');
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded]   = useState(null);

  async function load(p = 1, t = type, st = status, append = false) {
    const params = { page: p, limit: 20 };
    if (t !== 'all') params.type = t;
    if (st !== 'all') params.status = st;
    const res = await brandApi.listTransactions(params);
    if (res?.success) {
      const list = res.data?.transactions || [];
      setItems(prev => (append ? [...prev, ...list] : list));
      setTotal(res.data?.meta?.total ?? list.length);
      setPage(p);
    }
    setLoading(false); setRefreshing(false);
  }

  useFocusEffect(useCallback(() => { setLoading(true); load(1, type, status); }, [type, status]));

  const canLoadMore = items.length < total;

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
          <Text style={s.backText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={s.title}>Orders</Text>
        <Text style={s.subtitle}>Walk-ins, pre-bookings and online orders from followers</Text>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
          {TYPE_FILTERS.map(f => (
            <TouchableOpacity key={f.key} style={[s.chip, type === f.key && s.chipOn]} onPress={() => setType(f.key)}>
              <Text style={[s.chipTxt, type === f.key && s.chipTxtOn]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
          <View style={{ width: 10 }} />
          {STATUS_FILTERS.map(f => (
            <TouchableOpacity key={f.key} style={[s.chip, status === f.key && s.chipOn]} onPress={() => setStatus(f.key)}>
              <Text style={[s.chipTxt, status === f.key && s.chipTxtOn]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" color={P.ink} /></View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 14, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(1, type, status); }} tintColor={P.ink} />}
        >
          {items.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🧾</Text>
              <Text style={s.emptyTitle}>No orders yet</Text>
              <Text style={s.emptyText}>Follower walk-ins, bookings and online orders appear here.</Text>
            </View>
          ) : items.map(tx => {
            const pill = STATUS_PILL[tx.status] || STATUS_PILL.initiated;
            const open = expanded === tx.id;
            return (
              <TouchableOpacity key={tx.id} style={s.card} activeOpacity={0.85} onPress={() => setExpanded(open ? null : tx.id)}>
                <View style={s.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardName} numberOfLines={1}>{tx.follower_name || 'Customer'}</Text>
                    <Text style={s.cardMeta} numberOfLines={1}>
                      {TYPE_LABEL[tx.transaction_type] || tx.transaction_type} · {new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {tx.product_name ? ` · ${tx.product_name}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.cardAmt}>{fmtMoney(tx.net_amount)}</Text>
                    <View style={[s.pill, { backgroundColor: pill.bg }]}>
                      <Text style={[s.pillTxt, { color: pill.fg }]}>{String(tx.status || '').toUpperCase()}</Text>
                    </View>
                  </View>
                </View>
                {open && (
                  <View style={s.detail}>
                    <Row k="Bill amount" v={fmtMoney(tx.gross_amount)} />
                    {Number(tx.discount_amount) > 0 && <Row k="Discount" v={`- ${fmtMoney(tx.discount_amount)}`} />}
                    <Row k="Customer paid" v={fmtMoney(tx.net_amount)} />
                    {tx.brand_net != null && <Row k="Your net" v={fmtMoney(tx.brand_net)} strong />}
                    {Number(tx.influencer_commission) > 0 && <Row k="Creator commission" v={fmtMoney(tx.influencer_commission)} />}
                    {tx.instagram_handle ? <Row k="Via creator" v={`@${tx.instagram_handle}`} /> : null}
                    {tx.campaign_name ? <Row k="Campaign" v={tx.campaign_name} /> : null}
                    {tx.coupon_code_used ? <Row k="Coupon" v={tx.coupon_code_used} /> : null}
                    {tx.booking_date ? <Row k="Booking" v={`${tx.booking_date} ${tx.booking_time || ''}`} /> : null}
                    {tx.order_status ? <Row k="Order status" v={tx.order_status} /> : null}
                    {tx.razorpay_payment_id ? <Row k="Payment ID" v={tx.razorpay_payment_id} mono /> : null}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          {canLoadMore && (
            <TouchableOpacity style={s.more} onPress={() => load(page + 1, type, status, true)}>
              <Text style={s.moreTxt}>Load more ({items.length}/{total})</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Row({ k, v, strong, mono }) {
  return (
    <View style={s.row}>
      <Text style={s.rowK}>{k}</Text>
      <Text style={[s.rowV, strong && { fontWeight: '800' }, mono && { fontFamily: fonts.monoMedium }]} numberOfLines={1}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  header:    { backgroundColor: P.white, paddingHorizontal: 18, paddingTop: 52, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  back:      { paddingBottom: 6 },
  backText:  { fontFamily: fonts.sansMedium, fontSize: 11.5, fontWeight: '600', color: P.muted2 },
  title:     { fontFamily: fonts.displayBold, fontSize: 22, fontWeight: '700', color: P.ink, letterSpacing: -0.3 },
  subtitle:  { fontFamily: fonts.sansMedium, fontSize: 11, color: P.muted2, marginTop: 6 },
  chipsRow:  { paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  chip:      { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 6, marginRight: 6 },
  chipOn:    { backgroundColor: P.bg2, borderColor: P.ink },
  chipTxt:   { fontSize: 11.5, fontWeight: '600', color: P.muted },
  chipTxtOn: { color: P.ink },
  card:      { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 12, padding: 14, marginBottom: 10 },
  cardTop:   { flexDirection: 'row', alignItems: 'flex-start' },
  cardName:  { fontSize: 14, fontWeight: '700', color: P.ink },
  cardMeta:  { fontSize: 11.5, color: P.muted2, marginTop: 2 },
  cardAmt:   { fontSize: 14, fontWeight: '800', color: P.ink },
  pill:      { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginTop: 4 },
  pillTxt:   { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  detail:    { borderTopWidth: 1, borderTopColor: P.borderSoft, marginTop: 10, paddingTop: 8 },
  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  rowK:      { fontSize: 12, color: P.muted2 },
  rowV:      { fontSize: 12, color: P.ink2, fontWeight: '600', maxWidth: '60%' },
  more:      { alignItems: 'center', padding: 12 },
  moreTxt:   { fontSize: 12.5, fontWeight: '700', color: P.ink },
  empty:     { alignItems: 'center', paddingTop: 70 },
  emptyIcon: { fontSize: 34, marginBottom: 10 },
  emptyTitle:{ fontSize: 15, fontWeight: '700', color: P.ink },
  emptyText: { fontSize: 12.5, color: P.muted2, textAlign: 'center', marginTop: 4, maxWidth: 260 },
});
