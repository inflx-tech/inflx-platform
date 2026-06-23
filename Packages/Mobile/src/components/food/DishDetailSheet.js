/**
 * DishDetailSheet — Food World 3C-2 (Toing img3). Image/name tap.
 *
 * Bottom sheet: big image · Popular badge · veg mark · price + struck MRP ·
 * brand rating · free-text description (nutrition lives in the prose) · ADD
 * (pink outline). ADD → onAdd(product): the host opens CustomiseSheet when the
 * dish has add-on groups, else adds it directly.
 *
 * Props: visible, product (getProductDetail shape), onClose, onAdd(product).
 */

import React from 'react';
import { View, Text, Image, ScrollView, Pressable, Modal, StyleSheet, Dimensions } from 'react-native';
import { toing as T, fonts } from '../../theme/tokens';
import { vegKind } from '../../utils/veg';

const W = Dimensions.get('window').width;

export default function DishDetailSheet({ visible, product, onClose, onAdd }) {
  if (!product) return null;
  const price = parseFloat(product.price) || 0;
  const mrp = product.mrp != null ? parseFloat(product.mrp) : null;
  const struck = mrp != null && mrp > price;
  const rating = product.rating ?? product.brand?.avg_rating ?? null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.dim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Pressable onPress={onClose} style={s.xclose}><Text style={s.xtxt}>✕</Text></Pressable>
        <View style={s.sheet}>
          <View style={s.hero}>
            {product.image_url ? <Image source={{ uri: product.image_url }} style={s.heroImg} resizeMode="cover" /> : <Text style={{ fontSize: 70 }}>🍽️</Text>}
            {product.badge ? <View style={s.pop}><Text style={s.popTxt}>{product.badge}</Text></View> : null}
          </View>
          <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: 96 }} showsVerticalScrollIndicator={false}>
            <View style={s.nameRow}>
              <View style={[s.vd, vegKind(product.veg_flag) === 'nonveg' ? s.vdnv : vegKind(product.veg_flag) === 'unknown' ? s.vdna : null]}>
              <View style={[s.vdDot, vegKind(product.veg_flag) === 'nonveg' ? s.vdDotNv : vegKind(product.veg_flag) === 'unknown' ? s.vdDotNa : null]} />
            </View>
              <Text style={s.name}>{product.name}</Text>
            </View>
            <View style={s.priceRow}>
              <Text style={s.price}>₹{Math.round(price)}</Text>
              {struck ? <Text style={s.mrp}>₹{Math.round(mrp)}</Text> : null}
              {rating != null ? <View style={s.star}><Text style={s.starTxt}>★ {Number(rating).toFixed(1)}</Text></View> : null}
            </View>
            {product.description ? <Text style={s.desc}>{product.description}</Text> : null}
          </ScrollView>
          <View style={s.foot}>
            <Pressable onPress={() => onAdd?.(product)} style={s.add}>
              <Text style={s.addTxt}>ADD</Text>
            </Pressable>
            {(Array.isArray(product.addon_groups) && product.addon_groups.length > 0) ? <Text style={s.cust}>Customisable</Text> : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(20,20,20,0.5)', justifyContent: 'flex-end' },
  xclose: { position: 'absolute', alignSelf: 'center', bottom: '84%', width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(60,60,60,0.85)', alignItems: 'center', justifyContent: 'center' },
  xtxt: { color: '#fff', fontSize: 16 },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '84%', overflow: 'hidden' },
  hero: { height: 240, backgroundColor: T.pinkTint, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  heroImg: { width: W, height: 240 },
  pop: { position: 'absolute', top: 14, left: 14, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  popTxt: { fontSize: 12, color: T.veg, fontFamily: fonts.monoBold },
  body: { paddingHorizontal: 18, paddingTop: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vd: { width: 16, height: 16, borderWidth: 1.6, borderColor: T.veg, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  vdnv: { borderColor: T.nonVeg },
  vdna: { borderColor: '#9CA3AF' },
  vdDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: T.veg },
  vdDotNv: { backgroundColor: T.nonVeg },
  vdDotNa: { backgroundColor: '#9CA3AF' },
  name: { flex: 1, fontSize: 22, fontFamily: fonts.displayBold, color: T.ink, letterSpacing: -0.3 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  price: { fontSize: 18, fontFamily: fonts.displayBold, color: T.pink },
  mrp: { fontSize: 15, color: T.hint, textDecorationLine: 'line-through', fontFamily: fonts.sansMedium },
  star: { flexDirection: 'row', backgroundColor: T.veg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  starTxt: { color: '#fff', fontSize: 12, fontFamily: fonts.monoBold },
  desc: { fontSize: 13.5, color: T.muted, lineHeight: 21, marginTop: 14, fontFamily: fonts.sansRegular },
  foot: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: T.line, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12 },
  add: { borderWidth: 1.6, borderColor: T.pink, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 44 },
  addTxt: { color: T.pink, fontSize: 16, fontFamily: fonts.sansBold },
  cust: { fontSize: 11, color: T.muted, fontFamily: fonts.sansBold },
});
