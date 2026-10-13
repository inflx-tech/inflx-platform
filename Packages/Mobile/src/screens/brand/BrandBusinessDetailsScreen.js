/**
 * BrandBusinessDetailsScreen — B4: logo (JPG/PNG ≤ 5 MB, uploaded straight to storage and
 * checked again by the server), business name*, about (≤ 200), contact person*, email (new,
 * collected only), the locked phone — the login number, which IS the business number — and the
 * locked business type. GSTIN left this screen for the Wallet tab.
 * Contract: features/registration-and-profile · features/item3-discovery-profiles-groups
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi, uploadFile } from '../../services/api';
import { FieldError } from '../../components/settings/primitives';
import { SaveBar, useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { FormScroll, FormArea } from '../../components/shell/FormScroll';
import { COPY } from '../../components/settings/copy';
import { applyServerError } from '../../utils/serverError';
import useUnsavedGuard from '../../hooks/useUnsavedGuard';
import useRouteToast from '../../hooks/useRouteToast';
import ImagePickerField from '../../components/discovery/ImagePickerField';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { C3, MSG3 } from '../../components/discovery/copy3';
import { maskIndian } from '../shared/ChangeNumberScreen';

const D = C3.brandProfile.details;
const ABOUT_MAX = 200;
const MSG_EMAIL = 'Enter a valid email address.';

function Field({ label, value, onChangeText, error, testID, multiline, maxLength, hint, counter, autoCapitalize, keyboardType, placeholder }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={base.label}>{label}</Text>
      <TextInput style={[s.input, multiline && s.multi]} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={T.ink3}
        multiline={multiline} maxLength={maxLength} autoCapitalize={autoCapitalize} keyboardType={keyboardType} autoCorrect={false} testID={testID} />
      {counter != null ? <Text style={[s.counter, counter > ABOUT_MAX && { color: T.danger }]}>{counter} / {ABOUT_MAX}</Text> : null}
      {hint ? <Text style={base.hint}>{hint}</Text> : null}
      <FieldError text={error} />
    </View>
  );
}
/** A locked field; `action` draws a link beside the label (features/change-login-number N0). */
export function Locked({ label, value, hint, testID, action }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={s.labelRow}>
        <Text style={base.label}>{label}</Text>
        {action ? (
          <TouchableOpacity onPress={action.onPress} accessibilityRole="link" testID={action.testID} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.link}>{action.label}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={s.locked}><Text style={s.lockedText} testID={testID}>🔒 {value}</Text></View>
      {hint ? <Text style={base.hint}>{hint}</Text> : null}
    </View>
  );
}

const formOf = (b) => ({ business_name: b.business_name || '', about: b.about || '', contact_person: b.contact_person || b.listing_data?.contact_person_name || '', email: b.email || '' });

