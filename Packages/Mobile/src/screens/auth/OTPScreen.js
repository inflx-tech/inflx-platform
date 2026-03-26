import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../theme/tokens';
import { authApi } from '../../services/api';

export default function OTPScreen({ navigation, route }) {
  const { phone } = route.params;
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = useRef([]);

  function handleChange(index, value) {
    const char = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = char;
    setOtp(newOtp);
    if (char && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyPress(index, e) {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleVerify() {
    const otpStr = otp.join('');
    if (otpStr.length < 6) return;
    setError('');
    setLoading(true);
    const res = await authApi.verifyOtp(phone, otpStr);
    setLoading(false);
    if (!res.success) { setError(res.error?.message || 'Invalid OTP'); return; }

    const { access_token, user } = res.data;
    await AsyncStorage.setItem('inflx_token', access_token);
    await AsyncStorage.setItem('inflx_user', JSON.stringify(user));

    // Navigate based on role
    if (user.role === 'brand') {
      navigation.reset({ index: 0, routes: [{ name: 'BrandApp' }] });
    } else if (user.role === 'influencer') {
      navigation.reset({ index: 0, routes: [{ name: 'InfluencerApp' }] });
    } else if (user.role === 'follower') {
      navigation.reset({ index: 0, routes: [{ name: 'FollowerApp' }] });
    } else {
      setError('This app is for brands, influencers, and followers. Admins use the web dashboard.');
    }
  }

  const otpComplete = otp.join('').length === 6;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Enter OTP</Text>
        <Text style={styles.sub}>Sent to {phone}</Text>
        <Text style={styles.devHint}>Dev mode: use 000000</Text>

        <View style={styles.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={el => inputRefs.current[i] = el}
              style={[styles.otpBox, digit && styles.otpBoxFilled]}
              value={digit}
              onChangeText={v => handleChange(i, v)}
              onKeyPress={e => handleKeyPress(i, e)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, (!otpComplete || loading) && styles.btnDisabled]}
          onPress={handleVerify}
          disabled={!otpComplete || loading}
        >
          <Text style={styles.btnText}>{loading ? 'Verifying...' : 'Verify OTP'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navyDeep, padding: 24, justifyContent: 'center' },
  back: { marginBottom: 24 },
  backText: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', color: colors.white, marginBottom: 8 },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  devHint: { fontSize: 11, color: colors.gold, marginBottom: 32, opacity: 0.7 },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 24 },
  otpBox: { width: 48, height: 56, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.07)', color: colors.white, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  otpBoxFilled: { borderColor: colors.gold, backgroundColor: 'rgba(255,184,0,0.1)' },
  error: { backgroundColor: colors.redPale, borderRadius: 10, padding: 10, fontSize: 12, color: colors.red, marginBottom: 16 },
  btn: { backgroundColor: colors.orange, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 16, fontWeight: '700', color: colors.white },
});
