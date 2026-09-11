/**
 * ProfileInfoScreen — A8: photo (JPG/PNG ≤ 5 MB), full name*, bio (≤ 150), city (Google
 * search → canonical city; new cities are added to INFLX), Instagram (verified, locked),
 * YouTube, and her measured numbers (read-only).
 * Contract: features/item3-discovery-profiles-groups · prompt §6.1 A8
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi, uploadFile } from '../../services/api';
import { FieldError, Section } from '../../components/settings/primitives';
import { SaveBar, useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { COPY, shortDate } from '../../components/settings/copy';
import useUnsavedGuard from '../../hooks/useUnsavedGuard';
import ImagePickerField from '../../components/discovery/ImagePickerField';
import PlaceSearchField from '../../components/discovery/PlaceSearchField';
import { StatTriple } from '../../components/discovery/bits';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { C3, MSG3 } from '../../components/discovery/copy3';

const I = C3.creatorProfile.info;
const BIO_MAX = 150;

export default function ProfileInfoScreen({ navigation }) {
  const [status, setStatus] = useState('loading');
  const [inf, setInf] = useState(null);
  const [f, setF] = useState({ full_name: '', bio: '', youtube_handle: '' });
  const [place, setPlace] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [done, setDone] = useState(false);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await influencerApi.getMe();
    if (!r.success) { setStatus('error'); return; }
    const me = r.data?.influencer || r.data;
    setInf(me);
    setF({ full_name: me.full_name || me.name || '', bio: me.bio || '', youtube_handle: me.youtube_handle || '' });
    setStatus('ready');
  }, []);
  useEffect(() => { load(); }, [load]);

  const initial = inf ? { full_name: inf.full_name || inf.name || '', bio: inf.bio || '', youtube_handle: inf.youtube_handle || '' } : f;
  const dirty = !!place || Object.keys(f).some(k => f[k] !== initial[k]);
  useUnsavedGuard(navigation, dirty && !done);
  const clientErrors = {
    full_name: f.full_name.trim() ? '' : MSG3.FULL_NAME,
    bio: f.bio.length > BIO_MAX ? MSG3.BIO : '',
    place_id: place || inf?.city_id || inf?.city ? '' : MSG3.CITY,
  };
  const errorCount = Object.values(clientErrors).filter(Boolean).length;
  const set = (k) => (v) => { setF(prev => ({ ...prev, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };

  async function save() {
    const payload = {};
    if (f.full_name !== initial.full_name) payload.full_name = f.full_name.trim();
    if (f.bio !== initial.bio) payload.bio = f.bio.trim();
    if (f.youtube_handle !== initial.youtube_handle) payload.youtube_handle = f.youtube_handle.trim() || null;
    if (place) payload.place_id = place.placeId;
    setSaving(true);
    const r = await influencerApi.updateMe(payload);
    setSaving(false);
    if (!r.success) {
      const field = r.error?.field;
      if (field) setErrors({ [field]: r.error.message });
      else if (r.error?.code === 'STATE_UNKNOWN') setErrors({ place_id: MSG3.STATE_UNKNOWN });
      else show(r.error?.message || COPY.saveFailed);
      return;
    }
    setDone(true);
    const city = r.data?.cityAdded && place?.city?.name ? place.city.name : null;
    navigation.navigate('ProfileMain', { toast: city ? C3.toasts.cityAdded(city) : 'Saved.' });
  }

  async function pickPhoto(asset) {
    setPhotoBusy(true);
    try {
      const fileType = asset.type || 'image/jpeg';
      const u = await influencerApi.getProfileImageUploadUrl({ content_type: fileType });
      if (!u.success) throw new Error(u.error?.message || MSG3.IMAGE);
      const { url, method, key } = u.data;
      await uploadFile(url, method, asset.uri, asset.fileName || 'photo.jpg', fileType, key);
      const r = await influencerApi.updateMe({ profile_image_key: key });
      if (!r.success) throw new Error(r.error?.message || MSG3.IMAGE);
      const me = r.data?.influencer || r.data;
      setInf(prev => ({ ...prev, profile_image_url: me.profile_image_url }));
    } finally { setPhotoBusy(false); }
  }

  if (status === 'loading') return <View style={base.screen}><Header title={I.title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={I.title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const cityValue = place || (inf.city_name ? { city: { name: inf.city_name }, state: inf.state_name ? { name: inf.state_name } : null } : (inf.city ? { city: { name: inf.city }, state: inf.state ? { name: inf.state } : null } : null));
  const name = f.full_name || inf.instagram_handle || 'Creator';

  return (
    <View style={base.screen} testID="profile-info">
      <Header title={I.title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[base.body, { paddingBottom: 140 }]} keyboardShouldPersistTaps="handled">
        <ImagePickerField label={I.photo} hint={I.photoHint} name={name} url={inf.profile_image_url} onPick={pickPhoto} busy={photoBusy} changeLabel={I.change} testID="photo" />
        <View style={{ height: 16 }} />
        <Text style={base.label}>{I.name}</Text>
        <TextInput style={s.input} value={f.full_name} onChangeText={set('full_name')} placeholderTextColor={T.ink3} testID="field-name" />
        <FieldError text={errors.full_name || (dirty ? clientErrors.full_name : '')} />
        <View style={{ height: 14 }} />
        <Text style={base.label}>{I.bio}</Text>
        <TextInput style={[s.input, s.multi]} value={f.bio} onChangeText={set('bio')} multiline placeholderTextColor={T.ink3} testID="field-bio" />
        <Text style={[s.counter, f.bio.length > BIO_MAX && { color: T.danger }]}>{f.bio.length} / {BIO_MAX}</Text>
        <FieldError text={errors.bio || clientErrors.bio} />
        <View style={{ height: 14 }} />
        <PlaceSearchField mode="city" label={I.city} placeholder="Search your city" value={cityValue} onResolved={setPlace}
          error={errors.place_id || (dirty && !place ? clientErrors.place_id : '')} testID="field-city" />
        <Text style={base.hint}>{I.cityHint}</Text>
        <View style={{ height: 14 }} />
        <Text style={base.label}>{I.ig}</Text>
        <View style={s.locked}><Text style={s.lockedText}>🔒 {inf.instagram_handle ? `@${inf.instagram_handle}` : '—'}</Text></View>
        <View style={{ height: 14 }} />
        <Text style={base.label}>{I.yt}</Text>
        <TextInput style={s.input} value={f.youtube_handle} onChangeText={set('youtube_handle')} placeholder="@yourchannel" placeholderTextColor={T.ink3} autoCapitalize="none" testID="field-youtube" />
        <FieldError text={errors.youtube_handle} />

        <Section title={I.numbers}>
          <Text style={s.measured}>{I.measured}</Text>
          <StatTriple instagram={inf.followers_count} youtube={inf.youtube_subscribers} engagement={inf.engagement_rate} />
          <Text style={[base.hint, { marginTop: 8 }]} testID="numbers-hint">{inf.measured_at ? I.numbersHint(shortDate(inf.measured_at)) : I.numbersHintNoDate}</Text>
        </Section>
      </ScrollView>
      <SaveBar dirty={dirty} errorCount={dirty ? errorCount : 0} saving={saving} onSave={save} label={I.save} />
      {toast}
    </View>
  );
}

const s = StyleSheet.create({
  input: { fontFamily: fonts.sansMedium, fontSize: 15, color: T.ink, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: T.bg },
  multi: { minHeight: 80, textAlignVertical: 'top' },
  counter: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink3, textAlign: 'right', marginTop: 4 },
  locked: { backgroundColor: T.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  lockedText: { fontFamily: fonts.sansMedium, fontSize: 14, color: T.ink2 },
  measured: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: T.ink2 },
});
