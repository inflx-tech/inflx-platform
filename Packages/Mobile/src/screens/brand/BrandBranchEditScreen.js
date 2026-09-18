/**
 * BrandBranchEditScreen — A5: add or edit a branch. Name, a Google address search that
 * resolves to a canonical city + state (the city is added to INFLX when new), and "Make
 * this the main branch". Contract: features/item3-discovery-profiles-groups · prompt §6.1 A5
 *
 * Item 10 (founder, 18 Sep): the address may also be TYPED. The Google search is not always
 * answering, and a Store Visit set now needs a branch with a street address, so a brand must
 * never be stuck behind the search. A typed address has no map pin; the city and state stay
 * what the branch (or, for a new one, the brand's registration) already has.
 * Contract: features/item10-store-visit
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
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
  // Typed address: on by default when the branch has no address yet (the search may not answer).
  const [typing, setTyping] = useState(editing && !branch?.formattedAddress);
  const [typed, setTyped] = useState(branch?.formattedAddress || '');
  const [pin, setPin] = useState(branch?.pincode || '');
  const [isMain, setIsMain] = useState(!!branch?.isMain);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const { toast, show } = useToast();

  const typedChanged = typing && (typed.trim() !== (branch?.formattedAddress || '') || (pin || '') !== (branch?.pincode || ''));
  const dirty = name !== (branch?.name || '') || !!place || typedChanged || isMain !== !!branch?.isMain;
  useUnsavedGuard(navigation, dirty && !done);

  const clientErrors = {
    name: name.trim() ? '' : MSG3.BRANCH_NAME,
    place_id: typing ? '' : (editing || place ? '' : MSG3.BRANCH_ADDRESS),
    address_text: typing ? (typed.trim() ? (typed.trim().length > 200 ? MSG3.BRANCH_ADDRESS_LONG : '') : MSG3.BRANCH_ADDRESS) : '',
    pincode: typing && pin && !/^\d{6}$/.test(pin.trim()) ? MSG3.BRANCH_PIN : '',
  };
  const errorCount = Object.values(clientErrors).filter(Boolean).length;

  async function save() {
    setErrors({});
    const body = { name: name.trim() };
    if (typing) { body.address_text = typed.trim(); body.pincode = pin.trim() || undefined; }
    else if (place) { body.place_id = place.placeId; }
    if (isMain && !branch?.isMain) body.is_main = true;
    setSaving(true);
    const r = editing ? await brandApi.updateBranch(branch.id, body) : await brandApi.createBranch(body);
    setSaving(false);
    if (!r.success) {
      applyServerError(r.error, { fields: ['name', 'place_id', 'address_text', 'pincode'], setErrors, show, fallback: COPY.saveFailed });
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

        {typing ? (
          <>
            <Text style={base.label}>{B.typedLabel}</Text>
            <TextInput style={[s.input, s.multi]} value={typed} onChangeText={(v) => { setTyped(v); setErrors((e) => ({ ...e, address_text: undefined })); }}
              placeholder={B.typedPlaceholder} placeholderTextColor={T.ink3} multiline maxLength={200} testID="branch-address-text" />
            <FieldError text={errors.address_text || (dirty ? clientErrors.address_text : '')} />
            <View style={{ height: 10 }} />
            <Text style={base.label}>{B.pin}</Text>
            <TextInput style={[s.input, { width: 140 }]} value={pin} onChangeText={(v) => { setPin(v.replace(/[^\d]/g, '').slice(0, 6)); setErrors((e) => ({ ...e, pincode: undefined })); }}
              placeholder={B.pinPlaceholder} placeholderTextColor={T.ink3} keyboardType="number-pad" maxLength={6} testID="branch-pin" />
            <FieldError text={errors.pincode || clientErrors.pincode} />
            <Text style={base.hint}>{B.typedHint}</Text>
            <TouchableOpacity onPress={() => setTyping(false)} testID="branch-search-instead"><Text style={s.link}>{B.searchInstead}</Text></TouchableOpacity>
          </>
        ) : (
          <>
            <PlaceSearchField label={B.address} placeholder="Search your branch address" value={shownPlace} onResolved={setPlace}
              error={errors.place_id || (place || !dirty || editing ? '' : clientErrors.place_id)} testID="branch-address" />
            <TouchableOpacity onPress={() => { setTyping(true); setPlace(null); }} testID="branch-type-instead"><Text style={s.link}>{B.typeInstead}</Text></TouchableOpacity>
          </>
        )}

        <View style={{ height: 12 }} />
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
  multi: { minHeight: 84, textAlignVertical: 'top' },
  link: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink, textDecorationLine: 'underline', marginTop: 4, marginBottom: 4 },
});
