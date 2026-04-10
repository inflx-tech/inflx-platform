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
  const [step, setStep] = useState('phone'); // 'phone' | 'otp' | 'register'
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');

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
    if (otp.length < 4) { Alert.alert('Enter a valid OTP'); return; }
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

          // Check if follower profile exists
          if (user?.status === 'approved') {
            Alert.alert('Welcome back!', 'You are now signed in.', [
              { text: 'Continue', onPress: () => navigation.goBack() },
            ]);
          } else {
            // New user — need to register as follower
            setStep('register');
          }
        }
      } else {
        Alert.alert('Invalid OTP', res.error?.message || 'Please try again');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    if (!name.trim()) { Alert.alert('Enter your name'); return; }
    setLoading(true);
    try {
      const res = await api.post('/followers/register', { name: name.trim(), city: 'Vijayawada', state: 'AP' });
      if (res.success || res.data) {
        Alert.alert('Welcome to INFLX!', 'You are now signed in.', [
          { text: 'Continue', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Failed', res.error?.message || 'Could not register');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
        <Text style={s.backText}>← Back to browsing</Text>
      </TouchableOpacity>

      <View style={s.card}>
        <Text style={s.emoji}>🔐</Text>
        <Text style={s.title}>
          {step === 'phone' ? 'Quick Sign In' :
           step === 'otp' ? 'Enter OTP' : 'Almost Done!'}
        </Text>
        <Text style={s.subtitle}>
          {step === 'phone' ? 'Sign in to make payments and bookings' :
           step === 'otp' ? `We sent a code to +91${phone.replace(/\D/g, '').slice(-10)}` :
           'Just tell us your name'}
        </Text>

        {step === 'phone' && (
          <>
            <View style={s.inputWrap}>
              <Text style={s.prefix}>+91</Text>
              <TextInput
                style={s.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="Enter phone number"
                placeholderTextColor={darkColors.textMuted}
                maxLength={10}
              />
            </View>
            <TouchableOpacity style={s.btn} onPress={handleSendOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Send OTP →</Text>}
            </TouchableOpacity>
          </>
        )}

        {step === 'otp' && (
          <>
            <TextInput
              style={[s.input, s.otpInput]}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              placeholder="Enter 6-digit OTP"
              placeholderTextColor={darkColors.textMuted}
              maxLength={6}
            />
            <Text style={s.hint}>For testing: use OTP 000000</Text>
            <TouchableOpacity style={s.btn} onPress={handleVerifyOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Verify & Sign In →</Text>}
            </TouchableOpacity>
          </>
        )}

        {step === 'register' && (
          <>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={darkColors.textMuted}
            />
            <TouchableOpacity style={s.btn} onPress={handleRegister} disabled={loading}>
              {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Get Started →</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>

      <Text style={s.note}>Browse deals freely without signing in.{'\n'}Sign in is only needed for payments & bookings.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: darkColors.bg, justifyContent: 'center', padding: 20 },
  backBtn: { position: 'absolute', top: 50, left: 20 },
  backText: { color: darkColors.amber, fontSize: 13, fontWeight: '600' },
  card: {
    backgroundColor: darkColors.card, borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: darkColors.border, alignItems: 'center',
  },
  emoji: { fontSize: 40, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: darkColors.text, marginBottom: 4 },
  subtitle: { fontSize: 12, color: darkColors.textSecondary, marginBottom: 20, textAlign: 'center' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', width: '100%',
    backgroundColor: darkColors.input, borderRadius: 12,
    borderWidth: 1.5, borderColor: darkColors.border, marginBottom: 14,
  },
  prefix: { paddingHorizontal: 14, fontSize: 15, fontWeight: '600', color: darkColors.textSecondary, borderRightWidth: 1, borderRightColor: darkColors.border, paddingVertical: 14 },
  input: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16,
    fontWeight: '600', color: darkColors.text, backgroundColor: darkColors.input,
    borderRadius: 12, borderWidth: 1.5, borderColor: darkColors.border, width: '100%',
  },
  otpInput: { textAlign: 'center', letterSpacing: 8, fontSize: 22, marginBottom: 8 },
  hint: { fontSize: 10, color: darkColors.textMuted, marginBottom: 14 },
  btn: {
    width: '100%', backgroundColor: darkColors.amber, paddingVertical: 15,
    borderRadius: 12, alignItems: 'center', marginTop: 4,
  },
  btnText: { fontSize: 15, fontWeight: '800', color: '#000' },
  note: { textAlign: 'center', fontSize: 11, color: darkColors.textMuted, marginTop: 20, lineHeight: 18 },
});
