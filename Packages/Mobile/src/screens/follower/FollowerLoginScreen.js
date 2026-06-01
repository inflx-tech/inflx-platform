import React, { useState } from 'react';
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
import { api } from '../../services/api';

/**
 * FollowerLoginScreen — quick OTP login for followers.
 *
 * Flow: Phone → OTP → Name (new users only) → Done → back to payment
 */

export default function FollowerLoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'otp' | 'name'
  const [loading, setLoading] = useState(false);

  const cleanedPhone = phone.replace(/\D/g, '');
  const fullPhone = cleanedPhone.startsWith('91') ? `+${cleanedPhone}` : `+91${cleanedPhone}`;

  async function handleSendOtp() {
    if (cleanedPhone.length < 10) { Alert.alert('Enter a valid 10-digit phone number'); return; }
    setLoading(true);
    try {
      const res = await api.post('/auth/send-otp', { phone: fullPhone });
      if (res.success || res.data) {
        setStep('otp');
      } else {
        Alert.alert('Failed', res.error?.message || 'Could not send OTP');
      }
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  }

  async function handleVerifyOtp() {
    if (otp.length < 6) { Alert.alert('Enter the 6-digit OTP'); return; }
    setLoading(true);
    try {
      // First try verify with a dummy name — if user exists, it works
      const res = await api.post('/auth/verify-otp', { phone: fullPhone, otp, role: 'follower', name: 'Follower' });

      if (res.success || res.data) {
        const token = res.data?.access_token;
        const user = res.data?.user;

        if (token) {
          await AsyncStorage.setItem('inflx_token', token);
          await AsyncStorage.setItem('inflx_user', JSON.stringify({ ...user, role: 'follower' }));

          // Check if this is a new user who needs follower registration
          const checkRes = await api.get('/followers/me');
          if (checkRes.success && checkRes.data) {
            // Existing follower — done!
            finishLogin();
          } else {
            // New user — need name for follower registration
            setStep('name');
          }
        } else {
          Alert.alert('Failed', 'No token received');
        }
      } else {
        // If error says "name is required" — go to name step first
        if (res.error?.field === 'name' || res.error?.message?.includes('name')) {
          setStep('name');
        } else {
          Alert.alert('Invalid OTP', res.error?.message || 'Please check and try again');
        }
      }
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  }

  async function handleNameSubmit() {
    if (!name.trim()) { Alert.alert('Please enter your name'); return; }
    setLoading(true);
    try {
      // If we don't have token yet (verify-otp failed earlier), re-verify with name
      const token = await AsyncStorage.getItem('inflx_token');
      if (!token) {
        const res = await api.post('/auth/verify-otp', { phone: fullPhone, otp, role: 'follower', name: name.trim() });
        if (res.success || res.data) {
          await AsyncStorage.setItem('inflx_token', res.data.access_token);
          await AsyncStorage.setItem('inflx_user', JSON.stringify({ ...res.data.user, role: 'follower' }));
        } else {
          Alert.alert('Failed', res.error?.message || 'Could not verify');
          setLoading(false);
          return;
        }
      }

      // Register as follower
      const regRes = await api.post('/followers/register', { name: name.trim(), city: 'Vijayawada', state: 'AP' });
      if (regRes.success || regRes.data) {
        finishLogin();
      } else {
        // If already registered, that's fine
        if (regRes.error?.message?.includes('already')) {
          finishLogin();
        } else {
          Alert.alert('Failed', regRes.error?.message || 'Could not register');
        }
      }
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  }

  function finishLogin() {
    Alert.alert('Signed In! ✅', 'You can now make payments and bookings.', [
      { text: 'Continue', onPress: () => navigation.goBack() },
    ]);
  }

  return (
    <View style={s.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
        <Text style={s.backText}>← Back to browsing</Text>
      </TouchableOpacity>

      <View style={s.content}>
        {/* Icon */}
        <View style={s.iconCircle}>
          <Text style={{ fontSize: 32 }}>{step === 'phone' ? '📱' : step === 'otp' ? '🔑' : '👤'}</Text>
        </View>

        {/* Title */}
        <Text style={s.title}>
          {step === 'phone' ? 'Quick Sign In' : step === 'otp' ? 'Enter OTP' : 'Your Name'}
        </Text>
        <Text style={s.subtitle}>
          {step === 'phone' ? 'Sign in to make payments and bookings'
            : step === 'otp' ? `We sent a 6-digit code to +91 ${cleanedPhone.slice(-10)}`
            : 'Almost done! Tell us your name'}
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
                placeholderTextColor="rgba(255,255,255,0.25)"
                maxLength={10}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={[s.btn, cleanedPhone.length < 10 && s.btnDisabled]}
              onPress={handleSendOtp}
              disabled={loading || cleanedPhone.length < 10}
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
              placeholderTextColor="rgba(255,255,255,0.2)"
              maxLength={6}
              autoFocus
            />
            <Text style={s.hint}>For testing use: 000000</Text>
            <TouchableOpacity
              style={[s.btn, otp.length < 6 && s.btnDisabled]}
              onPress={handleVerifyOtp}
              disabled={loading || otp.length < 6}
            >
              {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Verify →</Text>}
            </TouchableOpacity>
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
              placeholderTextColor="rgba(255,255,255,0.25)"
              autoFocus
            />
            <TouchableOpacity
              style={[s.btn, !name.trim() && s.btnDisabled]}
              onPress={handleNameSubmit}
              disabled={loading || !name.trim()}
            >
              {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Continue →</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Text style={s.note}>Browse deals freely without signing in.{'\n'}Sign in is only needed for payments & bookings.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070b16', justifyContent: 'center', paddingHorizontal: 24 },
  backBtn: { position: 'absolute', top: 52, left: 20 },
  backText: { color: '#F59E0B', fontSize: 13, fontWeight: '600' },
  content: { alignItems: 'center' },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  formBox: { width: '100%' },
  label: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  phoneRow: { flexDirection: 'row', marginBottom: 16 },
  prefixBox: {
    backgroundColor: '#0D1D2E', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
    borderTopLeftRadius: 12, borderBottomLeftRadius: 12,
    paddingHorizontal: 14, justifyContent: 'center', borderRightWidth: 0,
  },
  prefixText: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  phoneInput: {
    flex: 1, backgroundColor: '#0D1D2E', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
    borderTopRightRadius: 12, borderBottomRightRadius: 12,
    paddingHorizontal: 14, paddingVertical: 16,
    fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: 1,
  },
  otpInput: {
    backgroundColor: '#0D1D2E', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12, paddingHorizontal: 20, paddingVertical: 18,
    fontSize: 28, fontWeight: '800', color: '#F59E0B', textAlign: 'center', letterSpacing: 12,
    marginBottom: 8, width: '100%',
  },
  nameInput: {
    backgroundColor: '#0D1D2E', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16,
    fontSize: 16, fontWeight: '600', color: '#fff',
    marginBottom: 16, width: '100%',
  },
  hint: { fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginBottom: 16 },
  btn: { backgroundColor: '#F59E0B', paddingVertical: 16, borderRadius: 12, alignItems: 'center', width: '100%' },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 15, fontWeight: '800', color: '#000' },
  linkBtn: { marginTop: 14, alignItems: 'center' },
  linkText: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  note: { textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 32, lineHeight: 18 },
});
