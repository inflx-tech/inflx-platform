import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { toing as T, fonts } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { useAppLocation } from '../../contexts/LocationContext';
import { getRecentLocations, pushRecentLocation } from '../../utils/recentLocations';

/**
 * LocationSearchScreen — Follower v2, steps L2 + L3.
 *
 * "Select your location" on the white/yellow toing skin: live Google Places
 * autocomplete (type → suggestions → pick → exact coords), plus current-location
 * + add-new actions, saved addresses (getAddresses) and recently searched.
 * Picking sets the app-wide location (feed re-ranks) and remembers recents.
 * Backend proxy keeps the key safe. Contract: features/follower-location-redesign.
 */

function newSession() {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

// Haversine distance in km between two {latitude, longitude} points (or null).
function distanceKm(a, b) {
  if (!a || !b || a.latitude == null || b == null) return null;
  const lat2 = b.lat != null ? b.lat : b.latitude;
  const lng2 = b.lng != null ? b.lng : b.longitude;
  if (lat2 == null || lng2 == null) return null;
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - a.latitude), dLng = toRad(lng2 - a.longitude);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
function fmtKm(km) {
  if (km == null) return null;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

const addrIcon = (label) => (label === 'Work' ? 'briefcase-outline' : label === 'Home' ? 'home-outline' : 'map-marker-outline');

export default function LocationSearchScreen({ navigation }) {
  const { location, setLocation, useCurrentLocation } = useAppLocation();
  const [q, setQ] = useState('');
  const [preds, setPreds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState([]);
  const [saved, setSaved] = useState([]);
  const session = useRef(newSession());
  const timer = useRef(null);

  useEffect(() => {
    getRecentLocations().then(setRecent);
    followerApi.getAddresses?.()
      .then((r) => setSaved((r?.data || r)?.addresses || []))
      .catch(() => {});
  }, []);

  // Debounced autocomplete (location-biased to the current area).
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const term = q.trim();
    if (term.length < 2) { setPreds([]); setLoading(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const r = await followerApi.placesAutocomplete(term, {
          session: session.current, lat: location?.latitude, lng: location?.longitude,
        });
        setPreds((r?.data || r)?.predictions || []);
      } catch { setPreds([]); }
      finally { setLoading(false); }
    }, 320);
    return () => timer.current && clearTimeout(timer.current);
  }, [q, location?.latitude, location?.longitude]);

  const choose = useCallback(async (pred) => {
    setLoading(true);
    try {
      const r = await followerApi.placeDetails(pred.place_id, session.current);
      const d = r?.data || r;
      if (d?.lat != null) {
        const loc = {
          label: pred.main || d.area_name || 'Selected area',
          sublabel: pred.secondary || d.formatted_address || '',
          latitude: d.lat, longitude: d.lng, source: 'address', address_id: null,
        };
        setLocation(loc);
        pushRecentLocation(loc);
        session.current = newSession();
        navigation.goBack();
      }
    } catch { /* keep screen open */ }
    finally { setLoading(false); }
  }, [setLocation, navigation]);

  const pickRecent = (loc) => { setLocation(loc); navigation.goBack(); };
  const pickCurrent = () => { useCurrentLocation(); navigation.goBack(); };
  const pickSaved = (a) => {
    setLocation({
      label: a.label || a.line1 || 'Saved address',
      sublabel: [a.line1, a.city].filter(Boolean).join(', '),
      latitude: a.lat != null ? a.lat : a.latitude,
      longitude: a.lng != null ? a.lng : a.longitude,
      source: 'address', address_id: a.id,
    });
    navigation.goBack();
  };
  const addNew = () => navigation.navigate('Address', { add: true });

  const searching = q.trim().length >= 2;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Icon name="arrow-left" size={22} color={T.ink} />
        </TouchableOpacity>
        <Text style={s.title}>Select your location</Text>
      </View>

      <View style={s.searchBar}>
        <Icon name="magnify" size={18} color={T.yellowDeep} />
        <TextInput
          style={s.searchInput} value={q} onChangeText={setQ} autoFocus
          placeholder="Search for area, street or landmark" placeholderTextColor={T.hint}
        />
        {q.length > 0 && (
          <TouchableOpacity onPress={() => setQ('')} hitSlop={8}>
            <Icon name="close" size={16} color={T.hint} />
          </TouchableOpacity>
        )}
      </View>

      {!searching && (
        <View style={s.pillRow}>
          <TouchableOpacity style={[s.pill, s.pillTint]} onPress={pickCurrent} activeOpacity={0.85}>
            <Icon name="crosshairs-gps" size={15} color={T.yellowDeep} />
            <Text style={s.pillText}>Use current location</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.pill, s.pillOutline]} onPress={addNew} activeOpacity={0.85}>
            <Icon name="plus" size={15} color={T.yellowDeep} />
            <Text style={s.pillText}>Add new address</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        {loading && <ActivityIndicator color={T.yellowDeep} style={{ marginTop: 16 }} />}

        {searching ? (
          <>
            <Text style={s.section}>SEARCH RESULTS</Text>
            {!loading && preds.length === 0 && <Text style={s.empty}>No matches. Try a nearby area or landmark.</Text>}
            {preds.map((p) => (
              <TouchableOpacity key={p.place_id} style={s.row} onPress={() => choose(p)}>
                <View style={s.rowIcon}><Icon name="map-marker-outline" size={18} color={T.muted} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowMain} numberOfLines={1}>{p.main}</Text>
                  {p.secondary ? <Text style={s.rowSub} numberOfLines={2}>{p.secondary}</Text> : null}
                </View>
              </TouchableOpacity>
            ))}
          </>
        ) : (
          <>
            {saved.length > 0 && (
              <>
                <Text style={s.section}>SAVED ADDRESSES</Text>
                {saved.map((a) => {
                  const km = fmtKm(distanceKm(location, a));
                  return (
                    <TouchableOpacity key={a.id} style={s.row} onPress={() => pickSaved(a)}>
                      <View style={s.rowIcon}><Icon name={addrIcon(a.label)} size={18} color={T.muted} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowMain} numberOfLines={1}>
                          {a.label || 'Address'}{km ? <Text style={s.rowKm}>  ·  {km}</Text> : null}
                        </Text>
                        <Text style={s.rowSub} numberOfLines={1}>
                          {[a.line1, a.line2, a.city].filter(Boolean).join(', ')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {recent.length > 0 && (
              <>
                <Text style={s.section}>RECENTLY SEARCHED</Text>
                {recent.map((r, i) => (
                  <TouchableOpacity key={i} style={s.row} onPress={() => pickRecent(r)}>
                    <View style={s.rowIcon}><Icon name="history" size={18} color={T.muted} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowMain} numberOfLines={1}>{r.label}</Text>
                      {r.sublabel ? <Text style={s.rowSub} numberOfLines={2}>{r.sublabel}</Text> : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.pageBg, paddingTop: 50 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  title: { fontSize: 20, color: T.ink, fontFamily: fonts.displayBold },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  searchInput: { flex: 1, fontSize: 15, color: T.ink, fontFamily: fonts.sansRegular, padding: 0 },
  pillRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  pill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 12, paddingVertical: 11,
  },
  pillTint: { backgroundColor: T.yellowTint },
  pillOutline: { borderWidth: 1, borderColor: T.line, backgroundColor: T.card },
  pillText: { fontSize: 12, color: T.yellowDeep, fontFamily: fonts.sansBold },
  section: { fontSize: 11, color: T.hint, fontFamily: fonts.sansBold, letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  empty: { fontSize: 13, color: T.muted, paddingHorizontal: 16, paddingVertical: 12, fontFamily: fonts.sansRegular },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  rowIcon: { width: 34, height: 34, borderRadius: 8, backgroundColor: T.pageBg, alignItems: 'center', justifyContent: 'center' },
  rowMain: { fontSize: 14, color: T.ink, fontFamily: fonts.sansBold },
  rowKm: { fontSize: 13, color: T.muted, fontFamily: fonts.sansRegular },
  rowSub: { fontSize: 12, color: T.muted, marginTop: 2, fontFamily: fonts.sansRegular },
});
