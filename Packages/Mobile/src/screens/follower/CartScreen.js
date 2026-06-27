import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Pressable, Image, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toing as T, fonts } from '../../theme/tokens';
import { useCart } from '../../services/CartContext';
import { followerApi } from '../../services/api';
import CustomiseSheet from '../../components/food/CustomiseSheet';

/**
 * CartScreen — Food 3C-3. The unified multi-item cart (route `Cart`), reskinned
 * to the toing palette. Renders the CartContext lines WITH their customisation
 * (variation + add-ons + note), an offer-picker over the brand's published
 * store_offers, and a bill summary. Green PLACE ORDER hands the cart + chosen
 * brand_offer_id to OnlineOrderScreen → createOrder(placeOrder) → Razorpay →
 * verifyOrder. placeOrder re-prices authoritatively and resolves the
 * customisation server-side (Phase 1) — the cart numbers here are an estimate.
 *
 * Cart persists across app close (CartContext is AsyncStorage-backed); items
 * survive until removed or the order is placed.
 */

// Best-effort client estimate for a store offer's saving. The server is
// authoritative (resolveOfferDiscount); we only preview the common "discount"
// mechanic, and show "Applied" for the rest.
function estimateOfferDiscount(offer, subtotal) {
  if (!offer || subtotal <= 0) return 0;
  const cfg = offer.offer_config_json || offer.config || {};
  const type = String(offer.offer_type || '').toLowerCase();
  if (type !== 'discount') return 0;
  const dt = String(cfg.discount_type || cfg.type || '').toLowerCase();
  const val = Number(cfg.value ?? cfg.discount_value ?? 0) || 0;
  if (val <= 0) return 0;
  if (dt === 'flat' || dt === 'amount') return Math.min(val, subtotal);
  // percentage (optionally capped)
  let d = Math.round((subtotal * val) / 100);
  const cap = Number(cfg.max_discount ?? cfg.cap ?? 0) || 0;
  if (cap > 0) d = Math.min(d, cap);
  return Math.min(d, subtotal);
}

function lineSummary(item) {
  const parts = [];
  if (item.variation_name) parts.push(item.variation_name);
  if (Array.isArray(item.addon_names) && item.addon_names.length) parts.push(item.addon_names.join(', '));
  return parts.join(' · ');
}

