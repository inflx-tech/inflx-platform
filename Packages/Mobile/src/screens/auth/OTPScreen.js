import React, { useState, useRef, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../theme/tokens';
import { authApi, influencerApi, brandApi } from '../../services/api';
import { AuthContext } from '../../../App';

export default function OTPScreen({ navigation, route }) {
  const { phone, role } = route.params;
  const { setRole: setAppRole } = useContext(AuthContext);
  const [otp, setOtp]             = useState(['', '', '', '', '', '']);
  const [name, setName]           = useState('');
  const [needsName, setNeedsName] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError]         = useState('');
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

  async function handleResend() {
    setError('');
    setOtp(['', '', '', '', '', '']);
    setNeedsName(false);
    setResending(true);
    const res = await authApi.sendOtp(phone);
    setResending(false);
    if (!res.success) setError(res.error?.message || 'Failed to resend OTP');
  }

  async function handleVerify() {
    const otpStr = otp.join('');
    if (otpStr.length < 6) return;
    setError('');
    if (needsName && !name.trim()) { setError('Please enter your full name'); return; }
    setLoading(true);
    const res = await authApi.verifyOtp(phone, otpStr, role, name.trim() || undefined);
    setLoading(false);
    // New user — backend requires name; reveal the field and let them retry
    if (!res.success && res.error?.field === 'name') {
      setNeedsName(true);
      setError('Please enter your full name to create your account');
      return;
    }
    if (!res.success) { setError(res.error?.message || 'Invalid OTP'); return; }

    const { access_token, user } = res.data;
    await AsyncStorage.setItem('inflx_token', access_token);
    await AsyncStorage.setItem('inflx_user', JSON.stringify(user));

    if (user.role === 'brand') {
      const brandRes = await brandApi.getMe();
      if (!brandRes.success) {
        navigation.reset({ index: 0, routes: [{ name: 'Waiting' }] });
      } else {
        const status = brandRes.data?.brand?.status || brandRes.data?.user_status;
        if (status === 'rejected') navigation.reset({ index: 0, routes: [{ name: 'Rejected' }] });
        else if (status === 'approved') setAppRole('brand');
        else navigation.reset({ index: 0, routes: [{ name: 'Waiting' }] });
      }
    } else if (user.role === 'influencer') {
      const infRes = await influencerApi.getMe();
      if (!infRes.success) {
        navigation.navigate('InfluencerRegister');
      } else {
        const status = infRes.data?.user_status;
        if (status === 'rejected') navigation.reset({ index: 0, routes: [{ name: 'Rejected' }] });
        else if (status === 'approved') setAppRole('influencer');
        else navigation.reset({ index: 0, routes: [{ name: 'Waiting' }] });
      }
    } else if (user.role === 'follower') {
      setAppRole('follower');
    } else {
      setError('This app is for brands, influencers, and followers. Admins use the web dashboard.');
    }
  }

  const otpComplete = otp.join('').length === 6;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
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

        {needsName && (
          <View style={styles.nameWrap}>
            <Text style={styles.nameLabel}>Full Name</Text>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
              placeholderTextColor={colors.t3}
              autoFocus
            />
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, (!otpComplete || loading) && styles.btnDisabled]}
          onPress={handleVerify}
          disabled={!otpComplete || loading}
        >
          <Text style={styles.btnText}>{loading ? 'Verifying...' : 'Verify OTP'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resendBtn} onPress={handleResend} disabled={resending}>
          <Text style={styles.resendText}>{resending ? 'Resending...' : 'Resend OTP'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.navyDeep, padding: 24, justifyContent: 'center' },
  back: { marginBottom: 24 },
  backText: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', color: colors.white, marginBottom: 8 },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  devHint: { fontSize: 11, color: colors.gold, marginBottom: 32, opacity: 0.7 },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 28 },
  otpBox: { width: 48, height: 56, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.07)', color: colors.white, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  otpBoxFilled: { borderColor: colors.gold, backgroundColor: 'rgba(255,184,0,0.1)' },
  nameWrap: { marginBottom: 20 },
  nameLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  nameLabelHint: { fontSize: 10, fontWeight: '400', textTransform: 'none', letterSpacing: 0 },
  nameInput: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.white },
  error: { backgroundColor: colors.redPale, borderRadius: 10, padding: 10, fontSize: 12, color: colors.red, marginBottom: 16 },
  btn: { backgroundColor: colors.orange, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  resendBtn: { marginTop: 14, alignItems: 'center', paddingVertical: 8 },
  resendText: { fontSize: 14, fontWeight: '600', color: colors.gold },
});
