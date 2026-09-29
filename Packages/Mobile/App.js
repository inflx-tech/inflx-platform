import React, { useEffect, useState, createContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator, Platform, Linking } from 'react-native';
import { navigationRef } from './src/navigation/navRef';
import { handleDeepLink } from './src/utils/deepLink';
import { OneSignal, LogLevel } from 'react-native-onesignal';
import { colors } from './src/theme/tokens';
import { ONESIGNAL_APP_ID } from './src/config/api';
import APP_ROLE from './src/config/appRole';
import { setAccountStatus } from './src/services/accountStatus';

import AuthNavigator from './src/navigation/AuthNavigator';
import InfluencerNavigator from './src/navigation/InfluencerNavigator';
import FollowerNavigator from './src/navigation/FollowerNavigator';
import BrandNavigator from './src/navigation/BrandNavigator';
import SplashScreen from './src/screens/SplashScreen';
import { checkForOtaUpdate, confirmAppliedVersion } from './src/services/otaUpdater';
import { ensureDeviceHeader } from './src/components/shop/shopStore';

export const AuthContext = createContext({ setRole: () => {} });

export default function App() {
  const [role, setRole] = useState(null); // null = loading, '' = unauthenticated
  const [showSplash, setShowSplash] = useState(true);

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

  // ── Links (post-links-codes, follower-app-v2) ────────────────────────────
  // inflx.in/p/<code>, /s/<handle>, /c/<code> open the post, her store or the collection.
  // Cold start (getInitialURL) + warm (the 'url' event). Follower flavor only. The phone's
  // anonymous id rides on every request from the start, so a guest's visits are hers (5.14).
  useEffect(() => {
    if (APP_ROLE !== 'follower') return undefined;
    ensureDeviceHeader().catch(() => {});
    Linking.getInitialURL().then((url) => { if (url) handleDeepLink(url); }).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => handleDeepLink(e?.url));
    return () => { try { sub.remove(); } catch (_) { /* older RN */ } };
  }, []);

  // ── OTA update check ───────────────────────────────────────────────────
  // The JS bundle running RIGHT NOW was either baked into the APK or loaded
  // from a previously-downloaded OTA bundle. Either way, this is the one
  // the user chose to run this session — confirm it's good, then check
  // the backend for an even newer one. If found, it downloads silently
  // in the background and activates on the NEXT app launch.
  useEffect(() => {
    confirmAppliedVersion().finally(() => {
      checkForOtaUpdate();
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
        const storedRole = user.role || '';

        // Role guard — this APK is baked for a specific flavor (brand /
        // influencer / follower). If the logged-in user's role doesn't
        // match the flavor (e.g. brand APK with an influencer account),
        // clear the session and return to auth. Follower APKs accept any
        // logged-in follower; follower flavor also serves unauthenticated
        // browsing, so only guard brand + influencer flavors here.
        if (APP_ROLE && (APP_ROLE === 'brand' || APP_ROLE === 'influencer') && storedRole !== APP_ROLE) {
          await AsyncStorage.multiRemove(['inflx_token', 'inflx_refresh_token', 'inflx_user']);
          setRole('');
          return;
        }

        // features/registration-and-profile — the tab lock reads the account status at the
        // navigator's first render, so seed it from the stored user BEFORE the role flips the
        // navigator in. The stored `status` is what verify-otp returned (and api.js keeps it
        // current from every GET /me); the background /me below refreshes it again.
        setAccountStatus(user.status || null);
        setRole(storedRole);

        // Profile guard — a stored session only proves WHO the user is, not
        // that they ever finished setting up their business/creator profile.
        // A brand who verified OTP but never completed the registration form
        // has a users row and no brands row; restoring their session dropped
        // them straight into the tab bar, where every screen answers "profile
        // not found" and there is no route back to the form (it lives in the
        // auth stack). Confirm the profile in the background and, only on a
        // definitive NOT_FOUND, return them to sign-in — the OTP screen already
        // routes a profile-less account to the registration form. Network
        // errors and 401s are deliberately ignored here: the API client owns
        // session expiry, and a blip must never sign anyone out.
        const PROFILE_PATH = { brand: '/brands/me', influencer: '/influencers/me' };
        if (PROFILE_PATH[storedRole]) {
          const { api } = require('./src/services/api');
          api.get(PROFILE_PATH[storedRole]).then(async (res) => {
            if (res.success && res.data?.user_status) setAccountStatus(res.data.user_status);
            if (!res.success && res.error?.code === 'NOT_FOUND') {
              await AsyncStorage.multiRemove(['inflx_token', 'inflx_refresh_token', 'inflx_user']);
              setRole('');
            }
          }).catch(() => {});
        }

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
      {/* follower-app-v2: the old shopper app's location, cart and food-order providers went with
          it. The location one asked every flavor for the phone's position on first launch;
          now only the shopper app asks, at Welcome (rules v1.7 §5.3). */}
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      {!showSplash && (
        <NavigationContainer ref={navigationRef}>
          {role === 'brand' ? <BrandNavigator /> :
           role === 'influencer' ? <InfluencerNavigator /> :
           role === 'follower' ? <FollowerNavigator /> :
           isFollowerApp ? <FollowerNavigator /> :
           <AuthNavigator />}
        </NavigationContainer>
      )}
    </AuthContext.Provider>
  );
}
