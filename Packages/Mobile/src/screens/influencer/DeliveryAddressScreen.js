/**
 * DeliveryAddressScreen — the delivery address a creator keeps in her profile (board P2, P3).
 * Contract: features/creator-address-bank-save · 03-expected-outputs.md (A1–A5)
 *
 * Until now she typed her street address into every Remote collaboration from nothing. She keeps
 * one here; the Remote form starts from it, and she can still change it there for one parcel.
 * Only she sees this screen's address — a brand gets one only when she sends it for a collab.
 *
 * It asks what the Remote form asks (item 11's R3), in item 11's words, so an address that saves
 * here is one that form will take. The courier check is not made here — whether a courier reaches
 * her depends on which store is sending, and is asked on each collaboration as before.
 *
 * GET / PUT / DELETE /influencers/me/delivery-address.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { FieldError } from '../../components/settings/primitives';
import { ConfirmSheet } from '../../components/settings/sheets';
import { SaveBar, useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { FormScroll, FormArea } from '../../components/shell/FormScroll';
import { COPY } from '../../components/settings/copy';
import useUnsavedGuard from '../../hooks/useUnsavedGuard';
import OfferedStateCityFields, { MSG_STATE, MSG_CITY } from '../../components/registration/OfferedStateCityFields';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { DELIVERY_STREET_MAX } from '../../utils/storeAddress';
import { C11, MSG11 } from '../../components/remote/copy11';
import { ADDR } from '../../components/profile/addressBankCopy';

const NOTE_MAX = 200;
const L = C11.creator;
const tenOf = (v) => String(v || '').replace(/\D/g, '').slice(-10);

/** The form for an address she keeps, or — with none — what an empty form starts from. */
export function formOf(address, prefill) {
  const a = address || {};
  const p = address ? {} : (prefill || {});
  return {
    name: a.name || p.name || '', phone: tenOf(a.phone || p.phone),
    street: a.street || '', pincode: a.pincode || '',
    stateId: a.stateId != null ? a.stateId : (p.stateId != null ? p.stateId : null),
    cityId: a.cityId != null ? a.cityId : (p.cityId != null ? p.cityId : null),
    stateName: a.stateName || p.stateName || '', cityName: a.cityName || p.cityName || '',
    note: a.note || '',
  };
}
const KEYS = ['name', 'phone', 'street', 'pincode', 'stateId', 'cityId', 'note'];

