/**
 * OrderDetailScreen — Stage C4, locked board c4-orders.html frames 2+3.
 * Contract: features/concept-stagec4-orders/.
 *
 * White law, no yellow. Vertical tracking timeline lit from the REAL
 * per-status timestamps (packed_at, dispatched_at…), courier + AWB with the
 * carrier deep link, items + bill (COD fee + payment method honest), address,
 * and the locked cancel rule: Cancel renders only while confirmed/packed —
 * the server enforces the same guard (409 after dispatch). Cancelled orders
 * show the red banner with the money-truth per payment method.
 *
 * Preserved from the prior screen (functional, restyled): Fashion-1b Request
 * Return (delivered online orders) + MyReturns link, Tier-1 prebook
 * "Pay Balance via INFLX" block, courier tracking links.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { followerApi } from '../../services/api';
import ReturnRequestModal from '../../components/ReturnRequestModal';

// 5-step fulfilment lifecycle (migration 105). Each node's timestamp drives its date.
const LIFECYCLE = [
  { key: 'confirmed',        label: 'Confirmed',        tsKey: 'purchased_at' },
  { key: 'packed',           label: 'Packed',           tsKey: 'packed_at' },
  { key: 'dispatched',       label: 'Dispatched',       tsKey: 'dispatched_at' },
  { key: 'out_for_delivery', label: 'Out for delivery', tsKey: 'out_for_delivery_at' },
  { key: 'delivered',        label: 'Delivered',        tsKey: 'delivered_at' },
];
const LC_IDX = { confirmed: 0, packed: 1, dispatched: 2, out_for_delivery: 3, delivered: 4 };
const CANCELLABLE = ['confirmed', 'packed'];

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

const fmtEta = (d) => {
  if (!d) return '';
  const dt = new Date(d); if (isNaN(dt.getTime())) return String(d);
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${wd[dt.getDay()]}, ${dt.getDate()} ${mo[dt.getMonth()]}`;
};

export default function OrderDetailScreen({ navigation, route }) {
  const { orderId } = route.params || {};
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [refundNote, setRefundNote] = useState(null);
  const [returnModalOpen, setReturnModalOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await followerApi.getOrder(orderId);
    setLoading(false);
    if (res.success) setOrder(res.data?.order || res.data);
  }, [orderId]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={st.center}><ActivityIndicator color="#111" /></View>;
  if (!order) {
    return (
      <View style={st.center}>
        <Text style={st.errTxt}>Order not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.errBtn}>
          <Text style={st.errBtnTxt}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cancelled = order.order_status === 'cancelled';
  const curIdx = LC_IDX[order.order_status] ?? 0;
  const isCod = order.payment_method === 'cod';
  const codFee = Number(order.cod_fee) || 0;
  const net = Number(order.net_amount) || 0;
  const due = Math.round(net + (isCod ? codFee : 0));
  const gross = Number(order.gross_amount || 0);
  const savings = Number(order.discount_amount || 0);
  const tUrl = trackUrl(order.courier_name, order.tracking_number);
  const ref = `#${String(order.id || '').replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  const canCancel = CANCELLABLE.includes(order.order_status);

  const items = (() => {
    try { return typeof order.items_json === 'string' ? JSON.parse(order.items_json) : (order.items_json || []); }
    catch { return []; }
  })();
  // Live product names/images from the detail endpoint's product_meta join.
  const meta = new Map((order.product_meta || []).map((m) => [m.product_id, m]));
  const itemName = (it, i) => meta.get(it.product_id)?.name || it.name || it.product_name || `Item ${i + 1}`;

  function confirmCancel() {
    Alert.alert(
      'Cancel this order?',
      isCod
        ? 'Nothing was charged for this COD order — nothing to refund.'
        : 'Your refund will be initiated to the same payment method.',
      [
        { text: 'Keep order', style: 'cancel' },
        {
          text: 'Yes, cancel', style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            const res = await followerApi.cancelOrder?.(order.id).catch(() => null);
            setCancelling(false);
            if (res?.success) {
              setRefundNote(res.data?.refund?.note || null);
              load();
            } else {
              Alert.alert('Could not cancel', res?.error?.message || 'Please try again.');
              load(); // status may have advanced (dispatched) — refresh truth
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <View style={st.hdr}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}><Text style={st.back}>‹</Text></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>Order {ref}</Text>
          <Text style={st.sub} numberOfLines={1}>
            {[`Placed ${fmtWhen(order.purchased_at || order.created_at) || ''}`, order.brand_name].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 26 }}>
        {order.creator_handle ? <Text style={st.via}>via @{order.creator_handle}</Text> : null}

        {/* cancelled banner OR tracking timeline */}
        {cancelled ? (
          <View style={st.cxBanner}>
            <Text style={st.cxTxt}>
              This order was cancelled{order.cancelled_at ? ` on ${fmtWhen(order.cancelled_at)}` : ''}.
              {'\n'}{refundNote || (isCod ? 'Nothing was charged for this COD order.' : `Refund of ₹${Math.round(net)} initiated to your payment method.`)}
            </Text>
          </View>
        ) : (
          <View style={st.card}>
            <Text style={st.ct}>Tracking</Text>
            {LIFECYCLE.map((node, i) => {
              const lit = i <= curIdx;
              const when = fmtWhen(order[node.tsKey]);
              const last = i === LIFECYCLE.length - 1;
              return (
                <View key={node.key} style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ width: 14, alignItems: 'center' }}>
                    <View style={[st.dot, !lit && st.dotOff]}>
                      {lit ? <Text style={st.dotTick}>✓</Text> : null}
                    </View>
                    {!last && <View style={[st.stem, i >= curIdx && st.stemOff]} />}
                  </View>
                  <View style={{ flex: 1, paddingBottom: last ? 0 : 14 }}>
                    <Text style={[st.tln, !lit && st.tlnOff]}>{node.label}</Text>
                    {when ? <Text style={st.tld}>{when}</Text>
                      : (node.key === 'delivered' && order.estimated_delivery_date
                        ? <Text style={st.tld}>Expected {fmtEta(order.estimated_delivery_date)}</Text> : null)}
                    {node.key === 'dispatched' && lit && (order.courier_name || order.tracking_number) ? (
                      <TouchableOpacity style={st.courier} disabled={!tUrl}
                        onPress={() => tUrl && Linking.openURL(tUrl).catch(() => {})}>
                        <Text style={st.courierTxt} numberOfLines={1}>
                          Courier: <Text style={{ fontWeight: '800' }}>{order.courier_name || '—'}</Text>
                          {order.tracking_number ? <>  ·  AWB <Text style={{ fontWeight: '800' }}>{order.tracking_number}</Text></> : null}
                          {tUrl ? '  ↗' : ''}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* items + bill */}
        <View style={st.card}>
          <Text style={st.ct}>{items.length} item{items.length === 1 ? '' : 's'} · Bill</Text>
          {items.map((it, i) => (
            <View key={i} style={st.br}>
              <Text style={st.bl} numberOfLines={1}>
                {itemName(it, i)}{it.variant_label ? ` · ${it.variant_label}` : ''} ×{it.quantity || it.qty || 1}
              </Text>
              <Text style={st.bv}>₹{Math.round((Number(it.price) || 0) * (it.quantity || it.qty || 1))}</Text>
            </View>
          ))}
          {savings > 0 && (
            <>
              <View style={st.br}><Text style={st.bl}>Item total</Text><Text style={st.bv}>₹{Math.round(gross || net)}</Text></View>
              <View style={st.br}><Text style={st.bl}>Savings</Text><Text style={st.bg}>−₹{Math.round(savings)}</Text></View>
            </>
          )}
          {isCod && codFee > 0 && (
            <View style={st.br}><Text style={st.bl}>COD fee</Text><Text style={st.bv}>₹{Math.round(codFee)}</Text></View>
          )}
          <View style={st.btot}>
            <Text style={st.btotL}>{cancelled ? 'Total' : isCod ? (order.order_status === 'delivered' ? 'Paid on delivery' : 'To pay on delivery') : 'Paid'}</Text>
            <Text style={st.btotL}>₹{due}</Text>
          </View>
        </View>

        {/* address */}
        <View style={st.card}>
          <Text style={st.ct}>Delivering to {order.address_label || 'you'}</Text>
          <Text style={st.addr}>{typeof order.delivery_address === 'string' ? order.delivery_address : '—'}</Text>
        </View>

        {/* cancel — until dispatched (locked rule) */}
        {canCancel && (
          <TouchableOpacity style={[st.cancelBtn, cancelling && { opacity: 0.6 }]} disabled={cancelling} onPress={confirmCancel}>
            {cancelling ? <ActivityIndicator color="#D64545" /> : <Text style={st.cancelTxt}>Cancel order</Text>}
          </TouchableOpacity>
        )}

        {/* Fashion-1b — Request Return (delivered online orders only) */}
        {order.transaction_type === 'online_order' && order.order_status === 'delivered' && order.transaction_id ? (
          <View style={st.card}>
            <Text style={st.ct}>Need to return something?</Text>
            <Text style={st.help}>Within the return window? Request a return — we'll review and refund per the brand's policy.</Text>
            <TouchableOpacity style={st.returnBtn} onPress={() => setReturnModalOpen(true)}>
              <Text style={st.returnTxt}>Request Return</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Tier-1 prebook — pay balance at venue (unchanged wiring) */}
        {(order.transaction_type === 'prebook' || order.booking_type) && order.booking_id ? (
          <View style={st.card}>
            <Text style={st.ct}>At the venue?</Text>
            <Text style={st.help}>
              {order.at_venue_discount_pct > 0
                ? `Show this booking to claim your ${order.at_venue_discount_pct}% off, or pay the balance through INFLX — discount auto-applied.`
                : 'Pay your balance through INFLX for instant confirmation and credit to the creator.'}
            </Text>
            <TouchableOpacity style={st.returnBtn} onPress={() => navigation.navigate('PayAtStore', {
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
              <Text style={st.returnTxt}>Pay Balance via INFLX</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity style={st.linkRow} onPress={() => navigation.navigate('MyReturns')}>
          <Text style={st.linkTxt}>View my returns ›</Text>
        </TouchableOpacity>
      </ScrollView>

      <ReturnRequestModal
        visible={returnModalOpen}
        onClose={() => setReturnModalOpen(false)}
        onSuccess={() => navigation.navigate('MyReturns')}
        transactionId={order.transaction_id}
        orderItems={items.map((it) => ({
          product_id: it.product_id,
          name: itemName(it, 0),
          image_url: it.image_url || meta.get(it.product_id)?.image_url,
        }))}
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  errTxt: { fontSize: 14, color: '#8A8A8A', marginBottom: 14 },
  errBtn: { backgroundColor: '#111', borderRadius: 999, paddingHorizontal: 24, paddingVertical: 11 },
  errBtnTxt: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  back: { fontSize: 24, fontWeight: '700', color: '#111', marginTop: -2 },
  title: { fontSize: 17, fontWeight: '800', color: '#111' },
  sub: { fontSize: 12, color: '#8A8A8A', fontWeight: '600', marginTop: 1 },
  via: { paddingHorizontal: 16, fontSize: 11.5, color: '#8A8A8A', fontWeight: '700' },
  card: { marginHorizontal: 16, marginTop: 10, borderWidth: 1, borderColor: '#EEE', borderRadius: 14, padding: 13 },
  ct: { fontSize: 12.5, fontWeight: '800', color: '#111', marginBottom: 10 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  dotOff: { backgroundColor: '#FFF', borderWidth: 2, borderColor: '#DDD' },
  dotTick: { fontSize: 8, color: '#FFF', fontWeight: '800' },
  stem: { width: 2, flex: 1, backgroundColor: '#111', minHeight: 18 },
  stemOff: { backgroundColor: '#EEE' },
  tln: { fontSize: 12.5, fontWeight: '800', color: '#111' },
  tlnOff: { color: '#B5B5B5' },
  tld: { fontSize: 10.5, color: '#8A8A8A', marginTop: 1 },
  courier: { backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#EEE', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, marginTop: 6 },
  courierTxt: { fontSize: 11.5, color: '#111' },
  br: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 3 },
  bl: { flex: 1, fontSize: 12, color: '#555' },
  bv: { fontSize: 12, fontWeight: '800', color: '#111' },
  bg: { fontSize: 12, fontWeight: '800', color: '#1E9E5A' },
  btot: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#EEE', marginTop: 6, paddingTop: 8 },
  btotL: { fontSize: 13.5, fontWeight: '800', color: '#111' },
  addr: { fontSize: 12, color: '#555', lineHeight: 18 },
  cancelBtn: { marginHorizontal: 16, marginTop: 14, borderWidth: 1.5, borderColor: '#E4E4E4', borderRadius: 999, alignItems: 'center', paddingVertical: 12 },
  cancelTxt: { fontSize: 13, fontWeight: '800', color: '#D64545' },
  cxBanner: { marginHorizontal: 16, marginTop: 10, backgroundColor: '#FFF6F6', borderWidth: 1, borderColor: '#F1D5D5', borderRadius: 12, padding: 12 },
  cxTxt: { fontSize: 12, color: '#8A3B3B', lineHeight: 19 },
  help: { fontSize: 11.5, color: '#8A8A8A', lineHeight: 17, marginBottom: 10 },
  returnBtn: { borderWidth: 1.5, borderColor: '#111', borderRadius: 999, alignItems: 'center', paddingVertical: 10 },
  returnTxt: { fontSize: 12.5, fontWeight: '800', color: '#111' },
  linkRow: { paddingHorizontal: 16, paddingTop: 14 },
  linkTxt: { fontSize: 12.5, fontWeight: '800', color: '#111' },
});
