/**
 * ProfileInfoScreen — C5: photo (JPG/PNG ≤ 5 MB), full name*, bio (≤ 150), State + "Your
 * nearest major city" (the two pickers that replaced the Google city search), age, gender,
 * email (collected only — "We won't show this to brands."), Instagram and YouTube (item 3b:
 * after approval a change, add or remove asks first — R6), and her measured numbers.
 * Contract: features/registration-and-profile · features/item3-discovery-profiles-groups ·
 * features/item3b-social-numbers
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi, uploadFile } from '../../services/api';
import { FieldError, Section } from '../../components/settings/primitives';
import { ConfirmSheet } from '../../components/settings/sheets';
import { SaveBar, useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { FormScroll, FormArea } from '../../components/shell/FormScroll';
import { COPY, shortDate } from '../../components/settings/copy';
import useUnsavedGuard from '../../hooks/useUnsavedGuard';
import useRouteToast from '../../hooks/useRouteToast';
import ImagePickerField from '../../components/discovery/ImagePickerField';
import { Locked } from '../brand/BrandBusinessDetailsScreen';
import { maskIndian } from '../shared/ChangeNumberScreen';
import OfferedStateCityFields, { SinglePickSheet, MSG_CITY } from '../../components/registration/OfferedStateCityFields';
import { StatTriple } from '../../components/discovery/bits';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { C3, MSG3 } from '../../components/discovery/copy3';
import { C3B, MSG3B, PLATFORM_LABEL, validInstagram, validYoutube } from '../../components/social/copy3b';

const I = C3.creatorProfile.info;
const BIO_MAX = 150;
export const GENDERS = [{ id: 'female', name: 'Female' }, { id: 'male', name: 'Male' }, { id: 'other', name: 'Other' }];
export const MSG5 = { AGE: 'Enter an age between 13 and 99.', EMAIL: 'Enter a valid email address.' };

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

function formOf(me) {
  return {
    full_name: me.full_name || me.name || '', bio: me.bio || '',
    youtube_handle: me.youtube_handle || '', instagram_handle: me.instagram_handle || '',
    age: me.age != null && me.age !== '' ? String(me.age) : '', gender: me.gender || '', email: me.email || '',
  };
}

export default function ProfileInfoScreen({ navigation, route }) {
  const focus = route?.params?.focus;
  const [status, setStatus] = useState('loading');
  const [inf, setInf] = useState(null);
  const [f, setF] = useState(formOf({}));
  const [stateId, setStateId] = useState(null);
  const [cityId, setCityId] = useState(null);
  const [genderOpen, setGenderOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [confirmQueue, setConfirmQueue] = useState([]);
  const { toast, show } = useToast({ inFlow: true });
  const igRef = useRef(null), ytRef = useRef(null);

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await influencerApi.getMe();
    if (!r.success) { setStatus('error'); return; }
    const me = r.data?.influencer || r.data;
    setInf(me);
    setF(formOf(me));
    setStateId(me.state_id != null ? me.state_id : null);
    setCityId(me.city_id != null ? me.city_id : null);
    setStatus('ready');
  }, []);
  useEffect(() => { load(); }, [load]);
  // features/change-login-number N5 — coming back with a toast means the login number moved:
  // re-read /me so the phone tile shows the new number, then show the green line once.
  const returnedToast = route?.params?.toast;
  useFocusEffect(useCallback(() => { if (returnedToast) load(); }, [returnedToast, load]));
  useRouteToast(navigation, route, show);
  const changeNumber = () => navigation.navigate('ChangeNumber', { role: 'influencer', returnTo: 'ProfileInfo', phone: inf?.phone || '' });
  useEffect(() => {
    if (status !== 'ready' || !focus) return;
    const t = setTimeout(() => { (focus === 'instagram' ? igRef : ytRef).current?.focus?.(); }, 300);
    return () => clearTimeout(t);
  }, [status, focus]);

  const initial = inf ? formOf(inf) : f;
  const initialStateId = inf && inf.state_id != null ? inf.state_id : null;
  const initialCityId = inf && inf.city_id != null ? inf.city_id : null;
  const placeChanged = stateId !== initialStateId || cityId !== initialCityId;
  const dirty = placeChanged || Object.keys(f).some(k => f[k] !== initial[k]);
  useUnsavedGuard(navigation, dirty && !done);
  const igAction = handleAction('instagram', initial.instagram_handle, f.instagram_handle);
  const ytAction = handleAction('youtube', initial.youtube_handle, f.youtube_handle);
  const noneLeft = !f.instagram_handle.trim() && !f.youtube_handle.trim();
  const ageNum = f.age.trim() ? Number(f.age) : null;
  const clientErrors = {
    full_name: f.full_name.trim() ? '' : MSG3.FULL_NAME,
    bio: f.bio.length > BIO_MAX ? MSG3.BIO : '',
    city: cityId != null ? '' : MSG_CITY,
    age: ageNum != null && (!Number.isInteger(ageNum) || ageNum < 13 || ageNum > 99) ? MSG5.AGE : '',
    email: f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()) ? MSG5.EMAIL : '',
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
    if (f.age !== initial.age) payload.age = ageNum;
    if (f.gender !== initial.gender) payload.gender = f.gender || null;
    if (f.email !== initial.email) payload.email = f.email.trim() || null;
    if (placeChanged) { payload.state_id = stateId; payload.city_id = cityId; }
    if (!Object.keys(payload).length) { setDone(true); navigation.navigate('ProfileMain', {}); return; }
    setSaving(true);
    const r = await influencerApi.updateMe(payload);
    setSaving(false);
    if (!r.success) {
      const code = r.error?.code;
      const field = r.error?.field || ({ AGE_INVALID: 'age', GENDER_INVALID: 'gender', EMAIL_INVALID: 'email', CITY_REQUIRED: 'city' })[code];
      if (field) setErrors({ [field === 'city_id' || field === 'state_id' ? 'city' : field]: r.error.message });
      else show(r.error?.message || COPY.saveFailed);
      return;
    }
    setDone(true);
    navigation.navigate('ProfileMain', { toast: 'Saved.' });
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

  if (status === 'loading') return <View style={base.screen}><Header title={I.title} onBack={() => navigation.goBack()} /><Skeleton />{toast}</View>;
  if (status === 'error') return <View style={base.screen}><Header title={I.title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} />{toast}</View>;

  const name = f.full_name || inf.instagram_handle || 'Creator';
  const genderLabel = (GENDERS.find(g => g.id === f.gender) || {}).name || '';
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
      {/* ui-walk-fixes board C: the form scrolls in the room above the Save strip; nothing floats over it. */}
      <FormArea>
      <FormScroll contentContainerStyle={base.body}>
        <ImagePickerField label={inf.profile_image_url ? 'Profile photo' : I.photo} hint={I.photoHint} name={name} url={inf.profile_image_url} onPick={pickPhoto} busy={photoBusy} changeLabel={I.change} testID="photo" />
        <View style={{ height: 16 }} />
        <Text style={base.label}>{I.name}</Text>
        <TextInput style={s.input} value={f.full_name} onChangeText={set('full_name')} placeholderTextColor={T.ink3} testID="field-name" />
        <FieldError text={errors.full_name || (dirty ? clientErrors.full_name : '')} />
        <View style={{ height: 14 }} />
        <Text style={base.label}>{I.bio}</Text>
        <TextInput style={[s.input, s.multi]} value={f.bio} onChangeText={set('bio')} multiline placeholder="A line about what you make" placeholderTextColor={T.ink3} testID="field-bio" />
        <Text style={[s.counter, f.bio.length > BIO_MAX && { color: T.danger }]}>{f.bio.length} / {BIO_MAX}</Text>
        <FieldError text={errors.bio || clientErrors.bio} />
        <View style={{ height: 14 }} />
        <OfferedStateCityFields
          stateId={stateId}
          cityId={cityId}
          stateName={inf.state_name}
          cityName={inf.city_name || inf.city}
          onChange={({ stateId: sid, cityId: cid }) => { setStateId(sid); setCityId(cid); setErrors(e => ({ ...e, city: '' })); }}
          errors={{ city: errors.city || (dirty && placeChanged ? clientErrors.city : '') }}
          testIDPrefix="field"
          cityLabel="Nearest major city"
        />
        <View style={{ height: 14 }} />
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={base.label}>{I.age}</Text>
            <TextInput style={s.input} value={f.age} onChangeText={(v) => set('age')(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" maxLength={2} placeholder="24" placeholderTextColor={T.ink3} testID="field-age" />
            <FieldError text={errors.age || clientErrors.age} />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={base.label}>{I.gender}</Text>
            <TouchableOpacity style={s.pickField} onPress={() => setGenderOpen(true)} accessibilityRole="button" testID="field-gender">
              <Text style={[s.pickValue, !genderLabel && { color: T.ink3 }]}>{genderLabel || 'Select'}</Text>
              <Text style={s.chev}>›</Text>
            </TouchableOpacity>
            <FieldError text={errors.gender} />
          </View>
        </View>
        <View style={{ height: 14 }} />
        <Text style={base.label}>{I.email}</Text>
        <TextInput style={s.input} value={f.email} onChangeText={set('email')} placeholder="you@email.com" placeholderTextColor={T.ink3} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" testID="field-email" />
        <Text style={base.hint}>{I.emailHint}</Text>
        <FieldError text={errors.email || clientErrors.email} />
        <View style={{ height: 14 }} />
        {/* The login number — locked here; it moves through Change number (features/change-login-number). */}
        <Locked label={I.phone} value={maskIndian(inf.phone)} hint={I.phoneHint} testID="locked-phone"
          action={{ label: I.changeNumber, onPress: changeNumber, testID: 'change-number-link' }} />
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
      </FormScroll>
      {toast}
      </FormArea>
      <SaveBar dirty={dirty} errorCount={dirty ? errorCount : 0} saving={saving} onSave={startSave} label={I.save} />
      <SinglePickSheet visible={genderOpen} title="Gender" items={GENDERS} value={f.gender || null} onPick={(id) => { set('gender')(id); setGenderOpen(false); }} onClose={() => setGenderOpen(false)} searchPlaceholder="Search" testIDPrefix="gender" />
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
  pickField: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: T.bg },
  pickValue: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 15, color: T.ink },
  chev: { fontFamily: fonts.sansBold, fontSize: 18, color: T.ink3, marginLeft: 8 },
  measured: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: T.ink2 },
});
