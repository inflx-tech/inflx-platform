/**
 * After the order (shopper-ordering · board O13–O17 · rules 6.9, 6.11, 6.12):
 *   O13 Order placed — each brand's parcel and its date, the total and how she paid.
 *   O14 My orders — every item with its status and arrival date, newest first, filters and search.
 *   O15 Order details — the timeline, the courier and tracking once shipped, the address, what she
 *       paid, the post it came from.
 *   O16 Cancel — open until Shipped; a reason is required; deal items cancel together (warned); a
 *       free gift follows. O17 Cancelled — what happens to the money.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, FlatList, Image, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { followerApi } from '../../../services/api';
import { TopBar, Loading, Empty, Chip } from '../../../components/shop/bitsShop';
import { K, b } from '../../../components/shop/orderBits';
import { CO, dayLabel } from '../../../components/shop/copyOrder';
import { CS, inr } from '../../../components/shop/copyShop';
import { fonts } from '../../../theme/tokens';

/* ───────────────────────────────────────────── O13 */

export function OrderPlacedScreen({ navigation, route }) {
  const { checkoutId } = route.params || {};
  const [co, setCo] = useState(null);
  useEffect(() => {
    followerApi.checkout(checkoutId).then((r) => { if (r && r.success) setCo(r.data); });
  }, [checkoutId]);
  return (
    <SafeAreaView style={st.safe}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 40 }} testID="order-placed">
        <View style={st.tick}><Icon name="check" size={34} color="#fff" /></View>
        <Text style={st.big}>{CO.orderPlaced}</Text>
        {co ? (
          <>
            <Text style={st.sub}>{CO.paidBy(inr(co.total), co.payment_method)}</Text>
            {co.parcels.map((p) => (
              <View key={p.id} style={st.card}>
                <Text style={st.name}>{p.brand}</Text>
                <Text style={st.meta}>{CO.items(p.items)} · {CO.arrivesBy(dayLabel(p.arrives_by))}</Text>
              </View>
            ))}
          </>
        ) : <Loading />}
        <TouchableOpacity style={b.primary} onPress={() => navigation.replace('Orders')} testID="placed-orders"><Text style={b.primaryText}>{CO.myOrders}</Text></TouchableOpacity>
        <TouchableOpacity style={[b.secondary, { marginTop: 10 }]} onPress={() => navigation.navigate('Tabs')} testID="placed-shop"><Text style={b.secondaryText}>{CO.keepShopping}</Text></TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ───────────────────────────────────────────── O14 */

