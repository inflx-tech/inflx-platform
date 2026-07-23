/**
 * ShopThisPostSheet — the product popup (Post/Concept Stage A).
 * Contract: features/concept-stagea-posts-ui/.
 *
 * Opens from the Shop bar or a price-tag tap. Lists the post's attached
 * products (server-sorted: concept-keeping first, then purchasable, then
 * the rest); tapping one lands on the EXISTING ProductDetail screen with
 * the post's tracking block — purchases attribute to the creator through
 * the live commission rails, zero new money code.
 */
import React from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, Modal, Dimensions, StyleSheet } from 'react-native';
import { YELLOW } from './PostCard';

const H = Dimensions.get('window').height;

export default function ShopThisPostSheet({ visible, post, onClose, navigation }) {
  if (!post) return null;
  const products = post.products || [];

  function openProduct(p) {
    onClose();
    navigation.navigate('ProductDetail', {
      offer: p.discount_value ? {
        discount_value: p.discount_value, offer_type: 'discount',
      } : null,
      brand: p.brand
        ? { id: p.brand.id, name: p.brand.name, category: p.brand.category }
        : null,
      store: p.via_creator ? { instagram_handle: p.via_creator.handle, name: p.via_creator.name } : null,
      influencer: p.via_creator || null,
      selectedProductId: p.product_id,
      product: { id: p.product_id, name: p.name, price: p.price, image_url: p.image_url },
      tracking: p.tracking || null,
      trackingParams: p.tracking || null,
    });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={st.back} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={st.sheet} onPress={() => {}}>
          <View style={st.grip} />
          <Text style={st.title}>Shop this post</Text>
          <Text style={st.sub}>{products.length} item{products.length === 1 ? '' : 's'} · by {post.creator?.handle}</Text>
          <FlatList
            data={products}
            keyExtractor={p => p.product_id}
            style={{ maxHeight: H * 0.55 }}
            renderItem={({ item: p }) => (
              <TouchableOpacity
                style={[st.row, !p.purchasable && { opacity: 0.45 }]}
                disabled={!p.purchasable}
                onPress={() => openProduct(p)}>
                {p.image_url
                  ? <Image source={{ uri: p.image_url }} style={st.img} />
                  : <View style={[st.img, { backgroundColor: '#F2F2F2' }]} />}
                <View style={{ flex: 1 }}>
                  <Text style={st.name} numberOfLines={1}>{p.name}</Text>
                  <Text style={st.brand} numberOfLines={1}>{p.brand?.name}{p.purchasable ? '' : ' · unavailable'}</Text>
                  <View style={st.priceRow}>
                    <Text style={st.price}>₹{p.offer_price ?? p.price}</Text>
                    {p.offer_price != null && p.offer_price !== p.price && (
                      <Text style={st.struck}>₹{p.price}</Text>
                    )}
                    {!!p.discount_value && <Text style={st.pct}>{p.discount_value}% off</Text>}
                  </View>
                </View>
                <Text style={st.chev}>›</Text>
              </TouchableOpacity>
            )}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const st = StyleSheet.create({
  back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingBottom: 24, paddingTop: 8 },
  grip: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: '#E5E5E5', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '800', color: '#111' },
  sub: { fontSize: 11.5, color: '#999', marginTop: 2, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#F5F5F5' },
  img: { width: 54, height: 68, borderRadius: 10 },
  name: { fontSize: 13.5, fontWeight: '700', color: '#111' },
  brand: { fontSize: 11, color: '#999', marginTop: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 3 },
  price: { fontSize: 13.5, fontWeight: '800', color: '#111' },
  struck: { fontSize: 11.5, color: '#AAA', textDecorationLine: 'line-through' },
  pct: { fontSize: 11, fontWeight: '800', color: YELLOW },
  chev: { fontSize: 22, color: '#CCC' },
});
