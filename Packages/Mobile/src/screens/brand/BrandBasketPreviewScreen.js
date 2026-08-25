import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';
import { ProductPickerModal } from '../../components/brand/ProductPicker';

/**
 * BrandBasketPreviewScreen — "what a shopper pays".
 * Contract: features/stage-2-build-a-campaign-from-the-phone
 * Board: 04-preview/mockups/stage2-screens.html panel ⑧ · action ledger #96
 *
 * WHY THIS SCREEN IS WORTH INSISTING ON
 * Offer stacking is the single most confusing thing about running a shop. A brand
 * publishing an offer they have never seen resolve is how "why did this sell for that
 * price?" arrives a week later.
 *
 * The numbers come from POST /campaigns/preview-basket, which runs the shopping app's own
 * resolver. This screen holds NO discount arithmetic — a preview that can disagree with
 * the till is worse than no preview, because then the brand trusts a number that will not
 * happen.
 *
 * It shows the losers as well as the winner. "Buy 2 get 1 free · not applied · needs 3
 * items" is the sentence that stops a brand assuming an offer fired when it did not.
 */
export default function BrandBasketPreviewScreen({ route, navigation }) {
  const { offer, commissionPct, creatorName } = route.params || {};

  const [productIds, setProductIds] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [seeding, setSeeding] = useState(true);

  // Seed with a couple of real products so the screen opens with something to look at
  // rather than an empty state that has to be filled before it says anything.
  useEffect(() => {
    let alive = true;
    brandApi.listProducts().then((res) => {
      if (!alive) return;
      const live = (res?.data?.products || []).filter(p => p.is_active !== false);
      setProductIds(live.slice(0, 2).map(p => p.id));
      setSeeding(false);
    }).catch(() => { if (alive) setSeeding(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (seeding || productIds.length === 0) { setResult(null); return; }
    let alive = true;
    setLoading(true); setError(null);
    brandApi.previewBasket({
      product_ids: productIds,
      commission_pct: commissionPct ?? null,
      brand_offer_id: offer?.brand_offer_id || null,
    }).then((res) => {
      if (!alive) return;
      if (res?.success) setResult(res.data);
      else setError(res?.error?.message || 'Could not work out the price.');
      setLoading(false);
    }).catch(() => { if (alive) { setError('Could not work out the price.'); setLoading(false); } });
    return () => { alive = false; };
  }, [productIds, offer, commissionPct, seeding]);

  const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  return (
    <View style={s.container}>
      <View style={s.nav}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} activeOpacity={0.6}>
          <Icon name="chevron-left" size={24} color={ig.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>What a shopper pays</Text>
          <Text style={s.sub}>PREVIEW · SAMPLE BASKET</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={s.sec2}>
          <View style={s.dhRow}>
            <Text style={s.dh}>A basket of {result?.basket?.length ?? productIds.length}</Text>
            <TouchableOpacity onPress={() => setPickerOpen(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.change}>Change</Text>
            </TouchableOpacity>
          </View>

          {seeding || loading ? (
            <ActivityIndicator color={ig.text} style={{ marginVertical: 18 }} />
          ) : productIds.length === 0 ? (
            <Text style={s.help}>Pick a product or two to see how the offer resolves.</Text>
          ) : error ? (
            <Text style={s.err}>{error}</Text>
          ) : (
            <>
              {(result?.basket || []).map(b => (
                <View key={b.id} style={s.row}>
                  <Text style={s.rowK} numberOfLines={1}>
                    {b.name}{b.quantity > 1 ? ` × ${b.quantity}` : ''}
                  </Text>
                  <Text style={s.rowV}>{money(b.price * b.quantity)}</Text>
                </View>
              ))}
              <View style={s.row}>
                <Text style={[s.rowK, { color: ig.text, fontWeight: '800' }]}>Subtotal</Text>
                <Text style={s.rowV}>{money(result?.subtotal)}</Text>
              </View>
            </>
          )}
        </View>

        {!!result && (
          <>
            <View style={s.sec2}>
              <Text style={s.dh}>Offers that could apply</Text>
              {(result.candidates || []).length === 0 && (
                <Text style={s.help}>
                  No offer reaches this basket, so a shopper pays full price. On a sales set that
                  means nothing gives them a reason to buy through a creator.
                </Text>
              )}
              {(result.candidates || []).map((c, i) => (
                <View key={`${c.offer_id || c.source}-${i}`} style={[s.cand, c.wins && s.candWin, !c.applied && s.candDim]}>
                  <View style={s.candHd}>
                    <Text style={s.candT}>
                      {String(c.offer_type || 'offer').toUpperCase()}
                      {c.source === 'creator' ? ' · THIS SET' : ' · YOUR STORE'}
                    </Text>
                    <Text style={[s.candTag, c.wins ? { color: ig.green } : { color: ig.mut2 }]}>
                      {c.wins ? 'WINS' : 'NOT APPLIED'}
                    </Text>
                  </View>
                  <Text style={s.candS}>
                    {c.applied
                      ? `Saves ${money(c.discount_amount)}`
                      : `Would save ₹0${c.reason ? ` · ${c.reason}` : ''}`}
                  </Text>
                </View>
              ))}
            </View>

            <View style={s.sec2}>
              <View style={s.row}>
                <Text style={[s.rowK, { color: ig.text, fontWeight: '800' }]}>Shopper pays</Text>
                <Text style={s.big}>{money(result.shopper_pays)}</Text>
              </View>
              {result.creator_earns != null && (
                <View style={s.row}>
                  <Text style={s.rowK}>
                    {creatorName ? `${creatorName} earns` : 'The creator earns'}
                    {result.commission_pct != null ? ` at ${result.commission_pct}%` : ''}
                  </Text>
                  <Text style={[s.rowV, { color: ig.green }]}>{money(result.creator_earns)}</Text>
                </View>
              )}
            </View>

            <View style={s.sec}>
              <View style={s.noteN}>
                <Text style={s.noteT}>
                  One offer per basket — whichever is best for the shopper.{' '}
                  <Text style={s.noteB}>A creator&apos;s own offer wins a tie.</Text> These numbers come
                  from the same calculation the shop uses at checkout.
                </Text>
              </View>
            </View>
          </>
        )}

        <View style={s.sec}>
          <TouchableOpacity style={[s.btn, s.btnPri]} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Text style={s.btnPriT}>Back to the set</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ProductPickerModal
        visible={pickerOpen}
        multi
        onlyLive
        selected={productIds}
        title="A sample basket"
        doneLabel="Price it"
        onClose={() => setPickerOpen(false)}
        onDone={(rows) => { setProductIds(rows.map(r => r.id)); setPickerOpen(false); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  back: { padding: 4 },
  title: { fontSize: 16, fontWeight: '800', color: ig.text },
  sub: { fontSize: 10.5, fontWeight: '700', color: ig.mut, marginTop: 1, letterSpacing: 0.4 },

  sec: { paddingHorizontal: 14, paddingVertical: 11 },
  sec2: { paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  dhRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  dh: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: ig.mut, textTransform: 'uppercase' },
  change: { fontSize: 11, fontWeight: '800', color: ig.blue },
  help: { fontSize: 11, color: ig.mut, fontWeight: '650', lineHeight: 16 },
  err: { fontSize: 11.5, color: ig.red, fontWeight: '700', lineHeight: 17 },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  rowK: { flex: 1, fontSize: 11.5, color: ig.mut, fontWeight: '650' },
  rowV: { fontSize: 12.5, fontWeight: '800', color: ig.text },
  big: { fontSize: 18, fontWeight: '800', color: ig.text },

  cand: { borderWidth: 1, borderColor: ig.line, borderRadius: 11, padding: 11, marginBottom: 8 },
  candWin: { borderColor: ig.green, backgroundColor: ig.greenBg },
  candDim: { opacity: 0.55 },
  candHd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  candT: { flex: 1, fontSize: 11, fontWeight: '800', color: ig.text, letterSpacing: 0.2 },
  candTag: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  candS: { fontSize: 11, color: ig.mut, fontWeight: '700', marginTop: 4, lineHeight: 16 },

  noteN: { backgroundColor: ig.bgSoft, borderRadius: 11, padding: 12 },
  noteT: { fontSize: 11.5, color: ig.mut, fontWeight: '700', lineHeight: 17 },
  noteB: { color: ig.text, fontWeight: '800' },

  btn: { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnPri: { backgroundColor: ig.text },
  btnPriT: { fontSize: 13, fontWeight: '800', color: ig.bg },
});
