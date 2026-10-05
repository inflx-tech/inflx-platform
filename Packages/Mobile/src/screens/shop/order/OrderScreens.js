/**
 * After the order (shopper-ordering · board O13–O17 · rules 6.9, 6.11, 6.12):
 *   O13 Order placed — each brand's parcel and its date, the total and how she paid.
 *   O14 My orders — every item with its status and arrival date, newest first, filters and search.
 *   O15 Order details — the timeline, the courier and tracking once shipped, the address, what she
 *       paid, the post it came from.
 *   O16 Cancel — open until Shipped; a reason is required; deal items cancel together (warned); a
 *       free gift follows. O17 Cancelled — what happens to the money.
 *
 * shopper-walk-fixes (W14 · rules v1.18 §6.16) — Return. A delivered item inside INFLX's return
 * window has a Return button on Order details, with until when; her return then shows there as a
 * box (requested, approved, not accepted with INFLX's note, returned with the money). My orders has
 * a "Returned" filter and says "Return requested" on the row. The screen she asks on is
 * ReturnScreen.js. An item that went back is "Returned" — it never reads "Arrives by".
 *
 * shopper-deal-orders (board O1–O4 · the founder's rule D1) — a deal is ONE. A set, a bundle, a
 * buy-one-get-one pair and the items a buy-more saving applied to are one card in My orders (the
 * deal's words, its items, one status, what the deal cost), one page (every item, what was paid for
 * the deal, one timeline) with one button — "Cancel deal" before it ships, "Return deal" once
 * delivered — and Cancel names the deal and its items. Which items are one deal, and every word and
 * amount, are the server's (`card`, `deal`, `lines`). A plain-discount item, and one bought alone,
 * are as they were. From a server that sends no cards every item is on its own, as before.
 *
 * shopper-app-fixes:
 *   N3  Order details: cash on delivery reads "To pay ₹X on delivery" until the parcel is
 *       delivered, and "Paid ₹X · Cash on delivery" after. Online is unchanged.
 *   N4  My orders: a search or a filter with no match says "Nothing matches" and what did not
 *       match; "No orders yet" only when she has none. Packed and Out for delivery are filters.
 *       Orders that could not be read are not "No orders yet" either: Try again.
 *   N5  My orders goes on past the first 20: the next ones load as she reaches the end.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, FlatList, Image, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { followerApi } from '../../../services/api';
import { TopBar, Loading, Empty, Chip } from '../../../components/shop/bitsShop';
import { K, b } from '../../../components/shop/orderBits';
import { CO, dayLabel } from '../../../components/shop/copyOrder';
import { CR, refundWords, untilLabel } from '../../../components/shop/copyReturn';
import { ReturnBox } from './ReturnScreen';
import { CS, inr } from '../../../components/shop/copyShop';
import { fonts } from '../../../theme/tokens';

/* ───────────────────────────────────────────── O13 */

export function OrderPlacedScreen({ navigation, route }) {
  const { checkoutId } = route.params || {};
  const [co, setCo] = useState(null);
  // S2: the order IS placed; if its details cannot be read the page says so with Try again — it used
  // to spin for ever.
  const [failed, setFailed] = useState(false);
  const read = useCallback(() => {
    setFailed(false);
    followerApi.checkout(checkoutId)
      .then((r) => { if (r && r.success) setCo(r.data); else setFailed(true); })
      .catch(() => setFailed(true));
  }, [checkoutId]);
  useEffect(() => { read(); }, [read]);
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
        ) : failed ? (
          <View testID="placed-failed">
            <Text style={st.sub}>{CO.placedDetailsFailed}</Text>
            <Text style={[st.act, { textAlign: 'center', marginBottom: 12 }]} onPress={read} testID="placed-retry">{CS.retry}</Text>
          </View>
        ) : <Loading />}
        <TouchableOpacity style={b.primary} onPress={() => navigation.replace('Orders')} testID="placed-orders"><Text style={b.primaryText}>{CO.myOrders}</Text></TouchableOpacity>
        <TouchableOpacity style={[b.secondary, { marginTop: 10 }]} onPress={() => navigation.navigate('Tabs')} testID="placed-shop"><Text style={b.secondaryText}>{CO.keepShopping}</Text></TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ───────────────────────────────────────────── O14 */