export default function CartScreen({ navigation }) {
  const { cart, updateQty, removeItem, replaceLine, applyOffer, clearOffer } = useCart();
  const items = cart.items || [];

  const [editing, setEditing] = useState(null); // { product, lineKey, initial }
  const [editLoading, setEditLoading] = useState(false);
  const [offersOpen, setOffersOpen] = useState(false);

  const count = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + (Number(i.price) || 0) * i.qty, 0);
  // MRP savings — only honest on un-customised lines (a variation resets base).
  const mrpSavings = items.reduce((s, i) => {
    if (i.variation || i.mrp == null) return s;
    const diff = Number(i.mrp) - Number(i.price);
    return s + (diff > 0 ? diff * i.qty : 0);
  }, 0);

  const storeOffers = cart.storeOffers || [];
  const applied = cart.appliedOffer || null;
  const offerSaving = estimateOfferDiscount(applied, subtotal);
  const total = Math.max(0, subtotal - offerSaving);

  // "You might also like" — same-category cross-sell from the cart's items.
  const [recs, setRecs] = useState([]);
  const cartIdKey = items.map((i) => i.product_id).join(',');
  useEffect(() => {
    let on = true;
    const ids = items.map((i) => i.product_id).filter(Boolean);
    if (!ids.length) { setRecs([]); return undefined; }
    const p = followerApi.getCartRecommendations?.(ids, 10);
    if (p && typeof p.then === 'function') {
      p.then((res) => { if (on) setRecs(((res.data || res).items) || []); }).catch(() => {});
    }
    return () => { on = false; };
  }, [cartIdKey]);

  // ── Edit a customised line → reopen CustomiseSheet pre-filled ──────────────
  const onEdit = useCallback(async (line) => {
    setEditLoading(true);
    try {
      const r = await followerApi.getProductDetail?.(line.product_id);
      const product = r?.data?.product ? { ...r.data.product } : null;
      if (!product) return;
      setEditing({
        product,
        lineKey: line.line_key,
        initial: {
          variationId: line.variation?.item_id || null,
          addonIds: (line.selected_addons || []).map((a) => a.item_id),
          qty: line.qty,
          note: line.note || '',
        },
      });
    } catch { /* swallow — edit just won't open */ }
    finally { setEditLoading(false); }
  }, []);

  const onEditConfirm = useCallback((newLine) => {
    if (editing) replaceLine(editing.lineKey, newLine);
    setEditing(null);
  }, [editing, replaceLine]);

  function checkout() {
    navigation.navigate('OnlineOrder', {
      products: items.map((i) => ({
        id: i.product_id,
        name: i.name,
        price: i.price,
        qty: i.qty,
        image_url: i.image_url,
        variant_sku: i.variant_sku || null,
        variant_label: i.variant_label || null,
        variation: i.variation || null,
        selected_addons: i.selected_addons || [],
        note: i.note || null,
        // display-only for the review step
        variation_name: i.variation_name || null,
        addon_names: i.addon_names || [],
      })),
      brand_offer_id: applied?.brand_offer_id || null,
      offer: cart.offer || null,
      store: { id: cart.brandId, brand_id: cart.brandId, name: cart.brandName },
      tracking: cart.tracking || null,
      trackingParams: cart.tracking || null,
    });
  }

  if (items.length === 0) {
    return (
      <View style={s.outer}>
        <SafeAreaView edges={['top']} style={s.topbar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}><Text style={s.back}>←</Text></Pressable>
          <Text style={s.title}>Your Cart</Text>
          <View style={{ width: 22 }} />
        </SafeAreaView>
        <View style={s.empty}>
          <Text style={{ fontSize: 44, marginBottom: 12 }}>🛒</Text>
          <Text style={s.emptyTitle}>Your cart is empty</Text>
          <Text style={s.emptyText}>Browse dishes and tap ＋ to add.</Text>
          <Pressable style={s.browseBtn} onPress={() => navigation.goBack()}>
            <Text style={s.browseTxt}>Browse</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={s.outer}>
      <SafeAreaView edges={['top']} style={s.topbar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}><Text style={s.back}>←</Text></Pressable>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.title}>Your Cart</Text>
          {cart.brandName ? <Text style={s.sub} numberOfLines={1}>{cart.brandName}</Text> : null}
        </View>
        {editLoading ? <ActivityIndicator color={T.pink} /> : null}
      </SafeAreaView>

      {mrpSavings + offerSaving > 0 ? (
        <View style={s.savings}>
          <Text style={s.savingsTxt}>🎉 You're saving ₹{Math.round(mrpSavings + offerSaving)} on this order</Text>
        </View>
      ) : null}

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 18 }}>
        {/* ── Items ── */}
        <View style={s.block}>
          {items.map((item) => {
            const summary = lineSummary(item);
            const struck = !item.variation && item.mrp != null && Number(item.mrp) > Number(item.price);
            const canEdit = !!(item.variation || (item.selected_addons || []).length);
            return (
              <View key={item.line_key} style={s.line}>
                <View style={s.thumb}>
                  {item.image_url
                    ? <Image source={{ uri: item.image_url }} style={s.thumbImg} resizeMode="cover" />
                    : <Text style={{ fontSize: 24 }}>🍽️</Text>}
                </View>
                <View style={s.ldet}>
                  <Text style={s.lname} numberOfLines={2}>{item.name}</Text>
                  {summary ? <Text style={s.custom} numberOfLines={3}>{summary}</Text> : null}
                  {item.note ? <Text style={s.note} numberOfLines={2}>“{item.note}”</Text> : null}
                  {canEdit ? (
                    <Pressable onPress={() => onEdit(item)} hitSlop={6}><Text style={s.edit}>Edit ›</Text></Pressable>
                  ) : null}
                </View>
                <View style={s.lright}>
                  <View style={s.stepper}>
                    <Pressable onPress={() => updateQty(item.line_key, item.qty - 1)} hitSlop={6}><Text style={s.stepTxt}>−</Text></Pressable>
                    <Text style={s.stepN}>{item.qty}</Text>
                    <Pressable onPress={() => updateQty(item.line_key, item.qty + 1)} hitSlop={6}><Text style={s.stepTxt}>+</Text></Pressable>
                  </View>
                  <Text style={s.lprice}>
                    {struck ? <Text style={s.strike}>₹{Math.round(item.mrp * item.qty)} </Text> : null}
                    ₹{Math.round((Number(item.price) || 0) * item.qty)}
                  </Text>
                </View>
              </View>
            );
          })}
          <Pressable onPress={() => navigation.goBack()}><Text style={s.addmore}>+ Add more items</Text></Pressable>
        </View>

        {/* ── Offers ── */}
        {storeOffers.length > 0 ? (
          <View style={s.block}>
            <Text style={s.secTitle}>Offers &amp; Coupons</Text>
            {applied ? (
              <View style={[s.offerRow, s.offerSel]}>
                <Text style={s.ticket}>🎟️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.oname}>{applied.name}</Text>
                  <Text style={s.odescOn}>{offerSaving > 0 ? `Applied · saving ₹${Math.round(offerSaving)}` : 'Applied · savings at checkout'}</Text>
                </View>
                <Pressable onPress={clearOffer} hitSlop={8}><Text style={s.removeTxt}>Remove</Text></Pressable>
              </View>
            ) : (
              <Pressable style={s.offerTease} onPress={() => setOffersOpen((v) => !v)}>
                <Text style={s.ticket}>🎟️</Text>
                <Text style={s.offerTeaseTxt}>{storeOffers.length} offer{storeOffers.length > 1 ? 's' : ''} available</Text>
                <Text style={s.chev}>{offersOpen ? '▲' : '▼'}</Text>
              </Pressable>
            )}
            {!applied && offersOpen ? storeOffers.map((o) => (
              <View key={o.brand_offer_id} style={s.offerRow}>
                <Text style={s.ticket}>🎟️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.oname}>{o.name}</Text>
                  <Text style={s.odesc}>{String(o.offer_type || '').replace('_', ' ')}</Text>
                </View>
                <Pressable onPress={() => { applyOffer(o); setOffersOpen(false); }} hitSlop={8}><Text style={s.applyTxt}>Apply</Text></Pressable>
              </View>
            )) : null}
          </View>
        ) : null}

        {/* ── Bill ── */}
        <View style={s.block}>
          <Text style={s.secTitle}>Bill Details</Text>
          <View style={s.billRow}><Text style={s.billLbl}>Item total</Text><Text style={s.billVal}>₹{Math.round(subtotal + mrpSavings)}</Text></View>
          {mrpSavings > 0 ? (
            <View style={s.billRow}><Text style={s.billLbl}>Item savings</Text><Text style={s.billDisc}>−₹{Math.round(mrpSavings)}</Text></View>
          ) : null}
          {applied && offerSaving > 0 ? (
            <View style={s.billRow}><Text style={s.billLbl}>Offer · {applied.name}</Text><Text style={s.billDisc}>−₹{Math.round(offerSaving)}</Text></View>
          ) : null}
          <View style={s.billRow}><Text style={s.billLbl}>Delivery fee</Text><Text style={s.billVal}>Free</Text></View>
          <View style={s.billTotal}><Text style={s.billTotalLbl}>To Pay</Text><Text style={s.billTotalVal}>₹{Math.round(total)}</Text></View>
          <Text style={s.estimate}>Final price &amp; savings confirmed at checkout.</Text>
        </View>

        {/* You might also like — same-category cross-sell */}
        {recs.length > 0 ? (
          <View style={s.block}>
            <Text style={s.secTitle}>You might also like</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 11, paddingTop: 6 }}>
              {recs.map((p) => {
                const showMrp = p.mrp != null && p.price != null && p.mrp > p.price;
                return (
                  <TouchableOpacity key={p.id} style={s.rec} activeOpacity={0.85} onPress={() => navigation.navigate('ProductDetail', { selectedProductId: p.id, product: p, brand: p.brand || null, offer: null, tracking: null })}>
                    <View style={s.recImg}>
                      {p.image_url ? <Image source={{ uri: p.image_url }} style={s.recImgFill} resizeMode="cover" /> : <Text style={{ fontSize: 22 }}>🛍️</Text>}
                    </View>
                    <Text style={s.recNm} numberOfLines={2}>{p.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                      <Text style={s.recPr}>₹{Math.round(p.price)}</Text>
                      {showMrp ? <Text style={s.recMrp}>₹{Math.round(p.mrp)}</Text> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      {/* ── Footer: green Place Order ── */}
      <SafeAreaView edges={['bottom']} style={s.footer}>
        <Pressable style={s.place} onPress={checkout}>
          <Text style={s.placeTxt}>Place Order</Text>
          <Text style={s.placeAmt}>₹{Math.round(total)} ›</Text>
        </Pressable>
      </SafeAreaView>

      {/* Edit a customised line */}
      <CustomiseSheet
        visible={!!editing}
        product={editing?.product || null}
        initial={editing?.initial || null}
        onClose={() => setEditing(null)}
        onAdd={onEditConfirm}
      />
    </View>
  );
}

const s = StyleSheet.create({
  outer: { flex: 1, backgroundColor: T.pageBg },
  topbar: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.card, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: T.line },
  back: { fontSize: 22, color: T.ink },
  title: { fontSize: 18, fontFamily: fonts.displayBold, color: T.ink },
  sub: { fontSize: 11.5, color: T.muted, marginTop: 1, fontFamily: fonts.sansMedium },

  savings: { backgroundColor: T.successTint, paddingHorizontal: 16, paddingVertical: 9 },
  savingsTxt: { color: T.veg, fontSize: 12.5, fontFamily: fonts.sansBold },

  block: { backgroundColor: T.card, marginTop: 10, paddingHorizontal: 16, paddingVertical: 6 },

  line: { flexDirection: 'row', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: T.line },
  thumb: { width: 54, height: 54, borderRadius: 11, backgroundColor: T.pinkTint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  ldet: { flex: 1, minWidth: 0 },
  lname: { fontSize: 14.5, fontFamily: fonts.displayBold, color: T.ink, letterSpacing: -0.2 },
  custom: { fontSize: 11.5, color: T.muted, marginTop: 3, lineHeight: 17, fontFamily: fonts.sansMedium },
  note: { fontSize: 11, color: T.yellowDeep, marginTop: 3, fontStyle: 'italic', fontFamily: fonts.sansMedium },
  edit: { fontSize: 11.5, color: T.pink, fontFamily: fonts.sansBold, marginTop: 6 },
  lright: { alignItems: 'flex-end', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.line, borderRadius: 8, overflow: 'hidden' },
  stepTxt: { paddingHorizontal: 9, paddingVertical: 3, fontSize: 15, color: T.pink, fontFamily: fonts.displayBold },
  stepN: { paddingHorizontal: 4, fontSize: 13, fontFamily: fonts.displayBold, color: T.ink, minWidth: 22, textAlign: 'center' },
  lprice: { fontSize: 13.5, fontFamily: fonts.displayBold, color: T.ink, marginTop: 10 },
  strike: { color: T.hint, textDecorationLine: 'line-through', fontFamily: fonts.sansMedium, fontSize: 11.5 },
  addmore: { color: T.pink, fontSize: 13, fontFamily: fonts.sansBold, paddingVertical: 13 },

  secTitle: { fontSize: 11.5, fontFamily: fonts.monoBold, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.6, paddingTop: 12, paddingBottom: 10 },
  offerTease: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: T.line, borderRadius: 11, marginBottom: 10 },
  offerTeaseTxt: { flex: 1, fontSize: 13, fontFamily: fonts.sansBold, color: T.ink },
  chev: { fontSize: 11, color: T.muted },
  offerRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, paddingHorizontal: 12, borderWidth: 1, borderColor: T.line, borderRadius: 11, marginBottom: 9 },
  offerSel: { borderColor: T.veg, backgroundColor: T.successTint },
  ticket: { fontSize: 18 },
  oname: { fontSize: 13, fontFamily: fonts.sansBold, color: T.ink },
  odesc: { fontSize: 11, color: T.muted, marginTop: 1, fontFamily: fonts.sansMedium, textTransform: 'capitalize' },
  odescOn: { fontSize: 11, color: T.veg, marginTop: 1, fontFamily: fonts.sansMedium },
  applyTxt: { fontSize: 12.5, fontFamily: fonts.sansBold, color: T.pink },
  removeTxt: { fontSize: 12.5, fontFamily: fonts.sansBold, color: T.veg },

  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 },
  billLbl: { fontSize: 13, color: T.muted, fontFamily: fonts.sansMedium, flex: 1 },
  billVal: { fontSize: 13, color: T.ink, fontFamily: fonts.sansSemiBold },
  billDisc: { fontSize: 13, color: T.pink, fontFamily: fonts.sansBold },
  billTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, marginTop: 3, borderTopWidth: 1, borderTopColor: T.line },
  billTotalLbl: { fontSize: 15.5, fontFamily: fonts.displayBold, color: T.ink },
  billTotalVal: { fontSize: 15.5, fontFamily: fonts.displayBold, color: T.ink },
  rec: { width: 104 },
  recImg: { width: 104, height: 104, borderRadius: 11, backgroundColor: T.pageBg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  recImgFill: { width: '100%', height: '100%' },
  recNm: { fontSize: 11.5, color: T.ink, marginTop: 6, lineHeight: 14, fontFamily: fonts.sansMedium },
  recPr: { fontSize: 12.5, fontWeight: '700', color: T.ink, marginTop: 2, fontFamily: fonts.sansBold },
  recMrp: { fontSize: 10.5, color: T.hint, textDecorationLine: 'line-through', marginLeft: 5, fontFamily: fonts.sansRegular },
  estimate: { fontSize: 10.5, color: T.hint, marginTop: 8, marginBottom: 4, fontStyle: 'italic' },

  footer: { backgroundColor: T.card, borderTopWidth: 1, borderTopColor: T.line, paddingHorizontal: 16, paddingTop: 12 },
  place: { backgroundColor: T.veg, borderRadius: 13, paddingVertical: 15, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  placeTxt: { color: '#fff', fontSize: 15, fontFamily: fonts.sansBold },
  placeAmt: { color: '#fff', fontSize: 15, fontFamily: fonts.displayBold },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontFamily: fonts.displayBold, color: T.ink, marginBottom: 6 },
  emptyText: { fontSize: 13, color: T.muted, textAlign: 'center', marginBottom: 18, fontFamily: fonts.sansMedium },
  browseBtn: { backgroundColor: T.veg, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12 },
  browseTxt: { fontSize: 13.5, fontFamily: fonts.sansBold, color: '#fff' },
});
