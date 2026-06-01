import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { creatorVibe as Cv, fmtMoney, fmtRupees } from '../../theme/tokens';

// Flow 52.D — Creator Vibe recolor shim. Legacy navy/teal `colors` → creatorVibe.
// Visual only; order-history fetch/refresh + status render + nav unchanged.
const colors = {
  navy: Cv.brown, navyDeep: Cv.brownDark, navyMid: Cv.brown, navyPale: Cv.soft,
  orange: Cv.brown, orangeDeep: Cv.brownDark, orangePale: Cv.soft,
  gold: Cv.star, goldPale: Cv.soft, teal: Cv.brown, tealDeep: Cv.brown, tealPale: Cv.soft,
  red: Cv.offer, redPale: Cv.soft, purple: Cv.brown, purplePale: Cv.soft,
  bg: Cv.screenBg, surface: Cv.card, surface2: Cv.soft, border: Cv.line, border2: Cv.line,
  t1: Cv.ink, t2: Cv.muted, t3: Cv.muted, white: Cv.card, black: Cv.ink,
};
import { followerApi } from '../../services/api';

const STATUS_CONFIG = {
  pending:    { label: 'Pending',    bg: colors.orange + '18', color: colors.orange },
  confirmed:  { label: 'Confirmed',  bg: colors.teal + '18',   color: colors.teal },
  dispatched: { label: 'Dispatched', bg: colors.navy + '18',   color: colors.navy },
  delivered:  { label: 'Delivered',  bg: colors.teal + '18',   color: colors.teal },
  cancelled:  { label: 'Cancelled',  bg: colors.red + '18',    color: colors.red },
  completed:  { label: 'Completed',  bg: colors.teal + '18',   color: colors.teal },
  booked:     { label: 'Booked',     bg: colors.navy + '18',   color: colors.navy },
  paid:       { label: 'Paid',       bg: colors.teal + '18',   color: colors.teal },
};

const TYPE_LABELS = {
  pay_at_store: 'Pay at Store',
  online_order: 'Online Order',
  online:       'Online Order',
  prebook:      'Pre-booking',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function OrderCard({ order, onPress }) {
  const status = STATUS_CONFIG[order.order_status || order.status] || STATUS_CONFIG.pending;
  const type = order.transaction_type || order.order_type || 'online_order';
  const typeLabel = TYPE_LABELS[type] || type.replace(/_/g, ' ');

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brandName}>{order.brand_name || 'Order'}</Text>
          <Text style={styles.orderId}>#{(order.id || '').slice(-8).toUpperCase()}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Type</Text>
          <Text style={styles.metaVal}>{typeLabel}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Amount</Text>
          <Text style={styles.metaValAmount}>{fmtRupees(order.net_amount || 0)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Date</Text>
          <Text style={styles.metaVal}>{formatDate(order.purchased_at || order.created_at)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function OrderHistoryScreen({ navigation }) {
  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState(null);

  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await followerApi.getOrders();
      if (res.success) {
        setOrders(res.data?.orders || []);
      } else {
        setError(res.error?.message || 'Failed to load orders');
      }
    } catch (e) {
      setError('Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  function handlePress(order) {
    navigation.navigate('OrderDetail', { orderId: order.id });
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.navy} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Order History</Text>
        <Text style={styles.sub}>{orders.length} order{orders.length !== 1 ? 's' : ''}</Text>
      </View>

      {error ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchOrders()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptySub}>Your order history will appear here once you make a purchase.</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <OrderCard order={item} onPress={() => handlePress(item)} />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchOrders(true)}
              colors={[colors.navy]}
              tintColor={colors.navy}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  back: { marginBottom: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '800', color: colors.white },
  sub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  list: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  brandName: { fontSize: 15, fontWeight: '700', color: colors.t1 },
  orderId: { fontSize: 11, color: colors.t3, fontFamily: 'monospace', marginTop: 2 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  metaItem: {},
  metaLabel: { fontSize: 10, color: colors.t3, fontWeight: '600', marginBottom: 2, textTransform: 'uppercase' },
  metaVal: { fontSize: 13, color: colors.t1, fontWeight: '600' },
  metaValAmount: { fontSize: 13, color: colors.navy, fontWeight: '800' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorText: { fontSize: 14, color: colors.red, textAlign: 'center', marginBottom: 16 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.surface2, borderRadius: 12 },
  retryBtnText: { fontSize: 14, fontWeight: '600', color: colors.navy },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.t1, marginBottom: 8 },
  emptySub: { fontSize: 13, color: colors.t3, textAlign: 'center', lineHeight: 20 },
});
