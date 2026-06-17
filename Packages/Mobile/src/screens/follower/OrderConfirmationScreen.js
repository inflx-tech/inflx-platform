import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { creatorVibe as C, fonts, fmtRupees } from '../../theme/tokens';

/**
 * OrderConfirmationScreen — Creators Vibe Yellow screen 08. Shown after a real
 * order is placed + verified (from OnlineOrderScreen). Replaces the old success
 * Alert. The order # is the real order id; VIEW ORDER → OrderDetail (tracking).
 */
export default function OrderConfirmationScreen({ navigation, route }) {
  const { orderId, total, brandName } = route.params || {};
  const ref = orderId ? `#${String(orderId).replace(/-/g, '').slice(0, 8).toUpperCase()}` : '#—';

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
