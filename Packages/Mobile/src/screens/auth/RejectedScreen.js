import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { brandApi } from '../../services/api';

const P = {
  bg:          '#FAFAFA',
  surface:     '#FFFFFF',
  surface2:    '#F4F4F5',
  ink:         '#0A0A0A',
  ink2:        '#18181B',
  muted:       '#52525B',
  muted2:      '#71717A',
  border:      '#E4E4E7',
  yellow:      '#FFC107',
  yellowHover: '#E0A800',
  success:     '#10B981',
  successPale: '#D1FAE5',
  successDeep: '#047857',
  danger:      '#E8401A',
  dangerPale:  '#FDEEE9',
  dangerDeep:  '#B91C1C',
};

const MONO = Platform.OS === 'android' ? 'monospace' : 'Menlo';

export default function RejectedScreen({ navigation, route }) {
  const reason = route.params?.rejection_reason;
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function resubmit() {
    setSubmitting(true);
    await brandApi.resubmit({ notes: 'Resubmitting application' });
    setSubmitting(false);
    setSubmitted(true);
  }

  async function logout() {
    await AsyncStorage.multiRemove(['inflx_token', 'inflx_refresh_token', 'inflx_user']);
    navigation.reset({ index: 0, routes: [{ name: 'Phone' }] });
  }

  if (submitted) return (
    <View style={styles.container}>
      <View style={styles.center}>
        <View style={[styles.iconWrap, { backgroundColor: P.successPale }]}>
          <Text style={[styles.iconGlyph, { color: P.successDeep }]}>✓</Text>
        </View>
        <Text style={styles.title}>Resubmitted</Text>
        <Text style={styles.body}>Your application has been sent for review again. You'll get an SMS once it's approved.</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <View style={[styles.iconWrap, { backgroundColor: P.dangerPale }]}>
          <Text style={[styles.iconGlyph, { color: P.dangerDeep }]}>!</Text>
        </View>

        <Text style={styles.title}>Your application needs a fix</Text>
        <Text style={styles.body}>Admin noted something to correct. Once you resubmit, review usually takes under a day.</Text>

        {reason ? (
          <View style={styles.reason}>
            <View style={styles.reasonBadge}><Text style={styles.reasonBadgeText}>!</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reasonLabel}>REASON FROM ADMIN</Text>
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.ctaBar}>
        <TouchableOpacity
          style={[styles.btn, submitting && styles.btnDisabled]}
          onPress={resubmit}
          disabled={submitting}
        >
          <Text style={styles.btnText}>{submitting ? 'Submitting…' : 'Update & resubmit'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnGhost} onPress={logout}>
          <Text style={styles.btnGhostText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: P.bg },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },

  iconWrap:    { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  iconGlyph:   { fontSize: 40, fontWeight: '800', lineHeight: 46 },

  title:       { fontSize: 22, fontWeight: '700', color: P.ink, marginBottom: 10, textAlign: 'center', letterSpacing: -0.4 },
  body:        { fontSize: 13.5, color: P.muted, textAlign: 'center', lineHeight: 20, marginBottom: 18 },

  reason:      { flexDirection: 'row', backgroundColor: P.dangerPale, borderLeftWidth: 3, borderLeftColor: P.danger, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, width: '100%' },
  reasonBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: P.danger, alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1 },
  reasonBadgeText:{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  reasonLabel: { fontSize: 10.5, fontWeight: '700', color: P.dangerDeep, letterSpacing: 0.4, marginBottom: 2 },
  reasonText:  { fontSize: 12, color: P.ink2, lineHeight: 17 },

  ctaBar:      { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 28 },
  btn:         { backgroundColor: P.yellow, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.45 },
  btnText:     { fontSize: 15, fontWeight: '700', color: P.ink, letterSpacing: 0.2 },
  btnGhost:    { paddingVertical: 10, alignItems: 'center' },
  btnGhostText:{ fontSize: 13, fontWeight: '600', color: P.muted },
});
