import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { toing as T, fonts } from '../../theme/tokens';
import { useAppLocation } from '../../contexts/LocationContext';
import { isMapsAvailable } from '../../utils/maps';

/**
 * LocationEntryScreen — Follower v2, step L1.
 *
 * The "Where should we deliver?" gateway: one tap to use current GPS, or go to
 * manual search. Reuses LocationContext.useCurrentLocation() (permission + GPS +
 * reverse-geocode + persist; OTA-safe — falls back to the default on the current
 * APK / web). White canvas + yellow accent (toing palette); text on yellow = ink.
 *
 * Contract: features/follower-location-redesign (L1).
 */
export default function LocationEntryScreen({ navigation }) {
  const { useCurrentLocation } = useAppLocation();
  const [detecting, setDetecting] = useState(false);

  const onUseCurrent = useCallback(async () => {
    if (detecting) return;
    // On a maps-capable APK, open the drag-pin picker; else (current OTA build)
    // fall back to one-tap GPS detect.
    if (isMapsAvailable()) { navigation?.navigate?.('MapPinPicker'); return; }
    setDetecting(true);
    try {
      await useCurrentLocation();
    } finally {
      setDetecting(false);
      if (navigation?.canGoBack?.()) navigation.goBack();
      else navigation?.navigate?.('Home');
    }
  }, [detecting, useCurrentLocation, navigation]);

  const onManual = useCallback(() => {
    navigation?.navigate?.('LocationSearch');
  }, [navigation]);

  return (
    <View style={s.container}>
      <View style={s.center}>
        <View style={s.hero}>
          <Icon name="map-marker-radius-outline" size={40} color={T.yellowDeep} />
        </View>
        <Text style={s.title}>Where should we deliver?</Text>
        <Text style={s.sub}>We'll show businesses, dishes and deals near you.</Text>

        <TouchableOpacity
          style={[s.btn, s.btnPrimary, detecting && s.btnDisabled]}
          activeOpacity={0.85}
          onPress={onUseCurrent}
          disabled={detecting}
          accessibilityRole="button"
          accessibilityLabel="Use current location"
        >
          {detecting ? (
            <ActivityIndicator color={T.yellowInk} />
          ) : (
            <>
              <Icon name="crosshairs-gps" size={18} color={T.yellowInk} />
              <Text style={s.btnPrimaryText}>Use current location</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.btn, s.btnGhost]}
          activeOpacity={0.85}
          onPress={onManual}
          accessibilityRole="button"
          accessibilityLabel="Enter location manually"
        >
          <Icon name="magnify" size={18} color={T.yellowDeep} />
          <Text style={s.btnGhostText}>Enter location manually</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.footer}>Your location is only used to find nearby businesses.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.card },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  hero: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: T.yellowTint,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: {
    fontSize: 22, color: T.ink, fontFamily: fonts.displayBold, textAlign: 'center', marginBottom: 8,
  },
  sub: {
    fontSize: 14, color: T.muted, fontFamily: fonts.sansRegular, textAlign: 'center',
    lineHeight: 20, marginBottom: 28,
  },
  btn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14,
  },
  btnPrimary: { backgroundColor: T.yellow, marginBottom: 12 },
  btnDisabled: { opacity: 0.7 },
  btnPrimaryText: { fontSize: 15, color: T.yellowInk, fontFamily: fonts.sansBold },
  btnGhost: { backgroundColor: T.card, borderWidth: 1, borderColor: T.line },
  btnGhostText: { fontSize: 15, color: T.yellowDeep, fontFamily: fonts.sansBold },
  footer: {
    fontSize: 11, color: T.hint, fontFamily: fonts.sansRegular, textAlign: 'center',
    paddingHorizontal: 28, paddingBottom: 28,
  },
});
