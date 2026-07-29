/**
 * PostProductScreen — product details reached from a post (Stage C1, locked
 * board c1-shopping-window.html step 4).
 * Contract: features/concept-stagec1-shopping-window/.
 *
 * Gallery with dots · name · price + struck original + % OFF (deep yellow,
 * the single accent) · "Inclusive of all taxes" · colour + size selectors
 * from variants_json · Product Details accordion · black-outline Add to Bag
 * + yellow Buy Now. Rating row renders ONLY when real review data exists AND
 * the admin knob (app-config show_product_ratings) is on — never fake.
 *
 * Adds carry the post's tracking block (route params) → creator commission
 * through the existing cart rails. Buy Now = add + jump to bag (the full
 * review-order → payment flow is Stage C3).
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, Dimensions, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { followerApi } from '../../services/api';
import { useCart } from '../../services/CartContext';
import { isWished, toggleWish } from '../../services/wishlist';
import { HeartIcon } from '../../components/posts/icons';
import { YELLOW } from '../../components/posts/PostCard';

const W = Dimensions.get('window').width;
const YDEEP = '#CA8A04';

export default function PostProductScreen({ navigation, route }) {
  // p = the shop-sheet product (carries tracking/via_creator/brand); detail
  // fills description/facets/variants/offers from the (offer-aware) PDP API.
  const { p } = route.params || {};
  const { addItem } = useCart();
  const [detail, setDetail] = useState(null);
  const [slide, setSlide] = useState(0);
  const [colour, setColour] = useState(null);
  const [size, setSize] = useState(null);
  const [accOpen, setAccOpen] = useState(false);
  const [added, setAdded] = useState(false);
  // Stage C2 — wishlist heart in the top bar.
  const [wished, setWished] = useState(false);
  useEffect(() => {
    let alive = true;
    if (p?.product_id) isWished(p.product_id).then((w) => alive && setWished(w)).catch(() => {});
    return () => { alive = false; };
  }, [p?.product_id]);

  useEffect(() => {
    if (p?.product_id) {
      followerApi.getProductDetail
        ? followerApi.getProductDetail(p.product_id).then(res => { if (res.success) setDetail(res.data.product); })
        : setDetail(null);
    }
  }, [p?.product_id]);

  if (!p) return null;
  const d = detail || {};

  // variants
  let vj = d.variants_json ?? null;
  if (typeof vj === 'string') { try { vj = JSON.parse(vj); } catch { vj = null; } }
  const colours = Array.isArray(vj?.colors) ? vj.colors : [];
  const colourName = (c) => (c && (c.color ?? c.colour)) || null;
  const activeColour = colours.length
    ? (colours.find(c => colourName(c) === colour) || colours[0]) : null;
  const sizes = activeColour
    ? (Array.isArray(activeColour.sizes) ? activeColour.sizes : [])
    : (Array.isArray(vj?.sizes) ? vj.sizes : (Array.isArray(vj?.options) ? vj.options : []));
  const sizeLabel = (sz) => (typeof sz === 'string' ? sz : (sz?.label || sz?.value || sz?.size));
  const needsSize = sizes.length > 0 && !size;
  const sizeObj = sizes.find(sz => sizeLabel(sz) === size) || null;

  // gallery: colour images > cover_images > card image
  const gallery = (activeColour?.images?.length ? activeColour.images
    : (vj?.cover_images?.length ? vj.cover_images : [p.image_url])).filter(Boolean);

  // price truth: effective price from the offer engine; struck = list price
  const listPrice = d.price != null ? Number(d.price) : p.price;
  const effPrice = d.offer_price ?? p.offer_price ?? listPrice;
  const pct = d.discount_value ?? p.discount_value ?? null;

  function buildItem() {
    return {
      id: p.product_id, name: p.name, price: effPrice, image_url: gallery[0] || p.image_url,
      variant_sku: sizeObj?.sku || null,
      variant_label: [activeColour ? colourName(activeColour) : null, size].filter(Boolean).join(' · ') || null,
      qty: 1,
    };
  }
  function add(goBag) {
    if (needsSize) { Alert.alert('Select a size', 'Pick your size first.'); return; }
    const res = addItem(buildItem(), p.brand?.id, p.brand?.name, p.tracking, {
      cartKind: 'shop', creatorHandle: p.via_creator?.handle || null,
    });
    if (res.ok) {
      setAdded(true);
      if (goBag) navigation.navigate('Cart');
    }
  }

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <View style={st.top}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={st.topIcon}>‹</Text></TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
          <TouchableOpacity hitSlop={10} onPress={async () => {
            const w = await toggleWish({
              product_id: p.product_id, name: p.name,
              price: listPrice, offer_price: effPrice !== listPrice ? effPrice : null,
              image_url: p.image_url, brand_id: p.brand?.id, brand_name: p.brand?.name,
            }).catch(() => null);
            if (w !== null) setWished(w);
          }}>
            <HeartIcon size={20} color="#111" filled={wished} />
          </TouchableOpacity>
          <Text style={st.topIconSm}>↗</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 90 }}>
        <FlatList
          horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          data={gallery} keyExtractor={(u, i) => `${i}`}
          onMomentumScrollEnd={e => setSlide(Math.round(e.nativeEvent.contentOffset.x / W))}
          renderItem={({ item: u }) => (
            // 3:4 to match ProductDetailScreen and the upload frame — this is a
            // second, separate product gallery and the two must agree.
            <Image source={{ uri: u }} style={{ width: W, aspectRatio: 3 / 4 }} resizeMode="cover" />
          )}
        />
        {gallery.length > 1 && (
          <View style={st.dots}>
            {gallery.map((_, i) => <View key={i} style={[st.dot, i === slide && st.dotOn]} />)}
          </View>
        )}
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={st.name}>{p.name}</Text>
          <Text style={st.brand}>{p.brand?.name}{p.via_creator ? `  ·  via @${p.via_creator.handle}` : ''}</Text>
          <View style={st.priceRow}>
            <Text style={st.price}>₹{effPrice}</Text>
            {effPrice !== listPrice && <Text style={st.mrp}>₹{listPrice}</Text>}
            {!!pct && <Text style={st.off}>{pct}% OFF</Text>}
          </View>
          <Text style={st.tax}>Inclusive of all taxes</Text>

          {colours.length > 0 && (
            <>
              <Text style={st.lbl}>Colour{activeColour ? ` · ${colourName(activeColour)}` : ''}</Text>
              <View style={st.chips}>
                {colours.map((c, i) => (
                  <TouchableOpacity key={i}
                    style={[st.chip, colourName(activeColour) === colourName(c) && st.chipOn]}
                    onPress={() => { setColour(colourName(c)); setSize(null); setSlide(0); }}>
                    <Text style={[st.chipTxt, colourName(activeColour) === colourName(c) && st.chipTxtOn]}>{colourName(c)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
          {sizes.length > 0 && (
            <>
              <Text style={st.lbl}>Size</Text>
              <View style={st.chips}>
                {sizes.map((sz, i) => {
                  const lbl = sizeLabel(sz);
                  const out = sz && sz.stock != null && Number(sz.stock) <= 0;
                  return (
                    <TouchableOpacity key={i} style={[st.chip, size === lbl && st.chipOn, out && { opacity: 0.35 }]}
                      disabled={out} onPress={() => setSize(lbl)}>
                      <Text style={[st.chipTxt, size === lbl && st.chipTxtOn]}>{lbl}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <TouchableOpacity style={st.acc} onPress={() => setAccOpen(o => !o)}>
            <Text style={st.accTitle}>Product Details</Text>
            <Text style={{ color: '#999' }}>{accOpen ? '⌃' : '⌄'}</Text>
          </TouchableOpacity>
          {accOpen && (
            <Text style={st.accBody}>
              {d.description || 'No further details from the brand yet.'}
              {d.return_policy_days != null ? `\n\nReturns: ${d.return_policy_days} days.` : ''}
            </Text>
          )}
          {(d.offers || []).length > 0 && (
            <>
              <Text style={st.lbl}>Live offers</Text>
              {(d.offers || []).map(o => (
                <Text key={o.id} style={st.offerLine}>· {o.name} ({o.offer_type.replace('_', ' ')})</Text>
              ))}
            </>
          )}
        </View>
      </ScrollView>

      <View style={st.ctas}>
        <TouchableOpacity style={st.ghost} onPress={() => added ? navigation.navigate('Cart') : add(false)}>
          <Text style={st.ghostTxt}>{added ? 'Go to Bag' : 'Add to Bag'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.buy} onPress={() => add(true)}>
          <Text style={st.buyTxt}>Buy Now</Text>
        </TouchableOpacity>
      </View>
      {!detail && <ActivityIndicator style={st.loading} color={YELLOW} />}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  topIcon: { fontSize: 30, color: '#111' },
  topIconSm: { fontSize: 17, color: '#111' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingVertical: 8 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#DDD' },
  dotOn: { backgroundColor: '#111' },
  name: { fontSize: 17, fontWeight: '800', color: '#111', marginTop: 6 },
  brand: { fontSize: 11.5, color: '#999', marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 },
  price: { fontSize: 19, fontWeight: '900', color: '#111' },
  mrp: { fontSize: 13, color: '#AAA', textDecorationLine: 'line-through' },
  off: { fontSize: 13, fontWeight: '800', color: YDEEP },
  tax: { fontSize: 10, color: '#999', marginTop: 2 },
  lbl: { fontSize: 10.5, fontWeight: '800', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderColor: '#DDD', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { borderColor: '#111', backgroundColor: '#111' },
  chipTxt: { fontSize: 12, fontWeight: '700', color: '#333' },
  chipTxtOn: { color: '#FFF' },
  acc: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#F0F0F0', marginTop: 18, paddingVertical: 13 },
  accTitle: { fontSize: 13.5, fontWeight: '800', color: '#111' },
  accBody: { fontSize: 12, color: '#555', lineHeight: 18, paddingBottom: 8 },
  offerLine: { fontSize: 12, color: '#333', marginBottom: 3 },
  ctas: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, padding: 14, backgroundColor: '#FFF', borderTopWidth: 1, borderColor: '#F0F0F0' },
  ghost: { flex: 1, borderWidth: 1.6, borderColor: '#111', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  ghostTxt: { fontSize: 13, fontWeight: '800', color: '#111' },
  buy: { flex: 1, backgroundColor: YELLOW, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  buyTxt: { fontSize: 13, fontWeight: '800', color: '#FFF' },
  loading: { position: 'absolute', top: 90, alignSelf: 'center' },
});
