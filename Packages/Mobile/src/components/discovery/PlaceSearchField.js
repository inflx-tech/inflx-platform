/**
 * PlaceSearchField — Google address search (server proxy) → pick → resolve to a canonical
 * city and state, adding the city to INFLX when new. Used for branches (A5) and the
 * creator's city (A8). Contract: features/item3-discovery-profiles-groups · D3
 *
 * onResolved({ placeId, formattedAddress, pincode, lat, lng, state:{id,name}, city:{id,name,added} })
 * onStateUnknown() when the server answers STATE_UNKNOWN (the message shows under the field).
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { referenceApi } from '../../services/api';
import { FieldError, Tag } from '../settings/primitives';
import { MSG3 } from './copy3';

export default function PlaceSearchField({ label, placeholder, value, onResolved, error, testID, mode = 'address' }) {
  const [q, setQ] = useState('');
  const [preds, setPreds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState('');
  const timer = useRef(null);
  const session = useRef(Math.random().toString(36).slice(2));

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 3) { setPreds([]); return undefined; }
    timer.current = setTimeout(async () => {
      setBusy(true);
      const r = await referenceApi.placesAutocomplete(q.trim(), session.current);
      setBusy(false);
      setPreds(r.success ? (r.data?.predictions || []) : []);
    }, 350);
    return () => clearTimeout(timer.current);
  }, [q]);

  async function pick(pr) {
    setPreds([]);
    setLocalErr('');
    setBusy(true);
    const r = await referenceApi.resolvePlace(pr.place_id, session.current);
    setBusy(false);
    if (!r.success) {
      if (r.error?.code === 'STATE_UNKNOWN') setLocalErr(MSG3.STATE_UNKNOWN);
      else setLocalErr(r.error?.message || (mode === 'city' ? MSG3.CITY : MSG3.BRANCH_ADDRESS));
      return;
    }
    setQ('');
    onResolved(r.data);
  }

  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      {value ? (
        <View style={s.card} testID={`${testID}-picked`}>
          <Text style={s.address}>{mode === 'city' ? `${value.city?.name || ''}${value.state?.name ? `, ${value.state.name}` : ''}` : value.formattedAddress}</Text>
          <View style={{ flexDirection: 'row', marginTop: 6 }}>
            {value.city ? <Tag label={value.city.name} /> : null}
            {value.state ? <Tag label={value.state.name} /> : null}
          </View>
        </View>
      ) : null}
      <View style={s.inputWrap}>
        <TextInput style={s.input} value={q} onChangeText={setQ} placeholder={placeholder} placeholderTextColor={T.ink3} autoCorrect={false} testID={testID} />
        {busy ? <ActivityIndicator size="small" color={T.ink3} /> : null}
      </View>
      {preds.length ? (
        <View style={s.list}>
          {preds.slice(0, 6).map(pr => (
            <TouchableOpacity key={pr.place_id} style={s.row} onPress={() => pick(pr)} testID={`place-${pr.place_id}`}>
              <Text style={s.main} numberOfLines={1}>{pr.main || pr.description}</Text>
              {pr.secondary ? <Text style={s.sec} numberOfLines={1}>{pr.secondary}</Text> : null}
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      <FieldError text={localErr || error} />
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: T.ink, marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.border, borderRadius: 10, backgroundColor: T.bg, paddingHorizontal: 12 },
  input: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 15, color: T.ink, paddingVertical: 11 },
  list: { borderWidth: 1, borderColor: T.border, borderRadius: 10, marginTop: 6, overflow: 'hidden', backgroundColor: T.bg },
  row: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border },
  main: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: T.ink },
  sec: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 1 },
  card: { backgroundColor: T.surface, borderRadius: 10, padding: 12, marginBottom: 8 },
  address: { fontFamily: fonts.sansMedium, fontSize: 13.5, color: T.ink },
});
