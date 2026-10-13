/**
 * BrandLinksScreen — the A1 "Links" row: website and Instagram, shown on the brand overview.
 * Contract: features/item3-discovery-profiles-groups · prompt §6.1
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { FieldError } from '../../components/settings/primitives';
import { SaveBar, useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { FormScroll, FormArea } from '../../components/shell/FormScroll';
import { COPY } from '../../components/settings/copy';
import { applyServerError } from '../../utils/serverError';
import useUnsavedGuard from '../../hooks/useUnsavedGuard';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { C3 } from '../../components/discovery/copy3';

const L = C3.brandProfile.linksScreen;

export default function BrandLinksScreen({ navigation }) {
  const [status, setStatus] = useState('loading');
  const [initial, setInitial] = useState({ website_url: '', instagram_handle: '' });
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const { toast, show } = useToast({ inFlow: true });

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await brandApi.getMe();
    if (!r.success) { setStatus('error'); return; }
    const v = { website_url: r.data.brand.website_url || '', instagram_handle: r.data.brand.instagram_handle || '' };
    setInitial(v); setF(v);
    setStatus('ready');
  }, []);
  useEffect(() => { load(); }, [load]);

  const dirty = f.website_url !== initial.website_url || f.instagram_handle !== initial.instagram_handle;
  const saved = useUnsavedGuard(navigation, dirty);

  async function save() {
    const payload = {};
    if (f.website_url !== initial.website_url) payload.website_url = f.website_url.trim() || null;
    if (f.instagram_handle !== initial.instagram_handle) payload.instagram_handle = f.instagram_handle.trim() || null;
    setSaving(true);
    const r = await brandApi.updateMe(payload);
    setSaving(false);
    if (!r.success) {
      applyServerError(r.error, { fields: ['website_url', 'instagram_handle'], setErrors, show, fallback: COPY.saveFailed });
      return;
    }
    saved();
    navigation.navigate('BrandProfile', { toast: 'Saved.' });
  }

  if (status === 'loading') return <View style={base.screen}><Header title={L.title} onBack={() => navigation.goBack()} /><Skeleton rows={3} /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={L.title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  return (
    <View style={base.screen}>
      <Header title={L.title} onBack={() => navigation.goBack()} />
      {/* ui-walk-fixes board C: the form scrolls in the room above the Save strip; nothing floats over it. */}
      <FormArea>
      <FormScroll contentContainerStyle={base.body}>
        <Text style={base.label}>{L.website}</Text>
        <TextInput style={s.input} value={f.website_url} onChangeText={(v) => { setF(p => ({ ...p, website_url: v })); setErrors({}); }} placeholder="https://" placeholderTextColor={T.ink3} autoCapitalize="none" keyboardType="url" testID="field-website" />
        <FieldError text={errors.website_url} />
        <View style={{ height: 16 }} />
        <Text style={base.label}>{L.instagram}</Text>
        <TextInput style={s.input} value={f.instagram_handle} onChangeText={(v) => { setF(p => ({ ...p, instagram_handle: v })); setErrors({}); }} placeholder="@yourbrand" placeholderTextColor={T.ink3} autoCapitalize="none" testID="field-instagram" />
        <FieldError text={errors.instagram_handle} />
      </FormScroll>
      {toast}
      </FormArea>
      <SaveBar dirty={dirty} errorCount={0} saving={saving} onSave={save} />
    </View>
  );
}

const s = StyleSheet.create({
  input: { fontFamily: fonts.sansMedium, fontSize: 15, color: T.ink, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: T.bg },
});
