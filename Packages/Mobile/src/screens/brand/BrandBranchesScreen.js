/**
 * BrandBranchesScreen — A4: the brand's branches. Each row: name (Main chip), address,
 * city · state, then Edit · Open in Maps · Remove. Creators only ever see city names.
 * Contract: features/item3-discovery-profiles-groups · prompt §6.1 A4
 */
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton, StatusChip, EmptyState } from '../../components/settings/primitives';
import { ConfirmSheet } from '../../components/settings/sheets';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { COPY } from '../../components/settings/copy';
import { Header, s as base } from './BrandPitchSettingsScreen';
import useRouteToast from '../../hooks/useRouteToast';
import { C3, MSG3 } from '../../components/discovery/copy3';

const B = C3.brandProfile.branches;

export function mapsUrl(b) {
  if (b.lat != null && b.lng != null) return `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}${b.googlePlaceId ? `&query_place_id=${b.googlePlaceId}` : ''}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.formattedAddress || b.name)}`;
}

export default function BrandBranchesScreen({ navigation, route }) {
  const [status, setStatus] = useState('loading');
  const [rows, setRows] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const { toast, show } = useToast();
  useRouteToast(navigation, route, show);

  const load = useCallback(async () => {
    const r = await brandApi.listBranches();
    if (!r.success) { setStatus('error'); return; }
    setRows(r.data.branches || []);
    setStatus('ready');
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  function askRemove(b) {
    if (b.isMain) { show(MSG3.MAIN_BRANCH); return; }
    setConfirm(b);
  }
  async function remove() {
    const b = confirm; setConfirm(null);
    const r = await brandApi.removeBranch(b.id);
    if (!r.success) { show(r.error?.message || COPY.saveFailed); return; }
    setRows(prev => prev.filter(x => x.id !== b.id));
  }

  return (
    <View style={base.screen}>
      <Header title={B.title} onBack={() => navigation.goBack()} />
      {status === 'loading' ? <Skeleton rows={4} /> : status === 'error' ? <LoadError onRetry={load} /> : (
        <FlatList
          data={rows}
          keyExtractor={b => b.id}
          contentContainerStyle={{ padding: 18, paddingBottom: 120 }}
          ListHeaderComponent={<Text style={[base.hint, { marginBottom: 10 }]}>{B.hint}</Text>}
          ListEmptyComponent={<EmptyState title="No branches yet" body={C3.brandProfile.mainCityWarning} />}
          renderItem={({ item: b }) => (
            <View style={s.card} testID={`branch-${b.id}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={s.name} numberOfLines={1}>{b.name}</Text>
                {b.isMain ? <View style={{ marginLeft: 8 }}><StatusChip on label={B.main} /></View> : null}
              </View>
              {b.formattedAddress
                ? <Text style={s.addr}>{b.formattedAddress}</Text>
                // Item 10: a Store Visit set needs the street address, so its absence is said where you would look for it.
                : <Text style={[s.addr, { color: T.danger }]} testID={`branch-no-address-${b.id}`}>{B.noAddressYet}</Text>}
              <Text style={s.city}>{[b.cityName, b.stateName].filter(Boolean).join(' · ')}</Text>
              <View style={s.actions}>
                <TouchableOpacity onPress={() => navigation.navigate('BrandBranchEdit', { branch: b })} testID={`branch-edit-${b.id}`}><Text style={s.action}>{B.edit}</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => Linking.openURL(mapsUrl(b)).catch(() => {})} testID={`branch-maps-${b.id}`}><Text style={s.action}>{B.maps}</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => askRemove(b)} testID={`branch-remove-${b.id}`}><Text style={[s.action, { color: T.danger }]}>{B.remove}</Text></TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
      <View style={s.footer}>
        <PrimaryButton label={B.add} onPress={() => navigation.navigate('BrandBranchEdit', {})} testID="add-branch" />
      </View>
      {toast}
      <ConfirmSheet visible={!!confirm} danger title={confirm ? B.removeTitle(confirm.name) : ''} body={B.removeBody}
        confirmLabel={B.removeConfirm} cancelLabel={B.keep} onConfirm={remove} onCancel={() => setConfirm(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 14, marginBottom: 12 },
  name: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: T.ink, flexShrink: 1 },
  addr: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, marginTop: 4, lineHeight: 18 },
  city: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: T.ink3, marginTop: 4 },
  actions: { flexDirection: 'row', marginTop: 10 },
  action: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink, marginRight: 18 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 22, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border },
});
