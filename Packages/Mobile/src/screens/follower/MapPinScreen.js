import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { toing as T, fonts } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { useAppLocation } from '../../contexts/LocationContext';
import { isGpsAvailable, ensureLocationPermission, getCurrentPosition } from '../../utils/geolocation';
import { RNMaps, isMapsAvailable } from '../../utils/maps';

/**
 * MapPinScreen — Follower v2, Wave B (native, APK-gated).
 *
 * Add-address locate step: a search bar with Google autocomplete ON TOP of a
 * draggable map. Type → pick a suggestion → the map flies there and the pin
 * drops; drag the map to fine-tune. The centre always reverse-geocodes to an
 * address. "Confirm & proceed":
 *   - forAddress (from "Add new address") → AddressDetails form (receiver +
 *     location details), carrying the picked coords + components.
 *   - otherwise → sets the app location directly.
 * OTA-safe: isMapsAvailable() checks the native view manager; the current build
 * shows a fallback. Contract: features/follower-location-redesign.
 */

const MapView = RNMaps?.default;
const PROVIDER_GOOGLE = RNMaps?.PROVIDER_GOOGLE;

function newSession() { return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`; }

export default function MapPinScreen({ navigation, route }) {
  const forAddress = !!route.params?.forAddress;
  const { location, setLocation } = useAppLocation();
  const initLat = route.params?.latitude ?? location?.latitude ?? 16.5062;
  const initLng = route.params?.longitude ?? location?.longitude ?? 80.6480;

  const mapRef = useRef(null);
  const rgTimer = useRef(null);
  const sTimer = useRef(null);
  const session = useRef(newSession());

  const [center, setCenter] = useState({ latitude: initLat, longitude: initLng });
  const [zoomedOut, setZoomedOut] = useState(false);
  const [picked, setPicked] = useState(null);   // { area, formatted, city, state, pincode }
  const [busy, setBusy] = useState(false);

  // Search
  const [q, setQ] = useState('');
  const [preds, setPreds] = useState([]);
  const [searching, setSearching] = useState(false);

  const reverse = useCallback((lat, lng) => {
    if (rgTimer.current) clearTimeout(rgTimer.current);
    rgTimer.current = setTimeout(async () => {
      try {
        const r = await followerApi.reverseGeocode(lat, lng);
        const d = r?.data || r;
        setPicked({ area: d?.area_name || 'Selected location', formatted: d?.formatted_address || d?.city || '', city: d?.city || '' });
      } catch { setPicked({ area: 'Selected location', formatted: '', city: '' }); }
    }, 350);
  }, []);

  useEffect(() => {
    reverse(initLat, initLng);
    return () => { rgTimer.current && clearTimeout(rgTimer.current); sTimer.current && clearTimeout(sTimer.current); };
  }, []);

  // Debounced autocomplete.
  useEffect(() => {
    if (sTimer.current) clearTimeout(sTimer.current);
    const term = q.trim();
    if (term.length < 2) { setPreds([]); setSearching(false); return; }
    setSearching(true);
    sTimer.current = setTimeout(async () => {
      try {
        const r = await followerApi.placesAutocomplete(term, { session: session.current, lat: center.latitude, lng: center.longitude });
        setPreds((r?.data || r)?.predictions || []);
      } catch { setPreds([]); }
      finally { setSearching(false); }
    }, 320);
    return () => sTimer.current && clearTimeout(sTimer.current);
  }, [q]);

  // Fallback when the native module isn't in this build (OTA on the old APK).
  if (!isMapsAvailable() || !MapView) {
    return (
      <View style={s.fallback}>
        <Icon name="map-marker-off-outline" size={40} color={T.hint} />
        <Text style={s.fbTitle}>Map needs the latest app version</Text>
        <Text style={s.fbSub}>Update the app, or search your location instead.</Text>
        <TouchableOpacity style={s.fbBtn} onPress={() => navigation.replace('LocationSearch')} activeOpacity={0.85}>
          <Text style={s.fbBtnText}>Search location</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const onRegionChangeComplete = (region) => {
    setCenter({ latitude: region.latitude, longitude: region.longitude });
    setZoomedOut(region.latitudeDelta > 0.05);
    reverse(region.latitude, region.longitude);
  };

  const pickPrediction = async (pred) => {
    setSearching(true);
    try {
      const r = await followerApi.placeDetails(pred.place_id, session.current);
      const d = r?.data || r;
      if (d?.lat != null && mapRef.current) {
        mapRef.current.animateToRegion(
          { latitude: d.lat, longitude: d.lng, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 500,
        );
        setPicked({ area: d.area_name || pred.main, formatted: d.formatted_address || pred.secondary || '', city: d.city || '', state: d.state || '', pincode: d.pincode || '' });
        setQ(''); setPreds([]);
        session.current = newSession();
      }
    } catch { /* keep screen */ }
    finally { setSearching(false); }
  };

  const recenter = async () => {
    if (!isGpsAvailable()) return;
    setBusy(true);
    try {
      const ok = await ensureLocationPermission();
      if (ok) {
        const c = await getCurrentPosition();
        if (c && mapRef.current) {
          mapRef.current.animateToRegion({ latitude: c.latitude, longitude: c.longitude, latitudeDelta: 0.006, longitudeDelta: 0.006 }, 400);
        }
      }
    } finally { setBusy(false); }
  };

  const confirm = () => {
    if (forAddress) {
      navigation.navigate('AddressDetails', {
        latitude: center.latitude, longitude: center.longitude,
        area: picked?.area || '', formatted: picked?.formatted || '',
        city: picked?.city || '', state: picked?.state || '', pincode: picked?.pincode || '',
      });
      return;
    }
    setLocation({
      label: picked?.area || 'Selected location',
      sublabel: picked?.formatted || '',
      latitude: center.latitude, longitude: center.longitude,
      source: 'current', address_id: null,
    });
    navigation.goBack();
  };

  return (
    <View style={s.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={{ latitude: initLat, longitude: initLng, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation
      />

      <View pointerEvents="none" style={s.pinWrap}>
        <Icon name="map-marker" size={42} color={T.yellowDeep} />
      </View>

      {/* top: back + inline autocomplete search */}
      <View style={s.topBar}>
        <View style={s.searchRow}>
          <TouchableOpacity style={s.circle} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Icon name="arrow-left" size={20} color={T.ink} />
          </TouchableOpacity>
          <View style={s.searchBox}>
            <Icon name="magnify" size={17} color={T.yellowDeep} />
            <TextInput
              style={s.searchInput} value={q} onChangeText={setQ}
              placeholder="Search an area or address" placeholderTextColor={T.hint}
            />
            {q.length > 0 && (
              <TouchableOpacity onPress={() => setQ('')} hitSlop={8}><Icon name="close" size={15} color={T.hint} /></TouchableOpacity>
            )}
          </View>
        </View>
        {(searching || preds.length > 0) && (
          <View style={s.predCard}>
            {searching && preds.length === 0 && <ActivityIndicator color={T.yellowDeep} style={{ paddingVertical: 12 }} />}
            {preds.map((p) => (
              <TouchableOpacity key={p.place_id} style={s.predRow} onPress={() => pickPrediction(p)}>
                <Icon name="map-marker-outline" size={16} color={T.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={s.predMain} numberOfLines={1}>{p.main}</Text>
                  {p.secondary ? <Text style={s.predSub} numberOfLines={1}>{p.secondary}</Text> : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <TouchableOpacity style={s.recenter} onPress={recenter} activeOpacity={0.85}>
        {busy ? <ActivityIndicator size="small" color={T.yellowDeep} /> : <Icon name="crosshairs-gps" size={15} color={T.yellowDeep} />}
        <Text style={s.recenterTxt}>Current location</Text>
      </TouchableOpacity>

      <View style={s.sheet}>
        <Text style={s.sheetHint}>Place the pin at exact delivery location</Text>
        <View style={s.addrRow}>
          <Icon name="map-marker" size={18} color={T.yellowDeep} />
          <View style={{ flex: 1 }}>
            <Text style={s.addrLabel} numberOfLines={1}>{picked?.area || 'Locating…'}</Text>
            {picked?.formatted ? <Text style={s.addrSub} numberOfLines={2}>{picked.formatted}</Text> : null}
          </View>
        </View>
        {zoomedOut && <Text style={s.warn}>Zoom in to place the pin at exact delivery location</Text>}
        <TouchableOpacity style={[s.confirm, zoomedOut && s.confirmDisabled]} disabled={zoomedOut} onPress={confirm} activeOpacity={0.85}>
          <Text style={s.confirmTxt}>Confirm & proceed</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.pageBg },
  pinWrap: { position: 'absolute', top: '50%', left: '50%', marginLeft: -21, marginTop: -42 },
  topBar: { position: 'absolute', top: 46, left: 14, right: 14 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  circle: { width: 40, height: 40, borderRadius: 20, backgroundColor: T.card, alignItems: 'center', justifyContent: 'center', elevation: 3 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, elevation: 3 },
  searchInput: { flex: 1, fontSize: 14, color: T.ink, fontFamily: fonts.sansRegular, padding: 0 },
  predCard: { backgroundColor: T.card, borderRadius: 12, marginTop: 8, paddingHorizontal: 12, elevation: 3, overflow: 'hidden' },
  predRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  predMain: { fontSize: 14, color: T.ink, fontFamily: fonts.sansBold },
  predSub: { fontSize: 12, color: T.muted, marginTop: 2, fontFamily: fonts.sansRegular },
  recenter: { position: 'absolute', bottom: 210, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.card, borderWidth: 1, borderColor: T.line, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8, elevation: 3 },
  recenterTxt: { fontSize: 12, color: T.yellowDeep, fontFamily: fonts.sansBold },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: T.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 24 },
  sheetHint: { fontSize: 12, color: T.muted, fontFamily: fonts.sansMedium, marginBottom: 8 },
  addrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 12 },
  addrLabel: { fontSize: 15, color: T.ink, fontFamily: fonts.sansBold },
  addrSub: { fontSize: 12, color: T.muted, marginTop: 2, fontFamily: fonts.sansRegular },
  warn: { fontSize: 12, color: T.danger, fontFamily: fonts.sansBold, marginBottom: 10 },
  confirm: { backgroundColor: T.yellow, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  confirmDisabled: { opacity: 0.5 },
  confirmTxt: { fontSize: 15, color: T.yellowInk, fontFamily: fonts.sansBold },
  fallback: { flex: 1, backgroundColor: T.card, alignItems: 'center', justifyContent: 'center', padding: 28 },
  fbTitle: { fontSize: 16, color: T.ink, fontFamily: fonts.sansBold, marginTop: 14 },
  fbSub: { fontSize: 13, color: T.muted, fontFamily: fonts.sansRegular, textAlign: 'center', marginTop: 6, marginBottom: 18 },
  fbBtn: { backgroundColor: T.yellow, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 12 },
  fbBtnText: { fontSize: 14, color: T.yellowInk, fontFamily: fonts.sansBold },
});
