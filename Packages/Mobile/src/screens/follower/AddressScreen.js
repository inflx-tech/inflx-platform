import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { creatorVibe as Cv } from '../../theme/tokens';

// Flow 52.D — Creator Vibe recolor shim. Legacy navy/teal `colors` → creatorVibe.
// Visual only; address CRUD + nav unchanged.
const colors = {
  navy: Cv.brown, navyDeep: Cv.brownDark, navyMid: Cv.brown, navyPale: Cv.soft,
  orange: Cv.brown, orangeDeep: Cv.brownDark, orangePale: Cv.soft,
  gold: Cv.star, goldPale: Cv.soft, teal: Cv.brown, tealDeep: Cv.brown, tealPale: Cv.soft,
  red: Cv.offer, redPale: Cv.soft, purple: Cv.brown, purplePale: Cv.soft,
  bg: Cv.screenBg, surface: Cv.card, surface2: Cv.soft, border: Cv.line, border2: Cv.line,
  t1: Cv.ink, t2: Cv.muted, t3: Cv.muted, white: Cv.card, black: Cv.ink,
};
import { followerApi } from '../../services/api';

const ADDRESS_TYPES = ['Home', 'Work', 'Other'];

export default function AddressScreen({ navigation, route }) {
  const { onSave } = route.params || {};
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);

  // Form fields
  const [label, setLabel]   = useState('Home');
  const [line1, setLine1]   = useState('');
  const [line2, setLine2]   = useState('');
  const [city, setCity]     = useState('');
  const [state, setState]   = useState('');
  const [pincode, setPincode] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await followerApi.getAddresses?.();
    setLoading(false);
    if (res?.success) setAddresses(res.data?.addresses || []);
  }

  async function saveAddress() {
    if (!line1.trim() || !city.trim() || !pincode.trim()) {
      Alert.alert('Required fields', 'Please fill in address, city and pincode');
      return;
    }
    setSaving(true);
    const res = await followerApi.addAddress?.({
      label, line1: line1.trim(), line2: line2.trim(),
      city: city.trim(), state: state.trim(), pincode: pincode.trim(),
    });
    setSaving(false);
    if (res?.success) {
      setShowForm(false);
      setLine1(''); setLine2(''); setCity(''); setState(''); setPincode(''); setLabel('Home');
      load();
      if (typeof onSave === 'function') onSave(res.data?.address);
    } else {
      Alert.alert('Failed', res?.error?.message || 'Could not save address');
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.navy} /></View>;
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Addresses</Text>
          <TouchableOpacity onPress={() => setShowForm(!showForm)} style={styles.addBtn}>
            <Text style={styles.addBtnText}>{showForm ? 'Cancel' : '+ Add New'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Add address form */}
      {showForm && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>New Address</Text>

          {/* Type selector */}
          <View style={styles.typeRow}>
            {ADDRESS_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.typeChip, label === t && styles.typeChipActive]}
                onPress={() => setLabel(t)}
              >
                <Text style={[styles.typeText, label === t && styles.typeTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Address Line 1</Text>
          <TextInput style={styles.input} value={line1} onChangeText={setLine1} placeholder="House no., Street name" placeholderTextColor={colors.t3} />
          <Text style={styles.fieldLabel}>Address Line 2 (optional)</Text>
          <TextInput style={styles.input} value={line2} onChangeText={setLine2} placeholder="Area, Landmark" placeholderTextColor={colors.t3} />
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>City</Text>
              <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City" placeholderTextColor={colors.t3} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>State</Text>
              <TextInput style={styles.input} value={state} onChangeText={setState} placeholder="State" placeholderTextColor={colors.t3} />
            </View>
          </View>
          <Text style={styles.fieldLabel}>Pincode</Text>
          <TextInput style={styles.input} value={pincode} onChangeText={setPincode} placeholder="6-digit pincode" placeholderTextColor={colors.t3} keyboardType="number-pad" maxLength={6} />

          <TouchableOpacity
            style={[styles.saveBtn, (saving || !line1 || !city || !pincode) && { opacity: 0.5 }]}
            onPress={saveAddress}
            disabled={saving || !line1 || !city || !pincode}
          >
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Save Address</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Address list */}
      {addresses.length === 0 && !showForm ? (
        <View style={[styles.card, { alignItems: 'center', paddingVertical: 32 }]}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>📍</Text>
          <Text style={styles.emptyText}>No addresses saved</Text>
          <TouchableOpacity style={styles.addFirstBtn} onPress={() => setShowForm(true)}>
            <Text style={styles.addFirstBtnText}>Add Your First Address</Text>
          </TouchableOpacity>
        </View>
      ) : (
        addresses.map(addr => (
          <View key={addr.id} style={styles.card}>
            <View style={styles.addrHeader}>
              <View style={styles.addrTypeChip}>
                <Text style={styles.addrTypeText}>{addr.label || addr.type || 'Home'}</Text>
              </View>
            </View>
            <Text style={styles.addrText}>
              {[addr.line1, addr.line2].filter(Boolean).join(', ')}
            </Text>
            <Text style={styles.addrCity}>
              {[addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}
            </Text>
          </View>
        ))
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  back: { marginBottom: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: colors.white },
  addBtn: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  addBtnText: { fontSize: 12, fontWeight: '700', color: colors.white },
  card: { margin: 16, marginBottom: 0, backgroundColor: colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 12 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  typeChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  typeText: { fontSize: 12, fontWeight: '600', color: colors.t2 },
  typeTextActive: { color: colors.white },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.t3, textTransform: 'uppercase', marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 2, borderColor: colors.border2, borderRadius: 12, padding: 12, fontSize: 14, color: colors.t1 },
  row2: { flexDirection: 'row', gap: 10 },
  saveBtn: { backgroundColor: colors.navy, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: colors.white },
  emptyText: { fontSize: 13, color: colors.t3, marginBottom: 12 },
  addFirstBtn: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.navy, borderRadius: 12 },
  addFirstBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },
  addrHeader: { marginBottom: 6 },
  addrTypeChip: { backgroundColor: colors.navy + '18', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  addrTypeText: { fontSize: 10, fontWeight: '700', color: colors.navy },
  addrText: { fontSize: 13, color: colors.t1, fontWeight: '500', marginBottom: 2 },
  addrCity: { fontSize: 12, color: colors.t3 },
});
