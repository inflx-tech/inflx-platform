import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, ActivityIndicator,
} from 'react-native';
import { creatorVibe as C, fonts, fmtRupees } from '../../theme/tokens';

// Flow 52.D — Creator Vibe recolor shim. Visual only; lookbook/product logic unchanged.
const P = {
  white: C.card, black: C.ink, bg: C.screenBg, bg2: C.soft,
  ink: C.ink, ink2: C.ink, muted: C.muted, muted2: C.muted, muted3: C.muted, muted4: C.line,
  border: C.line, borderSoft: C.line,
  yellow: C.brown, yellowHover: C.brownDark, yellowPale: C.soft, yellow50: C.soft, yellowText: C.brown,
  success: '#1E9E5A', successPale: C.soft, successText: '#1E9E5A',
  danger: C.offer, dangerPale: C.soft, dangerText: C.offer,
  conv: C.brown, convPale: C.soft, eng: C.verify, engPale: C.soft, hyb: C.brown, hybPale: C.soft, info: C.verify, infoPale: C.soft,
};

// Fashion wayfinding tint (this screen is fashion-only) — getBusinessAccentLight('fashion').pale
const FASHION_PALE = '#FCE7F3';
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
    return <View style={s.center}><ActivityIndicator color={P.ink} /></View>;
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
  container: { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: P.bg },
  errText: { fontFamily: fonts.sansMedium, fontSize: 13, color: P.muted, marginBottom: 14 },
  backTab: { backgroundColor: P.bg2, borderRadius: 11, paddingHorizontal: 18, paddingVertical: 9 },
  backTabText: { fontFamily: fonts.sansBold, fontSize: 12, color: P.ink },

  cover: { height: 240, position: 'relative', backgroundColor: FASHION_PALE },
  coverImg: { width: '100%', height: '100%' },
  coverFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  coverFallbackIcon: { fontSize: 70, opacity: 0.3 },
  back: { position: 'absolute', top: 50, left: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 16, color: P.ink, fontWeight: '700' },

  body: { padding: 16 },

  // creator chip — yellow avatar + ink initial (CreatorChip DNA)
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: P.white, borderRadius: 14, borderWidth: 1, borderColor: P.border, marginBottom: 16 },
  creatorAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: P.yellow, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  creatorAvatarImg: { width: '100%', height: '100%' },
  creatorAvatarInitial: { fontFamily: fonts.displayBlack, fontSize: 14, color: P.ink },
  creatorLabel: { fontFamily: fonts.monoBold, fontSize: 9, color: P.muted2, textTransform: 'uppercase', letterSpacing: 0.4 },
  creatorName: { fontFamily: fonts.displayBold, fontSize: 13, color: P.ink, marginTop: 2 },
  creatorHandle: { fontFamily: fonts.monoMedium, fontWeight: '500', color: P.muted },
  followBtn: { paddingHorizontal: 11, paddingVertical: 6, backgroundColor: P.bg2, borderRadius: 9, borderWidth: 1, borderColor: P.border },
  followBtnText: { fontFamily: fonts.sansBold, fontSize: 11, color: P.ink },

  title: { fontFamily: fonts.displayBold, fontSize: 22, color: P.ink },
  description: { fontFamily: fonts.sansMedium, fontSize: 12, color: P.muted, lineHeight: 18, marginTop: 6 },
  meta: { fontFamily: fonts.monoBold, fontSize: 10, color: P.muted2, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14 },

  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  productCard: { width: '48.5%', backgroundColor: P.white, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: P.border },
  productImgBox: { aspectRatio: 1, backgroundColor: FASHION_PALE, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  productImg: { width: '100%', height: '100%' },
  productImgFallback: { fontSize: 32, opacity: 0.4 },
  variantBadge: { position: 'absolute', bottom: 6, left: 6, backgroundColor: P.ink, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  variantBadgeText: { fontFamily: fonts.monoBold, fontSize: 9, color: '#FFFFFF' },
  productBody: { padding: 10 },
  brandName: { fontFamily: fonts.monoBold, fontSize: 9, color: P.muted2, textTransform: 'uppercase', letterSpacing: 0.3 },
  productName: { fontFamily: fonts.sansBold, fontSize: 12, color: P.ink, marginTop: 3 },
  productPrice: { fontFamily: fonts.monoBold, fontSize: 13, color: P.ink, marginTop: 4 },
  // creator-note — yellow-vibe (yellowPale + yellow left border)
  noteBox: { marginTop: 7, padding: 7, backgroundColor: P.yellowPale, borderRadius: 6, borderLeftWidth: 2, borderLeftColor: P.yellow },
  noteText: { fontFamily: fonts.sansMedium, fontSize: 10, fontStyle: 'italic', color: P.ink2, lineHeight: 14 },
});
