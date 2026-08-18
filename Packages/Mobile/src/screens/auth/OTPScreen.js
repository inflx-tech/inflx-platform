import React, { useState, useRef, useContext, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, AppState } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, influencerApi, brandApi, agencyApi } from '../../services/api';
import { AuthContext } from '../../../App';
import APP_ROLE from '../../config/appRole';

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
  yellow50:    '#FFFDEB',
  yellowPale:  '#FFF7CC',
  yellowText:  '#6B5A00',
  danger:      '#E8401A',
  dangerPale:  '#FDEEE9',
  dangerDeep:  '#B91C1C',
};

const MONO = Platform.OS === 'android' ? 'monospace' : 'Menlo';

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

  // ── Clipboard auto-read (preserved) ──
  const checkClipboardForOtp = useCallback(async () => {
    try {
      const text = await Clipboard.getString();
      if (!text) return;
      const match = text.match(/\b(\d{6})\b/);
      if (match) {
        const digits = match[1].split('');
        setOtp(digits);
        setClipboardHint('OTP pasted from clipboard');
        setTimeout(() => setClipboardHint(''), 3000);
      }
    } catch (_) { /* clipboard not available */ }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') checkClipboardForOtp();
    });
    checkClipboardForOtp();
    return () => subscription.remove();
  }, [checkClipboardForOtp]);

  // ── Auto-verify when all 6 digits filled (preserved) ──
  useEffect(() => {
    const otpStr = otp.join('');
    if (otpStr.length === 6 && !hasAutoVerified.current && !loading) {
      autoVerifyTimer.current = setTimeout(() => {
        hasAutoVerified.current = true;
        handleVerify();
      }, 500);
    }
    return () => {
      if (autoVerifyTimer.current) clearTimeout(autoVerifyTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, loading]);

  function handleChange(index, value) {
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
    hasAutoVerified.current = false;
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

    const res = await authApi.verifyOtp(phone, otpStr, role);
    setLoading(false);
    if (!res.success) { setError(res.error?.message || 'Invalid OTP'); return; }

    const { access_token, refresh_token, user } = res.data;

    // Role guard (preserved)
    if (APP_ROLE && (APP_ROLE === 'brand' || APP_ROLE === 'influencer' || APP_ROLE === 'agency') && user.role !== APP_ROLE) {
      const appLabel   = APP_ROLE === 'brand' ? 'Brand' : APP_ROLE === 'agency' ? 'Agency' : 'Influencer';
      const otherLabel = user.role === 'brand' ? 'Brand'
                       : user.role === 'influencer' ? 'Influencer'
                       : user.role === 'agency' ? 'Agency'
                       : user.role === 'follower' ? 'Follower'
                       : user.role === 'admin' ? 'Admin (use the web dashboard)'
                       : String(user.role || 'another role');
      setError(`This phone is registered as ${otherLabel}. Please install the ${otherLabel === 'Admin (use the web dashboard)' ? 'admin web dashboard' : otherLabel + ' app'} — this is the ${appLabel} app.`);
      return;
    }

    await AsyncStorage.setItem('inflx_token', access_token);
    if (refresh_token) await AsyncStorage.setItem('inflx_refresh_token', refresh_token);
    await AsyncStorage.setItem('inflx_user', JSON.stringify(user));

    if (user.role === 'brand') {
      const brandRes = await brandApi.getMe();
      if (!brandRes.success) {
        // No brands row yet — collect business details first. Sending a new
        // brand to Waiting strands them: the admin approval queue lists
        // brands rows, so there would be nothing to approve
        // (contract: features/brand-mobile-register).
        navigation.navigate('BrandRegister');
      } else {
        const status = brandRes.data?.brand?.status || brandRes.data?.user_status;
        if (status === 'rejected')      navigation.reset({ index: 0, routes: [{ name: 'Rejected' }] });
        else if (status === 'approved') setAppRole('brand');
        else                             navigation.reset({ index: 0, routes: [{ name: 'Waiting' }] });
      }
    } else if (user.role === 'influencer') {
      const infRes = await influencerApi.getMe();
      if (!infRes.success) {
        navigation.navigate('InfluencerRegister');
      } else {
        const status = infRes.data?.user_status;
        if (status === 'rejected')      navigation.reset({ index: 0, routes: [{ name: 'Rejected' }] });
        else if (status === 'approved') setAppRole('influencer');
        else                             navigation.reset({ index: 0, routes: [{ name: 'Waiting' }] });
      }
    } else if (user.role === 'agency') {
      const agRes = await agencyApi.getMe();
      if (!agRes.success) {
        navigation.navigate('AgencyRegister');
      } else {
        const status = agRes.data?.agency?.user_status;
        if (status === 'rejected')      navigation.reset({ index: 0, routes: [{ name: 'Rejected' }] });
        else if (status === 'approved') setAppRole('agency');
        else                             navigation.reset({ index: 0, routes: [{ name: 'Waiting' }] });
      }
    } else if (user.role === 'follower') {
      setAppRole('follower');
    } else {
      setError('This app is for brands, influencers, agencies, and followers. Admins use the web dashboard.');
    }
  }

  const otpComplete = otp.join('').length === 6;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: P.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Enter the 6-digit code</Text>
        <Text style={styles.sub}>Sent to <Text style={styles.subMono}>{phone}</Text></Text>

        <View style={styles.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={el => inputRefs.current[i] = el}
              style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
              value={digit}
              onChangeText={v => handleChange(i, v)}
              onKeyPress={e => handleKeyPress(i, e)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        {clipboardHint ? (
          <View style={styles.clipboardHint}>
            <Text style={styles.clipboardIcon}>⎘</Text>
            <Text style={styles.clipboardText}>{clipboardHint}</Text>
          </View>
        ) : null}

        <View style={styles.resendRow}>
          <Text style={styles.resendLabel}>Didn't get it? </Text>
          <TouchableOpacity onPress={handleResend} disabled={resending}>
            <Text style={styles.resendLink}>{resending ? 'Resending…' : 'Resend OTP'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.autoVerifyRow}>
          <Text style={styles.autoVerifyText}>Auto-verifying when you fill the last digit</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.ctaBar}>
        <TouchableOpacity
          style={[styles.btn, (!otpComplete || loading) && styles.btnDisabled]}
          onPress={handleVerify}
          disabled={!otpComplete || loading}
        >
          <Text style={styles.btnText}>{loading ? 'Verifying…' : 'Verify OTP'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll:        { flexGrow: 1, paddingHorizontal: 22, paddingTop: 32, paddingBottom: 24 },
  back:          { marginBottom: 18 },
  backText:      { fontSize: 13, color: P.muted, fontWeight: '600' },

  title:         { fontSize: 22, fontWeight: '700', color: P.ink, marginBottom: 6, letterSpacing: -0.4 },
  sub:           { fontSize: 13, color: P.muted, marginBottom: 22, lineHeight: 19 },
  subMono:       { fontFamily: MONO, fontWeight: '600', color: P.ink },

  otpRow:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14, gap: 7 },
  otpBox:        { flex: 1, height: 56, borderRadius: 12, borderWidth: 1.5, borderColor: P.border2, backgroundColor: P.surface, color: P.ink, fontSize: 22, fontWeight: '700', textAlign: 'center', fontFamily: MONO },
  otpBoxFilled:  { borderColor: P.yellow, backgroundColor: P.yellow50 },

  clipboardHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: P.yellow50, borderWidth: 1, borderColor: P.yellowPale, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  clipboardIcon: { fontSize: 13, color: P.yellowHover, fontWeight: '700', marginRight: 6 },
  clipboardText: { fontSize: 11.5, color: P.yellowText, fontWeight: '600' },

  resendRow:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  resendLabel:   { fontSize: 12.5, color: P.muted },
  resendLink:    { fontSize: 12.5, fontWeight: '600', color: P.yellowHover },

  autoVerifyRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' },
  autoVerifyText:{ fontSize: 11.5, color: P.muted2 },

  errorBox:      { backgroundColor: P.dangerPale, borderLeftWidth: 3, borderLeftColor: P.danger, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4 },
  errorText:     { fontSize: 12, color: P.dangerDeep, fontWeight: '500' },

  ctaBar:        { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 28, backgroundColor: P.bg },
  btn:           { backgroundColor: P.yellow, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnDisabled:   { opacity: 0.45 },
  btnText:       { fontSize: 15, fontWeight: '700', color: P.ink, letterSpacing: 0.2 },
});
