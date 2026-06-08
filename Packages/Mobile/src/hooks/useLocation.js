import { useState, useEffect, useCallback } from 'react';
import { Platform, Linking } from 'react-native';
import { isGpsAvailable, ensureLocationPermission, getCurrentPosition } from '../utils/geolocation';

/**
 * useLocation — follower coordinates.
 *
 * OTA-SAFE: returns the Vijayawada default immediately, then upgrades to REAL
 * device GPS when the native geolocation module is present (Contract 3 / next APK).
 * On the current APK (no native module) or web or denied permission, it stays on
 * the default — so every screen that already reads this hook (Home, Category) gets
 * real GPS automatically once the APK ships, with no further wiring.
 */

// Default: Vijayawada
const DEFAULT_COORDS = { latitude: 16.5062, longitude: 80.6480 };

export default function useLocation() {
  const [coords, setCoords] = useState(DEFAULT_COORDS);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isGpsAvailable()) return;          // current APK / web → keep default
    setLoading(true);
    try {
      const ok = await ensureLocationPermission();
      if (ok) {
        const c = await getCurrentPosition();
        if (c && Number.isFinite(c.latitude) && Number.isFinite(c.longitude)) setCoords(c);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { latitude: coords.latitude, longitude: coords.longitude, loading, error: null, refresh };
}

/**
 * Open Google Maps with directions to a destination.
 */
export function openDirections(destLat, destLng, label) {
  const url = Platform.select({
    ios: `maps://app?daddr=${destLat},${destLng}&q=${encodeURIComponent(label || 'Destination')}`,
    android: `google.navigation:q=${destLat},${destLng}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`,
  });

  Linking.canOpenURL(url).then(supported => {
    if (supported) {
      Linking.openURL(url);
    } else {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`);
    }
  });
}