/** An item that is no longer on its way: it has no "Arrives by", and Cancel is not what is closed. */
const DONE = ['cancelled', 'delivered', 'returned'];

/** The items of a card (its deal's, or itself), each: photo, name, colour · size — a pair says what each cost. */
function DealItems({ lines, pair, prefix }) {
  return lines.map((l) => (
    <View key={l.id} style={st.mini} testID={`${prefix}-${l.id}`}>
      {l.image_url ? <Image source={{ uri: l.image_url }} style={st.miniThumb} /> : <View style={st.miniThumb} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.miniName} numberOfLines={1}>{l.role === 'gift' ? CO.freeGift(l.name) : l.name}</Text>
        <Text style={st.meta}>
          {[[l.colour, l.size].filter(Boolean).join(' · '), l.qty > 1 ? `×${l.qty}` : null].filter(Boolean).join(' ')}
          {pair ? <Text style={l.role === 'free' ? st.free : null}>{`${l.colour || l.size ? ' · ' : ''}${l.role === 'free' ? CO.free : inr(l.paid)}`}</Text> : null}
        </Text>
      </View>
    </View>
  ));
}
const isPair = (deal) => !!deal && /^pair-/.test(String(deal.key || ''));

/** O1 — one deal, one card: status and date, the deal's words, its items, the brand and what the deal cost. */
function DealCard({ item, onPress }) {
  const when = item.status === 'delivered' && item.delivered_at ? dayLabel(item.delivered_at)
    : !DONE.includes(item.status) && item.arrives_by ? CO.arrivesBy(dayLabel(item.arrives_by)) : '';
  return (
    <TouchableOpacity style={st.card} onPress={onPress} testID={`order-${item.id}`}>
      <View style={st.cardTop}>
        <Text style={[st.status, item.status === 'cancelled' && { color: K.danger }, item.status === 'delivered' && { color: K.ok }]} testID={`order-status-${item.id}`}>
          {item.status_word}{item.return && item.status !== 'returned' ? ` · ${item.return.word}` : ''}
        </Text>
        {when ? <Text style={st.meta} testID={`order-when-${item.id}`}>{when}</Text> : null}
      </View>
      {item.deal && item.deal.line ? <View style={[b.effect, { marginTop: 6, marginBottom: 2 }]} testID={`order-deal-${item.id}`}><Text style={b.effectText}>{item.deal.line}</Text></View> : null}
      <DealItems lines={item.lines} pair={isPair(item.deal)} prefix="order-item" />
      <View style={st.cardFoot}>
        <Text style={[st.meta, { flex: 1 }]} numberOfLines={1}>{item.brand ? item.brand.name : ''}</Text>
        <Text style={st.name} testID={`order-paid-${item.id}`}>{inr(item.paid)}</Text>
      </View>
    </TouchableOpacity>
  );
}

/** The next page's rows after the ones shown; a row already shown (the list moved meanwhile) is not repeated. */
const joined = (have, next) => { const ids = new Set(have.map((x) => x.id)); return [...have, ...(next || []).filter((x) => !ids.has(x.id))]; };

