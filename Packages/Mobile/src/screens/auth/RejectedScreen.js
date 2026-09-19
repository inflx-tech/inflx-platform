/**
 * RejectedScreen — C8 (creator) / B9 (brand): the admin's remarks, then the user's own
 * registration form back, pre-filled and editable. "Send for review again" saves what
 * changed (PATCH /…/me) and then POSTs submit-for-review, which clears the remarks and moves
 * the account back to pending — then the app opens.
 *
 * Before: one shared screen with one button that called the BRAND resubmit endpoint with the
 * identical data the admin had just rejected — so a rejected creator was refused outright and
 * a rejected brand changed nothing (spec §6.4). Creator vs brand is decided the way the OTP
 * screen decides it: the APP_ROLE the binary was built with, falling back to the stored user.
 * Contract: features/registration-and-profile
 */
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, ScrollView, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { brandApi, influencerApi, clearSession } from '../../services/api';
import { AuthContext } from '../../../App';
import APP_ROLE from '../../config/appRole';
import OfferedStateCityFields, { MSG_STATE, MSG_CITY } from '../../components/registration/OfferedStateCityFields';
import { MSG3B, validInstagram, validYoutube } from '../../components/social/copy3b';

const P = {
  bg:          '#FAFAFA',
  surface:     '#FFFFFF',
  surface2:    '#F4F4F5',
  ink:         '#0A0A0A',
  ink2:        '#18181B',
  muted:       '#52525B',
  muted2:      '#71717A',
  muted3:      '#A1A1AA',
  border:      '#E4E4E7',
  border2:     '#D4D4D8',
  yellow:      '#FFC107',
  yellowHover: '#E0A800',
  danger:      '#E8401A',
  dangerPale:  '#FDEEE9',
  dangerDeep:  '#B91C1C',
  greenPale:   '#E4F5EA',
  greenText:   '#1A7A3D',
};

const MONO = Platform.OS === 'android' ? 'monospace' : 'Menlo';

export const REJECTED_COPY = {
  title: 'Needs a fix',
  adminSaid: 'What the admin said',
  creatorLede: "Change what's wrong and send it back. Review usually takes under a day.",
  brandLede: "Change what's wrong and send it back.",
  send: 'Send for review again',
  sending: 'Sending…',
  signOut: 'Sign out',
  finishProfile: 'Finish my profile',
};

async function resolveRole(routeRole) {
  if (APP_ROLE === 'brand' || APP_ROLE === 'influencer') return APP_ROLE;
  if (routeRole === 'brand' || routeRole === 'influencer') return routeRole;
  try {
    const u = JSON.parse((await AsyncStorage.getItem('inflx_user')) || 'null');
    if (u && (u.role === 'brand' || u.role === 'influencer')) return u.role;
  } catch (_) { /* fall through */ }
  return 'influencer';
}

/** The main branch's ids, for a brand whose registration address lives on that branch. */
function brandAddress(data) {
  const b = data.brand || {};
  const branches = Array.isArray(data.branches) ? data.branches : [];
  const main = branches.find((x) => x.isMain) || branches[0] || null;
  return {
    business_name: b.business_name || '',
    address_line: b.address_line || (main && main.formattedAddress) || '',
    pincode: b.pincode || (main && main.pincode) || '',
    state_id: (main && main.stateId != null) ? main.stateId : (b.state_id != null ? b.state_id : null),
    city_id: (main && main.cityId != null) ? main.cityId : (b.city_id != null ? b.city_id : (data.mainCity && data.mainCity.id != null ? data.mainCity.id : null)),
    state_name: (main && main.stateName) || b.state || '',
    city_name: (main && main.cityName) || b.city || (data.mainCity && data.mainCity.name) || '',
  };
}

