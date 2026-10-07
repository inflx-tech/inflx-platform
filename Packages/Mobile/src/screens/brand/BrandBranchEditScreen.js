/**
 * BrandBranchEditScreen — B6 / B7: add or edit a branch with the four-part address — branch
 * name, street address (required: a store visit can't be planned without it), pincode, State,
 * nearest major city. The Google search and the search/type toggle are gone.
 *
 * The main-branch rule (spec §4): the first branch is main. When a SECOND branch is added the
 * brand must say which of the two is main — the B7 sheet asks, listing both, "Save both".
 * Never assumed, never silently kept. From the third branch on, "Make main" on B5 covers it.
 * The server enforces the same rule: 422 MAIN_CHOICE_REQUIRED opens the sheet too.
 * Payload { name, address_text, landmark, phone, pincode, state_id, city_id, is_main? }.
 * Contract: features/registration-and-profile
 *
 * features/courier-ready-addresses (founder, 7 Oct 2026): a courier has to find the store. The
 * street address carries a hint and a 140 counter and must hold a shop or door number; a
 * Landmark and a Store phone are new (the phone starts as the login number); and the city field
 * is labelled "City" — someone whose town is not on the list picks the nearest one.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { FieldError, PrimaryButton, StatusChip } from '../../components/settings/primitives';
import { Sheet, sh } from '../../components/settings/sheets';
import { SaveBar, useToast } from '../../components/settings/feedback';
import { FormScroll, FormArea } from '../../components/shell/FormScroll';
import { COPY } from '../../components/settings/copy';
import { applyServerError } from '../../utils/serverError';
import useUnsavedGuard from '../../hooks/useUnsavedGuard';
import OfferedStateCityFields, { MSG_STATE } from '../../components/registration/OfferedStateCityFields';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { C3, MSG3 } from '../../components/discovery/copy3';
import { streetError, landmarkError, storePhoneError, tenDigits, STREET_MAX, LANDMARK_MAX, MSG_STORE } from '../../utils/storeAddress';

const B = C3.brandProfile.branches;
const M = B.mainSheet;

/** B7 — "Which is your main branch?" listing the existing main and the new one. */
export function MainBranchSheet({ visible, existing, fresh, choice, onChoose, onSave, onClose, busy }) {
  const Row = ({ id, name, city, tag, testID }) => {
    const on = choice === id;
    return (
      <TouchableOpacity style={[sh.optRow, on && { backgroundColor: T.surface, borderRadius: 10, paddingHorizontal: 8 }]} onPress={() => onChoose(id)} accessibilityRole="radio" accessibilityState={{ selected: !!on }} testID={testID}>
        <View style={{ flex: 1 }}>
          <Text style={sh.optLabel}>{name}</Text>
          <Text style={ms.sub}>{[city, tag].filter(Boolean).join(' · ')}</Text>
        </View>
        {on ? <Text style={ms.tick}>✓</Text> : null}
      </TouchableOpacity>
    );
  };
  return (
    <Sheet visible={visible} onClose={onClose} testID="main-branch-sheet">
      <Text style={sh.title}>{M.title}</Text>
      <Text style={sh.body}>{M.body}</Text>
      <View style={{ height: 10 }} />
      {existing ? <Row id="existing" name={existing.name} city={existing.cityName} tag={M.first} testID="main-choice-existing" /> : null}
      <Row id="new" name={fresh.name} city={fresh.cityName} tag={M.fresh} testID="main-choice-new" />
      <View style={{ height: 16 }} />
      <PrimaryButton label={M.save} onPress={onSave} disabled={!choice} busy={busy} testID="main-branch-save" />
    </Sheet>
  );
}

