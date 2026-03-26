import { Platform } from 'react-native';

// Android emulator maps 10.0.2.2 to localhost on host machine
// iOS simulator can use localhost directly
// Physical device: use ngrok URL
const getBaseUrl = () => {
  if (__DEV__) {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:3001/v1';
    }
    return 'http://localhost:3001/v1';
  }
  return 'https://api.inflx.in/v1';
};

export const API_BASE_URL = getBaseUrl();
