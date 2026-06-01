import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../../services/api';
import APP_ROLE from '../../config/appRole';
import Logo from '../../components/Logo';

const LAST_PHONE_KEY = 'inflx_last_phone';

// ── locked palette (yellow + white + ink, additive over existing tokens) ──
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

export default function PhoneScreen({ navigation }) {
  const [phone, setPhone]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [savedPhone, setSavedPhone]   = useState(null);

  // Load last used phone number on mount
  useEffect(() => {
    (async () => {
      try {
        const last = await AsyncStorage.getItem(LAST_PHONE_KEY);
        if (last && last.length === 10) setSavedPhone(last);
      } catch (_) { /* ignore storage errors */ }
    })();
  }, []);

  function applySavedPhone() {
    if (savedPhone) {
      setPhone(savedPhone);
      setSavedPhone(null);
    }
  }

  async function handleSend() {
    setError('');
    const formatted = phone.startsWith('+91') ? phone : `+91${phone}`;
    setLoading(true);

    try { await AsyncStorage.setItem(LAST_PHONE_KEY, phone.replace(/\D/g, '')); } catch (_) {}

    const res = await authApi.sendOtp(formatted);
    setLoading(false);
    if (res.success) {
      navigation.navigate('OTP', { phone: formatted, role: APP_ROLE });
    } else {
      setError(res.error?.message || 'Failed to send OTP');
    }
  }

  const workspaceLabel =
    APP_ROLE === 'brand'      ? 'Brand workspace' :
    APP_ROLE === 'influencer' ? 'Influencer app' :
    APP_ROLE === 'agency'     ? 'Agency app' :
    APP_ROLE === 'follower'   ? 'Discover deals' :
                                "India's micro-influencer platform";

  const canSend = phone.length === 10 && !loading;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: P.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brandWrap}>
          <Logo tone="dark" size="md" />
          <Text style={styles.tag}>{workspaceLabel}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.lede}>Sign in to continue managing your campaigns.</Text>

          {savedPhone && !phone ? (
            <TouchableOpacity style={styles.savedChip} onPress={applySavedPhone}>
              <Text style={styles.savedIcon}>↺</Text>
              <Text style={styles.savedText}>Use last number: </Text>
              <Text style={styles.savedDigits}>{savedPhone.slice(0, 4)} ••• {savedPhone.slice(8)}</Text>
              <Text style={styles.savedCta}>USE</Text>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.label}>Mobile number</Text>
          <View style={[styles.phoneRow, phone.length > 0 && styles.phoneRowFocused]}>
            <View style={styles.countryCode}>
              <Text style={styles.countryText}>🇮🇳 +91</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              value={phone}
              onChangeText={t => setPhone(t.replace(/\D/g, '').slice(0, 10))}
              keyboardType="phone-pad"
              placeholder="9876543210"
              placeholderTextColor={P.muted3}
              maxLength={10}
            />
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky bottom CTA */}
      <View style={styles.ctaBar}>
        <TouchableOpacity
          style={[styles.btn, !canSend && styles.btnDisabled]}
          onPress={handleSend}
          disabled={!canSend}
        >
          <Text style={styles.btnText}>{loading ? 'Sending OTP…' : 'Send OTP'}</Text>
        </TouchableOpacity>
        <View style={styles.hintRow}>
          <Text style={styles.hintText}>We'll send a 6-digit code.</Text>
          <Text style={styles.devPill}> dev · OTP 000000 </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll:        { flexGrow: 1, paddingHorizontal: 22, paddingTop: 56, paddingBottom: 24 },
  brandWrap:     { alignItems: 'center', marginBottom: 28 },
  tag:           { marginTop: 10, fontSize: 12, fontWeight: '500', color: P.muted2, letterSpacing: 0.3 },

  card:          { backgroundColor: P.surface, borderRadius: 20, borderWidth: 1, borderColor: P.border, padding: 22 },
  title:         { fontSize: 22, fontWeight: '700', color: P.ink, marginBottom: 4, letterSpacing: -0.4 },
  lede:          { fontSize: 13, color: P.muted, marginBottom: 18, lineHeight: 19 },

  savedChip:     { flexDirection: 'row', alignItems: 'center', backgroundColor: P.yellow50, borderWidth: 1, borderColor: P.yellowPale, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 16 },
  savedIcon:     { fontSize: 13, color: P.yellowHover, marginRight: 6, fontWeight: '700' },
  savedText:     { fontSize: 12.5, color: P.yellowText, fontWeight: '600' },
  savedDigits:   { fontSize: 13, fontWeight: '600', color: P.ink, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo', flex: 1 },
  savedCta:      { fontSize: 11, color: P.yellowHover, fontWeight: '700', letterSpacing: 0.4 },

  label:         { fontSize: 11.5, fontWeight: '600', color: P.ink2, marginBottom: 8 },
  phoneRow:      { flexDirection: 'row', borderWidth: 1.5, borderColor: P.border2, borderRadius: 12, backgroundColor: P.surface, overflow: 'hidden' },
  phoneRowFocused: { borderColor: P.yellow },
  countryCode:   { paddingHorizontal: 12, paddingVertical: 13, backgroundColor: P.surface2, borderRightWidth: 1, borderRightColor: P.border, justifyContent: 'center' },
  countryText:   { fontSize: 13.5, color: P.ink, fontWeight: '600', fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo' },
  phoneInput:    { flex: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: P.ink, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo', letterSpacing: 0.5 },

  errorBox:      { marginTop: 14, backgroundColor: P.dangerPale, borderLeftWidth: 3, borderLeftColor: P.danger, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  errorText:     { fontSize: 12, color: P.dangerDeep, fontWeight: '500' },

  ctaBar:        { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 28, backgroundColor: P.bg },
  btn:           { backgroundColor: P.yellow, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnDisabled:   { opacity: 0.45 },
  btnText:       { fontSize: 15, fontWeight: '700', color: P.ink, letterSpacing: 0.2 },
  hintRow:       { marginTop: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' },
  hintText:      { fontSize: 11.5, color: P.muted2 },
  devPill:       { fontSize: 10.5, color: P.yellowText, fontWeight: '600', backgroundColor: P.yellowPale, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 5, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo', marginLeft: 4 },
});
