/**
 * ProductDetailScreen — O3: one published product as a creator (or the brand itself) sees
 * it: images, name, price, out-of-stock, category path, sizes with availability, description.
 * No buying — the creator-side note explains when products become usable in posts.
 * Contract: features/item3-discovery-profiles-groups · prompt §6.7 O3
 *
 * route.params: { brandId, productId, viewer: 'brand' | 'creator' }
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi, influencerApi } from '../../services/api';
import { InfoBox } from '../../components/settings/primitives';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { groupIndian } from '../../components/settings/copy';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { ImageCarousel } from '../../components/discovery/bits';
import { C3 } from '../../components/discovery/copy3';

export default function ProductDetailScreen({ navigation, route }) {
  const { brandId, productId, viewer } = route?.params || {};
  const api = viewer === 'creator' ? influencerApi : brandApi;
  const [status, setStatus] = useState('loading');
  const [p, setP] = useState(null);

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await api.getBrandProduct(brandId, productId);
    if (!r.success) { setStatus('error'); return; }
    setP(r.data.product || r.data);
    setStatus('ready');
  }, [brandId, productId]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  const title = p?.brand?.name || 'Product';
  if (status === 'loading') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  return (
    <View style={base.screen}>
      <Header title={title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <ImageCarousel images={p.images || []} />
        <View style={base.body}>
          <Text style={s.name} testID="product-name">{p.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <Text style={s.price}>{p.price != null ? `₹${groupIndian(p.price)}` : ''}</Text>
            {p.outOfStock ? <View style={s.oos} testID="out-of-stock"><Text style={s.oosText}>{C3.overview.outOfStock}</Text></View> : null}
          </View>
          {p.categoryPath ? <Text style={s.path}>{p.categoryPath}</Text> : null}
          {Array.isArray(p.sizes) && p.sizes.length ? (
            <View style={{ marginTop: 16 }}>
              <Text style={s.sectionTitle}>{C3.overview.sizes}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {p.sizes.map(sz => (
                  <View key={sz.size} style={[s.size, !sz.available && s.sizeOff]} testID={`size-${sz.size}`}>
                    <Text style={[s.sizeText, !sz.available && s.sizeTextOff]}>{sz.size}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          {p.description ? <Text style={s.desc}>{p.description}</Text> : null}
          {viewer === 'creator' ? <InfoBox text={C3.overview.productInfo} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  name: { fontFamily: fonts.sansBold, fontSize: 19, color: T.ink },
  price: { fontFamily: fonts.sansBold, fontSize: 17, color: T.ink },
  oos: { marginLeft: 10, backgroundColor: T.state.ended.bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  oosText: { fontFamily: fonts.sansSemiBold, fontSize: 11.5, color: T.state.ended.fg },
  path: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink3, marginTop: 6 },
  sectionTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink2, marginBottom: 8 },
  size: { borderWidth: 1, borderColor: T.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8, marginBottom: 8 },
  sizeOff: { backgroundColor: T.surface, borderColor: T.surface },
  sizeText: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink },
  sizeTextOff: { color: T.ink3, textDecorationLine: 'line-through' },
  desc: { fontFamily: fonts.sansRegular, fontSize: 14, color: T.ink2, lineHeight: 21, marginTop: 16 },
});
