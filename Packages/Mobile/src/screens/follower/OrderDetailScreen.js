import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking,
} from 'react-native';
import { creatorVibe as Cv, fmtMoney, fmtRupees } from '../../theme/tokens';

// Flow 52.D — Creator Vibe recolor shim. Legacy navy/teal `colors` → creatorVibe.
// Visual only; order fetch + status render + nav unchanged.
const colors = {
  navy: Cv.brown, navyDeep: Cv.brownDark, navyMid: Cv.brown, navyPale: Cv.soft,
  orange: Cv.brown, orangeDeep: Cv.brownDark, orangePale: Cv.soft,
  gold: Cv.star, goldPale: Cv.soft, teal: Cv.brown, tealDeep: Cv.brown, tealPale: Cv.soft,
  red: Cv.offer, redPale: Cv.soft, purple: Cv.brown, purplePale: Cv.soft,
  bg: Cv.screenBg, surface: Cv.card, surface2: Cv.soft, border: Cv.line, border2: Cv.line,
  t1: Cv.ink, t2: Cv.muted, t3: Cv.muted, white: Cv.card, black: Cv.ink,
};
import { followerApi } from '../../services/api';
import ReturnRequestModal from '../../components/ReturnRequestModal';

// 5-step fulfilment lifecycle (migration 105). Each node's timestamp drives its date.
const LIFECYCLE = [
  { key: 'confirmed',        label: 'Order Confirmed', icon: '✓',  tsKey: 'purchased_at' },
  { key: 'packed',           label: 'Packed',          icon: '📦', tsKey: 'packed_at' },
  { key: 'dispatched',       label: 'Shipped',         icon: '🚚', tsKey: 'dispatched_at' },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: '📍', tsKey: 'out_for_delivery_at' },
  { key: 'delivered',        label: 'Delivered',       icon: '🎉', tsKey: 'delivered_at' },
];
const LC_IDX = { confirmed: 0, packed: 1, dispatched: 2, out_for_delivery: 3, delivered: 4 };

const STATUS_BADGE = {
  confirmed:        { icon: '✅', label: 'Confirmed' },
  packed:           { icon: '📦', label: 'Packed' },
  dispatched:       { icon: '🚚', label: 'Shipped' },
  out_for_delivery: { icon: '📍', label: 'Out for Delivery' },
  delivered:        { icon: '🎉', label: 'Delivered' },
  cancelled:        { icon: '❌', label: 'Cancelled' },
};

// Best-effort courier deep link; Google-search fallback (mirrors the brand panel).
function trackUrl(courier, awb) {
  if (!awb) return null;
  const c = String(courier || '').toLowerCase();
  if (c.includes('delhivery')) return `https://www.delhivery.com/track/package/${encodeURIComponent(awb)}`;
  if (c.includes('dtdc'))      return `https://www.dtdc.in/tracking/tracking_results.asp?strCnno=${encodeURIComponent(awb)}`;
  if (c.includes('blue'))      return `https://www.bluedart.com/tracking?trackingNo=${encodeURIComponent(awb)}`;
  if (c.includes('xpress'))    return `https://www.xpressbees.com/track?awb=${encodeURIComponent(awb)}`;
  if (c.includes('post'))      return 'https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx';
  return `https://www.google.com/search?q=${encodeURIComponent(`${courier || ''} ${awb} tracking`)}`;
}

function fmtWhen(v) {
  if (!v) return null;
  try { return new Date(v).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); }
  catch { return null; }
}

