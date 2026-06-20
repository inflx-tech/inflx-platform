import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { toing as T, fonts } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { isGpsAvailable, ensureLocationPermission, getCurrentPosition } from '../../utils/geolocation';

/**
 * AddressScreen — Follower v2, step L4 (white/yellow toing skin).
 *
 * Saved-address CRUD + add form. A saved address must be Google-locatable:
 * verify (forward geocode) or "use current" (GPS + reverse geocode) sets the
 * coords; save is blocked without resolvable coords (no null-coord persist).
 * Logic unchanged from the prior version — visual + the auto-open-form on
 * arrival via "Add new address". Contract: features/follower-location-redesign.
 */

const ADDRESS_TYPES = ['Home', 'Work', 'Other'];
const typeIcon = (t) => (t === 'Work' ? 'briefcase-outline' : t === 'Home' ? 'home-outline' : 'map-marker-outline');
function newSession() { return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`; }

export default function AddressScreen({ navigation, route }) {
  const { onSave, add } = route.params || {};
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(!!add);
  const [saving, setSaving]       = useState(false);

  // Form fields
  const [label, setLabel]   = useState('Home');
  const [line1, setLine1]   = useState('');
  const [line2, setLine2]   = useState('');
  const [city, setCity]     = useState('');
  const [state, setState]   = useState('');
  const [pincode, setPincode] = useState('');
  // Geocode-verify state: a saved address must be Google-locatable.
  const [located, setLocated] = useState(null);   // { lat, lng, area_name } | null
  const [verifying, setVerifying] = useState(false);
  const [locMsg, setLocMsg] = useState(null);      // { ok, text }

  // Google Places autocomplete for the address search bar.
  const [searchQ, setSearchQ] = useState('');
  const [searchPreds, setSearchPreds] = useState([]);
  const [searching, setSearching] = useState(false);
  const session = useRef(newSession());
  const sTimer = useRef(null);

  useEffect(() => { load(); }, []);

  // Debounced autocomplete: type an area / building → Google suggestions.
  useEffect(() => {
    if (sTimer.current) clearTimeout(sTimer.current);
    const term = searchQ.trim();
    if (term.length < 2) { setSearchPreds([]); setSearching(false); return; }
    setSearching(true);
    sTimer.current = setTimeout(async () => {
      try {
        const r = await followerApi.placesAutocomplete(term, { session: session.current });
        setSearchPreds((r?.data || r)?.predictions || []);
      } catch { setSearchPreds([]); }
      finally { setSearching(false); }
    }, 320);
    return () => sTimer.current && clearTimeout(sTimer.current);
  }, [searchQ]);

  // Pick a suggestion → fetch exact coords + components → pre-fill the form.
  async function pickPrediction(pred) {
    setSearching(true);
    try {
      const r = await followerApi.placeDetails(pred.place_id, session.current);
      const d = r?.data || r;
      if (d?.lat != null) {
        setLocated({ lat: d.lat, lng: d.lng, area_name: d.area_name });
        setLine2(d.area_name || pred.secondary || pred.main || '');
        if (d.city) setCity(d.city);
        if (d.state) setState(d.state);
        if (d.pincode) setPincode(d.pincode);
        setLocMsg({ ok: true, text: `Located: ${d.area_name || pred.main || d.formatted_address || 'address found'}` });
        setSearchQ(''); setSearchPreds([]);
        session.current = newSession();
      }
    } catch { /* keep form open */ }
    finally { setSearching(false); }
  }

  const addrQuery = () => [line1, line2, city, state, pincode].map((x) => x.trim()).filter(Boolean).join(', ');

  async function verifyAddress() {
    const q = addrQuery();
    if (!q) return;
    setVerifying(true); setLocMsg(null);
    try {
      const r = await followerApi.geocodeAddress(q);
      const d = r?.data || r;
      if (d?.found) { setLocated({ lat: d.lat, lng: d.lng, area_name: d.area_name }); setLocMsg({ ok: true, text: `Located: ${d.area_name || d.formatted_address || 'address found'}` }); }
      else { setLocated(null); setLocMsg({ ok: false, text: "Couldn't locate this address — add area / city / pincode." }); }
    } catch { setLocated(null); setLocMsg({ ok: false, text: 'Could not verify right now. Try again.' }); }
    finally { setVerifying(false); }
  }

  async function useCurrent() {
    setVerifying(true); setLocMsg(null);
    try {
      if (!isGpsAvailable()) { setLocMsg({ ok: false, text: 'GPS needs the latest app version.' }); return; }
      const ok = await ensureLocationPermission();
      if (!ok) { setLocMsg({ ok: false, text: 'Location permission denied.' }); return; }
      const c = await getCurrentPosition();
      if (!c) { setLocMsg({ ok: false, text: 'Could not get your location.' }); return; }
      const r = await followerApi.reverseGeocode(c.latitude, c.longitude);
      const area = (r?.data || r)?.area_name || null;
      setLocated({ lat: c.latitude, lng: c.longitude, area_name: area });
      if (area && !city.trim()) setCity(area);
      if (!label) setLabel('Other');
      setLocMsg({ ok: true, text: `Current location${area ? ': ' + area : ''}` });
    } catch { setLocMsg({ ok: false, text: 'Could not get your location.' }); }
    finally { setVerifying(false); }
  }

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
    let coords = located;
    if (!coords) {
      try {
        const r = await followerApi.geocodeAddress(addrQuery());
        const d = r?.data || r;
        if (d?.found) coords = { lat: d.lat, lng: d.lng, area_name: d.area_name };
      } catch { /* handled below */ }
    }
    if (!coords) {
      setSaving(false);
      setLocMsg({ ok: false, text: "Couldn't locate this address — add area / city / pincode, or use Current location." });
      Alert.alert('Address not found', "We couldn't locate that address on the map. Add more detail (area, city, pincode), or use 'Current location'.");
      return;
    }
    const res = await followerApi.addAddress?.({
      label, line1: line1.trim(), line2: line2.trim(),
      city: city.trim(), state: state.trim(), pincode: pincode.trim(),
      lat: coords.lat, lng: coords.lng,
    });
    setSaving(false);
    if (res?.success) {
      setShowForm(false);
      setLine1(''); setLine2(''); setCity(''); setState(''); setPincode(''); setLabel('Home');
      setLocated(null); setLocMsg(null);
      load();
      if (typeof onSave === 'function') onSave(res.data?.address);
    } else {
      Alert.alert('Failed', res?.error?.message || 'Could not save address');
    }
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={T.yellowDeep} /></View>;
  }

  return (
    <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Icon name="arrow-left" size={22} color={T.ink} />
        </TouchableOpacity>
        <Text style={s.title}>{showForm ? 'Add address' : 'Your addresses'}</Text>
        <TouchableOpacity onPress={() => setShowForm(!showForm)} style={s.addBtn}>
          <Text style={s.addBtnText}>{showForm ? 'Cancel' : '+ Add new'}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={s.card}>
          <Text style={s.searchHint}>Search your location, then add flat / house details</Text>
          <View style={s.searchBar}>
            <Icon name="magnify" size={18} color={T.yellowDeep} />
            <TextInput
              style={s.searchInput} value={searchQ} onChangeText={setSearchQ}
              placeholder="Search your area, building or street" placeholderTextColor={T.hint}
            />
            {searchQ.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQ('')} hitSlop={8}>
                <Icon name="close" size={16} color={T.hint} />
              </TouchableOpacity>
            )}
          </View>
          {searching && <ActivityIndicator color={T.yellowDeep} style={{ marginTop: 8 }} />}
          {searchPreds.map((p) => (
            <TouchableOpacity key={p.place_id} style={s.predRow} onPress={() => pickPrediction(p)}>
              <Icon name="map-marker-outline" size={16} color={T.muted} />
              <View style={{ flex: 1 }}>
                <Text style={s.predMain} numberOfLines={1}>{p.main}</Text>
                {p.secondary ? <Text style={s.predSub} numberOfLines={1}>{p.secondary}</Text> : null}
              </View>
            </TouchableOpacity>
          ))}
          <View style={s.searchDivider} />

          {locMsg && (
            locMsg.ok ? (
              <View style={s.locatedChip}>
                <Icon name="check-circle-outline" size={15} color={T.veg} />
                <Text style={s.locatedText}>{locMsg.text}</Text>
              </View>
            ) : (
              <Text style={s.locErr}>{locMsg.text}</Text>
            )
          )}

          <TouchableOpacity style={s.currentBtn} onPress={useCurrent} disabled={verifying} activeOpacity={0.85}>
            <Icon name="crosshairs-gps" size={16} color={T.yellowDeep} />
            <Text style={s.currentBtnText}>Use current location</Text>
          </TouchableOpacity>

          <Text style={s.fieldLabel}>Flat / House / Block no.</Text>
          <TextInput style={s.input} value={line1} onChangeText={(t) => { setLine1(t); setLocated(null); setLocMsg(null); }} placeholder="e.g. Flat 304, Sai Residency" placeholderTextColor={T.hint} />
          <Text style={s.fieldLabel}>Area / Street / Landmark</Text>
          <TextInput style={s.input} value={line2} onChangeText={(t) => { setLine2(t); setLocated(null); }} placeholder="e.g. Near Prayer House" placeholderTextColor={T.hint} />
          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>City</Text>
              <TextInput style={s.input} value={city} onChangeText={(t) => { setCity(t); setLocated(null); }} placeholder="City" placeholderTextColor={T.hint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>State</Text>
              <TextInput style={s.input} value={state} onChangeText={(t) => { setState(t); setLocated(null); }} placeholder="State" placeholderTextColor={T.hint} />
            </View>
          </View>
          <Text style={s.fieldLabel}>Pincode</Text>
          <TextInput style={s.input} value={pincode} onChangeText={(t) => { setPincode(t); setLocated(null); }} placeholder="6-digit pincode" placeholderTextColor={T.hint} keyboardType="number-pad" maxLength={6} />

          <TouchableOpacity style={s.verifyBtn} onPress={verifyAddress} disabled={verifying || !line1.trim()} activeOpacity={0.85}>
            <Icon name="magnify" size={15} color={T.muted} />
            <Text style={s.verifyBtnText}>{verifying ? 'Checking…' : 'Verify address'}</Text>
          </TouchableOpacity>

          <Text style={s.fieldLabel}>Save as</Text>
          <View style={s.typeRow}>
            {ADDRESS_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[s.typeChip, label === t && s.typeChipActive]}
                onPress={() => setLabel(t)}
                activeOpacity={0.85}
              >
                <Icon name={typeIcon(t)} size={14} color={label === t ? T.yellowDeep : T.muted} />
                <Text style={[s.typeText, label === t && s.typeTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[s.saveBtn, (saving || !line1 || !city || !pincode) && { opacity: 0.5 }]}
            onPress={saveAddress}
            disabled={saving || !line1 || !city || !pincode}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color={T.yellowInk} /> : <Text style={s.saveBtnText}>Save address</Text>}
          </TouchableOpacity>
        </View>
      )}

      {addresses.length === 0 && !showForm ? (
        <View style={[s.card, { alignItems: 'center', paddingVertical: 32 }]}>
          <Icon name="map-marker-outline" size={32} color={T.hint} />
          <Text style={s.emptyText}>No addresses saved</Text>
          <TouchableOpacity style={s.addFirstBtn} onPress={() => setShowForm(true)} activeOpacity={0.85}>
            <Text style={s.addFirstBtnText}>Add your first address</Text>
          </TouchableOpacity>
        </View>
      ) : (
        addresses.map((addr) => (
          <View key={addr.id} style={s.card}>
            <View style={s.addrTypeChip}>
              <Icon name={typeIcon(addr.label)} size={13} color={T.yellowDeep} />
              <Text style={s.addrTypeText}>{addr.label || addr.type || 'Home'}</Text>
            </View>
            <Text style={s.addrText}>{[addr.line1, addr.line2].filter(Boolean).join(', ')}</Text>
            <Text style={s.addrCity}>{[addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}</Text>
          </View>
        ))
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.pageBg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: T.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12 },
  title: { flex: 1, fontSize: 20, color: T.ink, fontFamily: fonts.displayBold },
  addBtn: { backgroundColor: T.yellowTint, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  addBtnText: { fontSize: 12, color: T.yellowDeep, fontFamily: fonts.sansBold },
  card: { marginHorizontal: 16, marginTop: 12, backgroundColor: T.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: T.line },
  locatedChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: T.successTint, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8, marginBottom: 14 },
  locatedText: { fontSize: 12, color: T.veg, fontFamily: fonts.sansBold },
  locErr: { fontSize: 12, color: T.danger, fontFamily: fonts.sansBold, marginBottom: 12 },
  currentBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingVertical: 11, marginBottom: 6 },
  currentBtnText: { fontSize: 13, color: T.yellowDeep, fontFamily: fonts.sansBold },
  fieldLabel: { fontSize: 12, color: T.muted, fontFamily: fonts.sansMedium, marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderColor: T.line, borderRadius: 10, padding: 12, fontSize: 14, color: T.ink, fontFamily: fonts.sansRegular },
  row2: { flexDirection: 'row', gap: 10 },
  verifyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: T.line, borderRadius: 10, paddingVertical: 10, marginTop: 14 },
  verifyBtnText: { fontSize: 12, color: T.muted, fontFamily: fonts.sansBold },
  typeRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: T.line, backgroundColor: T.card },
  typeChipActive: { backgroundColor: T.yellowTint, borderColor: T.yellowDeep },
  typeText: { fontSize: 12, color: T.muted, fontFamily: fonts.sansMedium },
  typeTextActive: { color: T.yellowDeep, fontFamily: fonts.sansBold },
  saveBtn: { backgroundColor: T.yellow, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  saveBtnText: { fontSize: 15, color: T.yellowInk, fontFamily: fonts.sansBold },
  emptyText: { fontSize: 13, color: T.muted, marginTop: 10, marginBottom: 12, fontFamily: fonts.sansMedium },
  addFirstBtn: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: T.yellow, borderRadius: 12 },
  addFirstBtnText: { fontSize: 13, color: T.yellowInk, fontFamily: fonts.sansBold },
  addrTypeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: T.yellowTint, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 8 },
  addrTypeText: { fontSize: 11, color: T.yellowDeep, fontFamily: fonts.sansBold },
  addrText: { fontSize: 14, color: T.ink, fontFamily: fonts.sansMedium, marginBottom: 2 },
  addrCity: { fontSize: 12, color: T.muted, fontFamily: fonts.sansRegular },
  searchHint: { fontSize: 12, color: T.muted, fontFamily: fonts.sansMedium, marginBottom: 8 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.pageBg, borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  searchInput: { flex: 1, fontSize: 14, color: T.ink, fontFamily: fonts.sansRegular, padding: 0 },
  predRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  predMain: { fontSize: 14, color: T.ink, fontFamily: fonts.sansBold },
  predSub: { fontSize: 12, color: T.muted, marginTop: 2, fontFamily: fonts.sansRegular },
  searchDivider: { height: 1, backgroundColor: T.line, marginVertical: 12 },
});
