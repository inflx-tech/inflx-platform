/**
 * BrandLinkedCreatorsScreen — Profile › Linked creators (item 20, board B2–B3). The people who run
 * this brand and post for it from their own creator accounts: no campaign, agreement or commission.
 * Each linked with a code sent to the brand's own number. Remove asks first; their live posts stay.
 * Built like Blocked creators. Contract: features/item20-own-brand · rules v1.33 §2D
 */
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { brandApi } from '../../services/api';
import { EmptyState } from '../../components/settings/primitives';
import { ConfirmSheet } from '../../components/settings/sheets';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { Avatar, bl } from './BrandBlockedCreatorsScreen';
import { O20 } from '../../components/ownbrand/copy20';

export default function BrandLinkedCreatorsScreen({ navigation }) {
  const [status, setStatus] = useState('loading');
  const [rows, setRows] = useState([]);
  const [asking, setAsking] = useState(null);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    const r = await brandApi.linkedCreators();
    if (!r.success) { setStatus('error'); return; }
    setRows(r.data.linked || []);
    setStatus('ready');
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function remove() {
    const row = asking;
    setAsking(null);
    const r = await brandApi.removeLinkedCreator(row.influencerId);
    if (!r.success) { show(r.error?.message || O20.generic); return; }
    setRows((prev) => prev.filter((x) => x.influencerId !== row.influencerId));
    show(O20.removedOne(row.name || 'Creator'));
  }

  return (
    <View style={base.screen} testID="linked-creators">
      <Header title={O20.linkedTitle} onBack={() => navigation.goBack()} />
      {status === 'loading' ? <Skeleton rows={4} /> : status === 'error' ? <LoadError onRetry={load} /> : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.influencerId}
          contentContainerStyle={{ padding: 18 }}
          ListHeaderComponent={<Text style={base.hint}>{O20.linkedHint}</Text>}
          ListEmptyComponent={<EmptyState title={O20.linkedEmptyTitle} body={O20.linkedFooter} />}
          ListFooterComponent={rows.length ? <Text style={[base.hint, { marginTop: 14 }]}>{O20.linkedFooter}</Text> : null}
          renderItem={({ item }) => (
            <View style={bl.row} testID={`linked-${item.influencerId}`}>
              <Avatar name={item.name} url={item.avatarUrl} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={bl.name}>{item.name || item.instagramHandle || 'Creator'}</Text>
                <Text style={bl.sub}>{[item.instagramHandle ? `@${item.instagramHandle}` : null, O20.linkedOnDay(item.linkedOn)].filter(Boolean).join(' · ')}</Text>
              </View>
              <TouchableOpacity style={bl.unblock} onPress={() => setAsking(item)} accessibilityRole="button" testID={`remove-${item.influencerId}`}>
                <Text style={bl.unblockText}>{O20.removeOne}</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
      <ConfirmSheet visible={!!asking} danger title={asking ? O20.removeOneQ(asking.name || 'this creator') : ''} body={O20.removeOneBody}
        confirmLabel={O20.removeOneYes} cancelLabel={O20.removeOneNo} onConfirm={remove} onCancel={() => setAsking(null)} />
      {toast}
    </View>
  );
}