export function OrdersScreen({ navigation }) {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  // What is on screen: the rows, whether more follow, the last page read, and the filter and the
  // search they answer — so "Nothing matches" names what she asked for. null until the first answer.
  const [list, setList] = useState(null);
  const [failed, setFailed] = useState(false);            // the orders could not be read
  const [adding, setAdding] = useState(false);            // the next page is on its way (N5)
  const [moreFailed, setMoreFailed] = useState(false);    // the next page could not be read
  const turn = useRef(0);                                 // only the latest read may answer
  const reading = useRef(false);                          // the list is being read again from its first page
  const asking = useRef(false);                           // a next page has been asked for and is not back yet
  const depth = useRef({ key: null, page: 1 });           // how far down she has gone, for this filter and search
  const asked = q.trim();

  const ask = useCallback((page) => followerApi.orders({ status: status || undefined, q: asked || undefined, page: page > 1 ? page : undefined }), [status, asked]);

  // Opening the screen, changing the filter or the search, and coming back from an item (its
  // status may have changed there): every page she had is read again, so she is where she was.
  const load = useCallback(() => {
    const key = `${status}|${asked}`;
    const upTo = depth.current.key === key ? depth.current.page : 1;
    const mine = (turn.current += 1);
    reading.current = true;
    (async () => {
      let items = []; let more = false; let page = 0;
      for (let p = 1; p <= upTo; p += 1) {
        let r = null;
        try { r = await ask(p); } catch { r = null; }
        if (mine !== turn.current) return;
        if (!r || !r.success) break;
        items = joined(items, r.data.items); more = !!r.data.more; page = p;
        if (!more) break;
      }
      reading.current = false;
      if (!page) {
        // Not even the first page: that is not "No orders yet" (N4). What she was looking at stays
        // if it answers the same filter and search; otherwise she is told, with Try again.
        setFailed(true);
        setList((cur) => (cur && cur.status === status && cur.q === asked ? cur : null));
        return;
      }
      depth.current = { key, page };
      setFailed(false); setMoreFailed(false);
      setList({ items, more, page, status, q: asked });
    })();
    return () => { turn.current += 1; };
  }, [status, asked, ask]);
  useFocusEffect(load);

  // N5: the next ones load as she reaches the end of the list.
  async function next() {
    if (!list || !list.more || asking.current) return;
    // The list on screen is being read again (another filter or search, or she just came back):
    // that read answers; she reaches the end again afterwards.
    if (reading.current || list.status !== status || list.q !== asked) return;
    const mine = turn.current;
    asking.current = true;
    setAdding(true); setMoreFailed(false);
    let r = null;
    try { r = await ask(list.page + 1); } catch { r = null; }
    asking.current = false;
    setAdding(false);
    if (mine !== turn.current) return;
    if (!r || !r.success) { setMoreFailed(true); return; }
    const page = list.page + 1;
    depth.current = { key: `${status}|${asked}`, page };
    setList({ ...list, items: joined(list.items, r.data.items), more: !!r.data.more, page });
  }

  const filters = [...CO.filters, CR.filter];
  const filterName = (k) => { const f = filters.find(([key]) => key === k); return f ? f[1] : ''; };
  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <TopBar title={CO.myOrders} onBack={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: 14 }}>
        <TextInput value={q} onChangeText={setQ} placeholder="Search your orders" style={st.search} testID="orders-search" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 10 }}>
          {filters.map(([k, label]) => <Chip key={k || 'all'} label={label} on={status === k} onPress={() => setStatus(k)} testID={`orders-filter-${k || 'all'}`} />)}
        </ScrollView>
      </View>
      {!list ? (
        failed ? <Empty title={CS.loadError} action={CS.retry} onAction={() => { setFailed(false); load(); }} testID="orders-error" /> : <Loading />
      ) : !list.items.length ? (
        // N4: "No orders yet" only when she has none at all — a filter or a search with no match says so.
        list.status || list.q
          ? <Empty title={CO.nothingMatches} sub={CO.nothingMatchesSub(list.q, list.status ? filterName(list.status) : '')} testID="orders-no-match" />
          : <Empty title={CO.noOrders} sub={CO.noOrdersSub} testID="orders-empty" />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}
          testID="orders-list"
          onEndReached={next}
          onEndReachedThreshold={0.5}
          ListFooterComponent={adding ? <ActivityIndicator color={K.ink} style={{ marginVertical: 12 }} testID="orders-more" />
            : moreFailed ? <Text style={st.moreFailed} onPress={next} testID="orders-more-retry">{CS.loadError} <Text style={st.act}>{CS.retry}</Text></Text> : null}
          renderItem={({ item }) => (item.card === 'deal' && Array.isArray(item.lines) && item.lines.length ? (
            <DealCard item={item} onPress={() => navigation.navigate('OrderDetail', { lineId: item.id })} />
          ) : (
            <TouchableOpacity style={st.card} onPress={() => navigation.navigate('OrderDetail', { lineId: item.id })} testID={`order-${item.id}`}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {item.image_url ? <Image source={{ uri: item.image_url }} style={st.thumb} /> : <View style={st.thumb} />}
                <View style={{ flex: 1 }}>
                  <Text style={[st.status, item.status === 'cancelled' && { color: K.danger }, item.status === 'delivered' && { color: K.ok }]}>
                    {item.status_word}{!DONE.includes(item.status) && item.arrives_by ? ` · ${CO.arrivesBy(dayLabel(item.arrives_by))}` : ''}
                    {/* W14 — a return that is still being decided, or was not accepted, is said on the row. */}
                    {item.return && item.status !== 'returned' ? ` · ${item.return.word}` : ''}
                  </Text>
                  <Text style={st.name} numberOfLines={1}>{item.name}</Text>
                  <Text style={st.meta}>{[item.colour, item.size].filter(Boolean).join(' · ')}{item.qty > 1 ? ` ×${item.qty}` : ''} · {item.brand.name}</Text>
                  <Text style={st.meta} testID={`order-paid-${item.id}`}>
                    {item.role === 'gift' ? CO.free : inr(item.paid)}
                    {/* O1 — an item that cost less than its normal price says so (a plain discount). */}
                    {item.role === 'buy' && Number(item.normal) > Number(item.paid) ? <Text style={st.struck}>  {inr(item.normal)}</Text> : null}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        />
      )}
    </SafeAreaView>
  );
}

