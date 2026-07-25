/**
 * ShopThisPostSheet — the product popup (Stage C1, locked board
 * c1-shopping-window.html). Contract: features/concept-stagec1-shopping-window/.
 *
 * 3-column GRID over the dimmed post. Every card: image, corner bag button
 * (QUICK-ADD — flips dark once in bag; products with sizes open the size
 * picker first), name (dots when long), PRICE BOLD below. Black toast with
 * yellow "View Bag". Tapping the image opens PostProductScreen; the sheet
 * reopens on return (owner passes onOpenProduct + reopens on focus).
 *
 * Adds carry the post's tracking block → the creator's commission rides the
 * existing cart-claim rails.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, Pressable, FlatList, Modal, Dimensions, StyleSheet, ActivityIndicator } from 'react-native';
import { useCart } from '../../services/CartContext';
import { loadWishlist, toggleWish } from '../../services/wishlist';
import { YELLOW } from './PostCard';
import { BagCircle, BagOutline, HeartIcon } from './icons';

const H = Dimensions.get('window').height;

export default function ShopThisPostSheet({ visible, post, loading, onClose, onOpenProduct }) {
  const { cart, addItem } = useCart();
  const [toast, setToast] = useState(null);          // { name }
  const [sizePick, setSizePick] = useState(null);    // { product, sizes }
  // Stage C2 — heart state for the corner wishlist toggle on every card.
  const [wished, setWished] = useState(() => new Set());
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    loadWishlist().then((d) => alive && setWished(new Set(d.items.map((i) => i.product_id)))).catch(() => {});
    return () => { alive = false; };
  }, [visible]);
  if (!post && !loading) return null;
  const products = post?.products || [];

  async function heart(p) {
    const on = await toggleWish({
      product_id: p.product_id, name: p.name,
      price: p.price, offer_price: p.offer_price ?? null,
      image_url: p.image_url, brand_id: p.brand?.id, brand_name: p.brand?.name,
    }).catch(() => null);
    if (on === null) return;
    setWished((prev) => {
      const next = new Set(prev);
      if (on) next.add(p.product_id); else next.delete(p.product_id);
      return next;
    });
  }

  const inBag = (productId) => (cart.items || []).some(i => i.product_id === productId);

  function parseSizes(p) {
    let v = p.variants_json;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch { v = null; } }
    if (!v) return [];
    const colours = Array.isArray(v.colors) ? v.colors : [];
    if (colours.length) return Array.isArray(colours[0].sizes) ? colours[0].sizes : [];
    return Array.isArray(v.sizes) ? v.sizes : (Array.isArray(v.options) ? v.options : []);
  }
  const sizeLabel = (sz) => (typeof sz === 'string' ? sz : (sz?.label || sz?.value || sz?.size));

  function doAdd(p, sizeObj = null) {
    const item = {
      id: p.product_id,
      name: p.name,
      price: p.offer_price ?? p.price,
      image_url: p.image_url,
      variant_sku: sizeObj?.sku || null,
      variant_label: sizeObj ? sizeLabel(sizeObj) : null,
      qty: 1,
    };
    const res = addItem(item, p.brand?.id, p.brand?.name, p.tracking, {
      cartKind: 'shop',
      creatorHandle: p.via_creator?.handle || null,
    });
    if (res.ok) {
      setSizePick(null);
      setToast({ name: p.name });
      setTimeout(() => setToast(null), 2600);
    }
  }

  function quickAdd(p) {
    if (!p.purchasable) return;
    const sizes = parseSizes(p);
    if (sizes.length) setSizePick({ product: p, sizes });
    else doAdd(p);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* backdrop and sheet are SIBLINGS — no touch-capturing wrapper, so the
          ✕ works first tap (v3.1 bug fix) */}
      <View style={st.back}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={st.sheet}>
          <View style={st.grip} />
          <TouchableOpacity style={st.x} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={{ color: '#666', fontSize: 17 }}>✕</Text>
          </TouchableOpacity>
          <Text style={st.title}>Products in this post</Text>
          <Text style={st.sub}>{loading ? 'Loading…' : `${products.length} item${products.length === 1 ? '' : 's'}`}</Text>

          {loading ? (
            <View style={{ paddingVertical: 46, alignItems: 'center' }}>
              <ActivityIndicator color={YELLOW} />
            </View>
          ) : (
          <FlatList
            data={products}
            keyExtractor={p => p.product_id}
            numColumns={2}
            style={{ maxHeight: H * 0.6 }}
            columnWrapperStyle={{ gap: 12 }}
            contentContainerStyle={{ gap: 16, paddingBottom: 8 }}
            renderItem={({ item: p }) => {
              const added = inBag(p.product_id);
              return (
                <View style={[st.card, !p.purchasable && { opacity: 0.45 }]}>
                  <TouchableOpacity activeOpacity={0.85} disabled={!p.purchasable}
                    onPress={() => onOpenProduct && onOpenProduct(p)}>
                    <View style={st.imgWrap}>
                      {p.image_url
                        ? <Image source={{ uri: p.image_url }} style={st.img} />
                        : <View style={[st.img, { backgroundColor: '#F2F2F2' }]} />}
                      <TouchableOpacity
                        style={st.heartBtn}
                        onPress={() => heart(p)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <HeartIcon size={14} color="#111" filled={wished.has(p.product_id)} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[st.bagBtn, added && st.bagBtnOn]}
                        disabled={!p.purchasable}
                        onPress={() => added ? null : quickAdd(p)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        {added
                          ? <BagCircle size={30} />
                          : <BagOutline size={16} />}
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                  <Text style={st.name} numberOfLines={1}>{p.name}</Text>
                  <View style={st.priceRow}>
                    <Text style={st.price}>₹{p.offer_price ?? p.price}</Text>
                    {p.offer_price != null && p.offer_price !== p.price && (
                      <Text style={st.struck}>₹{p.price}</Text>
                    )}
                  </View>
                  {!p.purchasable && <Text style={st.unavail}>unavailable</Text>}
                </View>
              );
            }}
          />)}

          {/* size mini-picker (quick-add on a sized product) */}
          {sizePick && (
            <View style={st.sizeBar}>
              <Text style={st.sizeTitle} numberOfLines={1}>Size — {sizePick.product.name}</Text>
              <View style={st.sizeChips}>
                {sizePick.sizes.map((sz, i) => {
                  const lbl = sizeLabel(sz);
                  const out = sz && sz.stock != null && Number(sz.stock) <= 0;
                  return (
                    <TouchableOpacity key={i} style={[st.sizeChip, out && { opacity: 0.35 }]}
                      disabled={out} onPress={() => doAdd(sizePick.product, sz)}>
                      <Text style={st.sizeChipTxt}>{lbl}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity onPress={() => setSizePick(null)}>
                <Text style={{ color: '#999', fontSize: 11, fontWeight: '700', textAlign: 'center', paddingTop: 8 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {toast && (
            <View style={st.toast}>
              <Text style={st.toastTxt} numberOfLines={1}>✓ {toast.name} added to bag</Text>
              <TouchableOpacity onPress={() => { setToast(null); onClose(); onOpenProduct && onOpenProduct('__bag__'); }}>
                <Text style={st.toastCta}>View Bag</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingBottom: 20, paddingTop: 8 },
  grip: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: '#E5E5E5', marginBottom: 10 },
  x: { position: 'absolute', right: 16, top: 14, padding: 4 },
  title: { fontSize: 16, fontWeight: '800', color: '#111' },
  sub: { fontSize: 11, color: '#999', marginTop: 2, marginBottom: 12 },
  card: { flex: 1 / 2 },
  imgWrap: { position: 'relative' },
  img: { width: '100%', aspectRatio: 4 / 5, borderRadius: 12 },
  bagBtn: { position: 'absolute', right: 7, bottom: 7, width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 3 },
  heartBtn: { position: 'absolute', right: 7, top: 7, width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  bagBtnOn: { backgroundColor: '#111' },
  name: { fontSize: 12.5, fontWeight: '600', color: '#111', marginTop: 7 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  price: { fontSize: 14, fontWeight: '800', color: '#111' },
  struck: { fontSize: 11.5, color: '#AAA', textDecorationLine: 'line-through' },
  unavail: { fontSize: 9, color: '#B3261E', marginTop: 1 },
  sizeBar: { borderTopWidth: 1, borderColor: '#F0F0F0', paddingTop: 10, marginTop: 4 },
  sizeTitle: { fontSize: 11.5, fontWeight: '800', color: '#111', marginBottom: 8 },
  sizeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sizeChip: { borderWidth: 1.5, borderColor: '#DDD', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  sizeChipTxt: { fontSize: 12, fontWeight: '700', color: '#111' },
  toast: { position: 'absolute', left: 14, right: 14, bottom: 14, backgroundColor: '#111', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toastTxt: { color: '#FFF', fontSize: 11.5, fontWeight: '600', flex: 1, marginRight: 10 },
  toastCta: { color: YELLOW, fontSize: 12, fontWeight: '800' },
});
