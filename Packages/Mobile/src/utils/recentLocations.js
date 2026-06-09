import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * recentLocations — small AsyncStorage MRU list of picked locations for the
 * "Recently searched" section of the location switcher. Stores the same shape
 * LocationContext.setLocation accepts: { label, sublabel, latitude, longitude }.
 */
const KEY = 'inflx_recent_locations';
const MAX = 6;

export async function getRecentLocations() {
  try { const raw = await AsyncStorage.getItem(KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}

export async function pushRecentLocation(loc) {
  if (!loc || loc.latitude == null) return;
  try {
    const list = await getRecentLocations();
    const next = [loc, ...list.filter(x => x.label !== loc.label || x.sublabel !== loc.sublabel)].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}
