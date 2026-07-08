import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Pressable, Image, StyleSheet, ActivityIndicator,
  Modal, Alert, TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toing as T, fonts } from '../../theme/tokens';
import { useCart } from '../../services/CartContext';
import { followerApi } from '../../services/api';
import { processPayment } from '../../services/payment';
import CustomiseSheet from '../../components/food/CustomiseSheet';

// follower-checkout Slice B — payment methods in the cart's payment selector.
// The first is the default. `rzp` preselects the method in Razorpay's checkout
// (it opens focused on that tab); Razorpay still owns the final method UI.
const PAY_METHODS = [
  { key: 'phonepe', icon: '📱', label: 'PhonePe UPI', sub: 'UPI', rzp: 'upi' },
  { key: 'gpay', icon: '📱', label: 'Google Pay', sub: 'UPI', rzp: 'upi' },
  { key: 'upi', icon: '🏦', label: 'Other UPI', sub: 'Enter any UPI ID', rzp: 'upi' },
  { key: 'card', icon: '💳', label: 'Credit / Debit Card', sub: 'Visa · Mastercard · RuPay', rzp: 'card' },
  { key: 'netbanking', icon: '🏛️', label: 'Netbanking', sub: 'All major banks', rzp: 'netbanking' },
];

function addrLine(a) {
  if (!a) return '';
  return [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ');
}

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

// follower-creator-attribution Slice 2 — preview a creator code's saving over the
// lines it claimed (discount-type only). placeOrder re-prices authoritatively.
function estimateCreatorDiscount(code, subtotal) {
  if (!code?.offer || subtotal <= 0) return 0;
  const { type, discount_type, value, max_discount } = code.offer;
  if (!['discount', 'percentage', 'flat'].includes(String(type || '').toLowerCase())) return 0;
  const v = Number(value) || 0;
  if (v <= 0) return 0;
  const dt = String(discount_type || '').toLowerCase();
  if (dt === 'flat' || dt === 'amount') return Math.min(v, subtotal);
  let d = Math.round((subtotal * v) / 100);
  const cap = Number(max_discount) || 0;
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
  const { cart, updateQty, removeItem, replaceLine, applyOffer, clearOffer, applyCreatorCode, clearCreatorCode, clear } = useCart();
  const items = cart.items || [];

  // follower-checkout Slice B — the shopping cart (fashion/furniture/beauty) IS
  // the checkout: address + payment bar + inline Place Order, splitting per brand
  // server-side. Food keeps its existing 3-step OnlineOrder flow (untouched).
  const isShop = cart.kind === 'shop';

  const [editing, setEditing] = useState(null); // { product, lineKey, initial }
  const [editLoading, setEditLoading] = useState(false);
  const [offersOpen, setOffersOpen] = useState(false);

  // Checkout-bar state (shop only)
  const [addresses, setAddresses] = useState([]);
  const [selectedAddr, setSelectedAddr] = useState(null);
  const [addrOpen, setAddrOpen] = useState(false);
  const [payKey, setPayKey] = useState(PAY_METHODS[0].key);
  const [payOpen, setPayOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const payMethod = PAY_METHODS.find((m) => m.key === payKey) || PAY_METHODS[0];

  const loadAddresses = useCallback((preferId) => {
    return followerApi.getAddresses?.().then((res) => {
      if (!res?.success) return;
      const addrs = res.data?.addresses || [];
      setAddresses(addrs);
      setSelectedAddr((prev) => {
        if (preferId && addrs.some((a) => a.id === preferId)) return preferId;
        if (prev && addrs.some((a) => a.id === prev)) return prev;
        return addrs.length ? addrs[0].id : null;
      });
    }).catch(() => {});
  }, []);

  useEffect(() => { if (isShop) loadAddresses(); }, [isShop, loadAddresses]);

  // The follower's own phone, prefilled into Razorpay so it skips its
  // contact-collection ("enter phone number") step — we already have it.
  const [userPhone, setUserPhone] = useState('');
  useEffect(() => {
    if (!isShop) return;
    AsyncStorage.getItem('inflx_user').then((raw) => {
      if (!raw) return;
      try { const u = JSON.parse(raw); if (u?.phone) setUserPhone(u.phone); } catch { /* ignore */ }
    }).catch(() => {});
  }, [isShop]);

  const addrObj = addresses.find((a) => a.id === selectedAddr) || null;

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

  // Phase 2 (offer-cart-preview) — ask the backend to price the applied offer on
  // this exact cart, so the bill shows the REAL discount + free items for
  // volume / BOGO / bundle / free-gift (not just the client discount estimate,
  // which only understood plain % / ₹). Same engine as checkout → no drift.
  const itemsKey = items.map((i) => `${i.product_id}:${i.qty}`).join('|');
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!applied || !items.length) { setPreview(null); return; }
    let alive = true;
    const body = {
      brand_id: cart.brandId,
      brand_offer_id: applied.brand_offer_id || null,
      items: items.map((i) => ({ product_id: i.product_id, variant_id: i.variant_id || null, quantity: i.qty })),
    };
    const t = setTimeout(() => {
      followerApi.previewCartOffer?.(body)
        .then((r) => { if (alive && r?.success) setPreview(r.data); })
        .catch(() => {});
    }, 300);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied?.brand_offer_id, applied?.id, itemsKey, cart.brandId]);

  const offerSaving = (applied && preview && preview.discount_amount != null)
    ? Number(preview.discount_amount)
    : estimateOfferDiscount(applied, subtotal);
  const freeItems = (applied && preview) ? (preview.adjustments || []) : [];
  const offerReason = (applied && preview) ? (preview.reason || null) : null;

  // Creator code (Slice 2): saving previewed over the lines it claimed.
  const appliedCode = cart.appliedCode || null;
  const codeClaimedSubtotal = items.reduce(
    (s, i) => (i.claim?.source === 'code' ? s + (Number(i.price) || 0) * i.qty : s), 0,
  );
  const codeSaving = estimateCreatorDiscount(appliedCode, codeClaimedSubtotal);

  const total = Math.max(0, subtotal - offerSaving - codeSaving);

  const [codeOpen, setCodeOpen] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState('');

  const onApplyCode = useCallback(async () => {
    const code = codeInput.trim();
    if (!code) return;
    setCodeLoading(true); setCodeError('');
    try {
      const res = await followerApi.resolveCoupon(code);
      const data = res?.data || res;
      if (!data?.campaign_influencer_id) {
        setCodeError(res?.error?.message || 'That code is not valid.'); return;
      }
      const r = applyCreatorCode(data);
      if (!r.ok) {
        setCodeError(r.reason === 'no_match'
          ? `This code is for @${data.creator_handle || 'the creator'}'s items — add one to use it.`
          : 'Could not apply this code.');
        return;
      }
      setCodeInput(''); setCodeOpen(false);
    } catch (e) {
      setCodeError(e.message || 'Could not apply this code.');
    } finally {
      setCodeLoading(false);
    }
  }, [codeInput, applyCreatorCode]);

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

  // Map a cart line → the backend order item shape (server re-prices + resolves
  // customisation; client prices are never trusted).
  const toOrderItem = (i) => ({
    product_id: i.product_id,
    quantity: i.qty,
    variant_sku: i.variant_sku || null,
    variant_label: i.variant_label || null,
    variation: i.variation || null,
    addons: Array.isArray(i.selected_addons) ? i.selected_addons : [],
    note: i.note || null,
  });

  // follower-checkout Slice B — inline shopping checkout. Builds the order
  // payload (single brand → legacy single payload; multiple brands → brand_groups
  // for the per-brand split), runs createOrder → (mock) pay → verifyOrder, then
  // clears the cart and shows the confirmation. The follower pays ONCE.
  async function placeShopOrder() {
    if (!items.length) return;
    if (!selectedAddr) {
      navigation.navigate('Address', { onSave: (a) => loadAddresses(a?.id) });
      return;
    }

    // follower-creator-attribution Slice 1 — group lines by (brand + claiming
    // creator). Each creator-claimed group credits that creator; the organic
    // group (no claim) is brand+platform only. The follower still pays once.
    const leadOfferId = applied?.brand_offer_id || null;
    const groups = new Map();
    for (const i of items) {
      const bid = i.brand_id || cart.brandId;
      const ci = i.claim?.campaign_influencer_id || '';
      const key = `${bid}::${ci}`;
      if (!groups.has(key)) groups.set(key, { brand_id: bid, claim: i.claim || null, lines: [] });
      groups.get(key).lines.push(i);
    }
    const groupArr = [...groups.values()];

    const groupPayload = (g) => {
      const grp = { brand_id: g.brand_id, items: g.lines.map(toOrderItem) };
      if (g.claim?.campaign_influencer_id) {
        grp.campaign_id = g.claim.campaign_id;
        grp.set_id = g.claim.set_id;
        grp.campaign_influencer_id = g.claim.campaign_influencer_id;
        grp.offer_id = g.claim.offer_id || null;
      } else if (g.brand_id === cart.brandId && leadOfferId) {
        // Organic lead-brand store offer (a brand-direct offer the follower chose).
        grp.brand_offer_id = leadOfferId;
      }
      return grp;
    };

    let payload;
    if (groupArr.length > 1) {
      payload = { address_id: selectedAddr, brand_groups: groupArr.map(groupPayload) };
    } else {
      const g = groupArr[0];
      payload = g.claim?.campaign_influencer_id
        ? {
            items: g.lines.map(toOrderItem), address_id: selectedAddr,
            campaign_id: g.claim.campaign_id, set_id: g.claim.set_id,
            campaign_influencer_id: g.claim.campaign_influencer_id, offer_id: g.claim.offer_id || null,
          }
        : { items: g.lines.map(toOrderItem), address_id: selectedAddr, brand_id: g.brand_id, brand_offer_id: leadOfferId };
    }

    setPlacing(true);
    try {
      const res = await followerApi.createOrder(payload);
      if (!res.success && !res.data) {
        Alert.alert('Order failed', res.error?.message || 'Please try again'); return;
      }
      const payResult = await processPayment({
        amount: Math.round((res.data?.net_amount || total) * 100), // paise
        orderId: res.data?.razorpay_order_id,
        keyId: res.data?.razorpay_key_id,
        description: `Order via ${payMethod.label}`,
        // The Razorpay merchant title must be OURS, not an individual store —
        // the follower pays INFLX once and we split per brand. (Was leaking the
        // lead brand's name, e.g. "Urban Stitch", in a multi-brand cart.)
        brandName: 'INFLX',
        // Skip Razorpay's phone step (we have the number) + open it focused on
        // the method the follower picked in our payment row.
        prefill: { contact: userPhone || '', method: payMethod.rzp },
      });
      if (!payResult) { Alert.alert('Payment cancelled', 'You can try again anytime.'); return; }

      const verifyRes = await followerApi.verifyOrder?.({
        razorpay_order_id: payResult.razorpay_order_id,
        razorpay_payment_id: payResult.razorpay_payment_id,
        razorpay_signature: payResult.razorpay_signature,
      });
      if (verifyRes?.success || verifyRes?.data) {
        const orderId = verifyRes?.data?.order_id;
        clear?.();
        navigation.replace('OrderConfirmation', {
          orderId, total: res.data?.net_amount || total, brandName: cart.brandName,
        });
      } else {
        Alert.alert('Verification failed', verifyRes?.error?.message || 'Payment received but verification failed. Contact support.');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Something went wrong');
    } finally {
      setPlacing(false);
    }
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

      {mrpSavings + offerSaving + codeSaving > 0 ? (
        <View style={s.savings}>
          <Text style={s.savingsTxt}>🎉 You're saving ₹{Math.round(mrpSavings + offerSaving + codeSaving)} on this order</Text>
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
                  {isShop ? (
                    item.claim?.creator_handle
                      ? <Text style={s.viaPill}>via @{item.claim.creator_handle}</Text>
                      : <Text style={s.addedBy}>Added by you</Text>
                  ) : null}
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

        {/* ── Creator code (Slice 2) ── */}
        {isShop ? (
          <View style={s.block}>
            {appliedCode ? (
              <View style={[s.offerRow, s.offerSel]}>
                <Text style={s.ticket}>🎟️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.oname}>{appliedCode.coupon_code} · via @{appliedCode.creator_handle}</Text>
                  <Text style={s.odescOn}>{appliedCode.offer?.label}{codeSaving > 0 ? ` · saving ₹${Math.round(codeSaving)}` : ' · applied'}</Text>
                </View>
                <Pressable onPress={clearCreatorCode} hitSlop={8}><Text style={s.removeTxt}>Remove</Text></Pressable>
              </View>
            ) : codeOpen ? (
              <View>
                <View style={s.codeRow}>
                  <TextInput
                    style={s.codeInput}
                    placeholder="Enter creator code"
                    placeholderTextColor={T.hint}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    value={codeInput}
                    onChangeText={(t) => { setCodeInput(t); if (codeError) setCodeError(''); }}
                    onSubmitEditing={onApplyCode}
                    returnKeyType="done"
                  />
                  <Pressable style={s.codeBtn} onPress={onApplyCode} disabled={codeLoading}>
                    {codeLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.codeBtnTxt}>Apply</Text>}
                  </Pressable>
                </View>
                {codeError ? <Text style={s.codeErr}>{codeError}</Text> : null}
              </View>
            ) : (
              <Pressable style={s.codeTease} onPress={() => setCodeOpen(true)}>
                <Text style={s.ticket}>🎟️</Text>
                <Text style={s.codeTeaseTxt}>Have a creator code?</Text>
                <Text style={s.chev}>›</Text>
              </Pressable>
            )}
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
          {/* Phase 2 — free items (BOGO / free-gift) + the reason line, previewed
              from the same engine that charges at checkout. */}
          {freeItems.map((f, i) => (
            <View key={`free${i}`} style={s.billRow}>
              <Text style={s.billLbl}>🎁 Free · {f.name}{f.free_qty > 1 ? ` ×${f.free_qty}` : ''}</Text>
              <Text style={s.billDisc}>FREE</Text>
            </View>
          ))}
          {offerReason && offerSaving <= 0 && freeItems.length === 0 ? (
            <View style={s.billRow}><Text style={s.billHint} numberOfLines={2}>{offerReason}</Text></View>
          ) : null}
          {appliedCode && codeSaving > 0 ? (
            <View style={s.billRow}><Text style={s.billLbl}>@{appliedCode.creator_handle} ({appliedCode.coupon_code})</Text><Text style={s.billDisc}>−₹{Math.round(codeSaving)}</Text></View>
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
                // MRP retired — struck "was" price from a live store offer (offer_price).
                const recStruck = p.offer_price != null && p.price != null && p.offer_price < p.price;
                const recShown = recStruck ? p.offer_price : p.price;
                return (
                  <TouchableOpacity key={p.id} style={s.rec} activeOpacity={0.85} onPress={() => navigation.navigate('ProductDetail', { selectedProductId: p.id, product: p, brand: p.brand || null, offer: null, tracking: null })}>
                    <View style={s.recImg}>
                      {p.image_url ? <Image source={{ uri: p.image_url }} style={s.recImgFill} resizeMode="cover" /> : <Text style={{ fontSize: 22 }}>🛍️</Text>}
                    </View>
                    <Text style={s.recNm} numberOfLines={2}>{p.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                      <Text style={s.recPr}>₹{Math.round(recShown)}</Text>
                      {recStruck ? <Text style={s.recMrp}>₹{Math.round(p.price)}</Text> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      {/* ── Footer ── */}
      {isShop ? (
        // Shopping checkout bar: delivery address + payment method + Place Order.
        // The follower pays once; the backend splits per brand silently.
        <SafeAreaView edges={['bottom']} style={s.footer}>
          <Pressable style={s.frow} onPress={() => (addresses.length ? setAddrOpen(true) : navigation.navigate('Address', { onSave: (a) => loadAddresses(a?.id) }))}>
            <Text style={s.fic}>🏠</Text>
            <View style={{ flex: 1 }}>
              {addrObj ? (
                <>
                  <Text style={s.ft} numberOfLines={1}>Delivering to {addrObj.label || addrObj.type || 'Address'}</Text>
                  <Text style={s.fs} numberOfLines={1}>{addrLine(addrObj)}</Text>
                </>
              ) : (
                <Text style={s.ft}>Add a delivery address</Text>
              )}
            </View>
            <Text style={s.fc}>{addrObj ? 'Change' : 'Add'}</Text>
          </Pressable>
          <Pressable style={s.frow} onPress={() => setPayOpen(true)}>
            <Text style={s.fic}>{payMethod.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.ft} numberOfLines={1}>Pay using {payMethod.label}</Text>
              <Text style={s.fs} numberOfLines={1}>Tap to change · UPI · Cards · Netbanking</Text>
            </View>
            <Text style={s.fchev}>⌄</Text>
          </Pressable>
          <Pressable style={[s.place, placing && { opacity: 0.7 }]} onPress={placeShopOrder} disabled={placing}>
            {placing ? <ActivityIndicator color="#fff" /> : (
              <>
                <View>
                  <Text style={s.placeTotalLbl}>TOTAL</Text>
                  <Text style={s.placeAmt}>₹{Math.round(total)}</Text>
                </View>
                <Text style={s.placeTxt}>Place Order →</Text>
              </>
            )}
          </Pressable>
        </SafeAreaView>
      ) : (
        // Food / legacy cart: existing 3-step OnlineOrder checkout (untouched).
        <SafeAreaView edges={['bottom']} style={s.footer}>
          <Pressable style={s.place} onPress={checkout}>
            <Text style={s.placeTxt}>Place Order</Text>
            <Text style={s.placeAmt}>₹{Math.round(total)} ›</Text>
          </Pressable>
        </SafeAreaView>
      )}

      {/* Address picker (shop) */}
      <Modal visible={addrOpen} transparent animationType="slide" onRequestClose={() => setAddrOpen(false)}>
        <Pressable style={s.sheetBg} onPress={() => setAddrOpen(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.sheetTitle}>Delivery address</Text>
            {addresses.map((a) => {
              const on = a.id === selectedAddr;
              return (
                <Pressable key={a.id} style={[s.optRow, on && s.optRowOn]} onPress={() => { setSelectedAddr(a.id); setAddrOpen(false); }}>
                  <View style={[s.radio, !on && s.radioOff]}>{on ? <View style={s.radioIn} /> : null}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.optLabel}>{a.label || a.type || 'Address'}</Text>
                    <Text style={s.optSub} numberOfLines={2}>{addrLine(a)}</Text>
                  </View>
                </Pressable>
              );
            })}
            <Pressable onPress={() => { setAddrOpen(false); navigation.navigate('Address', { onSave: (a) => loadAddresses(a?.id) }); }}>
              <Text style={s.addLink}>+ Add new address</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Payment method picker (shop) — UI only; mock payment */}
      <Modal visible={payOpen} transparent animationType="slide" onRequestClose={() => setPayOpen(false)}>
        <Pressable style={s.sheetBg} onPress={() => setPayOpen(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.sheetTitle}>Pay using</Text>
            {PAY_METHODS.map((m) => {
              const on = m.key === payKey;
              return (
                <Pressable key={m.key} style={[s.optRow, on && s.optRowOn]} onPress={() => { setPayKey(m.key); setPayOpen(false); }}>
                  <Text style={s.fic}>{m.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.optLabel}>{m.label}</Text>
                    <Text style={s.optSub}>{m.sub}</Text>
                  </View>
                  <View style={[s.radio, !on && s.radioOff]}>{on ? <View style={s.radioIn} /> : null}</View>
                </Pressable>
              );
            })}
            <Text style={s.payNote}>You'll confirm payment securely. INFLX never stores your card details.</Text>
          </Pressable>
        </Pressable>
      </Modal>

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
  viaPill: { alignSelf: 'flex-start', marginTop: 4, fontSize: 9.5, color: T.pink, backgroundColor: T.pinkTint, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, overflow: 'hidden', fontFamily: fonts.sansBold },
  addedBy: { marginTop: 4, fontSize: 9.5, color: T.hint, fontFamily: fonts.sansMedium },
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

  // Creator code door (Slice 2)
  codeTease: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: T.pink, borderStyle: 'dashed', borderRadius: 11 },
  codeTeaseTxt: { flex: 1, fontSize: 13, fontFamily: fonts.sansBold, color: T.pink },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  codeInput: { flex: 1, borderWidth: 1, borderColor: T.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: T.ink, fontFamily: fonts.sansBold, letterSpacing: 0.5 },
  codeBtn: { backgroundColor: T.pink, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', minWidth: 72 },
  codeBtnTxt: { color: '#fff', fontSize: 13, fontFamily: fonts.sansBold },
  codeErr: { color: T.pink, fontSize: 11.5, marginTop: 7, fontFamily: fonts.sansMedium },

  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 },
  billLbl: { fontSize: 13, color: T.muted, fontFamily: fonts.sansMedium, flex: 1 },
  billHint: { fontSize: 12, color: T.muted, fontFamily: fonts.sansMedium, flex: 1, fontStyle: 'italic' },
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

  footer: { backgroundColor: T.card, borderTopWidth: 1, borderTopColor: T.line, paddingHorizontal: 12, paddingTop: 4 },
  place: { backgroundColor: T.veg, borderRadius: 13, paddingVertical: 13, paddingHorizontal: 18, marginHorizontal: 4, marginTop: 8, marginBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  placeTxt: { color: '#fff', fontSize: 15, fontFamily: fonts.sansBold },
  placeAmt: { color: '#fff', fontSize: 16, fontFamily: fonts.displayBold },
  placeTotalLbl: { color: '#fff', fontSize: 9, fontFamily: fonts.sansBold, opacity: 0.85, letterSpacing: 0.5 },

  // Shop checkout bar rows (address / payment)
  frow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: T.line },
  fic: { width: 26, textAlign: 'center', fontSize: 16 },
  ft: { fontSize: 12.5, fontFamily: fonts.sansBold, color: T.ink },
  fs: { fontSize: 10.5, color: T.muted, marginTop: 1, fontFamily: fonts.sansMedium },
  fc: { fontSize: 12.5, fontFamily: fonts.sansBold, color: T.pink },
  fchev: { fontSize: 14, color: T.muted, paddingHorizontal: 4 },

  // Bottom-sheet pickers (address / payment)
  sheetBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: T.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 28 },
  sheetTitle: { fontSize: 15.5, fontFamily: fonts.displayBold, color: T.ink, marginBottom: 14 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: T.line, borderRadius: 11, marginBottom: 9 },
  optRowOn: { borderColor: T.veg, backgroundColor: T.successTint },
  optLabel: { fontSize: 13, fontFamily: fonts.sansBold, color: T.ink },
  optSub: { fontSize: 11, color: T.muted, marginTop: 1, fontFamily: fonts.sansMedium, lineHeight: 15 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: T.veg, alignItems: 'center', justifyContent: 'center' },
  radioOff: { borderColor: T.hint },
  radioIn: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.veg },
  addLink: { fontSize: 13, fontFamily: fonts.sansBold, color: T.pink, paddingVertical: 8, paddingHorizontal: 4 },
  payNote: { fontSize: 11, color: T.hint, marginTop: 4, fontFamily: fonts.sansMedium, lineHeight: 16 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontFamily: fonts.displayBold, color: T.ink, marginBottom: 6 },
  emptyText: { fontSize: 13, color: T.muted, textAlign: 'center', marginBottom: 18, fontFamily: fonts.sansMedium },
  browseBtn: { backgroundColor: T.veg, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12 },
  browseTxt: { fontSize: 13.5, fontFamily: fonts.sansBold, color: '#fff' },
});
