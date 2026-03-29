import React, { useEffect, useState, createContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator } from 'react-native';
import { colors } from './src/theme/tokens';

import AuthNavigator from './src/navigation/AuthNavigator';
import InfluencerNavigator from './src/navigation/InfluencerNavigator';
import FollowerNavigator from './src/navigation/FollowerNavigator';
import BrandNavigator from './src/navigation/BrandNavigator';

export const AuthContext = createContext({ setRole: () => {} });

export default function App() {
  const [role, setRole] = useState(null); // null = loading, '' = unauthenticated

  useEffect(() => {
    async function init() {
      try {
        const token = await AsyncStorage.getItem('inflx_token');
        const userStr = await AsyncStorage.getItem('inflx_user');
        if (!token || !userStr) { setRole(''); return; }
        const user = JSON.parse(userStr);
        setRole(user.role || '');
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

  return (
    <AuthContext.Provider value={{ setRole }}>
      <NavigationContainer>
        {role === 'brand' ? <BrandNavigator /> :
         role === 'influencer' ? <InfluencerNavigator /> :
         role === 'follower' ? <FollowerNavigator /> :
         <AuthNavigator />}
      </NavigationContainer>
    </AuthContext.Provider>
  );
}
