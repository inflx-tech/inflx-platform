import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { colors } from '../../theme/tokens';
import { influencerApi } from '../../services/api';

/**
 * Influencer registration screen.
 *
 * Asks for both Instagram handle (required) and YouTube handle (optional).
 * The backend tries to match either against existing creator_profiles
 * rows pushed in by the marketing-automation pipeline. If exactly one
 * profile matches, that profile is "claimed" — the user lands on the
 * Waiting screen with a clearer message that admin review is in flight.
 *
 * If multiple profiles match (handle conflict), the user is still
 * Waiting — admin resolves the conflict manually from the verification
 * queue. We surface this as a soft success ("we'll get you sorted")
 * rather than an error since it's not the user's fault.
 */
export default function InfluencerRegisterScreen({ navigation }) {
  const [fullName,    setFullName]    = useState('');
  const [city,        setCity]        = useState('');
  const [igHandle,    setIgHandle]    = useState('');
  const [ytHandle,    setYtHandle]    = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  const cleanHandle = (raw) => raw.trim().replace(/^@+/, '').replace(/\s/g, '').toLowerCase();

  async function handleRegister() {
    setError('');
    const nm = fullName.trim();
    const ct = city.trim();
    const ig = cleanHandle(igHandle);
    const yt = cleanHandle(ytHandle);
    if (!nm) { setError('Please enter your full name'); return; }
    if (!ig) { setError('Instagram handle is required'); return; }

    setLoading(true);
    const body = { name: nm, instagram_handle: ig };
    if (ct) body.city = ct;
    if (yt) body.youtube_handle = yt;
    const res = await influencerApi.register(body);
    setLoading(false);

    if (!res.success) { setError(res.error?.message || 'Registration failed'); return; }

    // Backend returns { influencer, user_status, claim:{ match_count, claimed, conflict, ... }}.
    // Decide which post-registration screen to show based on the outcome.
    const claim = res.data?.claim || {};
    const params = {
      claimMatched:    !!claim.claimed,
      claimConflict:   !!claim.conflict,
      claimMatchCount: claim.match_count || 0,
      handle:          ig,
    };

    navigation.reset({ index: 0, routes: [{ name: 'Waiting', params }] });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <Text style={styles.title}>Set up your profile</Text>
          <Text style={styles.sub}>
            Just a few quick details so we can verify your account and match
            you with brands.
          </Text>

          <Text style={styles.label}>Full Name <Text style={styles.required}>*</Text></Text>
          <View style={styles.inputRowPlain}>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              placeholderTextColor={colors.t3}
              autoCorrect={false}
            />
          </View>

          <Text style={styles.label}>City</Text>
          <View style={styles.inputRowPlain}>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="Hyderabad / Nellore / …"
              placeholderTextColor={colors.t3}
              autoCorrect={false}
            />
          </View>

          <Text style={styles.label}>Instagram Handle <Text style={styles.required}>*</Text></Text>
          <View style={styles.inputRow}>
            <Text style={styles.at}>@</Text>
            <TextInput
              style={styles.input}
              value={igHandle}
              onChangeText={t => setIgHandle(t.replace(/\s/g, '').replace(/^@+/, ''))}
              placeholder="yourhandle"
              placeholderTextColor={colors.t3}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Text style={styles.label}>YouTube Channel Handle <Text style={styles.optional}>(optional)</Text></Text>
          <View style={styles.inputRow}>
            <Text style={styles.at}>@</Text>
            <TextInput
              style={styles.input}
              value={ytHandle}
              onChangeText={t => setYtHandle(t.replace(/\s/g, '').replace(/^@+/, ''))}
              placeholder="yourchannel"
              placeholderTextColor={colors.t3}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, (!fullName.trim() || !igHandle.trim() || loading) && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={!fullName.trim() || !igHandle.trim() || loading}
          >
            <Text style={styles.btnText}>{loading ? 'Registering...' : 'Complete Registration'}</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            We&apos;ll match your handle to our creator database and our team will review your profile.
            You&apos;ll be notified once verified.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll:      { flexGrow: 1, backgroundColor: colors.navyDeep },
  container:   { flex: 1, padding: 24, justifyContent: 'center', minHeight: '100%' },
  title:       { fontSize: 26, fontWeight: '800', color: colors.white, marginBottom: 10 },
  sub:         { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 28, lineHeight: 21 },
  label:       { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  required:    { color: colors.orange },
  optional:    { color: 'rgba(255,255,255,0.4)', textTransform: 'none', letterSpacing: 0 },
  inputRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 16, marginBottom: 20 },
  inputRowPlain: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 16, marginBottom: 20 },
  at:          { fontSize: 18, color: colors.gold, fontWeight: '700', marginRight: 4 },
  input:       { flex: 1, paddingVertical: 14, fontSize: 16, color: colors.white },
  error:       { backgroundColor: colors.redPale, borderRadius: 10, padding: 10, fontSize: 12, color: colors.red, marginBottom: 16 },
  btn:         { backgroundColor: colors.orange, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
  btnDisabled: { opacity: 0.5 },
  btnText:     { fontSize: 16, fontWeight: '700', color: colors.white },
  hint:        { fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 18 },
});