export function OrdersScreen({ navigation }) {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState(null);
  const load = useCallback(() => {
    let alive = true;
    followerApi.orders({ status: status || undefined, q: q || undefined }).then((r) => {
      if (alive) setItems(r && r.success ? r.data.items : []);
    });
    return () => { alive = false; };
  }, [status, q]);
  useFocusEffect(load);
  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <TopBar title={CO.myOrders} onBack={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: 14 }}>
        <TextInput value={q} onChangeText={setQ} placeholder="Search your orders" style={st.search} testID="orders-search" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 10 }}>
          {CO.filters.map(([k, label]) => <Chip key={k || 'all'} label={label} on={status === k} onPress={() => setStatus(k)} testID={`orders-filter-${k || 'all'}`} />)}
        </ScrollView>
      </View>
      {items === null ? <Loading /> : !items.length ? <Empty title={CO.noOrders} sub={CO.noOrdersSub} testID="orders-empty" /> : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={st.card} onPress={() => navigation.navigate('OrderDetail', { lineId: item.id })} testID={`order-${item.id}`}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {item.image_url ? <Image source={{ uri: item.image_url }} style={st.thumb} /> : <View style={st.thumb} />}
                <View style={{ flex: 1 }}>
                  <Text style={[st.status, item.status === 'cancelled' && { color: K.danger }, item.status === 'delivered' && { color: K.ok }]}>
                    {item.status_word}{item.status !== 'cancelled' && item.status !== 'delivered' && item.arrives_by ? ` · ${CO.arrivesBy(dayLabel(item.arrives_by))}` : ''}
                  </Text>
                  <Text style={st.name} numberOfLines={1}>{item.name}</Text>
                  <Text style={st.meta}>{[item.colour, item.size].filter(Boolean).join(' · ')}{item.qty > 1 ? ` ×${item.qty}` : ''} · {item.brand.name}</Text>
                  <Text style={st.meta}>{item.role === 'gift' ? CO.free : inr(item.paid)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

/* ───────────────────────────────────────────── O15 */

export function OrderDetailScreen({ navigation, route }) {
  const { lineId } = route.params || {};
  const [d, setD] = useState(null);
  const load = useCallback(() => {
    let alive = true;
    followerApi.orderLine(lineId).then((r) => { if (alive) setD(r && r.success ? r.data : false); });
    return () => { alive = false; };
  }, [lineId]);
  useFocusEffect(load);
  if (d === null) return <SafeAreaView style={st.safe}><TopBar onBack={() => navigation.goBack()} /><Loading /></SafeAreaView>;
  if (d === false) return <SafeAreaView style={st.safe}><TopBar onBack={() => navigation.goBack()} /><Empty title={CS.loadError} /></SafeAreaView>;
  const a = d.address || {};
  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <TopBar title={d.status_word} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }} testID="order-detail">
        <View style={[st.card, { flexDirection: 'row', gap: 10 }]}>
          {d.image_url ? <Image source={{ uri: d.image_url }} style={st.thumb} /> : <View style={st.thumb} />}
          <View style={{ flex: 1 }}>
            <Text style={st.name}>{d.name}</Text>
            <Text style={st.meta}>{[d.colour, d.size].filter(Boolean).join(' · ')}{d.qty > 1 ? ` ×${d.qty}` : ''} · {d.brand.name}</Text>
            <Text style={st.meta}>{CO.paid} {d.role === 'gift' ? '₹0' : inr(d.paid)} · {d.payment_method === 'cod' ? CO.cod : CO.payOnline}</Text>
          </View>
        </View>
        <View style={st.card} testID="timeline">
          {d.timeline.map((t, i) => (
            <View key={t.status} style={st.tl}>
              <View style={[st.dot, t.at && st.dotOn, t.status === 'cancelled' && { backgroundColor: K.danger }]} />
              <View style={{ flex: 1 }}>
                <Text style={[st.tlText, !t.at && { color: K.ink3 }]}>{t.word}</Text>
                {t.at ? <Text style={st.meta}>{dayLabel(t.at)}</Text> : null}
                {t.status === 'dispatched' && d.courier ? <Text style={st.meta}>{CO.courier(d.courier.name, d.courier.tracking)}</Text> : null}
              </View>
            </View>
          ))}
        </View>
        {d.refund ? (
          <Text style={[st.refund, d.refund.status === 'failed' && { color: K.danger }]}>
            {d.refund.status === 'issued' || d.refund.status === 'pending' ? CO.refundOnWay(inr(d.refund.amount)) : d.refund.status === 'not_needed' ? CO.noRefund : CO.refundFailed}
          </Text>
        ) : null}
        <View style={st.card}>
          <Text style={st.lab}>{CO.deliverTo}</Text>
          <Text style={st.name}>{a.name}</Text>
          <Text style={st.meta}>{[a.house, a.area, a.landmark, a.city, a.state, a.pincode].filter(Boolean).join(', ')}</Text>
        </View>
        {d.post ? <Text style={st.act} onPress={() => navigation.navigate('Post', { postId: d.post.id })} testID="order-post">{CO.viewPost}{d.creator ? ` · ${CO.fromPost(d.creator.name.split(' ')[0])}` : ''}</Text> : null}
        {d.can_cancel ? (
          <TouchableOpacity style={[b.secondary, { marginTop: 16, borderColor: K.danger }]} onPress={() => navigation.navigate('CancelItem', { lineId: d.id })} testID="order-cancel">
            <Text style={[b.secondaryText, { color: K.danger }]}>{CO.cancelItem}</Text>
          </TouchableOpacity>
        ) : d.status !== 'cancelled' && d.status !== 'delivered' ? <Text style={st.hint}>{CO.cancelClosed}</Text> : null}
        {/* "Need help" waits for INFLX's support contact (identity facts owed, §7); no address is invented. */}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ───────────────────────────────────────────── O16, O17 */

export function CancelScreen({ navigation, route }) {
  const { lineId } = route.params || {};
  const [pv, setPv] = useState(null);
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => {
    followerApi.cancelPreview(lineId).then((r) => { if (r && r.success) setPv(r.data); else setErr(r && r.error ? r.error.message : CS.loadError); });
  }, [lineId]);

  async function go() {
    setBusy(true); setErr(null);
    const r = await followerApi.cancelLine(lineId, { reason, note: reason === 'Other' ? note : undefined });
    setBusy(false);
    if (!r || !r.success) { setErr(r && r.error ? r.error.message : CS.loadError); return; }
    setDone(r.data);
  }

  if (done) {
    return (
      <SafeAreaView style={st.safe}>
        <TopBar title={CO.cancelled} onBack={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={{ padding: 20 }} testID="cancelled">
          <Text style={st.big}>{CO.cancelled}</Text>
          {pv ? pv.lines.map((l) => <Text key={l.id} style={st.name}>{l.name}{l.size ? ` · ${l.size}` : ''}</Text>) : null}
          <Text style={st.refund}>{done.refund.status === 'issued' ? CO.refundOnWay(inr(done.refund.amount)) : done.refund.status === 'not_needed' ? CO.noRefund : CO.refundFailed}</Text>
          <Text style={st.hint}>{CO.cancelledWhat}</Text>
          <TouchableOpacity style={b.primary} onPress={() => navigation.navigate('Orders')} testID="cancelled-orders"><Text style={b.primaryText}>{CO.myOrders}</Text></TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <TopBar title={CO.cancelTitle} onBack={() => navigation.goBack()} />
      {!pv ? (err ? <Empty title={err} /> : <Loading />) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }} testID="cancel">
          {pv.warning ? <View style={st.warn}><Text style={st.warnText}>⚠ {pv.warning}</Text></View> : null}
          {pv.lines.map((l) => <Text key={l.id} style={st.name}>{l.role === 'gift' ? CO.freeGift(l.name) : l.name}{l.size ? ` · ${l.size}` : ''}</Text>)}
          <Text style={[st.lab, { marginTop: 14 }]}>{CO.why}</Text>
          {pv.reasons.map((r) => (
            <TouchableOpacity key={r} style={st.reason} onPress={() => setReason(r)} testID={`reason-${r}`} accessibilityRole="radio" accessibilityState={{ checked: reason === r }}>
              <Icon name={reason === r ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={K.ink} />
              <Text style={st.reasonText}>{r === 'Other' ? 'Other (write a note)' : r}</Text>
            </TouchableOpacity>
          ))}
          {reason === 'Other' ? <TextInput value={note} onChangeText={setNote} placeholder={CO.writeNote} style={st.search} multiline testID="cancel-note" /> : null}
          <View style={st.card}>
            <Text style={st.lab}>REFUND</Text>
            <Text style={st.name}>{pv.refund.text}</Text>
          </View>
          {err ? <Text style={b.problem}>{err}</Text> : null}
          <TouchableOpacity style={[b.primary, (!reason || (reason === 'Other' && !note.trim()) || busy) && b.primaryDis]}
            disabled={!reason || (reason === 'Other' && !note.trim()) || busy} onPress={go} testID="confirm-cancel">
            <Text style={b.primaryText}>{CO.confirmCancel}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  tick: { width: 64, height: 64, borderRadius: 32, backgroundColor: K.ok, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  big: { fontFamily: fonts.sansBold, fontSize: 22, color: K.ink, textAlign: 'center', marginTop: 12 },
  sub: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: K.ink2, textAlign: 'center', marginTop: 4, marginBottom: 12 },
  card: { borderWidth: 1, borderColor: K.border, borderRadius: 14, padding: 12, marginBottom: 10 },
  name: { fontFamily: fonts.sansBold, fontSize: 13.5, color: K.ink },
  meta: { fontFamily: fonts.sansRegular, fontSize: 12, color: K.ink2, marginTop: 2 },
  status: { fontFamily: fonts.sansBold, fontSize: 12, color: K.ink },
  thumb: { width: 54, height: 66, borderRadius: 9, backgroundColor: '#EDECE6' },
  search: { borderWidth: 1.5, borderColor: K.border, borderRadius: 12, paddingHorizontal: 12, minHeight: 44, fontFamily: fonts.sansRegular, fontSize: 14, color: K.ink, marginTop: 6 },
  tl: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#E1E0DA', marginTop: 3 },
  dotOn: { backgroundColor: K.ok },
  tlText: { fontFamily: fonts.sansBold, fontSize: 13, color: K.ink },
  lab: { fontFamily: fonts.sansBold, fontSize: 12, color: K.ink2, marginBottom: 4 },
  act: { fontFamily: fonts.sansBold, fontSize: 13, color: K.ink, textDecorationLine: 'underline' },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: K.ink2, marginTop: 10 },
  refund: { fontFamily: fonts.sansBold, fontSize: 13, color: K.ok, marginVertical: 10 },
  warn: { backgroundColor: K.warnSoft, borderRadius: 12, padding: 10, marginBottom: 10 },
  warnText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: K.warn },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  reasonText: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: K.ink },
});
