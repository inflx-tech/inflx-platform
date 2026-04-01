import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { colors, fmtMoney, fmtRupees } from '../../theme/tokens';
import { followerApi } from '../../services/api';

const STATUS_STEPS = ['pending', 'confirmed', 'dispatched', 'delivered'];

const STATUS_LABELS = {
  pending:    { icon: '🕐', label: 'Order Received',  color: colors.orange },
  confirmed:  { icon: '✅', label: 'Confirmed',        color: colors.teal },
  dispatched: { icon: '🚚', label: 'On the Way',       color: colors.navy },
  delivered:  { icon: '🎉', label: 'Delivered',        color: colors.teal },
  cancelled:  { icon: '❌', label: 'Cancelled',        color: colors.red },
};

export default function OrderDetailScreen({ navigation, route }) {
  const { orderId } = route.params || {};
  const [order, setOrder]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await followerApi.getOrder(orderId);
      setLoading(false);
      if (res.success) setOrder(res.data?.order || res.data);
    }
    load();
  }, [orderId]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.navy} /></View>;
  }
  if (!order) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Order not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusCfg = STATUS_LABELS[order.order_status] || STATUS_LABELS.pending;
  const currentStep = STATUS_STEPS.indexOf(order.order_status);
  const items = (() => {
    try { return typeof order.items_json === 'string' ? JSON.parse(order.items_json) : (order.items_json || []); }
    catch { return []; }
  })();

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Order Details</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + '22' }]}>
            <Text style={[styles.statusText, { color: statusCfg.color }]}>
              {statusCfg.icon} {statusCfg.label}
            </Text>
          </View>
        </View>
        <Text style={styles.sub}>#{(order.id || '').slice(-8).toUpperCase()}</Text>
      </View>

      {/* Progress tracker */}
      {order.order_status !== 'cancelled' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Progress</Text>
          <View style={styles.tracker}>
            {STATUS_STEPS.map((step, i) => {
              const isDone = i <= currentStep;
              return (
                <React.Fragment key={step}>
                  <View style={styles.stepItem}>
                    <View style={[styles.stepDot, isDone && styles.stepDotActive]}>
                      {isDone && <Text style={styles.stepCheck}>✓</Text>}
                    </View>
                    <Text style={[styles.stepLabel, isDone && styles.stepLabelActive]}>
                      {STATUS_LABELS[step]?.label}
                    </Text>
                  </View>
                  {i < STATUS_STEPS.length - 1 && (
                    <View style={[styles.stepLine, isDone && i < currentStep && styles.stepLineActive]} />
                  )}
                </React.Fragment>
              );
            })}
          </View>
        </View>
      )}

      {/* Items */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Items</Text>
        {items.map((item, i) => (
          <View key={i} style={styles.itemRow}>
            <Text style={styles.itemName}>{item.name || item.product_name || `Item ${i + 1}`}</Text>
            <Text style={styles.itemDetail}>{item.qty || 1}× {fmtRupees(item.price || 0)}</Text>
          </View>
        ))}
        <View style={[styles.itemRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalVal}>{fmtRupees(order.net_amount || 0)}</Text>
        </View>
      </View>

      {/* Delivery info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Delivery Address</Text>
        <Text style={styles.addrText}>
          {order.delivery_address
            ? (typeof order.delivery_address === 'string'
                ? order.delivery_address
                : [order.delivery_address.line1, order.delivery_address.line2, order.delivery_address.city, order.delivery_address.state, order.delivery_address.pincode].filter(Boolean).join(', ')
              )
            : '—'
          }
        </Text>
      </View>

      {/* Timestamps */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Timeline</Text>
        {[
          { label: 'Order Placed',  value: order.purchased_at || order.created_at },
          { label: 'Dispatched',    value: order.dispatched_at },
          { label: 'Delivered',     value: order.delivered_at },
        ].filter(r => r.value).map(r => (
          <View key={r.label} style={styles.timeRow}>
            <Text style={styles.timeLabel}>{r.label}</Text>
            <Text style={styles.timeVal}>{new Date(r.value).toLocaleString('en-IN')}</Text>
          </View>
        ))}
      </View>

      {order.tracking_number && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tracking</Text>
          <Text style={styles.trackingNum}>{order.tracking_number}</Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 14, color: colors.t2, marginBottom: 16 },
  backBtn: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.surface2, borderRadius: 12 },
  backBtnText: { fontSize: 14, fontWeight: '600', color: colors.navy },
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  back: { marginBottom: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  title: { fontSize: 20, fontWeight: '800', color: colors.white },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  sub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4, fontFamily: 'monospace' },
  card: { margin: 16, marginBottom: 0, backgroundColor: colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 12 },
  tracker: { flexDirection: 'row', alignItems: 'flex-start' },
  stepItem: { flex: 1, alignItems: 'center' },
  stepDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  stepDotActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  stepCheck: { fontSize: 11, color: colors.white, fontWeight: '700' },
  stepLabel: { fontSize: 9, color: colors.t3, textAlign: 'center', marginTop: 4, fontWeight: '600' },
  stepLabelActive: { color: colors.teal },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.border2, alignSelf: 'center', marginTop: -11 },
  stepLineActive: { backgroundColor: colors.teal },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemName: { fontSize: 13, color: colors.t1, fontWeight: '500', flex: 1 },
  itemDetail: { fontSize: 13, color: colors.t2 },
  totalRow: { borderBottomWidth: 0, paddingTop: 10 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: colors.t1 },
  totalVal: { fontSize: 14, fontWeight: '800', color: colors.navy },
  addrText: { fontSize: 13, color: colors.t2, lineHeight: 20 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  timeLabel: { fontSize: 12, color: colors.t3, fontWeight: '600' },
  timeVal: { fontSize: 12, color: colors.t1 },
  trackingNum: { fontSize: 14, color: colors.navy, fontWeight: '700', fontFamily: 'monospace' },
});
