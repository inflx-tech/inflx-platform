import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { creatorVibe as C, fonts, fmtRupees } from '../../theme/tokens';

/**
 * OrderConfirmationScreen — Creators Vibe Yellow screen 08. Shown after a real
 * order is placed + verified (from OnlineOrderScreen). Replaces the old success
 * Alert. The order # is the real order id; VIEW ORDER → OrderDetail (tracking).
 */
export default function OrderConfirmationScreen({ navigation, route }) {
  const { orderId, total, brandName, kind, cod, addrLabel, addrText } = route.params || {};
  const ref = orderId ? `#${String(orderId).replace(/-/g, '').slice(0, 8).toUpperCase()}` : '#—';

  // Stage C3 (board c3-checkout.html frame 3) — the SHOP checkout lands on the
  // white-law success screen: black tick, order number, COD badge only on COD
  // orders, address recap, black Track button (nothing to buy → no yellow).
  // The food flow keeps the Creator Vibe variant below.
  if (kind === 'shop') {
    return (
      <View style={ws.outer}>
        <View style={ws.body}>
          <View style={ws.tick}><Text style={ws.tickTxt}>✓</Text></View>
          <Text style={ws.h1}>Order placed</Text>
          <Text style={ws.p}>
            {brandName ? `We've told ${brandName}.` : 'The store has been told.'}{'\n'}You'll get updates as it moves.
          </Text>
          <View style={ws.oid}><Text style={ws.oidTxt}>Order {ref}</Text></View>
          {cod ? (
            <View style={ws.codBadge}><Text style={ws.codTxt}>Cash on Delivery{total != null ? ` · ${fmtRupees(total)} due` : ''}</Text></View>
          ) : (total != null ? <Text style={ws.paid}>Paid {fmtRupees(total)}</Text> : null)}
          {addrText ? (
            <View style={ws.addr}>
              <Text style={ws.addrTitle}>Delivering to {addrLabel || 'you'}</Text>
              <Text style={ws.addrTxt}>{addrText}</Text>
            </View>
          ) : null}
          <TouchableOpacity style={ws.trackBtn} onPress={() => navigation.replace('OrderDetail', { orderId })}>
            <Text style={ws.trackTxt}>Track in My Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.popToTop()}>
            <Text style={ws.cont}>Continue shopping</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.outer}>
      <View style={s.appbar}>
        <View style={s.ib} />
        <Text style={s.logo}>INFL<Text style={{ color: C.brown }}>X</Text></Text>
        <View style={s.ib} />
      </View>

      <View style={s.conf}>
        <View style={s.circ}><Text style={s.tick}>✓</Text></View>
        <Text style={s.h2}>Thank You!</Text>
        <Text style={s.p}>Your order has been placed{'\n'}successfully{brandName ? ` with ${brandName}` : ''}.</Text>
        <Text style={s.ord}>Order {ref}</Text>
        {total != null ? <Text style={s.paid}>Paid {fmtRupees(total)}</Text> : null}
        <Text style={s.p}>You'll get an SMS &amp; app notification{'\n'}with your order details.</Text>
        <TouchableOpacity style={s.btn} onPress={() => navigation.replace('OrderDetail', { orderId })}>
          <Text style={s.btnTxt}>VIEW ORDER</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.popToTop()}>
          <Text style={s.cont}>Continue shopping</Text>
        </TouchableOpacity>
      </View>

      <View style={s.share}>
        <Text style={s.shareT1}>Share your look with</Text>
        <Text style={s.shareT2}>#INFLX</Text>
        <Text style={s.shareT3}>and get featured!</Text>
      </View>
    </View>
  );
}

// Stage C3 white-law success skin (shop checkout only).
const ws = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#FFF' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26 },
  tick: { width: 74, height: 74, borderRadius: 37, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  tickTxt: { fontSize: 34, color: '#FFF', fontWeight: '800' },
  h1: { fontSize: 19, fontWeight: '800', color: '#111' },
  p: { fontSize: 12.5, color: '#8A8A8A', textAlign: 'center', lineHeight: 20, marginTop: 6 },
  oid: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#DDD', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, marginTop: 14 },
  oidTxt: { fontSize: 12, fontWeight: '800', color: '#111' },
  paid: { fontSize: 12.5, fontWeight: '800', color: '#111', marginTop: 10 },
  codBadge: { backgroundColor: '#FDFBF4', borderWidth: 1, borderColor: '#E0D6BB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginTop: 12 },
  codTxt: { fontSize: 11, fontWeight: '800', color: '#111' },
  addr: { alignSelf: 'stretch', borderWidth: 1, borderColor: '#EEE', borderRadius: 12, padding: 12, marginTop: 18 },
  addrTitle: { fontSize: 12, fontWeight: '800', color: '#111' },
  addrTxt: { fontSize: 12, color: '#555', marginTop: 3, lineHeight: 18 },
  trackBtn: { alignSelf: 'stretch', backgroundColor: '#111', borderRadius: 999, alignItems: 'center', paddingVertical: 14, marginTop: 22 },
  trackTxt: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  cont: { fontSize: 12.5, fontWeight: '800', color: '#111', marginTop: 14 },
});

const s = StyleSheet.create({
  outer: { flex: 1, backgroundColor: C.screenBg },
  appbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 6 },
  ib: { width: 36, height: 36 },
  logo: { fontSize: 16, fontWeight: '800', color: C.ink, letterSpacing: 1.4, fontFamily: fonts.displayBold },

  conf: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  circ: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: C.brown, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  tick: { fontSize: 38, color: C.brown, fontWeight: '800' },
  h2: { fontSize: 30, fontWeight: '600', color: C.ink, marginBottom: 12, fontFamily: fonts.serifDisplay },
  p: { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 19, marginTop: 4 },
  ord: { fontSize: 15, fontWeight: '800', color: C.ink, marginTop: 16, fontFamily: fonts.sansBold },
  paid: { fontSize: 13, fontWeight: '700', color: C.goldDeep, marginTop: 4 },
  btn: { backgroundColor: C.brown, borderRadius: 12, paddingHorizontal: 34, paddingVertical: 14, marginTop: 24 },
  btnTxt: { fontSize: 14, fontWeight: '800', color: C.onGold, letterSpacing: 0.8, fontFamily: fonts.sansBold },
  cont: { fontSize: 13, fontWeight: '700', color: C.muted, marginTop: 16 },

  share: { backgroundColor: C.soft, paddingVertical: 22, alignItems: 'center' },
  shareT1: { fontSize: 12, color: C.muted },
  shareT2: { fontSize: 20, fontWeight: '800', color: C.ink, marginVertical: 3, fontFamily: fonts.serifDisplay },
  shareT3: { fontSize: 12, color: C.muted },
});
