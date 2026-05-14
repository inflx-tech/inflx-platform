import React, { useState, useRef, useContext, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, AppState } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../theme/tokens';
import { authApi, influencerApi, brandApi } from '../../services/api';
import { AuthContext } from '../../../App';
import APP_ROLE from '../../config/appRole';

export default function OTPScreen({ navigation, route }) {
  const { phone, role } = route.params;
  const { setRole: setAppRole } = useContext(AuthContext);
  const [otp, setOtp]             = useState(['', '', '', '', '', '']);
  const [loading, setLoading]     = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError]         = useState('');
  const [clipboardHint, setClipboardHint] = useState('');
  const inputRefs = useRef([]);
  const autoVerifyTimer = useRef(null);
  const hasAutoVerified = useRef(false);

  // ── Clipboard OTP auto-read ──────────────────────────────────
  const checkClipboardForOtp = useCallback(async () => {
    try {
      const text = await Clipboard.getString();
      if (!text) return;
      // Extract a 6-digit number from clipboard content
      const match = text.match(/\b(\d{6})\b/);
      if (match) {
        const digits = match[1].split('');
        setOtp(digits);
        setClipboardHint('OTP pasted from clipboard');
        // Clear hint after 3 seconds
        setTimeout(() => setClipboardHint(''), 3000);
      }
    } catch (_) { /* clipboard not available */ }
  }, []);

  // Check clipboard when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkClipboardForOtp();
      }
    });
    // Also check once on mount (user may have copied OTP before opening)
    checkClipboardForOtp();
    return () => subscription.remove();
  }, [checkClipboardForOtp]);

  // ── Auto-verify when all 6 digits filled ─────────────────────
  useEffect(() => {
    const otpStr = otp.join('');
    if (otpStr.length === 6 && !hasAutoVerified.current && !loading) {
      // Short delay so user can see the filled OTP before submission
      autoVerifyTimer.current = setTimeout(() => {
        hasAutoVerified.current = true;
        handleVerify();
      }, 500);
    }
    return () => {
      if (autoVerifyTimer.current) clearTimeout(autoVerifyTimer.current);
    };
  }, [otp, loading]);

  function handleChange(index, value) {
    // Support pasting a full OTP into any box
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 6) {
      const digits = cleaned.split('');
      setOtp(digits);
      inputRefs.current[5]?.focus();
      return;
    }
    const char = cleaned.slice(-1);
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
    hasAutoVerified.current = false; // allow auto-verify again after resend
    setResending(true);
    const res = await authApi.sendOtp(phone);
    setResending(false);
    if (!res.success) setError(res.error?.message || 'Failed to resend OTP');
  }

  async function handleVerify() {
    const otpStr = otp.join('');
    if (otpStr.length < 6) return;
    setError('');
    setLoading(true);
    // No name passed — for new users the backend creates a placeholder user
    // row and the next screen (InfluencerRegister) collects real name + city
    // + handles in one shot. Avoids the double-verify-OTP bug.
    const res = await authApi.verifyOtp(phone, otpStr, role);
    setLoading(false);
    if (!res.success) { setError(res.error?.message || 'Invalid OTP'); return; }

    const { access_token, refresh_token, user } = res.data;

    // Role guard — this APK is baked for a specific flavor. Refuse to log
    // in a user whose registered role doesn't match the APK. Don't save
    // anything to AsyncStorage in this branch so the app stays on the
    // auth screen instead of silently routing to the wrong navigator.
    if (APP_ROLE && (APP_ROLE === 'brand' || APP_ROLE === 'influencer') && user.role !== APP_ROLE) {
      const appLabel   = APP_ROLE === 'brand' ? 'Brand' : 'Influencer';
      const otherLabel = user.role === 'brand' ? 'Brand'
                       : user.role === 'influencer' ? 'Influencer'
                       : user.role === 'follower' ? 'Follower'
                       : user.role === 'admin' ? 'Admin (use the web dashboard)'
                       : String(user.role || 'another role');
      setError(`This phone is registered as ${otherLabel}. Please install the ${otherLabel === 'Admin (use the web dashboard)' ? 'admin web dashboard' : otherLabel + ' app'} — this is the ${appLabel} app.`);
      return;
    }

    await AsyncStorage.setItem('inflx_token', access_token);
    if (refresh_token) {
      await AsyncStorage.setItem('inflx_refresh_token', refresh_token);
    }
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

        {clipboardHint ? <Text style={styles.clipboardHint}>{clipboardHint}</Text> : null}

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
  clipboardHint: { fontSize: 12, color: colors.gold, textAlign: 'center', marginBottom: 12, opacity: 0.8 },
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
