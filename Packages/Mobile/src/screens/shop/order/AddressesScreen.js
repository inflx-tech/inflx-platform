/**
 * O9 · Choose an address — her saved addresses, default first, with Deliver here and Edit.
 * Opened from checkout (Change) to pick one, or from Profile to manage them. Up to 10 (6.7).
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { followerApi } from '../../../services/api';
import { TopBar, Loading, Empty } from '../../../components/shop/bitsShop';
import { K, b } from '../../../components/shop/orderBits';
import { CO } from '../../../components/shop/copyOrder';
import { CS } from '../../../components/shop/copyShop';
import { fonts } from '../../../theme/tokens';

export const addressLines = (a) => [a.house || a.line1, a.area || a.line2, a.landmark, [a.city, a.state].filter(Boolean).join(', '), a.pincode].filter(Boolean).join(', ');

export default function AddressesScreen({ navigation, route }) {
  const { pick = false, onPick = null, selectedId = null } = route.params || {};
  const [list, setList] = useState(null);
  const [err, setErr] = useState(null);

  const load = useCallback(() => {
    let alive = true;
    (async () => {
      const r = await followerApi.addresses();
      if (!alive) return;
      if (r && r.success) setList(r.data.addresses || []); else { setList([]); setErr(r && r.error ? r.error.message : CS.loadError); }
    })();
    return () => { alive = false; };
  }, []);
  useFocusEffect(load);

  function remove(a) {
    Alert.alert(CO.delete, CO.deleteAsk, [
      { text: CO.cancel, style: 'cancel' },
      { text: CO.delete, style: 'destructive', onPress: async () => { await followerApi.deleteAddress(a.id); load(); } },
    ]);
  }

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <TopBar title={pick ? CO.chooseAddress : CO.addresses} onBack={() => navigation.goBack()} />
      {list === null ? <Loading /> : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }} testID="addresses">
          {!list.length ? <Empty title={CO.addAddress} testID="addresses-empty" /> : null}
          {list.map((a) => (
            <View key={a.id} style={[st.card, (selectedId === a.id) && { borderColor: K.ink, borderWidth: 2 }]} testID={`address-${a.id}`}>
              <View style={st.rowBetween}>
                <Text style={st.name}>{a.receiver_name || '—'}{a.label ? ` · ${a.label}` : ''}</Text>
                {a.is_default ? <View style={st.tag}><Text style={st.tagText}>{CO.defaultTag}</Text></View> : null}
              </View>
              <Text style={st.lines}>{addressLines(a)}</Text>
              {a.receiver_phone ? <Text style={st.lines}>{a.receiver_phone}</Text> : null}
              <View style={st.acts}>
                {pick ? (
                  <TouchableOpacity style={[b.primary, st.small]} onPress={() => { if (onPick) onPick(a); navigation.goBack(); }} testID={`deliver-here-${a.id}`}>
                    <Text style={b.primaryText}>{CO.deliverHere}</Text>
                  </TouchableOpacity>
                ) : null}
                <Text style={st.act} onPress={() => navigation.navigate('AddressForm', { address: a })} testID={`edit-address-${a.id}`}>{CO.edit}</Text>
                <Text style={[st.act, { color: K.danger }]} onPress={() => remove(a)} testID={`delete-address-${a.id}`}>{CO.delete}</Text>
              </View>
            </View>
          ))}
          {list.length < 10 ? (
            <TouchableOpacity style={st.add} onPress={() => navigation.navigate('AddressForm', { onSaved: pick ? onPick : null, backTwice: pick })} testID="add-address">
              <Text style={st.addText}>{CO.addNew}</Text>
            </TouchableOpacity>
          ) : null}
          {err ? <Text style={b.problem}>{err}</Text> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  card: { borderWidth: 1, borderColor: K.border, borderRadius: 14, padding: 12, marginBottom: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontFamily: fonts.sansBold, fontSize: 13.5, color: K.ink },
  tag: { backgroundColor: K.ink, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontFamily: fonts.sansBold, fontSize: 10.5, color: '#fff' },
  lines: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: K.ink2, marginTop: 3, lineHeight: 18 },
  acts: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 10 },
  small: { height: 38, marginTop: 0, paddingHorizontal: 16 },
  act: { fontFamily: fonts.sansBold, fontSize: 12.5, color: K.ink, textDecorationLine: 'underline' },
  add: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: K.border, borderRadius: 14, padding: 14, alignItems: 'center' },
  addText: { fontFamily: fonts.sansBold, fontSize: 13.5, color: K.ink },
});
