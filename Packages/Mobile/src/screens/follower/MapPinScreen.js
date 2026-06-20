import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { toing as T, fonts } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { useAppLocation } from '../../contexts/LocationContext';
import { isGpsAvailable, ensureLocationPermission, getCurrentPosition } from '../../utils/geolocation';
import { RNMaps, isMapsAvailable } from '../../utils/maps';

/**
 * MapPinScreen — Follower v2, Wave B (native, APK-gated).
 *
 * Drag-the-map-under-a-fixed-pin delivery-point picker (Swiggy/Zomato pattern).
 * The pin stays centred; the map moves; the centre coords reverse-geocode to an
 * address; "Confirm & proceed" sets the app location. Requires react-native-maps
 * + Maps SDK for Android (next APK). On the current OTA build isMapsAvailable()
 * is false → a fallback routes to manual search instead of crashing.
 *
 * Contract: features/follower-location-redesign.
 */

const MapView = RNMaps?.default;
const PROVIDER_GOOGLE = RNMaps?.PROVIDER_GOOGLE;

export default function MapPinScreen({ navigation, route }) {
  const { location, setLocation } = useAppLocation();
  const initLat = route.params?.latitude ?? location?.latitude ?? 16.5062;
  const initLng = route.params?.longitude ?? location?.longitude ?? 80.6480;

  const mapRef = useRef(null);
  const rgTimer = useRef(null);
  const [center, setCenter] = useState({ latitude: initLat, longitude: initLng });
  const [zoomedOut, setZoomedOut] = useState(false);
  const [addr, setAddr] = useState(null);   // { label, sub }
  const [busy, setBusy] = useState(false);

  const reverse = useCallback((lat, lng) => {
    if (rgTimer.current) clearTimeout(rgTimer.current);
    rgTimer.current = setTimeout(async () => {
      try {
        const r = await followerApi.reverseGeocode(lat, lng);
        const d = r?.data || r;
        setAddr({ label: d?.area_name || 'Selected location', sub: d?.formatted_address || d?.city || '' });
      } catch { setAddr({ label: 'Selected location', sub: '' }); }
    }, 350);
  }, []);

  useEffect(() => {
    reverse(initLat, initLng);
    return () => rgTimer.current && clearTimeout(rgTimer.current);
  }, []);

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

  const recenter = async () => {
    if (!isGpsAvailable()) return;
    setBusy(true);
    try {
      const ok = await ensureLocationPermission();
      if (ok) {
        const c = await getCurrentPosition();
        if (c && mapRef.current) {
          mapRef.current.animateToRegion(
            { latitude: c.latitude, longitude: c.longitude, latitudeDelta: 0.006, longitudeDelta: 0.006 }, 400,
          );
        }
      }
    } finally { setBusy(false); }
  };

  const confirm = () => {
    setLocation({
      label: addr?.label || 'Selected location',
      sublabel: addr?.sub || '',
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

      <View style={s.topBar}>
        <TouchableOpacity style={s.circle} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Icon name="arrow-left" size={20} color={T.ink} />
        </TouchableOpacity>
        <TouchableOpacity style={s.searchPill} onPress={() => navigation.navigate('LocationSearch')} activeOpacity={0.85}>
          <Icon name="magnify" size={16} color={T.yellowDeep} />
          <Text style={s.searchTxt}>Search an area or address</Text>
        </TouchableOpacity>
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
            <Text style={s.addrLabel} numberOfLines={1}>{addr?.label || 'Locating…'}</Text>
            {addr?.sub ? <Text style={s.addrSub} numberOfLines={2}>{addr.sub}</Text> : null}
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
  topBar: { position: 'absolute', top: 46, left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  circle: { width: 38, height: 38, borderRadius: 19, backgroundColor: T.card, alignItems: 'center', justifyContent: 'center', elevation: 3 },
  searchPill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, elevation: 3 },
  searchTxt: { fontSize: 13, color: T.hint, fontFamily: fonts.sansRegular },
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