export default function BrandBusinessDetailsScreen({ navigation, route }) {
  const [status, setStatus] = useState('loading');
  const [brand, setBrand] = useState(null);
  const [f, setF] = useState(formOf({}));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const { toast, show } = useToast({ inFlow: true });

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await brandApi.getMe();
    if (!r.success) { setStatus('error'); return; }
    const b = r.data.brand;
    setBrand(b);
    setF(formOf(b));
    setStatus('ready');
  }, []);
  useEffect(() => { load(); }, [load]);
  // features/change-login-number N5 — coming back with a toast means the login number moved:
  // re-read /me so the phone tile shows the new number, then show the green line once.
  const returnedToast = route?.params?.toast;
  useFocusEffect(useCallback(() => { if (returnedToast) load(); }, [returnedToast, load]));
  useRouteToast(navigation, route, show);
  const changeNumber = () => navigation.navigate('ChangeNumber', { role: 'brand', returnTo: 'BrandBusinessDetails', phone: brand?.login_phone || brand?.phone || '' });

  const initial = brand ? formOf(brand) : f;
  const dirty = Object.keys(f).some(k => f[k] !== initial[k]);
  const saved = useUnsavedGuard(navigation, dirty);
  const clientErrors = {
    business_name: f.business_name.trim() ? '' : MSG3.BRAND_NAME,
    contact_person: f.contact_person.trim() ? '' : MSG3.CONTACT,
    about: f.about.length > ABOUT_MAX ? MSG3.ABOUT : '',
    email: f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()) ? MSG_EMAIL : '',
  };
  const errorCount = Object.values(clientErrors).filter(Boolean).length;
  const set = (k) => (v) => { setF(prev => ({ ...prev, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };

  async function save() {
    const payload = {};
    for (const k of Object.keys(f)) if (f[k] !== initial[k]) payload[k] = (k === 'about' || k === 'email') ? (f[k].trim() || null) : f[k].trim();
    setSaving(true);
    const r = await brandApi.updateMe(payload);
    setSaving(false);
    if (!r.success) {
      applyServerError(r.error, { fields: ['business_name', 'about', 'contact_person', 'email'], setErrors, show, fallback: COPY.saveFailed });
      return;
    }
    saved();
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

  if (status === 'loading') return <View style={base.screen}><Header title={D.title} onBack={() => navigation.goBack()} /><Skeleton />{toast}</View>;
  if (status === 'error') return <View style={base.screen}><Header title={D.title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} />{toast}</View>;

  return (
    <View style={base.screen}>
      <Header title={D.title} onBack={() => navigation.goBack()} />
      {/* ui-walk-fixes board C: the form scrolls in the room above the Save strip; nothing floats over it. */}
      <FormArea>
      <FormScroll contentContainerStyle={base.body}>
        <ImagePickerField label={brand.logo_url ? D.logo : 'Add a logo'} hint={D.logoHint} name={brand.business_name} url={brand.logo_url} onPick={pickLogo} onRemove={removeLogo}
          busy={logoBusy} changeLabel={D.change} removeLabel={D.remove} testID="logo" />
        <View style={{ height: 16 }} />
        <Field label={D.name} value={f.business_name} onChangeText={set('business_name')} error={errors.business_name || (dirty ? clientErrors.business_name : '')} testID="field-name" />
        <Field label={D.about} value={f.about} onChangeText={set('about')} multiline counter={f.about.length} placeholder="A line about your brand" hint={D.aboutHint} error={errors.about || clientErrors.about} testID="field-about" />
        <Field label={D.contact} value={f.contact_person} onChangeText={set('contact_person')} placeholder="Who should we ask for?" error={errors.contact_person || (dirty ? clientErrors.contact_person : '')} testID="field-contact" />
        <Field label={D.email} value={f.email} onChangeText={set('email')} placeholder="you@business.com" autoCapitalize="none" keyboardType="email-address" error={errors.email || clientErrors.email} testID="field-email" />
        {/* The login number IS the business number — brands.phone was never written by anything (spec §7). */}
        <Locked label={D.phone} value={maskIndian(brand.login_phone || brand.phone)} hint={D.phoneHint} testID="locked-phone"
          action={{ label: D.changeNumber, onPress: changeNumber, testID: 'change-number-link' }} />
        <Locked label={D.major} value="Fashion" testID="locked-type" />
      </FormScroll>
      {toast}
      </FormArea>
      <SaveBar dirty={dirty} errorCount={dirty ? errorCount : 0} saving={saving} onSave={save} label={D.save} />
    </View>
  );
}

const s = StyleSheet.create({
  input: { fontFamily: fonts.sansMedium, fontSize: 15, color: T.ink, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: T.bg },
  multi: { minHeight: 90, textAlignVertical: 'top' },
  counter: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink3, textAlign: 'right', marginTop: 4 },
  locked: { backgroundColor: T.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  lockedText: { fontFamily: fonts.sansMedium, fontSize: 14, color: T.ink2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { fontFamily: fonts.sansBold, fontSize: 13, color: T.state.waiting.fg, marginBottom: 8 },
});
