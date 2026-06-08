/**
 * LocationContext — app-wide follower location for discovery.
 *
 * Holds the location every discovery surface (Home, Category, DiningHome) reads
 * lat/lng from, so "near me" + distance are consistent. Sources:
 *   - 'current'  device GPS (real, when the native module is present / new APK),
 *                reverse-geocoded to an area name; falls back to the default.
 *   - 'address'  a saved follower address (carries its geocoded lat/lng).
 *   - 'default'  Vijayawada (cold start before GPS / on web / permission denied).
 *
 * On mount: restore the last selection; if it was an explicitly-chosen saved
 * address, keep it; otherwise auto-detect the current location (GPS). OTA-safe —
 * isGpsAvailable() is false on the old APK/web, so it cleanly stays on default.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isGpsAvailable, ensureLocationPermission, getCurrentPosition } from '../utils/geolocation';
import { followerApi } from '../services/api';

const STORAGE_KEY = 'inflx_selected_location';

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

async function areaNameFor(lat, lng) {
  try {
    const r = await followerApi.reverseGeocode(lat, lng);
    return (r?.data || r)?.area_name || null;
  } catch { return null; }
}

export function LocationProvider({ children }) {
  const [location, setLocationState] = useState(DEFAULT_LOCATION);
  const started = useRef(false);

  const persist = useCallback(async (loc) => {
    setLocationState(loc);
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(loc)); } catch {}
  }, []);

  // Select a saved address (carries its geocoded lat/lng → repositions the feed).
  const setLocation = useCallback((loc) => {
    persist({
      label: loc.label || 'Selected area',
      sublabel: loc.sublabel || '',
      latitude: loc.latitude != null ? Number(loc.latitude) : DEFAULT_LOCATION.latitude,
      longitude: loc.longitude != null ? Number(loc.longitude) : DEFAULT_LOCATION.longitude,
      source: loc.source || 'address',
      address_id: loc.address_id || null,
    });
  }, [persist]);

  // "Use current location" — real device GPS when available, else default; the
  // label is the reverse-geocoded area name.
  const useCurrentLocation = useCallback(async () => {
    let lat = DEFAULT_LOCATION.latitude, lng = DEFAULT_LOCATION.longitude, detected = false;
    if (isGpsAvailable()) {
      const ok = await ensureLocationPermission();
      if (ok) {
        const c = await getCurrentPosition();
        if (c && Number.isFinite(c.latitude)) { lat = c.latitude; lng = c.longitude; detected = true; }
      }
    }
    const area = await areaNameFor(lat, lng);
    persist({
      label: area || (detected ? 'Current location' : DEFAULT_LOCATION.label),
      sublabel: detected ? 'Current location' : 'Default area',
      latitude: lat, longitude: lng, source: 'current', address_id: null,
    });
  }, [persist]);

  // Cold start: keep an explicitly-chosen address; else auto-detect current.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved?.source === 'address' && saved.latitude) { setLocationState(saved); return; }
          if (saved?.latitude) setLocationState(saved); // show last known immediately
        }
      } catch { /* keep default */ }
      useCurrentLocation(); // refresh to real GPS (or default) + area name
    })();
  }, [useCurrentLocation]);

  return (
    <LocationContext.Provider value={{ location, setLocation, useCurrentLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useAppLocation() {
  return useContext(LocationContext);
}
