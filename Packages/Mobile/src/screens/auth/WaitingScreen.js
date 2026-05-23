import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  yellowPale:  '#FFF7CC',
  yellow50:    '#FFFDEB',
  yellowText:  '#6B5A00',
  success:     '#10B981',
  successPale: '#D1FAE5',
  successDeep: '#047857',
};

const MONO = Platform.OS === 'android' ? 'monospace' : 'Menlo';

/**
 * Post-registration waiting room. Three variants by route params:
 *   claimMatched=true  → "Profile recognised" (success icon)
 *   claimConflict=true → "We found a few possible matches" (yellow)
 *   neither            → "Application under review" (standard)
 */
export default function WaitingScreen({ navigation, route }) {
  const claimMatched    = route?.params?.claimMatched;
  const claimConflict   = route?.params?.claimConflict;
  const claimMatchCount = route?.params?.claimMatchCount || 0;
  const handle          = route?.params?.handle || '';

  async function logout() {
    await AsyncStorage.multiRemove(['inflx_token', 'inflx_refresh_token', 'inflx_user']);
    navigation.reset({ index: 0, routes: [{ name: 'Phone' }] });
  }

  let variant = 'standard';
  let title   = 'Application under review';
  let body    = "We're reviewing your account. We'll send you an SMS the moment it's approved.";
  let extra   = null;

  if (claimMatched) {
    variant = 'matched';
    title   = 'Profile recognised';
    body    = `Great — we already had ${handle ? '@' + handle : 'your handle'} in our database. Our admin team is verifying that the account is yours.`;
    extra   = 'Verification usually takes under 24 hours.';
  } else if (claimConflict) {
    variant = 'conflict';
    title   = 'We found a few possible matches';
    body    = `${claimMatchCount} profiles in our database could be yours. Our admin team will pick the right one.`;
    extra   = "If you've recently changed your handle, don't worry — we'll get you sorted.";
  }

  return (
    <View style={styles.container}>
      <View style={styles.center}>

        {/* status icon — Text glyph inside a colored circle (no SVG dep) */}
        <View style={[styles.iconWrap, variant === 'matched' ? styles.iconSuccess : styles.iconYellow]}>
          <Text style={[styles.iconGlyph, variant === 'matched' ? styles.glyphSuccess : styles.glyphInk]}>
            {variant === 'matched' ? '✓' : '⏱'}
          </Text>
        </View>

        {/* ETA chip — only on standard variant */}
        {variant === 'standard' && (
          <View style={styles.etaChip}>
            <View style={styles.etaDot} />
            <Text style={styles.etaText}>ETA &lt; 24h</Text>
          </View>
        )}

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>

        {extra && (
          <View style={styles.tip}>
            <Text style={styles.tipText}>{extra}</Text>
          </View>
        )}

        {/* yellow info alert — standard variant */}
        {variant === 'standard' && (
          <View style={styles.info}>
            <View style={styles.infoBadge}><Text style={styles.infoBadgeText}>i</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>WHILE YOU WAIT</Text>
              <Text style={styles.infoText}>Browse deals and influencer stores. Some actions stay locked until approval.</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.ctaBar}>
        <TouchableOpacity style={styles.btn} onPress={logout}>
          <Text style={styles.btnText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: P.bg },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },

  iconWrap:    { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  iconYellow:  { backgroundColor: P.yellowPale },
  iconSuccess: { backgroundColor: P.successPale },
  iconGlyph:   { fontSize: 38, fontWeight: '700', lineHeight: 44 },
  glyphInk:    { color: P.ink },
  glyphSuccess:{ color: P.successDeep },

  etaChip:     { flexDirection: 'row', alignItems: 'center', backgroundColor: P.surface2, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 12 },
  etaDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: P.yellow, marginRight: 6 },
  etaText:     { fontSize: 11, fontWeight: '600', color: P.ink2, fontFamily: MONO },

  title:       { fontSize: 22, fontWeight: '700', color: P.ink, marginBottom: 10, textAlign: 'center', letterSpacing: -0.4 },
  body:        { fontSize: 13.5, color: P.muted, textAlign: 'center', lineHeight: 20, marginBottom: 14 },

  tip:         { backgroundColor: P.surface2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14, width: '100%' },
  tipText:     { fontSize: 12, color: P.muted, fontStyle: 'italic', textAlign: 'center' },

  info:        { flexDirection: 'row', backgroundColor: P.yellowPale, borderLeftWidth: 3, borderLeftColor: P.yellow, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, width: '100%' },
  infoBadge:   { width: 22, height: 22, borderRadius: 11, backgroundColor: P.ink, alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1 },
  infoBadgeText:{ color: P.yellow, fontWeight: '800', fontSize: 12 },
  infoLabel:   { fontSize: 10.5, fontWeight: '700', color: P.ink2, letterSpacing: 0.4, marginBottom: 2 },
  infoText:    { fontSize: 12, color: P.ink2, lineHeight: 17 },

  ctaBar:      { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 28 },
  btn:         { backgroundColor: P.surface2, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnText:     { fontSize: 14, fontWeight: '600', color: P.muted },
});
