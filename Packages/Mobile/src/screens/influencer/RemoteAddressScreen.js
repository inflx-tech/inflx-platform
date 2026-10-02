/**
 * Item 11 — R3, R4a, R4b: her delivery address.
 * Contract: features/item11-remote · rules v1.27 §11.2, §2B, §28
 *
 * The first street address INFLX has ever asked a creator for, so the screen says plainly what
 * happens to it: it goes to this brand and to the courier, and it cannot be changed afterwards.
 *
 * The state and city fields are item 2B's own component, imported verbatim — the same two lists
 * her profile, the brand's branches and every distance rule already read. The pincode is checked
 * against the courier network as she leaves the field, and again, authoritatively, on the server
 * when she sends.
 *
 * ui-walk-fixes (board C, rule 2): the form is a FormScroll — the box she is typing in, with the
 * hint or the red line under it, stays in view above the keypad. Nothing floats here ("Review and
 * send" is the last thing IN the form), so nothing else changes.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { PrimaryButton, SecondaryButton } from '../../components/settings/primitives';
import { Skeleton, LoadError, useToast } from '../../components/settings/feedback';
import { FormScroll } from '../../components/shell/FormScroll';
import { COPY } from '../../components/settings/copy';
// §2B's own two fields — the SAME component registration, the profile and the branch editor
// use. StateCityPicker (components/settings) is item 8A's multi-select "cities I can travel
// to" and is a different question entirely.
import OfferedStateCityFields, { MSG_STATE, MSG_CITY } from '../../components/registration/OfferedStateCityFields';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { StateBox7 } from '../../components/agreement/bits7';
import { C11, MSG11 } from '../../components/remote/copy11';

export default function RemoteAddressScreen({ navigation, route }) {
  const { ciId, correcting } = route.params || {};
  const [sh, setSh] = useState(null);
  const [status, setStatus] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [errors, setErrors] = useState({});
  const [coverage, setCoverage] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', street: '', pincode: '', stateId: null, cityId: null, stateName: '', cityName: '', note: '', sizes: '' });
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    setStatus((st) => (st === 'ready' ? 'ready' : 'loading'));
    const r = await influencerApi.myRemote(ciId);
    if (!r || !r.success) { setStatus('error'); return; }
    setSh(r.data.shoot);
    // R3: name and number arrive filled in; state and city come from her profile.
    const p = r.data.shoot.prefill || {};
    const a = r.data.shoot.address || {};
    setForm((f) => ({
      ...f,
      name: f.name || a.name || p.name || '',
      phone: f.phone || a.phone || p.phone || '',
      street: f.street || (correcting ? '' : a.street || ''),
      pincode: f.pincode || (correcting ? '' : a.pincode || ''),
      stateId: f.stateId || p.stateId || null,
      cityId: f.cityId || p.cityId || null,
      note: f.note || a.note || '',
      sizes: f.sizes || a.sizes || '',
    }));
    setStatus('ready');
  }, [ciId, correcting]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => { const n = { ...e }; delete n[k]; return n; }); };

  /** The coverage check as she leaves the pincode field (R3 → R4b). */
  async function checkPincode() {
    if (!/^\d{6}$/.test(form.pincode)) { setCoverage(null); return; }
    const r = await influencerApi.myRemoteCoverage(ciId, form.pincode);
    if (r && r.success) setCoverage(r.data);
  }

  /** What the app can check before it asks. The server checks all of it again. */
  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = MSG11.NAME_REQUIRED;
    if (!/^[6-9]\d{9}$/.test(String(form.phone).replace(/\D/g, '').slice(-10))) e.phone = MSG11.PHONE_REQUIRED;
    if (!form.street.trim()) e.street = MSG11.STREET_REQUIRED;
    if (!/^\d{6}$/.test(form.pincode)) e.pincode = MSG11.PINCODE_REQUIRED;
    if (!form.stateId) e.stateId = MSG_STATE;
    if (!form.cityId) e.cityId = MSG_CITY;
    if (form.note.length > 200) e.note = MSG11.NOTE_LONG;
    if (form.sizes.length > 100) e.sizes = MSG11.SIZES_LONG;
    // R4b: a pincode couriers cannot reach is a BLOCK, on the field, with the server's words.
    if (coverage && coverage.delivers === false) e.pincode = coverage.message;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    setBusy(true);
    const body = {
      name: form.name.trim(), phone: String(form.phone).replace(/\D/g, '').slice(-10),
      street: form.street.trim(), pincode: form.pincode,
      stateId: form.stateId, cityId: form.cityId,
      note: form.note.trim() || null, sizes: form.sizes.trim() || null,
    };
    const r = correcting ? await influencerApi.myRemoteCorrect(ciId, body) : await influencerApi.myRemoteAddress(ciId, body);
    setBusy(false);
    if (!r || !r.success) {
      setSheet(false);
      const err = (r && r.error) || {};
      if (err.field) setErrors({ [err.field]: err.message });
      show(err.message || COPY.saveFailed);
      return;
    }
    setSheet(false);
    navigation.navigate('MyRemote', { ciId, toast: correcting ? 'Address corrected.' : 'Address sent.' });
  }

  if (status === 'loading') return <View style={base.screen}><Header title={C11.creator.formTitle} onBack={() => navigation.goBack()} /><Skeleton rows={6} /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={C11.creator.formTitle} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const brandName = (sh && sh.brand && sh.brand.name) || 'the brand';
  const blocked = coverage && coverage.delivers === false;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={base.screen} testID="remote-address">
        <Header title={C11.creator.formTitle} onBack={() => navigation.goBack()} />
        <FormScroll contentContainerStyle={{ padding: 18, paddingBottom: 40 }} testID="remote-address-scroll">

          <Field label={C11.creator.nameLabel} value={form.name} onChange={(v) => set('name', v)} error={errors.name} testID="f-name" />

          <Field label={C11.creator.phoneLabel} value={form.phone} onChange={(v) => set('phone', v)}
            hint={C11.creator.phoneHint} keyboardType="phone-pad" maxLength={10} error={errors.phone} testID="f-phone" />

          <Field label={C11.creator.streetLabel} value={form.street} onChange={(v) => set('street', v)}
            multiline error={errors.street} testID="f-street" />

          <Field label={C11.creator.pincodeLabel} value={form.pincode} onChange={(v) => set('pincode', v.replace(/\D/g, '').slice(0, 6))}
            onBlur={checkPincode} keyboardType="number-pad" maxLength={6} error={errors.pincode} testID="f-pincode" />

          {/* R4b · the two coverage answers, in the server's words. */}
          {coverage && coverage.delivers && !coverage.returnPickup
            ? <StateBox7 tone="move" text={coverage.message} testID="coverage-warn" />
            : null}
          {coverage && coverage.delivers && coverage.returnPickup
            ? <StateBox7 tone="done" text={coverage.message} testID="coverage-ok" />
            : null}

          {/* §2B — the same two fields registration, the profile and the branch editor use. */}
          <OfferedStateCityFields
            stateId={form.stateId}
            cityId={form.cityId}
            stateName={form.stateName}
            cityName={form.cityName}
            onChange={({ stateId, cityId, stateName, cityName }) => {
              setForm((f) => ({ ...f, stateId, cityId, stateName: stateName || f.stateName, cityName: cityName || f.cityName }));
              setErrors((e) => { const n = { ...e }; delete n.stateId; delete n.cityId; return n; });
            }}
            errors={{ state: errors.stateId, city: errors.cityId }}
            testIDPrefix="f"
            cityLabel={C11.creator.cityLabel}
          />
          <Text style={s.hint}>{C11.creator.cityHint}</Text>

          <Field label={C11.creator.noteLabel} value={form.note} onChange={(v) => set('note', v)}
            placeholder={C11.creator.notePlaceholder} multiline maxLength={200}
            counter={`${form.note.length}/200`} error={errors.note} testID="f-note" />

          <Field label={C11.creator.sizesLabel} value={form.sizes} onChange={(v) => set('sizes', v)}
            placeholder={C11.creator.sizesPlaceholder} hint={C11.creator.sizesHint(brandName)} maxLength={100}
            counter={`${form.sizes.length}/100`} error={errors.sizes} testID="f-sizes" />

          <View style={{ marginTop: 18 }}>
            <PrimaryButton label={C11.creator.reviewAndSend} disabled={blocked}
              onPress={() => { if (validate()) setSheet(true); }} testID="review-send" />
          </View>
        </FormScroll>

        {/* R4a — the confirm sheet IS the review. There is no server-side draft. */}
        <ConfirmSheet
          visible={sheet}
          form={form}
          coverage={coverage}
          brandName={brandName}
          busy={busy}
          onClose={() => setSheet(false)}
          onSend={submit}
        />
        {toast}
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, onBlur, hint, error, placeholder, multiline, keyboardType, maxLength, counter, testID }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={s.labelRow}>
        <Text style={s.label}>{label}</Text>
        {counter ? <Text style={s.counter}>{counter}</Text> : null}
      </View>
      <TextInput
        value={String(value ?? '')}
        onChangeText={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={T.ink3}
        multiline={multiline}
        keyboardType={keyboardType}
        maxLength={maxLength}
        style={[s.input, multiline && { minHeight: 64, textAlignVertical: 'top' }, error && { borderColor: T.state.declined.fg }]}
        testID={testID}
      />
      {hint && !error ? <Text style={s.hint}>{hint}</Text> : null}
      {error ? <Text style={s.error} testID={`${testID}-error`}>{error}</Text> : null}
    </View>
  );
}

