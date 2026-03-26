import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../theme/tokens';

export default function WaitingScreen({ navigation }) {
  async function logout() {
    await AsyncStorage.multiRemove(['inflx_token', 'inflx_user']);
    navigation.reset({ index: 0, routes: [{ name: 'Phone' }] });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⏳</Text>
      <Text style={styles.title}>Application Under Review</Text>
      <Text style={styles.body}>Your application is being reviewed by the INFLX team. We'll notify you via SMS when approved — usually within 24 hours.</Text>
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
  icon: { fontSize: 56, marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', color: colors.t1, marginBottom: 12, textAlign: 'center' },
  body: { fontSize: 14, color: colors.t2, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  hint: { backgroundColor: colors.navyPale, borderRadius: 12, padding: 14, marginBottom: 24 },
  hintText: { fontSize: 12, color: colors.navy, fontWeight: '600', textAlign: 'center' },
  btn: { backgroundColor: colors.surface2, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  btnText: { fontSize: 14, fontWeight: '600', color: colors.t2 },
});
