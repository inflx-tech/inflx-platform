import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import BrandProfileScreen from '../screens/brand/BrandProfileScreen';
import LegalListScreen from '../screens/legal/LegalListScreen';
import LegalDocumentScreen from '../screens/legal/LegalDocumentScreen';

// features/profile-only-apps — every brand screen except Profile was removed on the
// founder's instruction (2026-09-10). One screen left, so no tab bar: the app opens
// straight on the profile. Legal stays because the stores require the privacy policy
// to be reachable inside the app. Backend and database untouched.
const Stack = createNativeStackNavigator();

export default function BrandNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BrandProfile" component={BrandProfileScreen} />
      {/* Legal — brands get the brand document set. */}
      <Stack.Screen name="LegalList" component={LegalListScreen} initialParams={{ audience: 'brand' }} />
      <Stack.Screen name="LegalDocument" component={LegalDocumentScreen} />
    </Stack.Navigator>
  );
}
