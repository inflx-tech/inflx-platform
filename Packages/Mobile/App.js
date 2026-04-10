import React, { useEffect, useState, createContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator, Platform } from 'react-native';
import { OneSignal, LogLevel } from 'react-native-onesignal';
import { colors } from './src/theme/tokens';
import { ONESIGNAL_APP_ID } from './src/config/api';
import APP_ROLE from './src/config/appRole';

import AuthNavigator from './src/navigation/AuthNavigator';
import InfluencerNavigator from './src/navigation/InfluencerNavigator';
import FollowerNavigator from './src/navigation/FollowerNavigator';
import BrandNavigator from './src/navigation/BrandNavigator';

export const AuthContext = createContext({ setRole: () => {} });

export default function App() {
  const [role, setRole] = useState(null); // null = loading, '' = unauthenticated

  // ── OneSignal initialization ───────────────────────────────────────────
  useEffect(() => {
    // Remove this or set to LogLevel.None in production
    OneSignal.Debug.setLogLevel(LogLevel.Verbose);

    // Initialize with your OneSignal App ID
    OneSignal.initialize(ONESIGNAL_APP_ID);

    // Request push notification permission (shows OS prompt on first launch)
    OneSignal.Notifications.requestPermission(true);

    // Listen for notification clicks → deep link into the app
    OneSignal.Notifications.addEventListener('click', (event) => {
      const data = event.notification.additionalData;
      if (data) {
        // Store the deep link data so the active navigator can pick it up
        AsyncStorage.setItem('inflx_pending_deeplink', JSON.stringify(data));
      }
    });

    // Observer: when OneSignal assigns a player/subscription ID, save it to backend
    OneSignal.User.pushSubscription.addEventListener('change', async (subscription) => {
      const playerId = subscription.current?.id;
      if (playerId) {
        try {
          const token = await AsyncStorage.getItem('inflx_token');
          if (token) {
            // Save OneSignal player ID to our backend
            const { api } = require('./src/services/api');
            await api.post('/auth/onesignal-player-id', { player_id: playerId });
          }
          // Also cache locally so we can send after login
          await AsyncStorage.setItem('inflx_onesignal_player_id', playerId);
        } catch (e) {
          console.log('[OneSignal] Failed to save player ID:', e);
        }
      }
    });
  }, []);

  // ── Auth state initialization ──────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const token = await AsyncStorage.getItem('inflx_token');
        const userStr = await AsyncStorage.getItem('inflx_user');
        if (!token || !userStr) { setRole(''); return; }
        const user = JSON.parse(userStr);
        setRole(user.role || '');

        // If we have a cached OneSignal player ID, send it to backend
        const playerId = await AsyncStorage.getItem('inflx_onesignal_player_id');
        if (playerId && token) {
          const { api } = require('./src/services/api');
          api.post('/auth/onesignal-player-id', { player_id: playerId }).catch(() => {});
        }
      } catch {
        setRole('');
      }
    }
    init();
  }, []);

  if (role === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navyDeep }}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  // Follower app = public browsing, no login required
  // Brand/Influencer apps = login required
  const isFollowerApp = APP_ROLE === 'follower';

  return (
    <AuthContext.Provider value={{ setRole }}>
      <NavigationContainer>
        {role === 'brand' ? <BrandNavigator /> :
         role === 'influencer' ? <InfluencerNavigator /> :
         role === 'follower' ? <FollowerNavigator /> :
         isFollowerApp ? <FollowerNavigator /> :
         <AuthNavigator />}
      </NavigationContainer>
    </AuthContext.Provider>
  );
}
