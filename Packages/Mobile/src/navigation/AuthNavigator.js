import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PhoneScreen from '../screens/auth/PhoneScreen';
import OTPScreen from '../screens/auth/OTPScreen';
import WaitingScreen from '../screens/auth/WaitingScreen';
import RejectedScreen from '../screens/auth/RejectedScreen';
import InfluencerRegisterScreen from '../screens/auth/InfluencerRegisterScreen';

const Stack = createNativeStackNavigator();

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Phone" component={PhoneScreen} />
      <Stack.Screen name="OTP" component={OTPScreen} />
      <Stack.Screen name="InfluencerRegister" component={InfluencerRegisterScreen} />
      <Stack.Screen name="Waiting" component={WaitingScreen} />
      <Stack.Screen name="Rejected" component={RejectedScreen} />
    </Stack.Navigator>
  );
}
