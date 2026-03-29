import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { colors } from '../../theme/tokens';
import { influencerApi } from '../../services/api';

export default function InfluencerRegisterScreen({ navigation }) {
  const [handle, setHandle]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleRegister() {
    setError('');
    const clean = handle.trim().replace(/^@/, '');
    if (!clean) { setError('Instagram handle is required'); return; }
    setLoading(true);
    const res = await influencerApi.register({ instagram_handle: clean });
    setLoading(false);
    if (!res.success) { setError(res.error?.message || 'Registration failed'); return; }
    navigation.reset({ index: 0, routes: [{ name: 'Waiting' }] });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        <Text style={styles.title}>Set up your profile</Text>
        <Text style={styles.sub}>Enter your Instagram handle so we can verify your account</Text>

        <Text style={styles.label}>Instagram Handle</Text>
        <View style={styles.inputRow}>
          <Text style={styles.at}>@</Text>
          <TextInput
            style={styles.input}
            value={handle}
            onChangeText={t => setHandle(t.replace(/\s/g, '').replace(/^@/, ''))}
            placeholder="yourhandle"
            placeholderTextColor={colors.t3}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, (!handle.trim() || loading) && styles.btnDisabled]}
          onPress={handleRegister}
          disabled={!handle.trim() || loading}
        >
          <Text style={styles.btnText}>{loading ? 'Registering...' : 'Complete Registration'}</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          Your profile will be reviewed by our team. You'll be notified once approved.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navyDeep, padding: 24, justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: colors.white, marginBottom: 10 },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 32, lineHeight: 21 },
  label: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 16, marginBottom: 20 },
  at: { fontSize: 18, color: colors.gold, fontWeight: '700', marginRight: 4 },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, color: colors.white },
  error: { backgroundColor: colors.redPale, borderRadius: 10, padding: 10, fontSize: 12, color: colors.red, marginBottom: 16 },
  btn: { backgroundColor: colors.orange, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  hint: { fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 18 },
});
