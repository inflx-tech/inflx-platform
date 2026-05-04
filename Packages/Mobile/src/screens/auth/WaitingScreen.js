import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../theme/tokens';

/**
 * Post-registration waiting room.
 *
 * The InfluencerRegister screen passes route params describing whether
 * the just-registered handle was matched against an existing scraped
 * creator_profile. Three states:
 *
 *   claimMatched=true                     → "Profile recognised. Admin
 *                                            verifying ownership."
 *   claimConflict=true                    → "Multiple profiles matched.
 *                                            Admin will pick the right one."
 *   neither (no match)                    → standard "Application under
 *                                            review" message.
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

  let icon = '⏳';
  let title = 'Application Under Review';
  let body  = "Your application is being reviewed by the INFLX team. We'll notify you via SMS when approved — usually within 24 hours.";
  let extraNote = null;

  if (claimMatched) {
    icon  = '✓';
    title = 'Profile recognised';
    body  = `Great — we already had ${handle ? '@' + handle : 'your handle'} in our creator database. Our admin team is verifying that the account is yours. You'll get an SMS the moment it's done.`;
    extraNote = 'Verification usually takes under 24 hours.';
  } else if (claimConflict) {
    icon  = '🤔';
    title = "We found a few possible matches";
    body  = `${claimMatchCount} different creator profiles in our database could be yours. Our admin team will pick the right one and confirm your account. You'll get an SMS once it's sorted.`;
    extraNote = "If you've recently changed your Instagram handle, don't worry — we'll get you sorted.";
  }

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {extraNote ? (
        <View style={styles.tip}>
          <Text style={styles.tipText}>{extraNote}</Text>
        </View>
      ) : null}
      <View style={styles.hint}>
        <Text style={styles.hintText}>💡 Dev: Approve at localhost:3003 (Admin Dashboard)</Text>
      </View>
      <TouchableOpacity style={styles.btn} onPress={logout}>
        <Text style={styles.btnText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  icon:      { fontSize: 56, marginBottom: 20 },
  title:     { fontSize: 22, fontWeight: '800', color: colors.t1, marginBottom: 12, textAlign: 'center' },
  body:      { fontSize: 14, color: colors.t2, textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  tip:       { backgroundColor: colors.surface2, borderRadius: 10, padding: 12, marginBottom: 12 },
  tipText:   { fontSize: 12, color: colors.t2, textAlign: 'center', fontStyle: 'italic' },
  hint:      { backgroundColor: colors.navyPale, borderRadius: 12, padding: 14, marginBottom: 24, marginTop: 8 },
  hintText:  { fontSize: 12, color: colors.navy, fontWeight: '600', textAlign: 'center' },
  btn:       { backgroundColor: colors.surface2, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  btnText:   { fontSize: 14, fontWeight: '600', color: colors.t2 },
});
