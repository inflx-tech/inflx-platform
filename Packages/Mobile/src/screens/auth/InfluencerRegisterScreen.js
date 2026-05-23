import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { influencerApi } from '../../services/api';

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
  yellowPale:  '#FFF7CC',
  yellowText:  '#6B5A00',
  danger:      '#E8401A',
  dangerPale:  '#FDEEE9',
  dangerDeep:  '#B91C1C',
};

const MONO = Platform.OS === 'android' ? 'monospace' : 'Menlo';

/**
 * Influencer registration. Backend tries to match the IG handle against an
 * existing scraped creator_profile; matched/conflict/no-match → 3 Waiting
 * variants. Payload + handler + navigation.reset preserved exactly.
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

    const claim = res.data?.claim || {};
    const params = {
      claimMatched:    !!claim.claimed,
      claimConflict:   !!claim.conflict,
      claimMatchCount: claim.match_count || 0,
      handle:          ig,
    };

    navigation.reset({ index: 0, routes: [{ name: 'Waiting', params }] });
  }

  const canSubmit = fullName.trim().length > 0 && igHandle.trim().length > 0 && !loading;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: P.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Set up your profile</Text>
        <Text style={styles.lede}>A few quick details so we can verify your account and match you with brands.</Text>

        <Text style={styles.label}>Full name <Text style={styles.req}>*</Text></Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Your full name"
          placeholderTextColor={P.muted3}
          autoCorrect={false}
        />

        <Text style={styles.label}>City</Text>
        <TextInput
          style={styles.input}
          value={city}
          onChangeText={setCity}
          placeholder="Hyderabad / Nellore / …"
          placeholderTextColor={P.muted3}
          autoCorrect={false}
        />

        <Text style={styles.label}>Instagram handle <Text style={styles.req}>*</Text></Text>
        <View style={styles.handleRow}>
          <Text style={styles.atSign}>@</Text>
          <TextInput
            style={styles.handleInput}
            value={igHandle}
            onChangeText={t => setIgHandle(t.replace(/\s/g, '').replace(/^@+/, ''))}
            placeholder="yourhandle"
            placeholderTextColor={P.muted3}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <Text style={styles.label}>YouTube channel <Text style={styles.opt}>(optional)</Text></Text>
        <View style={styles.handleRow}>
          <Text style={styles.atSign}>@</Text>
          <TextInput
            style={styles.handleInput}
            value={ytHandle}
            onChangeText={t => setYtHandle(t.replace(/\s/g, '').replace(/^@+/, ''))}
            placeholder="yourchannel"
            placeholderTextColor={P.muted3}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.info}>
          <View style={styles.infoBadge}><Text style={styles.infoBadgeText}>i</Text></View>
          <Text style={styles.infoText}>We'll match your handle to our creator database. If we already have you, you skip ahead.</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.ctaBar}>
        <TouchableOpacity
          style={[styles.btn, !canSubmit && styles.btnDisabled]}
          onPress={handleRegister}
          disabled={!canSubmit}
        >
          <Text style={styles.btnText}>{loading ? 'Registering…' : 'Complete registration'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll:        { flexGrow: 1, paddingHorizontal: 22, paddingTop: 40, paddingBottom: 24 },
  title:         { fontSize: 22, fontWeight: '700', color: P.ink, marginBottom: 6, letterSpacing: -0.4 },
  lede:          { fontSize: 13, color: P.muted, marginBottom: 22, lineHeight: 19 },

  label:         { fontSize: 11.5, fontWeight: '600', color: P.ink2, marginBottom: 8, marginTop: 6 },
  req:           { color: P.danger, fontWeight: '700' },
  opt:           { fontSize: 11, fontWeight: '500', color: P.muted2 },

  input:         { backgroundColor: P.surface, borderWidth: 1.5, borderColor: P.border2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: P.ink, marginBottom: 14 },

  handleRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: P.surface, borderWidth: 1.5, borderColor: P.border2, borderRadius: 12, paddingHorizontal: 14, marginBottom: 14 },
  atSign:        { fontSize: 16, color: P.yellowHover, fontWeight: '700', marginRight: 4, fontFamily: MONO },
  handleInput:   { flex: 1, paddingVertical: 13, fontSize: 14.5, color: P.ink, fontFamily: MONO },

  info:          { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: P.yellowPale, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: P.yellow, paddingHorizontal: 12, paddingVertical: 11, marginTop: 4 },
  infoBadge:     { width: 20, height: 20, borderRadius: 10, backgroundColor: P.ink, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  infoBadgeText: { color: P.yellow, fontSize: 12, fontWeight: '800' },
  infoText:      { flex: 1, fontSize: 12, color: P.ink2, lineHeight: 17 },

  errorBox:      { backgroundColor: P.dangerPale, borderLeftWidth: 3, borderLeftColor: P.danger, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 },
  errorText:     { fontSize: 12, color: P.dangerDeep, fontWeight: '500' },

  ctaBar:        { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 28, backgroundColor: P.bg },
  btn:           { backgroundColor: P.yellow, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnDisabled:   { opacity: 0.45 },
  btnText:       { fontSize: 15, fontWeight: '700', color: P.ink, letterSpacing: 0.2 },
});
