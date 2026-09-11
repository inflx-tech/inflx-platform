/**
 * BrandProductsScreen — "See all" from a brand overview: every published product, two per
 * row, paged. Contract: features/item3-discovery-profiles-groups · prompt §6.7
 *
 * route.params: { brandId, viewer: 'brand' | 'creator' }
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, ActivityIndicator, Dimensions } from 'react-native';
import { settingsTokens as T } from '../../theme/tokens';
import { brandApi, influencerApi } from '../../services/api';
import { EmptyState } from '../../components/settings/primitives';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { ProductCard } from '../../components/discovery/bits';
import { C3 } from '../../components/discovery/copy3';

export default function BrandProductsScreen({ navigation, route }) {
  const { brandId, viewer } = route?.params || {};
  const api = viewer === 'creator' ? influencerApi : brandApi;
  const [status, setStatus] = useState('loading');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const load = useCallback(async (next = 1) => {
    setStatus(next === 1 ? 'loading' : 'more');
    const r = await api.getBrandProducts(brandId, { page: next });
    if (!r.success) { setStatus('error'); return; }
    setTotal(r.data.total || 0);
    setRows(prev => next === 1 ? (r.data.rows || []) : [...prev, ...(r.data.rows || [])]);
    setPage(next);
    setStatus('ready');
  }, [brandId]); // eslint-disable-line
  useEffect(() => { load(1); }, [load]);

  const width = (Dimensions.get('window').width - 36 - 12) / 2;
  return (
    <View style={base.screen}>
      <Header title={C3.overview.products(total)} onBack={() => navigation.goBack()} />
      {status === 'loading' ? <Skeleton /> : status === 'error' ? <LoadError onRetry={() => load(1)} /> : (
        <FlatList data={rows} numColumns={2} keyExtractor={p => p.id} columnWrapperStyle={{ justifyContent: 'space-between' }}
          contentContainerStyle={{ padding: 18 }}
          renderItem={({ item }) => <ProductCard product={item} width={width} onPress={() => navigation.navigate('ProductDetail', { brandId, productId: item.id, viewer })} />}
          onEndReachedThreshold={0.4} onEndReached={() => { if (rows.length < total && status === 'ready') load(page + 1); }}
          ListFooterComponent={status === 'more' ? <ActivityIndicator color={T.ink3} style={{ marginVertical: 12 }} /> : null}
          ListEmptyComponent={<EmptyState title="No products yet" body={C3.overview.ownProductsHint} />} />
      )}
    </View>
  );
}
