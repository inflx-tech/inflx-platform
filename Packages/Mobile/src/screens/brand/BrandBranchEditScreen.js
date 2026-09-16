/**
 * BrandBranchEditScreen — A5: add or edit a branch. Name, a Google address search that
 * resolves to a canonical city + state (the city is added to INFLX when new), and "Make
 * this the main branch". Contract: features/item3-discovery-profiles-groups · prompt §6.1 A5
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { FieldError, SwitchRow, StatusChip } from '../../components/settings/primitives';
import { SaveBar, useToast } from '../../components/settings/feedback';
import { COPY } from '../../components/settings/copy';
import { applyServerError } from '../../utils/serverError';
import useUnsavedGuard from '../../hooks/useUnsavedGuard';
import PlaceSearchField from '../../components/discovery/PlaceSearchField';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { C3, MSG3 } from '../../components/discovery/copy3';

const B = C3.brandProfile.branches;

export default function BrandBranchEditScreen({ navigation, route }) {
  const branch = route?.params?.branch || null;
  const editing = !!branch;
  const [name, setName] = useState(branch?.name || '');
  const [place, setPlace] = useState(null);
  const [isMain, setIsMain] = useState(!!branch?.isMain);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const { toast, show } = useToast();

  const dirty = name !== (branch?.name || '') || !!place || isMain !== !!branch?.isMain;
  useUnsavedGuard(navigation, dirty && !done);

  const clientErrors = {
    name: name.trim() ? '' : MSG3.BRANCH_NAME,
    place_id: editing || place ? '' : MSG3.BRANCH_ADDRESS,
  };
  const errorCount = Object.values(clientErrors).filter(Boolean).length;

  async function save() {
    setErrors({});
    const body = { name: name.trim() };
    if (place) { body.place_id = place.placeId; }
    if (isMain && !branch?.isMain) body.is_main = true;
    setSaving(true);
    const r = editing ? await brandApi.updateBranch(branch.id, body) : await brandApi.createBranch(body);
    setSaving(false);
    if (!r.success) {
      applyServerError(r.error, { fields: ['name', 'place_id'], setErrors, show, fallback: COPY.saveFailed });
      return;
    }
    setDone(true);
    const city = r.data?.cityAdded && r.data?.branch?.cityName ? r.data.branch.cityName : null;
    navigation.navigate('BrandBranches', city ? { toast: C3.toasts.cityAdded(city) } : {});
  }

  const shownPlace = place || (editing && branch.formattedAddress ? {
    formattedAddress: branch.formattedAddress,
    city: branch.cityName ? { name: branch.cityName } : null,
    state: branch.stateName ? { name: branch.stateName } : null,
  } : null);

  return (
    <View style={base.screen}>
      <Header title={editing ? B.editTitle : B.addTitle} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[base.body, { paddingBottom: 140 }]} keyboardShouldPersistTaps="handled">
        <Text style={base.label}>{B.name}</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Banjara Hills store" placeholderTextColor={T.ink3} testID="branch-name" />
        <FieldError text={errors.name || (name.trim() ? '' : (dirty ? clientErrors.name : ''))} />
        <View style={{ height: 16 }} />
        <PlaceSearchField label={B.address} placeholder="Search your branch address" value={shownPlace} onResolved={setPlace}
          error={errors.place_id || (place || !dirty || editing ? '' : clientErrors.place_id)} testID="branch-address" />
        {branch?.isMain ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
            <StatusChip on label={B.main} /><Text style={[base.hint, { marginLeft: 8, marginBottom: 0 }]}>This is your main branch.</Text>
          </View>
        ) : (
          <SwitchRow label={B.makeMain} value={isMain} onValueChange={setIsMain} testID="branch-make-main" />
        )}
      </ScrollView>
      <SaveBar dirty={dirty} errorCount={errorCount} saving={saving} onSave={save} label={B.save} />
      {toast}
    </View>
  );
}

const s = StyleSheet.create({
  input: { fontFamily: fonts.sansMedium, fontSize: 15, color: T.ink, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: T.bg },
});
