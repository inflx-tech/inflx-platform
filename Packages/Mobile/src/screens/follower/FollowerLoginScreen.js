import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { creatorVibe as C } from '../../theme/tokens';

// Flow 52.D — Creator Vibe: was dark-themed. Remap darkColors → cream/terracotta.
// Visual only; OTP/login flow unchanged.
const darkColors = {
  bg: C.screenBg, bg2: C.screenBg, card: C.card, input: C.soft,
  text: C.ink, textSecondary: C.muted, textMuted: C.muted,
  border: C.line, borderAccent: C.line,
  amber: C.brown, amberDim: C.soft, green: '#1E9E5A', greenDim: C.soft,
  red: C.offer, redDim: C.soft, blue: C.verify, blueDim: C.soft,
  pink: C.brown, pinkDim: C.soft, teal: C.verify, tealDim: C.soft,
  purple: C.brown, purpleDim: C.soft, orange: C.brown, orangeDim: C.soft,
};
import { api, followerApi } from '../../services/api';
import { mergeAfterSignIn } from '../../components/shop/shopStore';
import { mergeBagAfterSignIn } from '../../components/shop/bag';
import { registerPushAfterSignIn } from '../../components/shop/notifications';
import { CS } from '../../components/shop/copyShop';

/**
 * FollowerLoginScreen — quick OTP login for followers.
 *
 * Flow: Phone → OTP → Name (only when she has never given one) → Done → back to where she was.
 * Guest-first (founder 2026-07-25): this screen is the ONE login moment of
 * the shopping journey (reached from Place Order); route.params.onDone lets
 * the caller resume (e.g. continue the order) after sign-in. Skin follows
 * the locked design law: pure white, black text, yellow on the button only.
 *
 * shopper-app-fixes:
 *   F2  The ten digits she types are always sent as +91 and those ten digits. (A number that
 *       starts with 91 — 91234 56789 — was sent as +9123456789 and refused.)
 *   F4  No name is sent with the code (every new shopper used to be signed up as "Follower").
 *       After the code her account says whether a name is still needed (`name_needed`); if so she
 *       is asked "Your name" once — one box, required — and it is saved to her account.
 *   N2  The first line says why she is signing in (route.params.reason: 'order' | 'comment' |
 *       'save' | 'follow'); "Resend code" appears 30 seconds after the code was sent.
 *   F15 The phone is registered for notifications as soon as she is signed in.
 */

export const RESEND_AFTER_MS = 30 * 1000;

