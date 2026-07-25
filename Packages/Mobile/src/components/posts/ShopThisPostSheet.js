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
import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, Modal, Dimensions, StyleSheet } from 'react-native';
import { useCart } from '../../services/CartContext';
import { YELLOW } from './PostCard';

const H = Dimensions.get('window').height;

export default function ShopThisPostSheet({ visible, post, onClose, onOpenProduct }) {
  const { cart, addItem } = useCart();
  const [toast, setToast] = useState(null);          // { name }
  const [sizePick, setSizePick] = useState(null);    // { product, sizes }
  if (!post) return null;
  const products = post.products || [];

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
      <TouchableOpacity style={st.back} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={st.sheet} onPress={() => {}}>
          <View style={st.grip} />
          <TouchableOpacity style={st.x} onPress={onClose}><Text style={{ color: '#999', fontSize: 15 }}>✕</Text></TouchableOpacity>
          <Text style={st.title}>Products in this post</Text>
          <Text style={st.sub}>{products.length} item{products.length === 1 ? '' : 's'}</Text>

          <FlatList
            data={products}
            keyExtractor={p => p.product_id}
            numColumns={3}
            style={{ maxHeight: H * 0.56 }}
            columnWrapperStyle={{ gap: 9 }}
            contentContainerStyle={{ gap: 12, paddingBottom: 8 }}
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
                        style={[st.bagBtn, added && st.bagBtnOn]}
                        disabled={!p.purchasable}
                        onPress={() => added ? null : quickAdd(p)}>
                        <Text style={{ fontSize: 11, color: added ? '#FFF' : '#111' }}>🛍</Text>
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
          />

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
        </TouchableOpacity>
      </TouchableOpacity>
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
  card: { flex: 1 / 3 },
  imgWrap: { position: 'relative' },
  img: { width: '100%', aspectRatio: 4 / 5, borderRadius: 10 },
  bagBtn: { position: 'absolute', right: 5, bottom: 5, width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 3 },
  bagBtnOn: { backgroundColor: '#111' },
  name: { fontSize: 10.5, fontWeight: '600', color: '#111', marginTop: 5 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  price: { fontSize: 12, fontWeight: '800', color: '#111' },
  struck: { fontSize: 10, color: '#AAA', textDecorationLine: 'line-through' },
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