export default function BrandBranchEditScreen({ navigation, route }) {
  const branch = route?.params?.branch || null;
  const editing = !!branch;
  const [name, setName] = useState(branch?.name || '');
  const [street, setStreet] = useState(branch?.formattedAddress || '');
  const [landmark, setLandmark] = useState(branch?.landmark || '');
  // The store phone starts as the login number. `phoneBase` is what the box held when the screen
  // opened, so a number we filled in ourselves does not count as the brand's own unsaved change.
  const [phone, setPhone] = useState(tenDigits(branch?.phone || ''));
  const [phoneBase, setPhoneBase] = useState(tenDigits(branch?.phone || ''));
  const [pin, setPin] = useState(branch?.pincode || '');
  const [stateId, setStateId] = useState(branch?.stateId != null ? branch.stateId : null);
  const [cityId, setCityId] = useState(branch?.cityId != null ? branch.cityId : null);
  const [cityName, setCityName] = useState(branch?.cityName || '');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  // How many branches exist and which is main — from the list screen, or fetched when arriving cold.
  const [branchCount, setBranchCount] = useState(route?.params?.branchCount != null ? route.params.branchCount : null);
  const [mainBranch, setMainBranch] = useState(route?.params?.mainBranch || null);
  const [sheet, setSheet] = useState(false);
  const [choice, setChoice] = useState(null);
  const { toast, show } = useToast({ inFlow: true });

  useEffect(() => {
    if (editing || branchCount != null) return;
    let alive = true;
    brandApi.listBranches().then((r) => {
      if (!alive || !r || !r.success) return;
      const rows = r.data.branches || [];
      setBranchCount(rows.length);
      setMainBranch(rows.find(b => b.isMain) || rows[0] || null);
    }).catch(() => {});
    return () => { alive = false; };
  }, [editing, branchCount]);

  useEffect(() => {
    if (tenDigits(branch?.phone || '')) return;
    let alive = true;
    Promise.resolve().then(() => brandApi.getMe()).then((r) => {
      if (!alive || !r || !r.success) return;
      const b = (r.data && r.data.brand) || r.data || {};
      const login = tenDigits(b.login_phone || b.phone || '');
      if (!login) return;
      setPhoneBase((was) => was || login);
      setPhone((was) => was || login);
    }).catch(() => {});
    return () => { alive = false; };
  }, [branch]);

  const dirty = name !== (branch?.name || '') || street !== (branch?.formattedAddress || '') || (pin || '') !== (branch?.pincode || '')
    || landmark !== (branch?.landmark || '') || phone !== phoneBase
    || stateId !== (branch?.stateId != null ? branch.stateId : null) || cityId !== (branch?.cityId != null ? branch.cityId : null);
  useUnsavedGuard(navigation, dirty && !done);

  const clientErrors = {
    name: name.trim() ? '' : MSG3.BRANCH_NAME,
    address_text: streetError(street),
    landmark: landmarkError(landmark),
    phone: storePhoneError(phone),
    pincode: /^\d{6}$/.test(String(pin).trim()) ? '' : MSG3.BRANCH_PIN,
    state: stateId != null ? '' : MSG_STATE,
    city: cityId != null ? '' : MSG_STORE.CITY,
  };
  const errorCount = Object.values(clientErrors).filter(Boolean).length;

  function body(isMain) {
    const b = { name: name.trim(), address_text: street.trim(), landmark: landmark.trim(), phone: tenDigits(phone), pincode: String(pin).trim(), state_id: stateId, city_id: cityId };
    if (isMain != null) b.is_main = isMain;
    return b;
  }

  async function submit(isMain) {
    setErrors({});
    setSaving(true);
    const r = editing ? await brandApi.updateBranch(branch.id, body(isMain)) : await brandApi.createBranch(body(isMain));
    setSaving(false);
    if (!r.success) {
      if (r.error?.code === 'MAIN_CHOICE_REQUIRED' || r.error?.field === 'is_main') { setSheet(true); return; }
      const field = r.error?.field === 'city_id' || r.error?.field === 'state_id' ? 'city' : r.error?.field;
      applyServerError({ ...r.error, field }, { fields: ['name', 'address_text', 'landmark', 'phone', 'pincode', 'city', 'state'], setErrors, show, fallback: COPY.saveFailed });
      return;
    }
    setSheet(false);
    setDone(true);
    navigation.navigate('BrandBranches', { toast: 'Saved.' });
  }

  function save() {
    // The second branch: ask which is main before anything is saved (B7).
    if (!editing && branchCount === 1) { setSheet(true); return; }
    submit(null);
  }

  return (
    <View style={base.screen}>
      <Header title={editing ? B.editTitle : B.addTitle} onBack={() => navigation.goBack()} />
      {/* ui-walk-fixes board C: the form scrolls in the room above the Save strip; nothing floats over it. */}
      <FormArea>
      <FormScroll contentContainerStyle={base.body}>
        <Text style={base.label}>{B.name}</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Jubilee Hills" placeholderTextColor={T.ink3} testID="branch-name" />
        <FieldError text={errors.name || (dirty ? clientErrors.name : '')} />
        <View style={{ height: 14 }} />

        <Text style={base.label}>{B.street}</Text>
        <TextInput style={[s.input, s.multi]} value={street} onChangeText={(v) => { setStreet(v); setErrors((e) => ({ ...e, address_text: undefined })); }}
          placeholder={B.streetPlaceholder} placeholderTextColor={T.ink3} multiline maxLength={STREET_MAX} testID="branch-address-text" />
        <View style={s.under}>
          <Text style={s.hint} testID="branch-street-hint">{B.streetHint}</Text>
          <Text style={s.count} testID="branch-street-count">{`${street.length}/${STREET_MAX}`}</Text>
        </View>
        <FieldError text={errors.address_text || (dirty ? clientErrors.address_text : '')} />
        <View style={{ height: 14 }} />

        <Text style={base.label}>{B.landmark}</Text>
        <TextInput style={s.input} value={landmark} onChangeText={(v) => { setLandmark(v); setErrors((e) => ({ ...e, landmark: undefined })); }}
          placeholder={B.landmarkPlaceholder} placeholderTextColor={T.ink3} maxLength={LANDMARK_MAX} testID="branch-landmark" />
        <View style={s.under}>
          <Text style={s.hint}>{B.landmarkHint}</Text>
          <Text style={s.count} testID="branch-landmark-count">{`${landmark.length}/${LANDMARK_MAX}`}</Text>
        </View>
        <FieldError text={errors.landmark || (dirty ? clientErrors.landmark : '')} />
        <View style={{ height: 14 }} />

        <OfferedStateCityFields
          stateId={stateId}
          cityId={cityId}
          stateName={branch?.stateName}
          cityName={branch?.cityName}
          onChange={({ stateId: sid, cityId: cid, cityName: cn }) => { setStateId(sid); setCityId(cid); setCityName(cn || ''); setErrors((e) => ({ ...e, city: undefined, state: undefined })); }}
          errors={{ state: errors.state || (dirty ? clientErrors.state : ''), city: errors.city || (dirty ? clientErrors.city : '') }}
          testIDPrefix="branch"
          cityLabel={B.city}
          cityHint={B.cityHint}
          citySheetTitle={B.city}
          beside={(
            <View>
              <Text style={base.label}>{B.pin}</Text>
              <TextInput style={s.input} value={String(pin || '')} onChangeText={(v) => { setPin(v.replace(/[^\d]/g, '').slice(0, 6)); setErrors((e) => ({ ...e, pincode: undefined })); }}
                placeholder={B.pinPlaceholder} placeholderTextColor={T.ink3} keyboardType="number-pad" maxLength={6} testID="branch-pin" />
              <FieldError text={errors.pincode || (dirty ? clientErrors.pincode : '')} />
            </View>
          )}
        />

        <View style={{ height: 14 }} />
        <Text style={base.label}>{B.phone}</Text>
        <TextInput style={s.input} value={phone} onChangeText={(v) => { setPhone(v.replace(/[^0-9]/g, '').slice(0, 10)); setErrors((e) => ({ ...e, phone: undefined })); }}
          placeholder="10 digits" placeholderTextColor={T.ink3} keyboardType="phone-pad" maxLength={10} testID="branch-phone" />
        <View style={s.under}><Text style={s.hint}>{B.phoneHint}</Text></View>
        <FieldError text={errors.phone || (dirty ? clientErrors.phone : '')} />

        <View style={s.blue} testID="branch-street-note"><Text style={s.blueText}>{B.streetNote}</Text></View>
        {branch?.isMain ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
            <StatusChip on label={B.main} /><Text style={[base.hint, { marginLeft: 8, marginBottom: 0 }]}>This is your main branch.</Text>
          </View>
        ) : null}
      </FormScroll>
      {toast}
      </FormArea>
      <SaveBar dirty={dirty} errorCount={errorCount} saving={saving && !sheet} onSave={save} label={B.save} />
      <MainBranchSheet
        visible={sheet}
        existing={mainBranch}
        fresh={{ name: name.trim() || 'New branch', cityName }}
        choice={choice}
        onChoose={setChoice}
        onSave={() => submit(choice === 'new')}
        onClose={() => setSheet(false)}
        busy={saving}
      />
    </View>
  );
}

const s = StyleSheet.create({
  input: { fontFamily: fonts.sansMedium, fontSize: 15, color: T.ink, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: T.bg },
  multi: { minHeight: 84, textAlignVertical: 'top' },
  under: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 6 },
  hint: { flex: 1, fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, lineHeight: 17, marginRight: 10 },
  count: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3 },
  blue: { backgroundColor: T.state.waiting.bg, borderRadius: 10, padding: 12, marginTop: 16 },
  blueText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: T.state.waiting.fg, lineHeight: 18 },
});
const ms = StyleSheet.create({
  sub: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 2 },
  tick: { fontFamily: fonts.sansBold, fontSize: 15, color: T.ink, marginLeft: 8 },
});