export default function FollowerLoginScreen({ navigation, route }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'otp' | 'name'
  const [loading, setLoading] = useState(false);
  const [sentAt, setSentAt] = useState(0);            // when the code was last sent
  const [canResend, setCanResend] = useState(false);
  const [noProfile, setNoProfile] = useState(false);  // an account with no shopper profile yet: her name creates it
  const reason = route && route.params ? route.params.reason : undefined;

  // F2: whatever she typed, the number is the last ten digits, behind +91.
  const cleanedPhone = phone.replace(/\D/g, '').slice(-10);
  const fullPhone = `+91${cleanedPhone}`;

  // N2: "Resend code" appears 30 seconds after a code is sent (each time one is sent).
  useEffect(() => {
    if (step !== 'otp' || !sentAt) return undefined;
    setCanResend(false);
    const t = setTimeout(() => setCanResend(true), RESEND_AFTER_MS);
    return () => clearTimeout(t);
  }, [step, sentAt]);

  async function handleSendOtp(again) {
    if (cleanedPhone.length < 10) { Alert.alert('Enter a valid 10-digit phone number'); return; }
    setLoading(true);
    try {
      const res = await api.post('/auth/send-otp', { phone: fullPhone });
      if (res.success || res.data) {
        if (again === true) setOtp('');
        setSentAt(Date.now());
        setStep('otp');
      } else {
        Alert.alert('Failed', res.error?.message || 'Could not send OTP');
      }
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  }

  /** She is signed in: this phone is hers to notify, and what she kept as a guest moves to her account. */
  async function afterSignIn() {
    registerPushAfterSignIn();        // F15 — never waited for, never fails a sign-in
    // follower-app-v2 (5.2): what she kept on the phone as a guest (follows, saves, Welcome
    // choices) moves to her account now. A failure here never blocks signing in.
    try { await mergeAfterSignIn(); } catch (_) { /* kept on the phone; merged next time */ }
    // shopper-ordering (O8): the bag she filled as a guest joins her account.
    try { await mergeBagAfterSignIn(); } catch (_) { /* kept on the phone; merged next time */ }
  }

  async function handleVerifyOtp() {
    if (otp.length < 6) { Alert.alert('Enter the 6-digit OTP'); return; }
    setLoading(true);
    try {
      // F4: no name goes with the code. A new shopper's account is made without one, and
      // `name_needed` below says to ask her.
      const res = await api.post('/auth/verify-otp', { phone: fullPhone, otp, role: 'follower' });

      if (res.success || res.data) {
        const token = res.data?.access_token;
        const user = res.data?.user;
        if (!token) { Alert.alert('Failed', 'No token received'); return; }

        await AsyncStorage.setItem('inflx_token', token);
        // Persist the refresh token so the API client can silently refresh the
        // 15-min access token. Without this, every follower write (save address,
        // place order) failed with "session expired" after 15 minutes.
        if (res.data?.refresh_token) await AsyncStorage.setItem('inflx_refresh_token', res.data.refresh_token);
        await AsyncStorage.setItem('inflx_user', JSON.stringify({ ...user, role: 'follower' }));

        const me = await followerApi.getMe();
        if (me && !me.success && me.error && me.error.code === 'NOT_FOUND') {
          // An account with no shopper profile yet: her name creates it (and nothing of hers can
          // be moved to it before it exists).
          setNoProfile(true);
          setStep('name');
          return;
        }
        await afterSignIn();
        // Her account could not be read just now: she is signed in all the same, and Profile
        // offers "Add your name" if one is still needed.
        if (me && me.success && me.data && me.data.name_needed) setStep('name');
        else finishLogin();
      } else {
        Alert.alert('Invalid OTP', res.error?.message || 'Please check and try again');
      }
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  }

  async function handleNameSubmit() {
    const given = name.trim();
    if (given.length < 2) { Alert.alert('Please enter your name'); return; }
    setLoading(true);
    try {
      const res = noProfile ? await api.post('/followers/register', { name: given }) : await followerApi.updateMe({ name: given });
      if (res && (res.success || res.data)) {
        try {
          const stored = await AsyncStorage.getItem('inflx_user');
          if (stored) await AsyncStorage.setItem('inflx_user', JSON.stringify({ ...JSON.parse(stored), name: given }));
        } catch (_) { /* her account has it; the copy on the phone is only a copy */ }
        if (noProfile) await afterSignIn();
        finishLogin();
      } else {
        Alert.alert('Failed', res?.error?.message || 'Could not save your name');
      }
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  }

  function finishLogin() {
    const onDone = route?.params?.onDone;
    Alert.alert('Signed in', 'You are all set.', [
      {
        text: 'Continue',
        onPress: () => {
          navigation.goBack();
          // Let the navigator settle before resuming the caller's action
          // (e.g. Place Order re-runs with the fresh session).
          if (typeof onDone === 'function') setTimeout(onDone, 400);
        },
      },
    ]);
  }

  return (
    <View style={s.container}>
      {/* On "Your name" there is no Back: she is already signed in, and the name is required (X2). */}
      {step !== 'name' ? (
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} testID="login-back">
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
      ) : null}

      <View style={s.content}>
        {/* Title */}
        <Text style={s.title}>
          {step === 'phone' ? 'Sign in' : step === 'otp' ? 'Enter OTP' : 'Your name'}
        </Text>
        <Text style={s.subtitle} testID="login-why">
          {step === 'phone' ? CS.signInWhy(reason)
            : step === 'otp' ? `We sent a 6-digit code to +91 ${cleanedPhone}`
            : 'Last step — tell us your name'}
        </Text>

        {/* ── Phone Step ── */}
        {step === 'phone' && (
          <View style={s.formBox}>
            <Text style={s.label}>Phone Number</Text>
            <View style={s.phoneRow}>
              <View style={s.prefixBox}>
                <Text style={s.prefixText}>+91</Text>
              </View>
              <TextInput
                style={s.phoneInput}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="Enter 10-digit number"
                placeholderTextColor="#B5B5B5"
                // F2: room for a pasted "+91 98765 43210" — the last ten digits are the number.
                maxLength={16}
                autoFocus
                testID="login-phone"
              />
            </View>
            <TouchableOpacity
              style={[s.btn, cleanedPhone.length < 10 && s.btnDisabled]}
              onPress={() => handleSendOtp(false)}
              disabled={loading || cleanedPhone.length < 10}
              testID="login-send"
            >
              {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Send OTP →</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* ── OTP Step ── */}
        {step === 'otp' && (
          <View style={s.formBox}>
            <Text style={s.label}>Enter OTP</Text>
            <TextInput
              style={s.otpInput}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              placeholder="0 0 0 0 0 0"
              placeholderTextColor="#B5B5B5"
              maxLength={6}
              autoFocus
              testID="login-otp"
            />
            <Text style={s.hint}>Enter the 6-digit code sent to your phone</Text>
            <TouchableOpacity
              style={[s.btn, otp.length < 6 && s.btnDisabled]}
              onPress={handleVerifyOtp}
              disabled={loading || otp.length < 6}
              testID="login-verify"
            >
              {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Verify →</Text>}
            </TouchableOpacity>
            {/* N2: half a minute after the code was sent, she can ask for it again. */}
            {canResend ? (
              <TouchableOpacity onPress={() => handleSendOtp(true)} disabled={loading} style={s.linkBtn} testID="login-resend" accessibilityRole="button">
                <Text style={s.resendText}>{CS.resendCode}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => { setStep('phone'); setOtp(''); }} style={s.linkBtn}>
              <Text style={s.linkText}>← Change phone number</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Name Step ── */}
        {step === 'name' && (
          <View style={s.formBox}>
            <Text style={s.label}>Your Name</Text>
            <TextInput
              style={s.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor="#B5B5B5"
              autoCapitalize="words"
              maxLength={100}
              autoFocus
              testID="login-name"
            />
            <TouchableOpacity
              style={[s.btn, name.trim().length < 2 && s.btnDisabled]}
              onPress={handleNameSubmit}
              disabled={loading || name.trim().length < 2}
              testID="login-name-continue"
            >
              {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Continue →</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Text style={s.note}>Browse, save and follow without signing in.{'\n'}Your saves and follows move to your account when you do.</Text>
    </View>
  );
}

// Locked design law: pure white chrome, black text, yellow lives on the
// primary button only.
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', paddingHorizontal: 24 },
  backBtn: { position: 'absolute', top: 52, left: 20 },
  backText: { color: '#111', fontSize: 13, fontWeight: '700' },
  content: { alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: '#111', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#8A8A8A', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  formBox: { width: '100%' },
  label: { fontSize: 11, fontWeight: '700', color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  phoneRow: { flexDirection: 'row', marginBottom: 16 },
  prefixBox: {
    backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#E4E4E4',
    borderTopLeftRadius: 12, borderBottomLeftRadius: 12,
    paddingHorizontal: 14, justifyContent: 'center', borderRightWidth: 0,
  },
  prefixText: { fontSize: 15, fontWeight: '700', color: '#8A8A8A' },
  phoneInput: {
    flex: 1, backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#E4E4E4',
    borderTopRightRadius: 12, borderBottomRightRadius: 12,
    paddingHorizontal: 14, paddingVertical: 16,
    fontSize: 18, fontWeight: '700', color: '#111', letterSpacing: 1,
  },
  otpInput: {
    backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#E4E4E4',
    borderRadius: 12, paddingHorizontal: 20, paddingVertical: 18,
    fontSize: 28, fontWeight: '800', color: '#111', textAlign: 'center', letterSpacing: 12,
    marginBottom: 8, width: '100%',
  },
  nameInput: {
    backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#E4E4E4',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16,
    fontSize: 16, fontWeight: '600', color: '#111',
    marginBottom: 16, width: '100%',
  },
  hint: { fontSize: 11, color: '#9A9A9A', textAlign: 'center', marginBottom: 16 },
  btn: { backgroundColor: '#F6B11E', paddingVertical: 16, borderRadius: 12, alignItems: 'center', width: '100%' },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 15, fontWeight: '800', color: '#111' },
  linkBtn: { marginTop: 14, alignItems: 'center' },
  linkText: { fontSize: 12, color: '#8A8A8A' },
  resendText: { fontSize: 13, fontWeight: '700', color: '#111', textDecorationLine: 'underline' },
  note: { textAlign: 'center', fontSize: 11, color: '#9A9A9A', marginTop: 32, lineHeight: 18 },
});
