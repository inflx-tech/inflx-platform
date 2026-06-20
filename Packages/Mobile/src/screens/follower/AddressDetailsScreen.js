import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { toing as T, fonts } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { useAppLocation } from '../../contexts/LocationContext';

/**
 * AddressDetailsScreen — Follower v2, the step AFTER the map pin.
 *
 * Receiver details (who gets the order) + location details (label, building,
 * street, area-from-map, save-as, landmark). Coords + area arrive from
 * MapPinScreen via route params. Saves via the existing addAddress (now also
 * stores receiver_name / receiver_phone / landmark — migration 107). "Entry
 * photo" deferred to a later slice. Contract: features/follower-location-redesign.
 */

const TYPES = [
  { key: 'House',  label: 'House',  icon: 'home-outline' },
  { key: 'Office', label: 'Office', icon: 'briefcase-outline' },
  { key: 'Other',  label: 'Other',  icon: 'map-marker-outline' },
];

export default function AddressDetailsScreen({ navigation, route }) {
  const { latitude, longitude, area = '', formatted = '', city = '', pincode = '' } = route.params || {};
  const { setLocation } = useAppLocation();

  const [useAccount, setUseAccount] = useState(false);
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [type, setType] = useState('House');
  const [building, setBuilding] = useState('');
  const [street, setStreet] = useState('');
  const [saveAs, setSaveAs] = useState('');
  const [landmark, setLandmark] = useState('');
  const [saving, setSaving] = useState(false);

  const onUseAccount = async () => {
    const next = !useAccount;
    setUseAccount(next);
    if (next) {
      try {
        const r = await followerApi.getMe?.();
        const me = r?.data || r || {};
        const nm = me.name || me.full_name || me.user?.name;
        const ph = me.phone || me.user?.phone || me.mobile;
        if (nm) setReceiverName(nm);
        if (ph) setReceiverPhone(String(ph));
      } catch { /* leave fields as-is */ }
    }
  };

  const pickType = (k) => {
    setType(k);
    if (k !== 'Other' && !saveAs.trim()) setSaveAs(k === 'House' ? 'Home' : 'Office');
  };

  const save = async () => {
    if (!receiverName.trim() || !receiverPhone.trim()) {
      Alert.alert('Receiver details', 'Please add the receiver name and number.');
      return;
    }
    if (!building.trim()) {
      Alert.alert('Building / Floor', 'Please add the building / floor.');
      return;
    }
    const label = (saveAs.trim() || (type === 'House' ? 'Home' : type === 'Office' ? 'Office' : 'Other'));
    setSaving(true);
    try {
      const res = await followerApi.addAddress?.({
        label,
        line1: building.trim(),
        line2: street.trim(),
        city: city || area,
        pincode,
        lat: latitude, lng: longitude,
        receiver_name: receiverName.trim(),
        receiver_phone: receiverPhone.trim(),
        landmark: landmark.trim(),
      });
      setSaving(false);
      if (res?.success) {
        const saved = res.data?.address;
        setLocation({
          label, sublabel: [building.trim(), area].filter(Boolean).join(', '),
          latitude, longitude, source: 'address', address_id: saved?.id || null,
        });
        navigation.popToTop();
      } else {
        Alert.alert('Failed', res?.error?.message || 'Could not save address');
      }
    } catch (e) {
      setSaving(false);
      Alert.alert('Failed', 'Could not save address. Please try again.');
    }
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Icon name="arrow-left" size={22} color={T.ink} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{area || 'Add address'} <Text style={s.headerSub}>{formatted ? '· ' + formatted : ''}</Text></Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 36 }}>
        {/* Receiver details */}
        <Text style={s.section}>Receiver details</Text>
        <View style={s.card}>
          <TouchableOpacity style={s.checkRow} onPress={onUseAccount} activeOpacity={0.8}>
            <Icon name={useAccount ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={useAccount ? T.yellowDeep : T.muted} />
            <Text style={s.checkText}>Use my account details</Text>
          </TouchableOpacity>
          <TextInput style={s.input} value={receiverName} onChangeText={setReceiverName} placeholder="Receiver name *" placeholderTextColor={T.hint} />
          <View style={s.inputRow}>
            <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} value={receiverPhone} onChangeText={setReceiverPhone} placeholder="Receiver's number *" placeholderTextColor={T.hint} keyboardType="phone-pad" />
            <Icon name="card-account-details-outline" size={20} color={T.muted} style={{ marginLeft: 10 }} />
          </View>
        </View>

        {/* Location details */}
        <Text style={s.section}>Location details</Text>
        <View style={s.card}>
          <View style={s.typeRow}>
            {TYPES.map((t) => (
              <TouchableOpacity key={t.key} style={[s.typeChip, type === t.key && s.typeChipActive]} onPress={() => pickType(t.key)} activeOpacity={0.85}>
                <Icon name={t.icon} size={15} color={type === t.key ? T.yellowInk : T.muted} />
                <Text style={[s.typeText, type === t.key && s.typeTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput style={s.input} value={building} onChangeText={setBuilding} placeholder="Building / Floor *" placeholderTextColor={T.hint} />
          <TextInput style={s.input} value={street} onChangeText={setStreet} placeholder="Street (Recommended)" placeholderTextColor={T.hint} />

          <View style={s.areaRow}>
            <View style={s.areaBox}>
              <Text style={s.areaLabel}>Area / Locality</Text>
              <Text style={s.areaValue} numberOfLines={2}>{formatted || area || '—'}</Text>
            </View>
            <TouchableOpacity style={s.changeBox} onPress={() => navigation.goBack()} activeOpacity={0.85}>
              <Icon name="map-marker" size={18} color={T.yellowDeep} />
              <Text style={s.changeText}>Change</Text>
            </TouchableOpacity>
          </View>

          <TextInput style={s.input} value={saveAs} onChangeText={setSaveAs} placeholder="Save address as *" placeholderTextColor={T.hint} />
          <TextInput style={[s.input, { marginBottom: 0 }]} value={landmark} onChangeText={setLandmark} placeholder="Landmark (optional)" placeholderTextColor={T.hint} />
        </View>

        <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color={T.yellowInk} /> : <Text style={s.saveText}>Save address</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.line },
  headerTitle: { flex: 1, fontSize: 16, color: T.ink, fontFamily: fonts.sansBold },
  headerSub: { fontSize: 13, color: T.muted, fontFamily: fonts.sansRegular },
  section: { fontSize: 16, color: T.ink, fontFamily: fonts.displayBold, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  card: { marginHorizontal: 16, backgroundColor: T.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: T.line },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  checkText: { fontSize: 14, color: T.ink, fontFamily: fonts.sansMedium },
  input: { borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: T.ink, fontFamily: fonts.sansRegular, marginBottom: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 0 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 22, borderWidth: 1, borderColor: T.line },
  typeChipActive: { backgroundColor: T.ink, borderColor: T.ink },
  typeText: { fontSize: 13, color: T.muted, fontFamily: fonts.sansMedium },
  typeTextActive: { color: T.white, fontFamily: fonts.sansBold },
  areaRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  areaBox: { flex: 1, borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  areaLabel: { fontSize: 11, color: T.muted, fontFamily: fonts.sansMedium },
  areaValue: { fontSize: 13, color: T.ink, fontFamily: fonts.sansRegular, marginTop: 3 },
  changeBox: { width: 92, borderWidth: 1, borderColor: T.line, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: T.yellowTint },
  changeText: { fontSize: 12, color: T.yellowDeep, fontFamily: fonts.sansBold, marginTop: 2 },
  saveBtn: { backgroundColor: T.yellow, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginHorizontal: 16, marginTop: 20 },
  saveText: { fontSize: 15, color: T.yellowInk, fontFamily: fonts.sansBold },
});
