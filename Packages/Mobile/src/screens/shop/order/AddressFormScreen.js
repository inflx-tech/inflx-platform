/**
 * O10 · Add an address (by hand) — name, 10-digit phone, house, area, landmark (optional), 6-digit
 * pincode, city, state from the list, Home / Work / Other, default. Any 6-digit pincode is accepted
 * for now (6.7). The server checks every field again.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Switch, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { followerApi } from '../../../services/api';
import { TopBar, Chip } from '../../../components/shop/bitsShop';
import { Sheet, K, b } from '../../../components/shop/orderBits';
import { CO } from '../../../components/shop/copyOrder';
import { fonts } from '../../../theme/tokens';

const FIELDS = ['receiver_name', 'receiver_phone', 'house', 'area', 'landmark', 'pincode', 'city'];
const LABEL = { receiver_name: CO.f.name, receiver_phone: CO.f.phone, house: CO.f.house, area: CO.f.area, landmark: CO.f.landmark, pincode: CO.f.pincode, city: CO.f.city };

export default function AddressFormScreen({ navigation, route }) {
  const { address = null, onSaved = null, backTwice = false } = route.params || {};
  const [v, setV] = useState(() => ({
    receiver_name: address ? address.receiver_name || '' : '', receiver_phone: address ? address.receiver_phone || '' : '',
    house: address ? address.house || address.line1 || '' : '', area: address ? address.area || address.line2 || '' : '',
    landmark: address ? address.landmark || '' : '', pincode: address ? address.pincode || '' : '', city: address ? address.city || '' : '',
    state: address ? address.state || '' : '', label: address ? address.label || 'Home' : 'Home', is_default: address ? !!address.is_default : false,
  }));
  const [states, setStates] = useState([]);
  const [picking, setPicking] = useState(false);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    followerApi.states().then((r) => {
      if (r && r.success) setStates((r.data.items || []).map((x) => x.name).filter(Boolean));
    }).catch(() => {});
  }, []);

  const set = (k) => (t) => setV((x) => ({ ...x, [k]: t }));
  const ok = /^[6-9]\d{9}$/.test(v.receiver_phone.replace(/\D/g, '').slice(-10)) && /^[1-9]\d{5}$/.test(v.pincode)
    && v.receiver_name.trim() && v.house.trim() && v.area.trim() && v.city.trim() && v.state;

  async function save() {
    setBusy(true); setErr(null);
    const body = { ...v, receiver_phone: v.receiver_phone.replace(/\D/g, '').slice(-10) };
    const r = address ? await followerApi.updateAddress(address.id, body) : await followerApi.addAddress(body);
    setBusy(false);
    if (!r || !r.success) { setErr(r && r.error ? r.error.message : 'Could not save'); return; }
    if (onSaved) onSaved(r.data.address);
    navigation.goBack();
    if (backTwice && onSaved) setTimeout(() => navigation.goBack(), 50);
  }

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <TopBar title={address ? CO.editAddress : CO.addAddress} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }} keyboardShouldPersistTaps="handled" testID="address-form">
          {FIELDS.map((k) => (
            <View key={k} style={{ marginBottom: 10 }}>
              <Text style={st.lab}>{LABEL[k]}</Text>
              <TextInput value={v[k]} onChangeText={set(k)} style={st.input} testID={`field-${k}`}
                keyboardType={k === 'receiver_phone' || k === 'pincode' ? 'number-pad' : 'default'}
                maxLength={k === 'pincode' ? 6 : k === 'receiver_phone' ? 10 : 200} />
            </View>
          ))}
          <Text style={st.lab}>{CO.f.state}</Text>
          <TouchableOpacity style={st.input} onPress={() => setPicking(true)} testID="field-state">
            <Text style={[st.inputText, !v.state && { color: K.ink3 }]}>{v.state || CO.pickState}</Text>
          </TouchableOpacity>
          <View style={st.chips}>
            {CO.labels.map((l) => <Chip key={l} label={l} on={v.label === l} onPress={() => setV((x) => ({ ...x, label: l }))} testID={`label-${l}`} />)}
          </View>
          <View style={st.def}>
            <Text style={st.defText}>{CO.makeDefault}</Text>
            <Switch value={v.is_default} onValueChange={(x) => setV((y) => ({ ...y, is_default: x }))} testID="field-default" />
          </View>
          {err ? <Text style={b.problem} testID="address-error">{err}</Text> : null}
          <TouchableOpacity style={[b.primary, (!ok || busy) && b.primaryDis]} disabled={!ok || busy} onPress={save} testID="save-address">
            <Text style={b.primaryText}>{CO.saveAddress}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      <Sheet visible={picking} onClose={() => setPicking(false)} tall testID="state-picker">
        <ScrollView style={{ maxHeight: 480 }}>
          {states.map((s) => (
            <TouchableOpacity key={s} onPress={() => { setV((x) => ({ ...x, state: s })); setPicking(false); }} style={st.stateRow} testID={`state-${s}`}>
              <Text style={[st.inputText, v.state === s && { fontFamily: fonts.sansBold }]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Sheet>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  lab: { fontFamily: fonts.sansBold, fontSize: 12, color: K.ink2, marginBottom: 4 },
  input: { borderWidth: 1.5, borderColor: K.border, borderRadius: 12, paddingHorizontal: 12, height: 46, justifyContent: 'center', fontFamily: fonts.sansRegular, fontSize: 14, color: K.ink },
  inputText: { fontFamily: fonts.sansRegular, fontSize: 14, color: K.ink },
  chips: { flexDirection: 'row', gap: 8, marginTop: 14 },
  def: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  defText: { fontFamily: fonts.sansBold, fontSize: 13, color: K.ink },
  stateRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F0EB' },
});
