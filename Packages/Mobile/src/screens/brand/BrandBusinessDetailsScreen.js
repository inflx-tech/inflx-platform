/**
 * BrandBusinessDetailsScreen — A2: logo (JPG/PNG ≤ 5 MB, uploaded straight to storage and
 * checked again by the server), brand name*, about (≤ 200), contact person*, GSTIN, and the
 * locked phone (the login number, masked) and major category.
 * Contract: features/item3-discovery-profiles-groups · prompt §6.1 A2
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi, uploadFile } from '../../services/api';
import { FieldError } from '../../components/settings/primitives';
import { SaveBar, useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { COPY } from '../../components/settings/copy';
import { applyServerError } from '../../utils/serverError';
import useUnsavedGuard from '../../hooks/useUnsavedGuard';
import ImagePickerField from '../../components/discovery/ImagePickerField';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { C3, MSG3, maskPhone } from '../../components/discovery/copy3';

const D = C3.brandProfile.details;
const ABOUT_MAX = 200;

function Field({ label, value, onChangeText, error, testID, multiline, maxLength, hint, counter, autoCapitalize }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={base.label}>{label}</Text>
      <TextInput style={[s.input, multiline && s.multi]} value={value} onChangeText={onChangeText} placeholderTextColor={T.ink3}
        multiline={multiline} maxLength={maxLength} autoCapitalize={autoCapitalize} testID={testID} />
      {counter != null ? <Text style={[s.counter, counter > ABOUT_MAX && { color: T.danger }]}>{counter} / {ABOUT_MAX}</Text> : null}
      {hint ? <Text style={base.hint}>{hint}</Text> : null}
      <FieldError text={error} />
    </View>
  );
}
function Locked({ label, value }) {
  return (
    <View style={{ flex: 1, marginBottom: 14 }}>
      <Text style={base.label}>{label}</Text>
      <View style={s.locked}><Text style={s.lockedText}>🔒 {value}</Text></View>
    </View>
  );
}

export default function BrandBusinessDetailsScreen({ navigation }) {
  const [status, setStatus] = useState('loading');
  const [brand, setBrand] = useState(null);
  const [f, setF] = useState({ business_name: '', about: '', contact_person: '', gstin: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [done, setDone] = useState(false);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await brandApi.getMe();
    if (!r.success) { setStatus('error'); return; }
    const b = r.data.brand;
    setBrand(b);
    setF({ business_name: b.business_name || '', about: b.about || '', contact_person: b.contact_person || b.listing_data?.contact_person_name || '', gstin: b.gstin || '' });
    setStatus('ready');
  }, []);
  useEffect(() => { load(); }, [load]);

  const initial = brand ? { business_name: brand.business_name || '', about: brand.about || '', contact_person: brand.contact_person || brand.listing_data?.contact_person_name || '', gstin: brand.gstin || '' } : f;
  const dirty = Object.keys(f).some(k => f[k] !== initial[k]);
  useUnsavedGuard(navigation, dirty && !done);
  const clientErrors = {
    business_name: f.business_name.trim() ? '' : MSG3.BRAND_NAME,
    contact_person: f.contact_person.trim() ? '' : MSG3.CONTACT,
    about: f.about.length > ABOUT_MAX ? MSG3.ABOUT : '',
  };
  const errorCount = Object.values(clientErrors).filter(Boolean).length;
  const set = (k) => (v) => { setF(prev => ({ ...prev, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };

  async function save() {
    const payload = {};
    for (const k of Object.keys(f)) if (f[k] !== initial[k]) payload[k] = k === 'about' ? (f[k].trim() || null) : f[k].trim();
    setSaving(true);
    const r = await brandApi.updateMe(payload);
    setSaving(false);
    if (!r.success) {
      applyServerError(r.error, { fields: ['business_name', 'about', 'contact_person', 'gstin'], setErrors, show, fallback: COPY.saveFailed });
      return;
    }
    setDone(true);
    navigation.navigate('BrandProfile', { toast: 'Saved.' });
  }

  async function pickLogo(asset) {
    setLogoBusy(true);
    try {
      const fileName = asset.fileName || 'logo.jpg';
      const fileType = asset.type || 'image/jpeg';
      const size = Number(asset.fileSize) || 0;
      const u = await brandApi.getLogoUploadUrl(fileName, fileType, size);
      if (!u.success) throw new Error(u.error?.message || MSG3.IMAGE);
      await uploadFile(u.data.url, u.data.method, asset.uri, fileName, fileType, u.data.key);
      const a = await brandApi.createLogoAsset({ title: 'Brand logo', file_r2_key: u.data.key, file_name: fileName, file_type: fileType, file_size_bytes: size });
      if (!a.success) throw new Error(a.error?.message || MSG3.IMAGE);
      const r = await brandApi.updateMe({ logo_asset_id: a.data.asset.id });
      if (!r.success) throw new Error(r.error?.message || MSG3.IMAGE);
      setBrand(prev => ({ ...prev, logo_url: (r.data.brand || r.data).logo_url }));
    } finally { setLogoBusy(false); }
  }
  async function removeLogo() {
    setLogoBusy(true);
    const r = await brandApi.updateMe({ logo_asset_id: null });
    setLogoBusy(false);
    if (!r.success) { show(r.error?.message || COPY.saveFailed); return; }
    setBrand(prev => ({ ...prev, logo_url: null }));
  }

  if (status === 'loading') return <View style={base.screen}><Header title={D.title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={D.title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  return (
    <View style={base.screen}>
      <Header title={D.title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[base.body, { paddingBottom: 140 }]} keyboardShouldPersistTaps="handled">
        <ImagePickerField label={D.logo} hint={D.logoHint} name={brand.business_name} url={brand.logo_url} onPick={pickLogo} onRemove={removeLogo}
          busy={logoBusy} changeLabel={D.change} removeLabel={D.remove} testID="logo" />
        <View style={{ height: 16 }} />
        <Field label={D.name} value={f.business_name} onChangeText={set('business_name')} error={errors.business_name || (dirty ? clientErrors.business_name : '')} testID="field-name" />
        <Field label={D.about} value={f.about} onChangeText={set('about')} multiline counter={f.about.length} hint={D.aboutHint} error={errors.about || clientErrors.about} testID="field-about" />
        <Field label={D.contact} value={f.contact_person} onChangeText={set('contact_person')} error={errors.contact_person || (dirty ? clientErrors.contact_person : '')} testID="field-contact" />
        <Field label={D.gstin} value={f.gstin} onChangeText={set('gstin')} autoCapitalize="characters" error={errors.gstin} testID="field-gstin" />
        <View style={{ flexDirection: 'row' }}>
          <Locked label={D.phone} value={maskPhone(brand.login_phone || brand.phone)} />
          <View style={{ width: 12 }} />
          <Locked label={D.major} value="Fashion" />
        </View>
        <Text style={base.hint}>{D.lockedHint}</Text>
      </ScrollView>
      <SaveBar dirty={dirty} errorCount={dirty ? errorCount : 0} saving={saving} onSave={save} label={D.save} />
      {toast}
    </View>
  );
}

const s = StyleSheet.create({
  input: { fontFamily: fonts.sansMedium, fontSize: 15, color: T.ink, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: T.bg },
  multi: { minHeight: 90, textAlignVertical: 'top' },
  counter: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink3, textAlign: 'right', marginTop: 4 },
  locked: { backgroundColor: T.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  lockedText: { fontFamily: fonts.sansMedium, fontSize: 14, color: T.ink2 },
});
