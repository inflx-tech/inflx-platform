/**
 * LocationContext — Path C-1: app-wide selected location.
 *
 * Holds the location the follower is browsing under: a saved address,
 * "current location", or the default. Every discovery surface
 * (DiningHome, Browse, category lists) reads lat/lng from here so
 * distance + "near me" are consistent across the app.
 *
 * GPS NOTE: real device GPS needs a native geolocation lib (APK
 * rebuild) — deferred per the agreed boundary. "Use current location"
 * resolves to the mock Vijayawada coords today, clearly labelled, so
 * the whole switcher UX ships OTA now and only the GPS resolver swaps
 * in later. Saved addresses also lack per-address coords (no
 * geocoding yet) so selecting one changes the label but keeps mock
 * coords until real geocoding lands. Honest placeholder, full UX.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'inflx_selected_location';

// Mock default — matches backend GEOCODING_MOCK fixed coords.
const DEFAULT_LOCATION = {
  label: 'Vijayawada',
  sublabel: 'Default area',
  latitude: 16.5062,
  longitude: 80.6480,
  source: 'default',          // 'default' | 'current' | 'address'
  address_id: null,
};

const LocationContext = createContext({
  location: DEFAULT_LOCATION,
  setLocation: () => {},
  useCurrentLocation: () => {},
});

export function LocationProvider({ children }) {
  const [location, setLocationState] = useState(DEFAULT_LOCATION);

  // Restore last selection on cold start.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved && saved.latitude && saved.longitude) setLocationState(saved);
        }
      } catch { /* keep default */ }
    })();
  }, []);

  const persist = useCallback(async (loc) => {
    setLocationState(loc);
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(loc)); } catch {}
  }, []);

  // Select a saved address. No per-address coords yet (geocoding mock),
  // so we keep the default coords but switch the label so the UX reads
  // correctly. When real geocoding lands, address rows carry lat/lng
  // and this passes them straight through.
  const setLocation = useCallback((loc) => {
    persist({
      label: loc.label || 'Selected area',
      sublabel: loc.sublabel || '',
      latitude: loc.latitude || DEFAULT_LOCATION.latitude,
      longitude: loc.longitude || DEFAULT_LOCATION.longitude,
      source: loc.source || 'address',
      address_id: loc.address_id || null,
    });
  }, [persist]);

  // "Use current location" — mock resolver today (no native GPS dep).
  const useCurrentLocation = useCallback(() => {
    persist({
      label: 'Current location',
      sublabel: 'Approximate · GPS coming soon',
      latitude: DEFAULT_LOCATION.latitude,
      longitude: DEFAULT_LOCATION.longitude,
      source: 'current',
      address_id: null,
    });
  }, [persist]);

  return (
    <LocationContext.Provider value={{ location, setLocation, useCurrentLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useAppLocation() {
  return useContext(LocationContext);
}
