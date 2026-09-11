/**
 * BlockedBrandsScreen — C6 blocked list + empty state. Contract: features/item2-pitch-invitation-settings
 * Unblock is immediate. A blocked brand is never told; it sees this creator as paused.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { influencerApi } from '../../services/api';
import { EmptyState } from '../../components/settings/primitives';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { COPY, shortDate } from '../../components/settings/copy';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { Avatar, bl } from '../brand/BrandBlockedCreatorsScreen';

const C = COPY.creator;

export default function BlockedBrandsScreen({ navigation }) {
  const [status, setStatus] = useState('loading');
  const [rows, setRows] = useState([]);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await influencerApi.listBlockedBrands();
    if (!r.success) { setStatus('error'); return; }
    setRows(r.data.blocked || []);
    setStatus('ready');
  }, []);
  useEffect(() => { load(); }, [load]);

  async function unblock(row) {
    const r = await influencerApi.unblockBrand(row.brandId);
    if (!r.success) { show(COPY.saveFailed); return; }
    setRows(prev => prev.filter(x => x.brandId !== row.brandId));
    show(C.unblocked(row.name || 'Brand'));
  }

  return (
    <View style={base.screen}>
      <Header title={C.blockedTitle} onBack={() => navigation.goBack()} />
      {status === 'loading' ? <Skeleton rows={4} /> : status === 'error' ? <LoadError onRetry={load} /> : (
        <FlatList
          data={rows}
          keyExtractor={r => r.brandId}
          contentContainerStyle={{ padding: 18 }}
          ListEmptyComponent={<EmptyState title={C.blockedEmptyTitle} body={C.blockedEmptyBody} />}
          renderItem={({ item }) => (
            <View style={bl.row} testID={`blocked-${item.brandId}`}>
              <Avatar name={item.name} url={item.logoUrl} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={bl.name}>{item.name}</Text>
                <Text style={bl.sub}>{COPY.brand.blockedOn(shortDate(item.blockedAt))}</Text>
              </View>
              <TouchableOpacity style={bl.unblock} onPress={() => unblock(item)} accessibilityRole="button" testID={`unblock-${item.brandId}`}>
                <Text style={bl.unblockText}>{COPY.brand.unblock}</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
      {toast}
    </View>
  );
}
