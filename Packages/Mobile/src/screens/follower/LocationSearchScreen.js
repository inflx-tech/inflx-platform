import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { creatorVibe as C, fonts } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { useAppLocation } from '../../contexts/LocationContext';
import { getRecentLocations, pushRecentLocation } from '../../utils/recentLocations';

/**
 * LocationSearchScreen — Swiggy-style "Select Your Location" with live Google
 * Places Autocomplete (type an area → suggestions → pick → exact coords). Picking
 * sets the app-wide location (feed re-ranks) and is remembered as "recently
 * searched". Also offers "Use current location". Backend proxy keeps the key safe;
 * needs the Places API enabled. Contract: features/follower-places-autocomplete.
 */

function newSession() {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export default function LocationSearchScreen({ navigation }) {
  const { location, setLocation, useCurrentLocation } = useAppLocation();
  const [q, setQ] = useState('');
  const [preds, setPreds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState([]);
  const session = useRef(newSession());
  const timer = useRef(null);

  useEffect(() => { getRecentLocations().then(setRecent); }, []);

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
        session.current = newSession(); // new session after a completed pick
        navigation.goBack();
      }
    } catch { /* keep screen open */ }
    finally { setLoading(false); }
  }, [setLocation, navigation]);

  const pickRecent = (loc) => { setLocation(loc); navigation.goBack(); };
  const pickCurrent = () => { useCurrentLocation(); navigation.goBack(); };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}><Text style={s.back}>←</Text></TouchableOpacity>
        <Text style={s.title}>Select Your Location</Text>
      </View>

      <View style={s.searchBar}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput} value={q} onChangeText={setQ} autoFocus
          placeholder="Search an area or address" placeholderTextColor={C.muted}
        />
        {q.length > 0 && <TouchableOpacity onPress={() => setQ('')} hitSlop={8}><Text style={s.clear}>✕</Text></TouchableOpacity>}
      </View>

      <TouchableOpacity style={s.currentRow} onPress={pickCurrent}>
        <Text style={s.currentIcon}>📍</Text>
        <Text style={s.currentText}>Use current location</Text>
      </TouchableOpacity>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        {loading && <ActivityIndicator color={C.brown} style={{ marginTop: 16 }} />}

        {q.trim().length >= 2 ? (
          <>
            <Text style={s.section}>SEARCH RESULTS</Text>
            {!loading && preds.length === 0 && <Text style={s.empty}>No matches. Try a nearby area or landmark.</Text>}
            {preds.map(p => (
              <TouchableOpacity key={p.place_id} style={s.row} onPress={() => choose(p)}>
                <Text style={s.rowIcon}>📍</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowMain} numberOfLines={1}>{p.main}</Text>
                  {p.secondary ? <Text style={s.rowSub} numberOfLines={2}>{p.secondary}</Text> : null}
                </View>
              </TouchableOpacity>
            ))}
          </>
        ) : recent.length > 0 ? (
          <>
            <Text style={s.section}>RECENTLY SEARCHED</Text>
            {recent.map((r, i) => (
              <TouchableOpacity key={i} style={s.row} onPress={() => pickRecent(r)}>
                <Text style={s.rowIcon}>🕘</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowMain} numberOfLines={1}>{r.label}</Text>
                  {r.sublabel ? <Text style={s.rowSub} numberOfLines={2}>{r.sublabel}</Text> : null}
                </View>
              </TouchableOpacity>
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.screenBg, paddingTop: 50 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingBottom: 14 },
  back: { fontSize: 22, color: C.ink },
  title: { fontSize: 20, fontWeight: '800', color: C.ink, fontFamily: fonts.displayBold },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 15, color: C.ink, fontFamily: fonts.sansRegular, padding: 0 },
  clear: { fontSize: 16, color: C.muted },
  currentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 14 },
  currentIcon: { fontSize: 16 },
  currentText: { fontSize: 14, fontWeight: '800', color: C.brown, fontFamily: fonts.sansBold },
  section: { fontSize: 11, fontWeight: '800', color: C.muted, letterSpacing: 0.5, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 6 },
  empty: { fontSize: 13, color: C.muted, paddingHorizontal: 18, paddingVertical: 12, fontFamily: fonts.sansRegular },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line },
  rowIcon: { fontSize: 16, width: 22, textAlign: 'center' },
  rowMain: { fontSize: 15, fontWeight: '700', color: C.ink, fontFamily: fonts.sansBold },
  rowSub: { fontSize: 12, color: C.muted, marginTop: 2, fontFamily: fonts.sansRegular },
});
