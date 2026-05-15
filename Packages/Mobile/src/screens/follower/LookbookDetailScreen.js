import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, ActivityIndicator,
} from 'react-native';
import { darkColors, fmtRupees } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { buildTrackingFromOffer } from '../../utils/tracking';

/**
 * LookbookDetailScreen — Fashion-2 full-screen lookbook view.
 *
 * Reads /store/:handle/lookbooks/:id which returns the lookbook meta +
 * ordered products (with variant info + brand context).
 *
 * The product grid items each carry creator_note from the lookbook
 * (e.g. "wearing M in this") — surfaces creator-specific guidance that
 * standard product cards can't.
 *
 * Tapping a product → navigates to BrandStore with tracking constructed
 * from the parent influencer so commission credits the right creator.
 */

export default function LookbookDetailScreen({ navigation, route }) {
  const { handle, lookbookId } = route.params || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await followerApi.getLookbook(handle, lookbookId);
        if (cancelled) return;
        setData(res?.data || res);
      } catch (e) {
        console.error('[LookbookDetail]', e?.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [handle, lookbookId]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={darkColors.amber} /></View>;
  }
  if (!data || !data.lookbook) {
    return (
      <View style={s.center}>
        <Text style={s.errText}>Lookbook not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backTab}>
          <Text style={s.backTabText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const lb = data.lookbook;
  const products = data.products || [];
  const creatorInitial = (lb.creator_name || '?')[0];

  function openProduct(p) {
    // Construct tracking from the creator (influencer_id known via lookbook
    // owner). Commission credits the creator who curated the lookbook.
    const tracking = {
      influencer_id: lb.influencer_id,
      campaign_id: null,
      set_id: null,
      offer_id: null,
      campaign_influencer_id: null,
    };
    navigation.navigate('BrandStore', { brandId: p.brand_id, brandName: p.business_name, tracking });
  }

  return (
    <ScrollView style={s.container}>
      {/* Cover */}
      <View style={s.cover}>
        {lb.cover_image_url
          ? <Image source={{ uri: lb.cover_image_url }} style={s.coverImg} />
          : <View style={s.coverFallback}><Text style={s.coverFallbackIcon}>👗</Text></View>}
        <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
      </View>

      <View style={s.body}>
        {/* Creator chip */}
        <View style={s.creatorRow}>
          <View style={s.creatorAvatar}>
            {lb.creator_profile_pic
              ? <Image source={{ uri: lb.creator_profile_pic }} style={s.creatorAvatarImg} />
              : <Text style={s.creatorAvatarInitial}>{creatorInitial}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.creatorLabel}>Curated by</Text>
            <Text style={s.creatorName}>{lb.creator_name} <Text style={s.creatorHandle}>@{lb.instagram_handle}</Text></Text>
          </View>
          <TouchableOpacity
            style={s.followBtn}
            onPress={() => navigation.navigate('InfluencerStore', { handle: lb.instagram_handle })}>
            <Text style={s.followBtnText}>Visit store</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.title}>{lb.title}</Text>
        {lb.description && <Text style={s.description}>{lb.description}</Text>}
        <Text style={s.meta}>{products.length} item{products.length === 1 ? '' : 's'} in this look</Text>

        {/* Product grid — 2-col, each row a product with creator note */}
        <View style={s.productGrid}>
          {products.map(p => (
            <TouchableOpacity key={p.lookbook_product_id} style={s.productCard} onPress={() => openProduct(p)} activeOpacity={0.85}>
              <View style={s.productImgBox}>
                {p.product_image_url
                  ? <Image source={{ uri: p.product_image_url }} style={s.productImg} />
                  : <Text style={s.productImgFallback}>👗</Text>}
                {(p.variant_size || p.variant_color) && (
                  <View style={s.variantBadge}>
                    <Text style={s.variantBadgeText}>
                      {[p.variant_size, p.variant_color].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                )}
              </View>
              <View style={s.productBody}>
                <Text style={s.brandName} numberOfLines={1}>{p.business_name}</Text>
                <Text style={s.productName} numberOfLines={2}>{p.product_name}</Text>
                <Text style={s.productPrice}>{fmtRupees(p.price_override ?? p.product_price)}</Text>
                {p.creator_note && (
                  <View style={s.noteBox}>
                    <Text style={s.noteText} numberOfLines={2}>"{p.creator_note}"</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 60 }} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: darkColors.bg2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: darkColors.bg2 },
  errText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 14 },
  backTab: { backgroundColor: '#142438', borderRadius: 11, paddingHorizontal: 18, paddingVertical: 9 },
  backTabText: { fontSize: 12, color: '#fff', fontWeight: '700' },

  cover: { height: 240, position: 'relative', backgroundColor: '#142438' },
  coverImg: { width: '100%', height: '100%' },
  coverFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  coverFallbackIcon: { fontSize: 70, opacity: 0.3 },
  back: { position: 'absolute', top: 50, left: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 16, color: '#fff', fontWeight: '700' },

  body: { padding: 16 },

  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: '#0D1D2E', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 16 },
  creatorAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#ec4899', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  creatorAvatarImg: { width: '100%', height: '100%' },
  creatorAvatarInitial: { fontSize: 14, fontWeight: '900', color: '#fff' },
  creatorLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.4 },
  creatorName: { fontSize: 13, fontWeight: '800', color: '#fff', marginTop: 2 },
  creatorHandle: { fontWeight: '500', color: 'rgba(255,255,255,0.5)' },
  followBtn: { paddingHorizontal: 11, paddingVertical: 6, backgroundColor: 'rgba(236,72,153,0.18)', borderRadius: 9, borderWidth: 1, borderColor: 'rgba(236,72,153,0.4)' },
  followBtnText: { fontSize: 11, fontWeight: '700', color: '#ec4899' },

  title: { fontSize: 22, fontWeight: '800', color: '#fff' },
  description: { fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 18, marginTop: 6 },
  meta: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14 },

  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  productCard: { width: '48.5%', backgroundColor: '#0D1D2E', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  productImgBox: { aspectRatio: 1, backgroundColor: '#142438', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  productImg: { width: '100%', height: '100%' },
  productImgFallback: { fontSize: 32, opacity: 0.4 },
  variantBadge: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  variantBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  productBody: { padding: 10 },
  brandName: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.3 },
  productName: { fontSize: 12, fontWeight: '700', color: '#fff', marginTop: 3 },
  productPrice: { fontSize: 13, fontWeight: '800', color: '#ec4899', marginTop: 4 },
  noteBox: { marginTop: 7, padding: 7, backgroundColor: 'rgba(236,72,153,0.08)', borderRadius: 6, borderLeftWidth: 2, borderLeftColor: '#ec4899' },
  noteText: { fontSize: 10, fontStyle: 'italic', color: 'rgba(255,255,255,0.75)', lineHeight: 14 },
});