export default function DeliveryAddressScreen({ navigation }) {
  const [status, setStatus] = useState('loading');
  const [kept, setKept] = useState(null);
  const [initial, setInitial] = useState(formOf(null, null));
  const [f, setF] = useState(formOf(null, null));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { toast, show } = useToast({ inFlow: true });

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await influencerApi.getDeliveryAddress();
    if (!r || !r.success) { setStatus('error'); return; }
    const start = formOf(r.data.address, r.data.prefill);
    setKept(r.data.address || null);
    setInitial(start);
    setF(start);
    setStatus('ready');
  }, []);
  useEffect(() => { load(); }, [load]);

  const dirty = KEYS.some((k) => String(f[k] == null ? '' : f[k]) !== String(initial[k] == null ? '' : initial[k]));
  const saved = useUnsavedGuard(navigation, dirty);

  const clientErrors = {
    name: f.name.trim() ? '' : MSG11.NAME_REQUIRED,
    phone: /^[6-9]\d{9}$/.test(tenOf(f.phone)) ? '' : MSG11.PHONE_REQUIRED,
    street: !f.street.trim() ? MSG11.STREET_REQUIRED : (f.street.trim().length > DELIVERY_STREET_MAX ? MSG11.STREET_LONG : ''),
    pincode: /^\d{6}$/.test(f.pincode) ? '' : MSG11.PINCODE_REQUIRED,
    state: f.stateId != null ? '' : MSG_STATE,
    city: f.cityId != null ? '' : MSG_CITY,
    note: f.note.length > NOTE_MAX ? MSG11.NOTE_LONG : '',
  };
  const errorCount = Object.values(clientErrors).filter(Boolean).length;
  const set = (k) => (v) => { setF((prev) => ({ ...prev, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })); };
  // A red line shows once she has started — an untouched empty form is not a page of errors.
  const lineFor = (k) => errors[k] || (dirty ? clientErrors[k] : '');

  async function save() {
    setSaving(true);
    const r = await influencerApi.saveDeliveryAddress({
      name: f.name.trim(), phone: tenOf(f.phone), street: f.street.trim(), pincode: f.pincode,
      stateId: f.stateId, cityId: f.cityId, note: f.note.trim() || null,
    });
    setSaving(false);
    if (!r || !r.success) {
      const err = (r && r.error) || {};
      const field = ({ stateId: 'state', cityId: 'city' })[err.field] || err.field;
      if (field && clientErrors[field] !== undefined) setErrors({ [field]: err.message });
      else show(err.message || COPY.saveFailed);
      return;
    }
    saved();
    navigation.navigate('ProfileMain', { toast: ADDR.saved });
  }

  async function remove() {
    setRemoving(true);
    const r = await influencerApi.removeDeliveryAddress();
    setRemoving(false);
    setAsking(false);
    if (!r || !r.success) { show((r && r.error && r.error.message) || COPY.saveFailed); return; }
    saved();
    navigation.navigate('ProfileMain', { toast: ADDR.removed });
  }

  if (status === 'loading') return <View style={base.screen}><Header title={ADDR.title} onBack={() => navigation.goBack()} /><Skeleton rows={6} />{toast}</View>;
  if (status === 'error') return <View style={base.screen}><Header title={ADDR.title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} />{toast}</View>;

  return (
    <View style={base.screen} testID="delivery-address">
      <Header title={ADDR.title} onBack={() => navigation.goBack()} />
      <FormArea>
        <FormScroll contentContainerStyle={base.body} testID="delivery-address-scroll">
          <Text style={s.lead}>{ADDR.lead}</Text>
          <View style={s.private} testID="addr-private"><Text style={s.privateText}>{ADDR.onlyYou}</Text></View>

          <Text style={base.label}>{L.nameLabel}</Text>
          <TextInput style={s.input} value={f.name} onChangeText={set('name')} placeholderTextColor={T.ink3} maxLength={80} testID="addr-name" />
          <FieldError text={lineFor('name')} />
          <View style={s.gap} />

          <Text style={base.label}>{L.phoneLabel}</Text>
          <TextInput style={s.input} value={f.phone} onChangeText={(v) => set('phone')(v.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" maxLength={10} placeholderTextColor={T.ink3} testID="addr-phone" />
          <Text style={base.hint}>{ADDR.phoneHint}</Text>
          <FieldError text={lineFor('phone')} />
          <View style={s.gap} />

          <View style={s.labelRow}>
            <Text style={base.label}>{L.streetLabel}</Text>
            <Text style={s.counter}>{f.street.length}/{DELIVERY_STREET_MAX}</Text>
          </View>
          <TextInput style={[s.input, s.multi]} value={f.street} onChangeText={set('street')} multiline maxLength={DELIVERY_STREET_MAX} placeholderTextColor={T.ink3} testID="addr-street" />
          <Text style={base.hint}>{L.streetHint}</Text>
          <FieldError text={lineFor('street')} />
          <View style={s.gap} />

          <Text style={base.label}>{L.pincodeLabel}</Text>
          <TextInput style={s.input} value={f.pincode} onChangeText={(v) => set('pincode')(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholderTextColor={T.ink3} testID="addr-pincode" />
          <FieldError text={lineFor('pincode')} />
          <View style={s.gap} />

          <OfferedStateCityFields
            stateId={f.stateId}
            cityId={f.cityId}
            stateName={f.stateName}
            cityName={f.cityName}
            onChange={({ stateId, cityId, stateName, cityName }) => {
              setF((prev) => ({ ...prev, stateId, cityId, stateName: stateName || prev.stateName, cityName: cityName || '' }));
              setErrors((e) => ({ ...e, state: '', city: '' }));
            }}
            errors={{ state: lineFor('state'), city: lineFor('city') }}
            testIDPrefix="addr"
            cityLabel={L.cityLabel}
            cityHint={ADDR.cityHint}
          />
          <View style={s.gap} />

          <View style={s.labelRow}>
            <Text style={base.label}>{L.noteLabel}</Text>
            <Text style={s.counter}>{f.note.length}/{NOTE_MAX}</Text>
          </View>
          <TextInput style={[s.input, s.multi]} value={f.note} onChangeText={set('note')} multiline maxLength={NOTE_MAX} placeholder={L.notePlaceholder} placeholderTextColor={T.ink3} testID="addr-note" />
          <FieldError text={lineFor('note')} />

          {kept ? (
            <TouchableOpacity style={s.remove} onPress={() => setAsking(true)} accessibilityRole="button" testID="addr-remove">
              <Text style={s.removeText}>{ADDR.remove}</Text>
            </TouchableOpacity>
          ) : null}
        </FormScroll>
        {toast}
      </FormArea>
      <SaveBar dirty={dirty} errorCount={dirty ? errorCount : 0} saving={saving} onSave={save} label={ADDR.save} />
      <ConfirmSheet visible={asking} danger title={ADDR.removeTitle} body={ADDR.removeBody}
        confirmLabel={ADDR.removeConfirm} cancelLabel={ADDR.removeCancel}
        onConfirm={() => { if (!removing) remove(); }} onCancel={() => setAsking(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  lead: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink2, lineHeight: 19 },
  private: { backgroundColor: T.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10, marginBottom: 18 },
  privateText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: T.ink2, lineHeight: 17 },
  input: { fontFamily: fonts.sansMedium, fontSize: 15, color: T.ink, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: T.bg },
  multi: { minHeight: 64, textAlignVertical: 'top' },
  gap: { height: 14 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  counter: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink3 },
  remove: { paddingVertical: 18, marginTop: 6 },
  removeText: { fontFamily: fonts.sansSemiBold, fontSize: 14.5, color: T.danger },
});
