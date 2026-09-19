/**
 * BrandBranchesScreen — B5: the brand's branches. Each card: name (Main tag), the street line,
 * "City, State · pincode", then Edit · Make main · Remove (the main branch shows Edit alone —
 * it can't be removed, only replaced). Creators only ever see the city.
 * Contract: features/registration-and-profile · features/item3-discovery-profiles-groups
 */
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
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

/** "Hyderabad, Telangana · 500034" */
export function cityLine(b) {
  const place = [b.cityName, b.stateName].filter(Boolean).join(', ');
  return [place, b.pincode].filter(Boolean).join(' · ');
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
  async function makeMain(b) {
    const r = await brandApi.makeMainBranch(b.id);
    if (!r.success) { show(r.error?.message || COPY.saveFailed); return; }
    setRows(prev => prev.map(x => ({ ...x, isMain: x.id === b.id })));
    show(`${b.name} is your main branch now.`);
  }
  const mainBranch = rows.find(b => b.isMain) || null;
  const add = () => navigation.navigate('BrandBranchEdit', { branchCount: rows.length, mainBranch });

  return (
    <View style={base.screen}>
      <Header title={B.title} onBack={() => navigation.goBack()} />
      {status === 'loading' ? <Skeleton rows={4} /> : status === 'error' ? <LoadError onRetry={load} /> : (
        <FlatList
          data={rows}
          keyExtractor={b => b.id}
          contentContainerStyle={{ padding: 18, paddingBottom: 120 }}
          ListEmptyComponent={<EmptyState title="No branches yet" body="Add your store's address so creators can see your city." />}
          ListFooterComponent={rows.length ? <Text style={[base.hint, { marginTop: 4 }]} testID="branches-hint">{B.hint}</Text> : null}
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
              <Text style={s.city} testID={`branch-city-${b.id}`}>{cityLine(b)}</Text>
              <View style={s.actions}>
                <TouchableOpacity onPress={() => navigation.navigate('BrandBranchEdit', { branch: b })} testID={`branch-edit-${b.id}`}><Text style={s.action}>{B.edit}</Text></TouchableOpacity>
                {!b.isMain ? <TouchableOpacity onPress={() => makeMain(b)} testID={`branch-make-main-${b.id}`}><Text style={s.action}>{B.makeMain}</Text></TouchableOpacity> : null}
                {!b.isMain ? <TouchableOpacity onPress={() => askRemove(b)} testID={`branch-remove-${b.id}`}><Text style={[s.action, { color: T.danger }]}>{B.remove}</Text></TouchableOpacity> : null}
              </View>
            </View>
          )}
        />
      )}
      <View style={s.footer}>
        <PrimaryButton label={`+ ${B.add}`} onPress={add} testID="add-branch" />
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