/** R4a. Everything she is about to send, the coverage answer, and the one warning that matters. */
function ConfirmSheet({ visible, form, coverage, brandName, busy, onClose, onSend }) {
  if (!visible) return null;
  return (
    <View style={s.backdrop} testID="confirm-sheet">
      <View style={s.sheet}>
        <Text style={s.sheetTitle}>{C11.creator.confirmTitle}</Text>
        <View style={s.review}>
          <Text style={s.reviewName}>{form.name}</Text>
          <Text style={s.reviewLine}>{form.phone}</Text>
          <Text style={s.reviewLine}>{form.street}</Text>
          <Text style={s.reviewLine}>{[form.cityName, form.stateName, form.pincode].filter(Boolean).join(', ')}</Text>
          {form.note ? <Text style={s.reviewNote}>{form.note}</Text> : null}
          {form.sizes ? <Text style={s.reviewNote}>{form.sizes}</Text> : null}
        </View>
        {coverage ? (
          <StateBox7
            tone={coverage.returnPickup ? 'done' : 'move'}
            text={coverage.returnPickup ? C11.creator.coverageOk(form.pincode) : C11.creator.coverageNoReturn(form.pincode, brandName)}
            testID="sheet-coverage"
          />
        ) : null}
        <StateBox7 tone="move" text={C11.creator.lockWarning(brandName)} testID="sheet-lock" />
        <View style={{ height: 10 }} />
        <PrimaryButton label={C11.creator.sendIt} onPress={onSend} busy={busy} testID="sheet-send" />
        <View style={{ height: 8 }} />
        <SecondaryButton label={C11.creator.notYet} onPress={onClose} disabled={busy} testID="sheet-cancel" />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink, marginBottom: 5 },
  counter: { fontFamily: fonts.sansRegular, fontSize: 11, color: T.ink3 },
  input: { borderWidth: 1, borderColor: T.border, borderRadius: 10, padding: 12,
    fontFamily: fonts.sansRegular, fontSize: 14, color: T.ink },
  hint: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink3, marginTop: 5, lineHeight: 16 },
  error: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.state.declined.fg, marginTop: 5, lineHeight: 16 },

  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, paddingBottom: 30 },
  sheetTitle: { fontFamily: fonts.sansBold, fontSize: 17, color: T.ink, marginBottom: 12 },
  review: { backgroundColor: T.surface, borderRadius: 12, padding: 14, marginBottom: 12 },
  reviewName: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink },
  reviewLine: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, marginTop: 3 },
  reviewNote: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 6 },
});
