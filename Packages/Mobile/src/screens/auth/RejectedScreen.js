import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../theme/tokens';
import { brandApi } from '../../services/api';

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
      <Text style={styles.icon}>✅</Text>
      <Text style={styles.title}>Resubmitted!</Text>
      <Text style={styles.body}>Your application has been sent for review again.</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>❌</Text>
      <Text style={styles.title}>Application Rejected</Text>
      {reason && (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>Rejection Reason</Text>
          <Text style={styles.reasonText}>{reason}</Text>
        </View>
      )}
      <Text style={styles.body}>Please review the feedback and resubmit your application.</Text>
      <TouchableOpacity style={[styles.btn, submitting && styles.btnDisabled]} onPress={resubmit} disabled={submitting}>
        <Text style={styles.btnText}>{submitting ? 'Submitting...' : 'Resubmit Application'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  icon: { fontSize: 56, marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', color: colors.t1, marginBottom: 16, textAlign: 'center' },
  reasonBox: { backgroundColor: colors.redPale, borderRadius: 12, padding: 14, marginBottom: 16, width: '100%' },
  reasonLabel: { fontSize: 10, fontWeight: '700', color: colors.red, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  reasonText: { fontSize: 13, color: colors.t2 },
  body: { fontSize: 14, color: colors.t2, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  btn: { backgroundColor: colors.orange, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, marginBottom: 12 },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 15, fontWeight: '700', color: colors.white },
  logoutBtn: { paddingVertical: 8 },
  logoutText: { fontSize: 13, color: colors.t3 },
});
