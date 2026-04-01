import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image,
} from 'react-native';
import { colors, fmtMoney } from '../../theme/tokens';
import { followerApi } from '../../services/api';

export default function ProductDetailScreen({ navigation, route }) {
  const { offer, store, trackingParams } = route.params || {};
  const handle = store?.instagram_handle || '';

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    async function load() {
      const res = await followerApi.getStoreProducts(handle);
      setLoading(false);
      if (res.success) {
        const items = res.data?.products || res.data || [];
        setProducts(items);
        if (items.length > 0) setSelected(items[0]);
      }
    }
    if (handle) load();
  }, [handle]);

  function computeDiscount(pricePaise) {
    if (!offer) return 0;
    if (offer.offer_type === 'percentage' && offer.discount_value) {
      return Math.round(pricePaise * (offer.discount_value / 100));
    }
    if (offer.offer_type === 'flat' && offer.discount_value) {
      return Math.min(offer.discount_value, pricePaise);
    }
    return 0;
  }

  function handleBuyNow() {
    if (!selected) return;
    navigation.navigate('OnlineOrder', {
      products: [selected],
      offer,
      store,
      trackingParams,
    });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.navy} />
      </View>
    );
  }

  if (products.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 32, marginBottom: 8 }}>📦</Text>
        <Text style={styles.emptyText}>No products available</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackBtn}>
          <Text style={styles.goBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const discountPaise = selected ? computeDiscount(selected.price || 0) : 0;
  const finalPrice = selected ? (selected.price || 0) - discountPaise : 0;

  return (
    <View style={styles.outer}>
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>{'<-'} Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{store?.brand_name || 'Products'}</Text>
          <Text style={styles.sub}>via @{handle}</Text>
        </View>

        {/* Offer banner */}
        {offer && (
          <View style={styles.offerBanner}>
            <Text style={styles.offerBannerTitle}>{offer.title}</Text>
            {offer.offer_type === 'percentage' && offer.discount_value ? (
              <Text style={styles.offerBannerDiscount}>{offer.discount_value}% OFF</Text>
            ) : offer.offer_type === 'flat' && offer.discount_value ? (
              <Text style={styles.offerBannerDiscount}>{fmtMoney(offer.discount_value)} OFF</Text>
            ) : null}
          </View>
        )}

        {/* Product list */}
        {products.map(product => {
          const isSelected = selected?.id === product.id;
          const pDiscount = computeDiscount(product.price || 0);
          return (
            <TouchableOpacity
              key={product.id}
              style={[styles.productCard, isSelected && styles.productCardSelected]}
              onPress={() => setSelected(product)}
            >
              {product.image_url ? (
                <Image
                  source={{ uri: product.image_url }}
                  style={styles.productImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.productImagePlaceholder}>
                  <Text style={{ fontSize: 28 }}>📷</Text>
                </View>
              )}
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{product.name}</Text>
                {product.description ? (
                  <Text style={styles.productDesc} numberOfLines={2}>{product.description}</Text>
                ) : null}
                <View style={styles.priceRow}>
                  <Text style={styles.productPrice}>{fmtMoney(product.price || 0)}</Text>
                  {pDiscount > 0 && (
                    <Text style={styles.discountedPrice}>
                      {fmtMoney((product.price || 0) - pDiscount)}
                    </Text>
                  )}
                </View>
              </View>
              {isSelected && (
                <View style={styles.checkMark}>
                  <Text style={styles.checkMarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Selected product details */}
        {selected && (
          <View style={styles.detailCard}>
            <Text style={styles.detailCardTitle}>Order Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{selected.name}</Text>
              <Text style={styles.summaryVal}>{fmtMoney(selected.price || 0)}</Text>
            </View>
            {discountPaise > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  Discount ({offer?.offer_type === 'percentage' ? `${offer.discount_value}%` : 'Flat'})
                </Text>
                <Text style={[styles.summaryVal, { color: colors.teal }]}>
                  - {fmtMoney(discountPaise)}
                </Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.summaryTotal]}>
              <Text style={styles.totalLabel}>You Pay</Text>
              <Text style={styles.totalVal}>{fmtMoney(finalPrice)}</Text>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Buy Now footer */}
      {selected && (
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <View>
              <Text style={styles.footerPrice}>{fmtMoney(finalPrice)}</Text>
              <Text style={styles.footerProduct}>{selected.name}</Text>
            </View>
            <TouchableOpacity style={styles.buyBtn} onPress={handleBuyNow}>
              <Text style={styles.buyBtnText}>Buy Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  emptyText: { fontSize: 14, color: colors.t2, marginBottom: 16 },
  goBackBtn: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.surface2, borderRadius: 12 },
  goBackBtnText: { fontSize: 14, fontWeight: '600', color: colors.navy },
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  back: { marginBottom: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '800', color: colors.white },
  sub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  offerBanner: { margin: 16, marginBottom: 0, backgroundColor: colors.orangePale, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.orange + '30' },
  offerBannerTitle: { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 4 },
  offerBannerDiscount: { fontSize: 22, fontWeight: '800', color: colors.orange },
  productCard: { margin: 16, marginBottom: 0, backgroundColor: colors.white, borderRadius: 16, padding: 12, borderWidth: 1.5, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
  productCardSelected: { borderColor: colors.navy, backgroundColor: colors.navy + '08' },
  productImage: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.surface2 },
  productImagePlaceholder: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  productInfo: { flex: 1 },
  productName: { fontSize: 15, fontWeight: '700', color: colors.t1, marginBottom: 4 },
  productDesc: { fontSize: 12, color: colors.t3, lineHeight: 17, marginBottom: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  productPrice: { fontSize: 14, fontWeight: '700', color: colors.t2, textDecorationLine: 'none' },
  discountedPrice: { fontSize: 16, fontWeight: '800', color: colors.orange },
  checkMark: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  checkMarkText: { fontSize: 13, color: colors.white, fontWeight: '700' },
  detailCard: { margin: 16, marginBottom: 0, backgroundColor: colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  detailCardTitle: { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { fontSize: 13, color: colors.t2 },
  summaryVal: { fontSize: 13, fontWeight: '600', color: colors.t1 },
  summaryTotal: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6, paddingTop: 10 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: colors.t1 },
  totalVal: { fontSize: 20, fontWeight: '800', color: colors.orange },
  footer: { backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border, padding: 16 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerPrice: { fontSize: 18, fontWeight: '800', color: colors.navy },
  footerProduct: { fontSize: 11, color: colors.t3, marginTop: 2 },
  buyBtn: { backgroundColor: colors.orange, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 },
  buyBtnText: { fontSize: 14, fontWeight: '800', color: colors.white },
});