/* ───────────────────────────────────────────── O15 */

/**
 * The money line of Order details (N3). Cash on delivery is paid when the parcel is handed over:
 * until then "To pay ₹X on delivery", after it "Paid ₹X · Cash on delivery". An item cancelled
 * before it was delivered was never paid and is not owed: the price and the method, nothing more.
 * Online, and a free gift (₹0), read as they always did.
 */
export function moneyLine(d) {
  const amount = d.role === 'gift' ? '₹0' : inr(d.paid);
  if (d.payment_method !== 'cod') return `${CO.paid} ${amount} · ${CO.payOnline}`;
  const delivered = d.status === 'delivered' || d.status === 'returned' || (d.timeline || []).some((t) => t.status === 'delivered' && t.at);
  if (delivered || d.role === 'gift') return `${CO.paid} ${amount} · ${CO.cod}`;
  if (d.status === 'cancelled') return `${amount} · ${CO.cod}`;
  // S3: when the parcel has other items or a fee, the courier collects the PARCEL's amount — the
  // server says it (`parcel.says`, shown under this line) — so this line is just the item's price.
  if (d.parcel && d.parcel.to_pay != null && Number(d.parcel.to_pay) !== Number(d.paid)) return `${amount} · ${CO.cod}`;
  return CO.toPayOnDelivery(amount);
}

