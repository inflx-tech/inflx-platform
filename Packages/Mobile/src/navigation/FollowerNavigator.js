import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import MeScreen from '../screens/follower/MeScreen';
import EditProfileScreen from '../screens/follower/EditProfileScreen';
// Sign-in stays: it is the only way from a guest profile into an account.
import FollowerLoginScreen from '../screens/follower/FollowerLoginScreen';
import LegalListScreen from '../screens/legal/LegalListScreen';
import LegalDocumentScreen from '../screens/legal/LegalDocumentScreen';

// features/profile-only-apps — every shopper screen except Profile and Edit Profile was
// removed on the founder's instruction (2026-09-10). One screen left, so no tab bar: the
// app opens straight on the profile. Legal stays because the stores require the privacy
// policy to be reachable inside the app. Backend and database untouched.
// Incoming inflx.in links (utils/deepLink.js) now name routes that do not exist here;
// navigateWhenReady swallows that, so a link simply opens the app on the profile.
const Stack = createNativeStackNavigator();

export default function FollowerNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={MeScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="FollowerLogin" component={FollowerLoginScreen} />
      {/* Legal — shoppers get the shopper document set. */}
      <Stack.Screen name="LegalList" component={LegalListScreen} initialParams={{ audience: 'shopper' }} />
      <Stack.Screen name="LegalDocument" component={LegalDocumentScreen} />
    </Stack.Navigator>
  );
}