export default function RejectedScreen({ navigation, route }) {
  const { setRole: setAppRole } = useContext(AuthContext);
  const [role, setRole] = useState(null);
  const [status, setStatus] = useState('loading');
  const [reason, setReason] = useState(route?.params?.reason || null);
  const [initial, setInitial] = useState(null);
  const [f, setF] = useState(null);
  const [errs, setErrs] = useState({});
  const [error, setError] = useState('');
  const [incomplete, setIncomplete] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await resolveRole(route?.params?.role);
    setRole(r);
    const res = r === 'brand' ? await brandApi.getMe() : await influencerApi.getMe();
    if (!res.success) { setStatus('error'); return; }
    const d = res.data || {};
    if (!route?.params?.reason) setReason((r === 'brand' ? d.brand && d.brand.rejection_reason : d.rejection_reason) || null);
    let init;
    if (r === 'brand') {
      init = brandAddress(d);
    } else {
      const inf = d.influencer || d;
      init = {
        full_name: inf.full_name || inf.name || '',
        state_id: inf.state_id != null ? inf.state_id : null,
        city_id: inf.city_id != null ? inf.city_id : null,
        state_name: inf.state_name || '',
        city_name: inf.city_name || '',
        instagram_handle: inf.instagram_handle || '',
        youtube_handle: inf.youtube_handle || '',
      };
    }
    setInitial(init); setF(init);
    setStatus('ready');
  }, [route?.params?.reason, route?.params?.role]);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (v) => { setF((p) => ({ ...p, [k]: v })); setErrs((e) => ({ ...e, [k]: '' })); };

  async function signOut() {
    await clearSession();
    navigation.reset({ index: 0, routes: [{ name: 'Phone' }] });
  }

  function validate() {
    const e = {};
    if (role === 'brand') {
      if (!f.business_name.trim()) e.business_name = 'Enter your business name.';
      if (!f.address_line.trim()) e.address_line = 'Enter your street address.';
      if (!/^[0-9]{6}$/.test(String(f.pincode).trim())) e.pincode = 'Enter a 6-digit pincode.';
    } else {
      if (!f.full_name.trim()) e.full_name = 'Enter your full name.';
      const ig = f.instagram_handle.trim(), yt = f.youtube_handle.trim();
      if (!ig && !yt) e.instagram_handle = MSG3B.AT_LEAST_ONE;
      if (ig && !validInstagram(ig)) e.instagram_handle = MSG3B.INSTAGRAM_INVALID;
      if (yt && !validYoutube(yt)) e.youtube_handle = MSG3B.YOUTUBE_INVALID;
    }
    if (f.state_id == null) e.state_id = MSG_STATE;
    if (f.city_id == null) e.city_id = MSG_CITY;
    return e;
  }

  /** Only what changed goes in the PATCH; state and city travel together. */
  function changes() {
    const out = {};
    const keys = role === 'brand' ? ['business_name', 'address_line', 'pincode'] : ['full_name', 'instagram_handle', 'youtube_handle'];
    for (const k of keys) if (String(f[k]).trim() !== String(initial[k]).trim()) out[k] = String(f[k]).trim() || null;
    if (f.state_id !== initial.state_id || f.city_id !== initial.city_id) { out.state_id = f.state_id; out.city_id = f.city_id; }
    return out;
  }

  async function send() {
    setError(''); setIncomplete('');
    const e = validate();
    setErrs(e);
    if (Object.keys(e).length) return;
    setSending(true);
    const patch = changes();
    const api = role === 'brand' ? brandApi : influencerApi;
    if (Object.keys(patch).length) {
      const r = await api.updateMe(patch);
      if (!r.success) {
        setSending(false);
        const field = r.error?.field;
        if (field && Object.prototype.hasOwnProperty.call(f, field)) setErrs({ [field]: r.error.message });
        else setError(r.error?.message || "Couldn't save your changes. Please try again.");
        return;
      }
      setInitial({ ...initial, ...patch, state_id: f.state_id, city_id: f.city_id });
    }
    const s = await api.submitForReview();
    setSending(false);
    if (!s.success) {
      if (s.error?.code === 'PROFILE_INCOMPLETE') { setIncomplete(s.error.message || 'Your profile is not complete yet.'); return; }
      setError(s.error?.message || "Couldn't send it for review. Please try again.");
      return;
    }
    setAppRole(role);
  }

  if (status !== 'ready' || !f) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          {status === 'error' ? (
            <>
              <Text style={styles.title}>{REJECTED_COPY.title}</Text>
              <Text style={styles.body}>We could not load your details. Check your connection and try again.</Text>
              <TouchableOpacity style={styles.btn} onPress={load} testID="rejected-retry"><Text style={styles.btnText}>Try again</Text></TouchableOpacity>
            </>
          ) : <ActivityIndicator color={P.ink} />}
        </View>
        <View style={styles.ctaBar}>
          <TouchableOpacity style={styles.btnGhost} onPress={signOut} testID="rejected-sign-out"><Text style={styles.btnGhostText}>{REJECTED_COPY.signOut}</Text></TouchableOpacity>
        </View>
      </View>
    );
  }

  const isBrand = role === 'brand';
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" testID={`rejected-${isBrand ? 'brand' : 'creator'}`}>
        <Text style={styles.title}>{REJECTED_COPY.title}</Text>

        <View style={styles.reason} testID="rejected-reason">
          <Text style={styles.reasonLabel}>{REJECTED_COPY.adminSaid}</Text>
          <Text style={styles.reasonText}>{reason || 'The admin did not leave a note. Check your details below and send them again.'}</Text>
        </View>
        <Text style={styles.lede}>{isBrand ? REJECTED_COPY.brandLede : REJECTED_COPY.creatorLede}</Text>

        {isBrand ? (
          <>
            <Text style={styles.label}>Business name</Text>
            <TextInput style={[styles.input, errs.business_name && styles.inputError]} value={f.business_name} onChangeText={set('business_name')} placeholderTextColor={P.muted3} autoCorrect={false} testID="rej-business" />
            {errs.business_name ? <Text style={styles.fieldError}>{errs.business_name}</Text> : null}

            <Text style={styles.label}>Street address</Text>
            <TextInput style={[styles.input, styles.multi, errs.address_line && styles.inputError]} value={f.address_line} onChangeText={set('address_line')} multiline placeholderTextColor={P.muted3} autoCorrect={false} testID="rej-street" />
            {errs.address_line ? <Text style={styles.fieldError}>{errs.address_line}</Text> : null}

            <View style={{ height: 14 }} />
            <OfferedStateCityFields
              stateId={f.state_id}
              cityId={f.city_id}
              stateName={f.state_name}
              cityName={f.city_name}
              onChange={({ stateId, cityId }) => { setF((p) => ({ ...p, state_id: stateId, city_id: cityId })); setErrs((e) => ({ ...e, state_id: '', city_id: '' })); }}
              errors={{ state: errs.state_id, city: errs.city_id }}
              testIDPrefix="rej"
              cityLabel="Nearest major city"
              cityHint=""
              labelStyle={styles.pickerLabel}
              fieldStyle={styles.pickerField}
              placeholderColor={P.muted2}
              beside={(
                <View>
                  <Text style={[styles.label, { marginTop: 0 }]}>Pincode</Text>
                  <TextInput style={[styles.input, { fontFamily: MONO, marginBottom: 0 }, errs.pincode && styles.inputError]} value={String(f.pincode || '')}
                    onChangeText={(t) => set('pincode')(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholderTextColor={P.muted3} testID="rej-pincode" />
                  {errs.pincode ? <Text style={styles.fieldError}>{errs.pincode}</Text> : null}
                </View>
              )}
            />
          </>
        ) : (
          <>
            <Text style={styles.label}>Full name</Text>
            <TextInput style={[styles.input, errs.full_name && styles.inputError]} value={f.full_name} onChangeText={set('full_name')} placeholderTextColor={P.muted3} autoCorrect={false} testID="rej-name" />
            {errs.full_name ? <Text style={styles.fieldError}>{errs.full_name}</Text> : null}

            <View style={{ height: 14 }} />
            <OfferedStateCityFields
              stateId={f.state_id}
              cityId={f.city_id}
              stateName={f.state_name}
              cityName={f.city_name}
              onChange={({ stateId, cityId }) => { setF((p) => ({ ...p, state_id: stateId, city_id: cityId })); setErrs((e) => ({ ...e, state_id: '', city_id: '' })); }}
              errors={{ state: errs.state_id, city: errs.city_id }}
              testIDPrefix="rej"
              cityLabel="Nearest major city"
              cityHint=""
              labelStyle={styles.pickerLabel}
              fieldStyle={styles.pickerField}
              placeholderColor={P.muted2}
            />

            <Text style={styles.label}>Instagram</Text>
            <View style={[styles.handleRow, errs.instagram_handle && styles.inputError]}>
              <Text style={styles.atSign}>@</Text>
              <TextInput style={styles.handleInput} value={f.instagram_handle} onChangeText={(t) => set('instagram_handle')(t.replace(/\s/g, '').replace(/^@+/, ''))} placeholder="yourhandle" placeholderTextColor={P.muted3} autoCapitalize="none" autoCorrect={false} testID="rej-instagram" />
            </View>
            {errs.instagram_handle ? <Text style={styles.fieldError}>{errs.instagram_handle}</Text> : null}

            <Text style={styles.label}>YouTube</Text>
            <TextInput style={[styles.input, { fontFamily: MONO }, errs.youtube_handle && styles.inputError]} value={f.youtube_handle} onChangeText={(t) => set('youtube_handle')(t.replace(/\s/g, ''))} placeholder="@yourchannel" placeholderTextColor={P.muted3} autoCapitalize="none" autoCorrect={false} testID="rej-youtube" />
            {errs.youtube_handle ? <Text style={styles.fieldError}>{errs.youtube_handle}</Text> : null}
          </>
        )}

        {incomplete ? (
          <View style={styles.incomplete} testID="rejected-incomplete">
            <Text style={styles.incompleteText}>{incomplete}</Text>
            <TouchableOpacity style={[styles.btn, { marginTop: 10 }]} onPress={() => setAppRole(role)} testID="rejected-finish-profile">
              <Text style={styles.btnText}>{REJECTED_COPY.finishProfile}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {error ? <View style={styles.errorBox} testID="rejected-error"><Text style={styles.errorText}>{error}</Text></View> : null}
      </ScrollView>

      <View style={styles.ctaBar}>
        <TouchableOpacity style={[styles.btn, sending && styles.btnDisabled]} onPress={send} disabled={sending} testID="rejected-send" accessibilityRole="button" accessibilityState={{ disabled: !!sending }}>
          <Text style={styles.btnText}>{sending ? REJECTED_COPY.sending : REJECTED_COPY.send}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnGhost} onPress={signOut} testID="rejected-sign-out">
          <Text style={styles.btnGhostText}>{REJECTED_COPY.signOut}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: P.bg },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  scroll:      { paddingHorizontal: 22, paddingTop: 56, paddingBottom: 24 },

  title:       { fontSize: 22, fontWeight: '700', color: P.ink, marginBottom: 14, letterSpacing: -0.4 },
  body:        { fontSize: 13.5, color: P.muted, textAlign: 'center', lineHeight: 20, marginBottom: 18 },
  lede:        { fontSize: 13, color: P.muted, lineHeight: 19, marginTop: 12, marginBottom: 10 },

  reason:      { backgroundColor: P.dangerPale, borderLeftWidth: 3, borderLeftColor: P.danger, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 },
  reasonLabel: { fontSize: 11, fontWeight: '700', color: P.dangerDeep, letterSpacing: 0.3, marginBottom: 3 },
  reasonText:  { fontSize: 13, color: P.ink2, lineHeight: 18 },

  label:       { fontSize: 11.5, fontWeight: '600', color: P.ink2, marginBottom: 8, marginTop: 12 },
  pickerLabel: { fontSize: 11.5, fontWeight: '600', color: P.ink2, marginBottom: 8, marginTop: 0, fontFamily: undefined },
  pickerField: { backgroundColor: P.surface, borderWidth: 1.5, borderColor: P.border2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  input:       { backgroundColor: P.surface, borderWidth: 1.5, borderColor: P.border2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: P.ink },
  inputError:  { borderColor: P.danger },
  multi:       { minHeight: 76, textAlignVertical: 'top' },
  handleRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: P.surface, borderWidth: 1.5, borderColor: P.border2, borderRadius: 12, paddingHorizontal: 14 },
  atSign:      { fontSize: 16, color: P.yellowHover, fontWeight: '700', marginRight: 4, fontFamily: MONO },
  handleInput: { flex: 1, paddingVertical: 13, fontSize: 14.5, color: P.ink, fontFamily: MONO },
  fieldError:  { fontSize: 12, color: P.dangerDeep, fontWeight: '600', marginTop: 6 },

  incomplete:  { backgroundColor: P.greenPale, borderRadius: 10, padding: 12, marginTop: 16 },
  incompleteText: { fontSize: 12.5, color: P.greenText, lineHeight: 18, fontWeight: '600' },
  errorBox:    { backgroundColor: P.dangerPale, borderLeftWidth: 3, borderLeftColor: P.danger, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 14 },
  errorText:   { fontSize: 12, color: P.dangerDeep, fontWeight: '500' },

  ctaBar:      { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 28, backgroundColor: P.bg, borderTopWidth: 1, borderTopColor: P.border },
  btn:         { backgroundColor: P.yellow, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.45 },
  btnText:     { fontSize: 15, fontWeight: '700', color: P.ink, letterSpacing: 0.2 },
  btnGhost:    { paddingVertical: 10, alignItems: 'center' },
  btnGhostText:{ fontSize: 13, fontWeight: '600', color: P.muted },
});