/** S3: what the courier collects for this parcel, in the server's words — only while it is still owed. */
export const parcelLine = (d) => (d && d.parcel && d.parcel.says && Number(d.parcel.to_pay) !== Number(d.paid) ? d.parcel.says : null);

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
  if (d === false) return <SafeAreaView style={st.safe}><TopBar onBack={() => navigation.goBack()} /><Empty title={CS.loadError} action={CS.retry} onAction={() => { setD(null); load(); }} testID="order-detail-failed" /></SafeAreaView>;
  const a = d.address || {};
  // O2, O4 — any item of a deal opens the deal: every item, and what was paid for the DEAL.
  const deal = d.deal && Array.isArray(d.deal.lines) && d.deal.lines.length ? d.deal : null;
  const whole = deal ? { ...d, role: 'buy', paid: deal.paid } : d;        // the money line speaks of the deal
  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <TopBar title={d.status_word} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }} testID="order-detail">
        {deal ? (
          <View style={st.card} testID="order-deal">
            <Text style={st.name} numberOfLines={1} testID="order-deal-from">{CO.dealFrom(d.creator ? d.creator.name.split(' ')[0] : null, d.brand ? d.brand.name : null)}</Text>
            {deal.line ? <Text style={st.meta} testID="order-deal-line">{deal.line}</Text> : null}
            <DealItems lines={deal.lines} pair={isPair(deal)} prefix="order-deal-item" />
            <View style={st.dealPaid}>
              <Text style={st.dealPaidText} testID="order-money">{moneyLine(whole)}</Text>
              {parcelLine(whole) ? <Text style={st.meta} testID="order-parcel-pay">{parcelLine(whole)}</Text> : null}
            </View>
          </View>
        ) : (
        <View style={[st.card, { flexDirection: 'row', gap: 10 }]}>
          {d.image_url ? <Image source={{ uri: d.image_url }} style={st.thumb} /> : <View style={st.thumb} />}
          <View style={{ flex: 1 }}>
            <Text style={st.name}>{d.name}</Text>
            <Text style={st.meta}>{[d.colour, d.size].filter(Boolean).join(' · ')}{d.qty > 1 ? ` ×${d.qty}` : ''} · {d.brand.name}</Text>
            <Text style={st.meta} testID="order-money">{moneyLine(d)}</Text>
            {parcelLine(d) ? <Text style={st.meta} testID="order-parcel-pay">{parcelLine(d)}</Text> : null}
          </View>
        </View>
        )}
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
        {/* A returned item says what happened to its money inside its Return box, below. */}
        {d.refund && d.status !== 'returned' ? (
          <Text style={[st.refund, d.refund.status === 'failed' && { color: K.danger }]} testID="order-refund">{refundWords(d.refund, inr)}</Text>
        ) : null}
        <ReturnBox back={d.return} />
        <View style={st.card}>
          <Text style={st.lab}>{CO.deliverTo}</Text>
          <Text style={st.name}>{a.name}</Text>
          <Text style={st.meta}>{[a.house, a.area, a.landmark, a.city, a.state, a.pincode].filter(Boolean).join(', ')}</Text>
        </View>
        {d.post ? <Text style={st.act} onPress={() => navigation.navigate('Post', { postId: d.post.id })} testID="order-post">{CO.viewPost}{d.creator ? ` · ${CO.fromPost(d.creator.name.split(' ')[0])}` : ''}</Text> : null}
        {d.can_cancel ? (
          <TouchableOpacity style={[b.secondary, { marginTop: 16, borderColor: K.danger }]} onPress={() => navigation.navigate('CancelItem', { lineId: d.id })} testID="order-cancel">
            <Text style={[b.secondaryText, { color: K.danger }]}>{deal ? CO.cancelDeal : CO.cancelItem}</Text>
          </TouchableOpacity>
        ) : d.can_return ? (
          // W14 — delivered, and inside INFLX's return window: she can ask, and is told until when.
          <>
            <TouchableOpacity style={[b.secondary, { marginTop: 16 }]} onPress={() => navigation.navigate('ReturnItem', { lineId: d.id })} testID="order-return">
              <Text style={b.secondaryText}>{deal ? CR.returnDeal : CR.returnItem}</Text>
            </TouchableOpacity>
            <Text style={st.hint} testID="order-return-until">{CR.openUntil(untilLabel(d.return_until))}</Text>
          </>
        ) : d.return_closed ? <Text style={st.hint} testID="order-return-closed">{d.return_closed}</Text>
          : !DONE.includes(d.status) ? <Text style={st.hint}>{CO.cancelClosed}</Text> : null}
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
  const [offline, setOffline] = useState(false);     // S2: it could not be read at all (not a refusal)
  const read = useCallback(() => {
    setErr(null); setOffline(false);
    followerApi.cancelPreview(lineId).then((r) => {
      if (r && r.success) { setPv(r.data); return; }
      const lost = !r || !r.error || r.error.code === 'NETWORK_ERROR';
      setOffline(lost);
      setErr(lost ? CS.loadError : r.error.message);
    }).catch(() => { setOffline(true); setErr(CS.loadError); });
  }, [lineId]);
  useEffect(() => { read(); }, [read]);

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
      <TopBar title={pv && pv.deal ? CO.cancelDeal : CO.cancelTitle} onBack={() => navigation.goBack()} />
      {!pv ? (err ? <Empty title={err} action={offline ? CS.retry : undefined} onAction={offline ? read : undefined} testID="cancel-failed" /> : <Loading />) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }} testID="cancel">
          {pv.deal ? (
            // O3 — Cancel deal: the deal's words, who it is from, its items. It is said once, up front,
            // so there is no "this is part of a deal" warning.
            <View testID="cancel-deal">
              <View style={st.dealHead}>
                {pv.deal.line ? <Text style={st.name} testID="cancel-deal-line">{pv.deal.line}</Text> : null}
                <Text style={st.meta} numberOfLines={1} testID="cancel-deal-from">{CO.dealFrom(pv.deal.creator, pv.deal.brand)}</Text>
              </View>
              <DealItems lines={pv.lines} pair={false} prefix="cancel-item" />
            </View>
          ) : (
            <>
              {pv.warning ? <View style={st.warn}><Text style={st.warnText}>⚠ {pv.warning}</Text></View> : null}
              {pv.lines.map((l) => <Text key={l.id} style={st.name}>{l.role === 'gift' ? CO.freeGift(l.name) : l.name}{l.size ? ` · ${l.size}` : ''}</Text>)}
            </>
          )}
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
            <Text style={b.primaryText}>{pv.deal ? CO.cancelDeal : CO.confirmCancel}</Text>
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
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F1F0EB' },
  mini: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  miniThumb: { width: 38, height: 46, borderRadius: 7, backgroundColor: '#EDECE6' },
  miniName: { fontFamily: fonts.sansBold, fontSize: 12.5, color: K.ink },
  free: { fontFamily: fonts.sansBold, color: K.ok },
  struck: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: K.ink3, textDecorationLine: 'line-through' },
  dealPaid: { backgroundColor: K.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginTop: 10 },
  dealPaidText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: K.ink },
  dealHead: { backgroundColor: K.surface, borderRadius: 12, padding: 10, marginBottom: 2 },
  search: { borderWidth: 1.5, borderColor: K.border, borderRadius: 12, paddingHorizontal: 12, minHeight: 44, fontFamily: fonts.sansRegular, fontSize: 14, color: K.ink, marginTop: 6 },
  tl: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#E1E0DA', marginTop: 3 },
  dotOn: { backgroundColor: K.ok },
  tlText: { fontFamily: fonts.sansBold, fontSize: 13, color: K.ink },
  lab: { fontFamily: fonts.sansBold, fontSize: 12, color: K.ink2, marginBottom: 4 },
  act: { fontFamily: fonts.sansBold, fontSize: 13, color: K.ink, textDecorationLine: 'underline' },
  moreFailed: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: K.ink2, textAlign: 'center', marginVertical: 12 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: K.ink2, marginTop: 10 },
  refund: { fontFamily: fonts.sansBold, fontSize: 13, color: K.ok, marginVertical: 10 },
  warn: { backgroundColor: K.warnSoft, borderRadius: 12, padding: 10, marginBottom: 10 },
  warnText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: K.warn },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  reasonText: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: K.ink },
});
