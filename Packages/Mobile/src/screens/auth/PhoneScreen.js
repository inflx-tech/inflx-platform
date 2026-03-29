import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { colors } from '../../theme/tokens';
import { authApi } from '../../services/api';
import APP_ROLE from '../../config/appRole';

export default function PhoneScreen({ navigation }) {
  const [phone, setPhone]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  async function handleSend() {
    setError('');
    const formatted = phone.startsWith('+91') ? phone : `+91${phone}`;
    setLoading(true);
    const res = await authApi.sendOtp(formatted);
    setLoading(false);
    if (res.success) {
      navigation.navigate('OTP', { phone: formatted, role: APP_ROLE });
    } else {
      setError(res.error?.message || 'Failed to send OTP');
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <Text style={styles.logo}>INFL<Text style={styles.logoX}>X</Text></Text>
          <Text style={styles.logoSub}>India's Micro-Influencer Platform</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Welcome</Text>
          <Text style={styles.sub}>Enter your mobile number</Text>

          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.phoneRow}>
            <View style={styles.countryCode}>
              <Text style={styles.countryText}>🇮🇳 +91</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              value={phone}
              onChangeText={t => setPhone(t.replace(/\D/g, '').slice(0, 10))}
              keyboardType="phone-pad"
              placeholder="9876543210"
              placeholderTextColor={colors.t3}
              maxLength={10}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, (loading || phone.length < 10) && styles.btnDisabled]}
            onPress={handleSend}
            disabled={loading || phone.length < 10}
          >
            <Text style={styles.btnText}>{loading ? 'Sending OTP...' : 'Send OTP'}</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>Dev mode: any number works, OTP is 000000</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navyDeep, alignItems: 'center', justifyContent: 'center', padding: 24, minHeight: '100%' },
  logoWrap: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 36, fontWeight: '800', color: colors.white, letterSpacing: -1 },
  logoX: { color: colors.orange },
  logoSub: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 },
  card: { backgroundColor: colors.white, borderRadius: 20, padding: 24, width: '100%', maxWidth: 360 },
  title: { fontSize: 20, fontWeight: '700', color: colors.t1, marginBottom: 6 },
  sub: { fontSize: 13, color: colors.t3, marginBottom: 20, lineHeight: 20 },
  label: { fontSize: 11, fontWeight: '700', color: colors.t2, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  phoneRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  countryCode: { backgroundColor: colors.surface2, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border2, paddingHorizontal: 12, paddingVertical: 14, justifyContent: 'center' },
  countryText: { fontSize: 14, color: colors.t1, fontWeight: '600' },
  phoneInput: { flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border2, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.t1 },
  btn: { backgroundColor: colors.orange, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 15, fontWeight: '700', color: colors.white },
  error: { backgroundColor: colors.redPale, borderRadius: 10, padding: 10, fontSize: 12, color: colors.red, marginBottom: 12 },
  hint: { fontSize: 11, color: colors.t3, textAlign: 'center' },
});
