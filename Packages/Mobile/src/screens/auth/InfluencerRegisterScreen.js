import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { influencerApi } from '../../services/api';
import { C3B, MSG3B, validInstagram, validYoutube } from '../../components/social/copy3b';

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
  yellowPale:  '#FFF7CC',
  yellowText:  '#6B5A00',
  danger:      '#E8401A',
  dangerPale:  '#FDEEE9',
  dangerDeep:  '#B91C1C',
};

const MONO = Platform.OS === 'android' ? 'monospace' : 'Menlo';

/**
 * Influencer registration — two steps since item 3b (rules v1.12 §2A, founder Q16):
 *   1. details (name, city)
 *   2. "Your social accounts" (R1): Instagram username and/or YouTube handle or channel link,
 *      at least one, format checked on the device with the exact §6 messages.
 * Nothing is measured here: the creator lands on the existing "approval pending" screen and
 * the first measurement runs when admin approves. Payload + navigation.reset preserved.
 * Contract: features/item3b-social-numbers
 */
export default function InfluencerRegisterScreen({ navigation }) {
  const [step,        setStep]        = useState(1);
  const [fullName,    setFullName]    = useState('');
  const [city,        setCity]        = useState('');
  const [igHandle,    setIgHandle]    = useState('');
  const [ytHandle,    setYtHandle]    = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [fieldErr,    setFieldErr]    = useState({});

  function next() {
    setError('');
    if (!fullName.trim()) { setError('Please enter your full name'); return; }
    setStep(2);
  }

  async function handleRegister() {
    setError(''); setFieldErr({});
    const igRaw = igHandle.trim(), ytRaw = ytHandle.trim();
    const errs = {};
    if (!igRaw && !ytRaw) { setError(MSG3B.AT_LEAST_ONE); return; }
    if (igRaw && !validInstagram(igRaw)) errs.ig = MSG3B.INSTAGRAM_INVALID;
    if (ytRaw && !validYoutube(ytRaw)) errs.yt = MSG3B.YOUTUBE_INVALID;
    if (Object.keys(errs).length) { setFieldErr(errs); return; }

    setLoading(true);
    const body = { name: fullName.trim() };
    if (city.trim()) body.city = city.trim();
    if (igRaw) body.instagram_handle = igRaw;
    if (ytRaw) body.youtube_handle = ytRaw;
    const res = await influencerApi.register(body);
    setLoading(false);

    if (!res.success) {
      const f = res.error?.field;
      if (f === 'instagram_handle') setFieldErr({ ig: res.error.message });
      else if (f === 'youtube_handle') setFieldErr({ yt: res.error.message });
      else setError(res.error?.message || 'Registration failed');
      return;
    }

    const claim = res.data?.claim || {};
    const params = {
      claimMatched:    !!claim.claimed,
      claimConflict:   !!claim.conflict,
      claimMatchCount: claim.match_count || 0,
      handle:          validInstagram(igRaw) || validYoutube(ytRaw) || '',
    };
    navigation.reset({ index: 0, routes: [{ name: 'Waiting', params }] });
  }

  const canContinue1 = fullName.trim().length > 0;
  const canSubmit = (igHandle.trim().length > 0 || ytHandle.trim().length > 0) && !loading;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: P.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.stepper} testID="stepper"><View style={[styles.stepBar, styles.stepOn]} /><View style={[styles.stepBar, step === 2 && styles.stepOn]} /></View>

        {step === 1 ? (
          <>
            <Text style={styles.title}>{C3B.r1.step1Title}</Text>
            <Text style={styles.lede}>{C3B.r1.step1Lede}</Text>

            <Text style={styles.label}>Full name <Text style={styles.req}>*</Text></Text>
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Your full name" placeholderTextColor={P.muted3} autoCorrect={false} testID="reg-name" />

            <Text style={styles.label}>City</Text>
            <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Hyderabad / Nellore / …" placeholderTextColor={P.muted3} autoCorrect={false} testID="reg-city" />
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => setStep(1)} style={styles.back} testID="reg-back"><Text style={styles.backText}>‹ Back</Text></TouchableOpacity>
            <Text style={styles.title}>{C3B.r1.title}</Text>
            <Text style={styles.lede}>{C3B.r1.intro}</Text>

            <Text style={styles.label}>{C3B.r1.ig}</Text>
            <View style={[styles.handleRow, fieldErr.ig && styles.rowError]}>
              <Text style={styles.atSign}>@</Text>
              <TextInput
                style={styles.handleInput}
                value={igHandle}
                onChangeText={t => { setIgHandle(t.replace(/\s/g, '').replace(/^@+/, '')); setFieldErr(e => ({ ...e, ig: '' })); }}
                placeholder="yourhandle"
                placeholderTextColor={P.muted3}
                autoCapitalize="none"
                autoCorrect={false}
                testID="reg-instagram"
              />
            </View>
            {fieldErr.ig ? <Text style={styles.fieldError} testID="err-instagram">{fieldErr.ig}</Text> : null}

            <Text style={styles.label}>{C3B.r1.yt}</Text>
            <View style={[styles.handleRow, fieldErr.yt && styles.rowError]}>
              <TextInput
                style={styles.handleInput}
                value={ytHandle}
                onChangeText={t => { setYtHandle(t.replace(/\s/g, '')); setFieldErr(e => ({ ...e, yt: '' })); }}
                placeholder="@yourchannel or youtube.com/@yourchannel"
                placeholderTextColor={P.muted3}
                autoCapitalize="none"
                autoCorrect={false}
                testID="reg-youtube"
              />
            </View>
            {fieldErr.yt ? <Text style={styles.fieldError} testID="err-youtube">{fieldErr.yt}</Text> : null}

            <Text style={styles.hint}>{C3B.r1.hint}</Text>
          </>
        )}

        {error ? (
          <View style={styles.errorBox} testID="reg-error">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.ctaBar}>
        {step === 1 ? (
          <TouchableOpacity style={[styles.btn, !canContinue1 && styles.btnDisabled]} onPress={next} disabled={!canContinue1} testID="reg-continue-1">
            <Text style={styles.btnText}>{C3B.r1.continue}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.btn, !canSubmit && styles.btnDisabled]} onPress={handleRegister} disabled={!canSubmit} testID="reg-continue-2">
            <Text style={styles.btnText}>{loading ? 'Registering…' : C3B.r1.continue}</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll:        { flexGrow: 1, paddingHorizontal: 22, paddingTop: 40, paddingBottom: 24 },
  stepper:       { flexDirection: 'row', marginBottom: 18 },
  stepBar:       { flex: 1, height: 4, borderRadius: 9, backgroundColor: P.border, marginRight: 4 },
  stepOn:        { backgroundColor: P.ink },
  back:          { marginBottom: 8 },
  backText:      { fontSize: 13, color: P.muted, fontWeight: '600' },
  title:         { fontSize: 22, fontWeight: '700', color: P.ink, marginBottom: 6, letterSpacing: -0.4 },
  lede:          { fontSize: 13, color: P.muted, marginBottom: 22, lineHeight: 19 },

  label:         { fontSize: 11.5, fontWeight: '600', color: P.ink2, marginBottom: 8, marginTop: 6 },
  req:           { color: P.danger, fontWeight: '700' },
  hint:          { fontSize: 12, color: P.muted, lineHeight: 17, marginTop: 4 },

  input:         { backgroundColor: P.surface, borderWidth: 1.5, borderColor: P.border2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: P.ink, marginBottom: 14 },

  handleRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: P.surface, borderWidth: 1.5, borderColor: P.border2, borderRadius: 12, paddingHorizontal: 14, marginBottom: 6 },
  rowError:      { borderColor: P.danger },
  atSign:        { fontSize: 16, color: P.yellowHover, fontWeight: '700', marginRight: 4, fontFamily: MONO },
  handleInput:   { flex: 1, paddingVertical: 13, fontSize: 14.5, color: P.ink, fontFamily: MONO },
  fieldError:    { fontSize: 12, color: P.dangerDeep, fontWeight: '600', marginBottom: 8 },

  errorBox:      { backgroundColor: P.dangerPale, borderLeftWidth: 3, borderLeftColor: P.danger, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 },
  errorText:     { fontSize: 12, color: P.dangerDeep, fontWeight: '500' },

  ctaBar:        { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 28, backgroundColor: P.bg },
  btn:           { backgroundColor: P.yellow, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnDisabled:   { opacity: 0.45 },
  btnText:       { fontSize: 15, fontWeight: '700', color: P.ink, letterSpacing: 0.2 },
});
