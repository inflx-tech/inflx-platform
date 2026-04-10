import { useState, useEffect } from 'react';
import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';

/**
 * useLocation — hook to get follower's GPS coordinates.
 *
 * Returns { latitude, longitude, loading, error, refresh }
 * Falls back to default city coords (Vijayawada) if permission denied.
 */

// Default: Vijayawada
const DEFAULT_COORDS = { latitude: 16.5062, longitude: 80.6480 };

export default function useLocation() {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function requestAndGet() {
    setLoading(true);
    setError(null);

    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'INFLX needs your location to show nearby deals and businesses',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.log('[Location] Permission denied, using default');
          setLocation(DEFAULT_COORDS);
          setLoading(false);
          return;
        }
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setLoading(false);
        },
        (err) => {
          console.log('[Location] Error:', err.message);
          setError(err.message);
          setLocation(DEFAULT_COORDS);
          setLoading(false);
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000, // 5 min cache
        }
      );
    } catch (e) {
      console.log('[Location] Exception:', e.message);
      setLocation(DEFAULT_COORDS);
      setLoading(false);
    }
  }

  useEffect(() => {
    requestAndGet();
  }, []);

  return {
    latitude: location?.latitude || DEFAULT_COORDS.latitude,
    longitude: location?.longitude || DEFAULT_COORDS.longitude,
    loading,
    error,
    refresh: requestAndGet,
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
      // Fallback to web Google Maps
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`);
    }
  });
}
