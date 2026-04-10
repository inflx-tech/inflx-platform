import { useState, useEffect } from 'react';
import { Platform, Linking } from 'react-native';

/**
 * useLocation — hook to get follower's GPS coordinates.
 *
 * GPS detection is DISABLED for now — always returns Vijayawada defaults.
 * Uncomment the requestAndGet() logic when ready for production.
 */

// Default: Vijayawada
const DEFAULT_COORDS = { latitude: 16.5062, longitude: 80.6480 };

export default function useLocation() {
  // GPS disabled for now — return defaults immediately
  return {
    latitude: DEFAULT_COORDS.latitude,
    longitude: DEFAULT_COORDS.longitude,
    loading: false,
    error: null,
    refresh: () => {},
  };
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
