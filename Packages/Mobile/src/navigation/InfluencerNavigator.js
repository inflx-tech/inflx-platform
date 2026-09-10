import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ProfileScreen from '../screens/influencer/ProfileScreen';
import LegalListScreen from '../screens/legal/LegalListScreen';
import LegalDocumentScreen from '../screens/legal/LegalDocumentScreen';

// features/profile-only-apps — every creator screen except Profile was removed on the
// founder's instruction (2026-09-10). One screen left, so no tab bar: the app opens
// straight on the profile. Legal stays because the stores require the privacy policy
// to be reachable inside the app. Backend and database untouched.
const Stack = createNativeStackNavigator();

export default function InfluencerNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      {/* Legal — creators get the creator document set. */}
      <Stack.Screen name="LegalList" component={LegalListScreen} initialParams={{ audience: 'creator' }} />
      <Stack.Screen name="LegalDocument" component={LegalDocumentScreen} />
    </Stack.Navigator>
  );
}
