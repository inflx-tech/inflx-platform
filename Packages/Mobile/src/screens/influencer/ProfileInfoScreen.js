/**
 * ProfileInfoScreen — A8: photo (JPG/PNG ≤ 5 MB), full name*, bio (≤ 150), city (Google
 * search → canonical city; new cities are added to INFLX), Instagram and YouTube (item 3b:
 * both editable; after approval a change, add or remove asks first — R6 — and the new
 * handle waits for INFLX's ownership check), and her measured numbers (read-only).
 * Contract: features/item3-discovery-profiles-groups · features/item3b-social-numbers
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi, uploadFile } from '../../services/api';
import { FieldError, Section } from '../../components/settings/primitives';
import { ConfirmSheet } from '../../components/settings/sheets';
import { SaveBar, useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { COPY, shortDate } from '../../components/settings/copy';
import useUnsavedGuard from '../../hooks/useUnsavedGuard';
import ImagePickerField from '../../components/discovery/ImagePickerField';
import PlaceSearchField from '../../components/discovery/PlaceSearchField';
import { StatTriple } from '../../components/discovery/bits';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { C3, MSG3 } from '../../components/discovery/copy3';
import { C3B, MSG3B, PLATFORM_LABEL, validInstagram, validYoutube } from '../../components/social/copy3b';

const I = C3.creatorProfile.info;
const BIO_MAX = 150;

/** What handle change the save would make for one platform: none | add | change | remove. */
export function handleAction(platform, initial, typed) {
  const norm = platform === 'instagram' ? validInstagram : validYoutube;
  const a = (initial || '').trim() ? norm(initial) : null;
  const b = (typed || '').trim() ? norm(typed) : null;
  if (!a && !b) return 'none';
  if (a && !b) return 'remove';
  if (!a && b) return 'add';
  return a === b ? 'none' : 'change';
}

