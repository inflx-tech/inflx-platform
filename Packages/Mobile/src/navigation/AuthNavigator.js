import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PhoneScreen from '../screens/auth/PhoneScreen';
import OTPScreen from '../screens/auth/OTPScreen';
// features/registration-and-profile — the Waiting screen is retired: a pending account enters
// the app (PendingHomeScreen says "under review"); only a rejected one stays out here.
import RejectedScreen from '../screens/auth/RejectedScreen';
import InfluencerRegisterScreen from '../screens/auth/InfluencerRegisterScreen';
import BrandRegisterScreen from '../screens/auth/BrandRegisterScreen';

const Stack = createNativeStackNavigator();

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Phone" component={PhoneScreen} />
      <Stack.Screen name="OTP" component={OTPScreen} />
      <Stack.Screen name="InfluencerRegister" component={InfluencerRegisterScreen} />
      <Stack.Screen name="BrandRegister" component={BrandRegisterScreen} />
      <Stack.Screen name="Rejected" component={RejectedScreen} />
    </Stack.Navigator>
  );
}