export default function OrderDetailScreen({ navigation, route }) {
  const { orderId } = route.params || {};
  const [order, setOrder]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [returnModalOpen, setReturnModalOpen] = useState(false);

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

  const statusCfg = STATUS_BADGE[order.order_status] || STATUS_BADGE.confirmed;
  const curIdx = LC_IDX[order.order_status] ?? 0;
  const cancelled = order.order_status === 'cancelled';
  const creatorHandle = order.creator_handle || null;
  const tUrl = trackUrl(order.courier_name, order.tracking_number);
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
          <View style={[styles.statusBadge, { backgroundColor: Cv.soft }]}>
            <Text style={[styles.statusText, { color: Cv.goldDeep }]}>
              {statusCfg.icon} {statusCfg.label}
            </Text>
          </View>
        </View>
        <Text style={styles.sub}>#{(order.id || '').replace(/-/g, '').slice(0, 8).toUpperCase()}</Text>
        {creatorHandle ? <Text style={styles.viaCreator}>via @{creatorHandle}</Text> : null}
      </View>

      {/* Status timeline — 5-step fulfilment (or cancelled banner) */}
      {cancelled ? (
        <View style={styles.card}><Text style={[styles.cardTitle, { color: Cv.offer, marginBottom: 0 }]}>❌ This order was cancelled</Text></View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Status</Text>
          {LIFECYCLE.map((node, i) => {
            const done = i < curIdx;
            const curr = i === curIdx;
            const when = fmtWhen(order[node.tsKey]);
            const extra = node.key === 'dispatched' && order.courier_name ? ` · ${order.courier_name}` : '';
            return (
              <View key={node.key} style={styles.tnode}>
                <View style={styles.tcol}>
                  <View style={[styles.tdot, (done || curr) && (done ? styles.tdotDone : styles.tdotCurr)]}>
                    <Text style={[styles.tdotTxt, (done || curr) && { color: done ? '#fff' : Cv.brown }]}>{done ? '✓' : node.icon}</Text>
                  </View>
                  {i < LIFECYCLE.length - 1 ? <View style={[styles.tline, done && styles.tlineDone]} /> : null}
                </View>
                <View style={styles.tbody}>
                  <Text style={[styles.tlabel, (done || curr) && styles.tlabelActive]}>{node.label}</Text>
                  <Text style={styles.tdate}>{when ? `${when}${extra}` : (curr ? `In progress${extra}` : 'Pending')}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Shipment — courier + AWB + track-on-courier link */}
      {(order.courier_name || order.tracking_number) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Shipment</Text>
          {order.courier_name ? (
            <View style={styles.shipRow}><Text style={styles.shipL}>Courier</Text><Text style={styles.shipV}>{order.courier_name}</Text></View>
          ) : null}
          {order.tracking_number ? (
            <View style={styles.shipRow}><Text style={styles.shipL}>Tracking / AWB</Text><Text style={styles.shipV}>{order.tracking_number}</Text></View>
          ) : null}
          {tUrl ? (
            <TouchableOpacity style={styles.trackBtn} onPress={() => Linking.openURL(tUrl).catch(() => {})}>
              <Text style={styles.trackBtnTxt}>TRACK ON {String(order.courier_name || 'COURIER').toUpperCase()} ↗</Text>
            </TouchableOpacity>
          ) : null}
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


      {/* Fashion-1b — Request Return CTA. Only surfaces for online_order
          transactions in 'delivered' status (mirrors industry pattern; salon
          prebooks and pay-at-store walk-ins don't carry physical goods).
          Server validates the return window per product. */}
      {order.transaction_type === 'online_order' && order.order_status === 'delivered' && order.transaction_id && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Need to return something?</Text>
          <Text style={styles.returnSub}>
            Within the return window? Request a return — we'll review and refund per the brand's policy.
          </Text>
          <TouchableOpacity
            style={styles.returnBtn}
            onPress={() => setReturnModalOpen(true)}>
            <Text style={styles.returnBtnText}>↩  Request Return</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tier-1 conversion fix — Q2 flow. "Pay Balance via INFLX" surfaces
          for prebook bookings in confirmed status. The customer arrives at
          the salon/garage, opens INFLX, taps this button, enters the salon's
          full bill, and pays the discounted balance via UPI. The pay-at-store
          screen knows the booking link → applies the captured discount % →
          subtracts the token already paid. */}
      {(order.transaction_type === 'prebook' || order.booking_type) && order.booking_id && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>At the venue?</Text>
          <Text style={styles.returnSub}>
            {order.at_venue_discount_pct > 0
              ? `Show this booking to claim your ${order.at_venue_discount_pct}% off. Or pay the balance through INFLX — discount auto-applied.`
              : 'Pay your balance through INFLX for instant confirmation and credit to the creator.'}
          </Text>
          <TouchableOpacity
            style={styles.payBalanceBtn}
            onPress={() => navigation.navigate('PayAtStore', {
              prebookBookingId: order.booking_id,
              tokenPaid: order.advance_paid || 0,
              atVenueDiscountPct: order.at_venue_discount_pct || 0,
              brand: { name: order.brand_name },
              tracking: {
                campaign_id: order.campaign_id,
                set_id: order.set_id,
                offer_id: order.offer_id,
                campaign_influencer_id: order.campaign_influencer_id,
                influencer_id: order.influencer_id,
              },
              influencer: { name: order.influencer_name },
              offer: { discount_value: order.at_venue_discount_pct || 0, id: order.offer_id },
            })}>
            <Text style={styles.payBalanceBtnText}>💸  Pay Balance via INFLX</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={styles.myReturnsLink}
        onPress={() => navigation.navigate('MyReturns')}>
        <Text style={styles.myReturnsText}>View my returns →</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />

      <ReturnRequestModal
        visible={returnModalOpen}
        onClose={() => setReturnModalOpen(false)}
        onSuccess={() => navigation.navigate('MyReturns')}
        transactionId={order.transaction_id}
        orderItems={items.map(it => ({
          product_id: it.product_id,
          name: it.name || it.product_name,
          image_url: it.image_url || it.product_image_url,
        }))}
      />
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

  // Fashion-1b return CTA styles
  returnSub: { fontSize: 12, color: colors.t2, marginBottom: 12, lineHeight: 17 },
  returnBtn: { backgroundColor: '#ec4899', paddingVertical: 12, borderRadius: 11, alignItems: 'center' },
  returnBtnText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  myReturnsLink: { padding: 18, alignItems: 'center' },
  myReturnsText: { fontSize: 13, color: '#ec4899', fontWeight: '600' },
  // Tier-1 Q2 — Pay Balance via INFLX
  payBalanceBtn: { backgroundColor: colors.amber || '#f59e0b', paddingVertical: 12, borderRadius: 11, alignItems: 'center' },
  payBalanceBtnText: { fontSize: 13, fontWeight: '800', color: '#000' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemName: { fontSize: 13, color: colors.t1, fontWeight: '500', flex: 1 },
  itemDetail: { fontSize: 13, color: colors.t2 },
  totalRow: { borderBottomWidth: 0, paddingTop: 10 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: colors.t1 },
  totalVal: { fontSize: 14, fontWeight: '800', color: colors.navy },
  addrText: { fontSize: 13, color: colors.t2, lineHeight: 20 },
  viaCreator: { fontSize: 12, color: Cv.goldDeep, fontWeight: '700', marginTop: 6 },
  // vertical timeline
  tnode: { flexDirection: 'row', gap: 12 },
  tcol: { alignItems: 'center', width: 38 },
  tdot: { width: 34, height: 34, borderRadius: 17, backgroundColor: Cv.soft, alignItems: 'center', justifyContent: 'center' },
  tdotDone: { backgroundColor: Cv.brown },
  tdotCurr: { backgroundColor: Cv.ink },
  tdotTxt: { fontSize: 15, color: Cv.muted },
  tline: { width: 2, flex: 1, minHeight: 18, backgroundColor: Cv.line, marginVertical: 2 },
  tlineDone: { backgroundColor: Cv.brown },
  tbody: { flex: 1, paddingBottom: 18, paddingTop: 5 },
  tlabel: { fontSize: 14, fontWeight: '700', color: Cv.muted },
  tlabelActive: { color: Cv.ink },
  tdate: { fontSize: 12, color: Cv.muted, marginTop: 3 },
  shipRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  shipL: { fontSize: 12.5, color: Cv.muted },
  shipV: { fontSize: 12.5, color: Cv.ink, fontWeight: '700' },
  trackBtn: { marginTop: 12, borderWidth: 1, borderColor: Cv.brown, borderRadius: 11, paddingVertical: 12, alignItems: 'center' },
  trackBtnTxt: { fontSize: 12.5, fontWeight: '800', color: Cv.ink, letterSpacing: 0.5 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  timeLabel: { fontSize: 12, color: colors.t3, fontWeight: '600' },
  timeVal: { fontSize: 12, color: colors.t1 },
  trackingNum: { fontSize: 14, color: colors.navy, fontWeight: '700', fontFamily: 'monospace' },
});
