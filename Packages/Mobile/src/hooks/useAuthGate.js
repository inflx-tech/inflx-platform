import { useCallback, useContext } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../../App';

/**
 * useAuthGate — checks if user is logged in before performing an action.
 *
 * For the follower app which allows public browsing:
 * - Browse, view stores, see deals → no login needed
 * - Pay, book, pre-book, save → login required
 *
 * Usage:
 *   const { requireAuth } = useAuthGate(navigation);
 *   requireAuth(() => navigation.navigate('PayAtStore', params));
 */

export default function useAuthGate(navigation) {
  const requireAuth = useCallback(async (onAuthenticated) => {
    const token = await AsyncStorage.getItem('inflx_token');
    if (token) {
      // Already logged in — proceed
      onAuthenticated();
    } else {
      // Not logged in — prompt
      Alert.alert(
        'Login Required',
        'You need to sign in to make payments and bookings. It only takes 30 seconds!',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign In',
            onPress: () => {
              // Store the pending action so we can resume after login
              AsyncStorage.setItem('inflx_pending_action', JSON.stringify({
                screen: 'pending_payment',
                timestamp: Date.now(),
              }));
              // Navigate to auth flow
              // Since follower app doesn't have AuthNavigator in its stack,
              // we show a simple OTP login modal or navigate to a login screen
              navigation.navigate('FollowerLogin');
            },
          },
        ]
      );
    }
  }, [navigation]);

  return { requireAuth };
}
