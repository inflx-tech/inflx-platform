import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors } from '../../theme/tokens';
import { api } from '../../services/api';

/**
 * FollowerLoginScreen — quick OTP login for followers.
 * Shows only when they try to perform an action that requires auth (pay, book, save).
 */

export default function FollowerLoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'otp' | 'register'
  const [loading, setLoading] = useState(false);

  async function handleSendOtp() {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) { Alert.alert('Enter a valid 10-digit phone number'); return; }
    setLoading(true);
    try {
      const fullPhone = cleaned.startsWith('91') ? `+${cleaned}` : `+91${cleaned}`;
      const res = await api.post('/auth/send-otp', { phone: fullPhone });
      if (res.success || res.data) {
        setStep('otp');
      } else {
        Alert.alert('Failed', res.error?.message || 'Could not send OTP');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (otp.length < 6) { Alert.alert('Enter the 6-digit OTP'); return; }
    setLoading(true);
    try {
      const cleaned = phone.replace(/\D/g, '');
      const fullPhone = cleaned.startsWith('91') ? `+${cleaned}` : `+91${cleaned}`;
      const res = await api.post('/auth/verify-otp', { phone: fullPhone, otp, role: 'follower' });

      if (res.success || res.data) {
        const token = res.data?.access_token;
        const user = res.data?.user;

        if (token) {
          await AsyncStorage.setItem('inflx_token', token);
          await AsyncStorage.setItem('inflx_user', JSON.stringify({ ...user, role: 'follower' }));

          // Try to register as follower (idempotent — if already registered, this is fine)
          try {
            await api.post('/followers/register', { name: user?.name || 'Follower', city: 'Vijayawada', state: 'AP' });
          } catch (regErr) {
            // Ignore — user might already be registered
            console.log('[Login] Register attempt:', regErr.message);
          }

          Alert.alert('Signed In!', 'You can now make payments and bookings.', [
            { text: 'Continue', onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert('Failed', 'No token received');
        }
      } else {
        Alert.alert('Invalid OTP', res.error?.message || 'Please check and try again');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.container}>
      {/* Back button */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
        <Text style={s.backText}>← Back to browsing</Text>
      </TouchableOpacity>

      <View style={s.content}>
        {/* Icon */}
        <View style={s.iconCircle}>
          <Text style={{ fontSize: 32 }}>{step === 'phone' ? '📱' : '🔑'}</Text>
        </View>

        {/* Title */}
        <Text style={s.title}>{step === 'phone' ? 'Quick Sign In' : 'Enter OTP'}</Text>
        <Text style={s.subtitle}>
          {step === 'phone'
            ? 'Sign in to make payments and bookings'
            : `We sent a 6-digit code to +91 ${phone.replace(/\D/g, '').slice(-10)}`}
        </Text>

        {/* Phone step */}
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
              style={[s.btn, phone.replace(/\D/g, '').length < 10 && s.btnDisabled]}
              onPress={handleSendOtp}
              disabled={loading || phone.replace(/\D/g, '').length < 10}
            >
              {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Send OTP →</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* OTP step */}
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
              {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Verify & Sign In →</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setStep('phone'); setOtp(''); }} style={s.linkBtn}>
              <Text style={s.linkText}>← Change phone number</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Footer note */}
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
    backgroundColor: '#0D1D2E', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12, paddingHorizontal: 20, paddingVertical: 18,
    fontSize: 28, fontWeight: '800', color: '#fff', textAlign: 'center', letterSpacing: 12,
    marginBottom: 8, width: '100%',
  },
  hint: { fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginBottom: 16 },
  btn: {
    backgroundColor: '#F59E0B', paddingVertical: 16, borderRadius: 12,
    alignItems: 'center', width: '100%',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 15, fontWeight: '800', color: '#000' },
  linkBtn: { marginTop: 14, alignItems: 'center' },
  linkText: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  note: { textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 32, lineHeight: 18 },
});
