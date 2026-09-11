import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import BrandProfileScreen from '../screens/brand/BrandProfileScreen';
import LegalListScreen from '../screens/legal/LegalListScreen';
import LegalDocumentScreen from '../screens/legal/LegalDocumentScreen';
// Item 2 — pitch settings, blocked creators, the creator profile (X4) and a minimal finder.
// Contract: features/item2-pitch-invitation-settings
import BrandPitchSettingsScreen from '../screens/brand/BrandPitchSettingsScreen';
import BrandBlockedCreatorsScreen from '../screens/brand/BrandBlockedCreatorsScreen';
import BrandCreatorProfileScreen from '../screens/brand/BrandCreatorProfileScreen';
import BrandPitchesPlaceholderScreen from '../screens/brand/BrandPitchesPlaceholderScreen';
import FindPartyScreen from '../screens/shared/FindPartyScreen';

// features/profile-only-apps — every brand screen except Profile was removed on the
// founder's instruction (2026-09-10). One screen left, so no tab bar: the app opens
// straight on the profile. Legal stays because the stores require the privacy policy
// to be reachable inside the app. Backend and database untouched.
const Stack = createNativeStackNavigator();

export default function BrandNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BrandProfile" component={BrandProfileScreen} />
      {/* Item 2 */}
      <Stack.Screen name="BrandPitchSettings" component={BrandPitchSettingsScreen} />
      <Stack.Screen name="BrandBlockedCreators" component={BrandBlockedCreatorsScreen} />
      <Stack.Screen name="BrandCreatorProfile" component={BrandCreatorProfileScreen} />
      <Stack.Screen name="BrandPitchesPlaceholder" component={BrandPitchesPlaceholderScreen} />
      <Stack.Screen name="FindParty" component={FindPartyScreen} initialParams={{ mode: 'creators' }} />
      {/* Legal — brands get the brand document set. */}
      <Stack.Screen name="LegalList" component={LegalListScreen} initialParams={{ audience: 'brand' }} />
      <Stack.Screen name="LegalDocument" component={LegalDocumentScreen} />
    </Stack.Navigator>
  );
}