export default function ProfileInfoScreen({ navigation, route }) {
  const focus = route?.params?.focus;
  const [status, setStatus] = useState('loading');
  const [inf, setInf] = useState(null);
  const [f, setF] = useState({ full_name: '', bio: '', youtube_handle: '', instagram_handle: '' });
  const [place, setPlace] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [confirmQueue, setConfirmQueue] = useState([]);
  const { toast, show } = useToast();
  const igRef = useRef(null), ytRef = useRef(null);

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await influencerApi.getMe();
    if (!r.success) { setStatus('error'); return; }
    const me = r.data?.influencer || r.data;
    setInf(me);
    setF({ full_name: me.full_name || me.name || '', bio: me.bio || '', youtube_handle: me.youtube_handle || '', instagram_handle: me.instagram_handle || '' });
    setStatus('ready');
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (status !== 'ready' || !focus) return;
    const t = setTimeout(() => { (focus === 'instagram' ? igRef : ytRef).current?.focus?.(); }, 300);
    return () => clearTimeout(t);
  }, [status, focus]);

  const initial = inf ? { full_name: inf.full_name || inf.name || '', bio: inf.bio || '', youtube_handle: inf.youtube_handle || '', instagram_handle: inf.instagram_handle || '' } : f;
  const dirty = !!place || Object.keys(f).some(k => f[k] !== initial[k]);
  useUnsavedGuard(navigation, dirty && !done);
  const igAction = handleAction('instagram', initial.instagram_handle, f.instagram_handle);
  const ytAction = handleAction('youtube', initial.youtube_handle, f.youtube_handle);
  const noneLeft = !f.instagram_handle.trim() && !f.youtube_handle.trim();
  const clientErrors = {
    full_name: f.full_name.trim() ? '' : MSG3.FULL_NAME,
    bio: f.bio.length > BIO_MAX ? MSG3.BIO : '',
    place_id: place || inf?.city_id || inf?.city ? '' : MSG3.CITY,
    instagram_handle: f.instagram_handle.trim() && !validInstagram(f.instagram_handle) ? MSG3B.INSTAGRAM_INVALID : (noneLeft ? MSG3B.LAST_ACCOUNT : ''),
    youtube_handle: f.youtube_handle.trim() && !validYoutube(f.youtube_handle) ? MSG3B.YOUTUBE_INVALID : '',
  };
  const errorCount = Object.values(clientErrors).filter(Boolean).length;
  const set = (k) => (v) => { setF(prev => ({ ...prev, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };
  const approved = inf?.user_status === 'approved';

  /** R6: after approval every handle change/add/remove asks first, one platform at a time. */
  function startSave() {
    const asks = [];
    if (approved) {
      for (const [platform, action] of [['instagram', igAction], ['youtube', ytAction]]) {
        if (action !== 'none') asks.push({ platform, action, handle: platform === 'instagram' ? validInstagram(f.instagram_handle) : validYoutube(f.youtube_handle) });
      }
    }
    if (asks.length) setConfirmQueue(asks); else save();
  }
  function confirmNext() {
    const [, ...rest] = confirmQueue;
    setConfirmQueue(rest);
    if (!rest.length) save();
  }

  async function save() {
    const payload = {};
    if (f.full_name !== initial.full_name) payload.full_name = f.full_name.trim();
    if (f.bio !== initial.bio) payload.bio = f.bio.trim();
    if (ytAction !== 'none') payload.youtube_handle = f.youtube_handle.trim() || null;
    if (igAction !== 'none') payload.instagram_handle = f.instagram_handle.trim() || null;
    if (place) payload.place_id = place.placeId;
    if (!Object.keys(payload).length) { setDone(true); navigation.navigate('ProfileMain', {}); return; }
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
  const ask = confirmQueue[0];
  const askLabel = ask ? PLATFORM_LABEL[ask.platform] : '';
  const sheet = !ask ? null : ask.action === 'remove'
    ? { title: C3B.r6.removeTitle(askLabel), body: C3B.r6.removeBody, confirm: C3B.r6.remove, danger: true }
    : ask.action === 'add'
      ? { title: C3B.r6.addTitle(askLabel), body: C3B.r6.addBody(ask.handle), confirm: C3B.r6.add }
      : { title: C3B.r6.changeTitle(askLabel), body: C3B.r6.changeBody(askLabel, ask.handle), confirm: C3B.r6.change };

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
        <View style={s.handleRow}>
          <Text style={s.at}>@</Text>
          <TextInput ref={igRef} style={s.handleInput} value={f.instagram_handle} onChangeText={(v) => set('instagram_handle')(v.replace(/\s/g, '').replace(/^@+/, ''))} placeholder="yourhandle" placeholderTextColor={T.ink3} autoCapitalize="none" autoCorrect={false} testID="field-instagram" />
        </View>
        <FieldError text={errors.instagram_handle || (dirty ? clientErrors.instagram_handle : '')} />
        <View style={{ height: 14 }} />
        <Text style={base.label}>{I.yt}</Text>
        <TextInput ref={ytRef} style={s.input} value={f.youtube_handle} onChangeText={(v) => set('youtube_handle')(v.replace(/\s/g, ''))} placeholder="@yourchannel or youtube.com/@yourchannel" placeholderTextColor={T.ink3} autoCapitalize="none" autoCorrect={false} testID="field-youtube" />
        <FieldError text={errors.youtube_handle || (dirty ? clientErrors.youtube_handle : '')} />

        <Section title={I.numbers}>
          <Text style={s.measured}>{I.measured}</Text>
          <StatTriple instagram={inf.followers_count} youtube={inf.youtube_subscribers} engagement={inf.engagement_rate} />
          <Text style={[base.hint, { marginTop: 8 }]} testID="numbers-hint">{inf.measured_at ? I.numbersHint(shortDate(inf.measured_at)) : I.numbersHintNoDate}</Text>
        </Section>
      </ScrollView>
      <SaveBar dirty={dirty} errorCount={dirty ? errorCount : 0} saving={saving} onSave={startSave} label={I.save} />
      {toast}
      <ConfirmSheet visible={!!ask} danger={!!(sheet && sheet.danger)} title={sheet ? sheet.title : ''} body={sheet ? sheet.body : ''}
        confirmLabel={sheet ? sheet.confirm : ''} cancelLabel={C3B.r6.cancel} onConfirm={confirmNext} onCancel={() => setConfirmQueue([])} />
    </View>
  );
}

const s = StyleSheet.create({
  input: { fontFamily: fonts.sansMedium, fontSize: 15, color: T.ink, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: T.bg },
  multi: { minHeight: 80, textAlignVertical: 'top' },
  counter: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink3, textAlign: 'right', marginTop: 4 },
  handleRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, backgroundColor: T.bg },
  at: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: T.ink3, marginRight: 2 },
  handleInput: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 15, color: T.ink, paddingVertical: 11 },
  measured: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: T.ink2 },
});
