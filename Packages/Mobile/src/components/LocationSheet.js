/**
 * LocationSheet — Path C-1 bottom-sheet location/address switcher.
 *
 * Opened from LocationHeader. Mirrors the Swiggy pattern adapted to our
 * model:
 *   - Use current location (mock resolver today — GPS deferred)
 *   - Add new address  → existing AddressScreen
 *   - Saved addresses list (followerApi.getAddresses) → select to set
 *
 * "Request via WhatsApp" from the Swiggy reference is intentionally
 * omitted for v1 (no backend for it; revisit if pilot asks).
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { lightColors, fonts } from '../theme/tokens';
import { followerApi } from '../services/api';
import { useAppLocation } from '../contexts/LocationContext';

export default function LocationSheet({ visible, onClose, navigation }) {
  const { location, setLocation, useCurrentLocation } = useAppLocation();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setLoading(true);
    followerApi.getAddresses?.()
      .then(r => { if (alive) setAddresses((r?.data || r)?.addresses || []); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [visible]);

  function pickCurrent() { useCurrentLocation(); onClose(); }

  function pickAddress(a) {
    setLocation({
      label: a.label || a.line1 || 'Saved address',
      sublabel: [a.line1, a.city].filter(Boolean).join(', '),
      source: 'address',
      address_id: a.id,
      // geocoded on save (migration 093 / createAddress forward-geocode).
      latitude: a.lat != null ? a.lat : a.latitude,
      longitude: a.lng != null ? a.lng : a.longitude,
    });
    onClose();
  }

  function addNew() {
    onClose();
    navigation?.navigate?.('Address');
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.bg} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.grip} />
        <View style={styles.header}>
          <Text style={styles.title}>Choose location</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        {/* Search bar → live Places autocomplete screen */}
        <Pressable
          style={styles.searchBar}
          onPress={() => { onClose(); navigation?.navigate?.('LocationSearch'); }}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Search an area or address</Text>
        </Pressable>

        <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
          {/* Actions */}
          <Pressable onPress={pickCurrent} style={styles.action}>
            <Text style={styles.actionGlyph}>📍</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>Use current location</Text>
              <Text style={styles.actionSub}>Detect with GPS</Text>
            </View>
            {location.source === 'current' && <Text style={styles.tick}>✓</Text>}
          </Pressable>

          <Pressable onPress={addNew} style={styles.action}>
            <Text style={styles.actionGlyph}>＋</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>Add new address</Text>
              <Text style={styles.actionSub}>Home, Work or other</Text>
            </View>
          </Pressable>

          {/* Saved */}
          <Text style={styles.sectionLabel}>SAVED ADDRESSES</Text>
          {loading ? (
            <ActivityIndicator color={lightColors.ink} style={{ marginVertical: 16 }} />
          ) : addresses.length === 0 ? (
            <Text style={styles.empty}>No saved addresses yet.</Text>
          ) : (
            addresses.map(a => {
              const active = location.address_id === a.id;
              return (
                <Pressable key={a.id} onPress={() => pickAddress(a)}
                  style={[styles.addr, active && styles.addrActive]}>
                  <Text style={styles.addrGlyph}>
                    {a.label === 'Work' ? '💼' : a.label === 'Home' ? '🏠' : '📌'}
                  </Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.addrLabel}>{a.label || 'Address'}</Text>
                    <Text style={styles.addrLine} numberOfLines={1}>
                      {[a.line1, a.line2, a.city, a.pincode].filter(Boolean).join(', ')}
                    </Text>
                  </View>
                  {active && <Text style={styles.tick}>✓</Text>}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(10,10,10,0.45)' },
  sheet: {
    backgroundColor: lightColors.paper,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 18, paddingTop: 8, maxHeight: '82%',
  },
  grip: { width: 36, height: 4, borderRadius: 2, backgroundColor: lightColors.border2, alignSelf: 'center', marginBottom: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: lightColors.bg2, borderWidth: 1, borderColor: lightColors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  searchIcon: { fontSize: 14 },
  searchPlaceholder: { fontSize: 14, color: lightColors.muted, fontFamily: fonts.body },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontFamily: fonts.displayBold, fontSize: 18, color: lightColors.ink, letterSpacing: -0.3 },
  close: { fontSize: 16, color: lightColors.muted },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomColor: lightColors.border, borderBottomWidth: 1,
  },
  actionGlyph: { fontSize: 20, width: 24, textAlign: 'center' },
  actionLabel: { fontFamily: fonts.sansBold, fontSize: 14, color: lightColors.ink },
  actionSub: { fontFamily: fonts.monoMedium, fontSize: 10, color: lightColors.muted, marginTop: 2 },
  sectionLabel: { fontFamily: fonts.monoBold, fontSize: 10, color: lightColors.muted, letterSpacing: 0.6, marginTop: 18, marginBottom: 8 },
  empty: { fontFamily: fonts.sansMedium, fontSize: 12, color: lightColors.muted, paddingVertical: 12 },
  addr: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10, marginBottom: 6,
  },
  addrActive: { backgroundColor: lightColors.yellow50, borderWidth: 1, borderColor: lightColors.yellow200 },
  addrGlyph: { fontSize: 18, width: 22, textAlign: 'center' },
  addrLabel: { fontFamily: fonts.sansBold, fontSize: 13, color: lightColors.ink },
  addrLine: { fontFamily: fonts.sansMedium, fontSize: 11, color: lightColors.muted, marginTop: 2 },
  tick: { fontFamily: fonts.displayBlack, fontSize: 14, color: lightColors.success },
});
