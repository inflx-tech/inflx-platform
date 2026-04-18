import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { colors } from '../../theme/tokens';
import { API_BASE_URL } from '../../config/api';

/**
 * ContractPdfScreen
 *
 * Renders the contract PDF inside a WebView. The backend endpoint
 *   GET /v1/contracts/:id/pdf
 * streams the PDF binary and is JWT-protected — we forward the bearer token
 * via the WebView `headers` prop. Both Android (Chrome WebView) and iOS
 * (WKWebView) render application/pdf inline.
 *
 * Route params: { contractId }
 */
export default function ContractPdfScreen({ route, navigation }) {
  const { contractId } = route.params || {};
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('inflx_token').then(t => {
      if (!t) {
        Alert.alert('Session expired', 'Please log in again.');
        navigation.goBack();
        return;
      }
      setToken(t);
    });
  }, []);

  if (!contractId) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Missing contract ID.</Text>
      </View>
    );
  }

  if (!token) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.navy} />
      </View>
    );
  }

  const url = `${API_BASE_URL}/contracts/${contractId}/pdf`;

  return (
    <View style={styles.outer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{'<-'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Contract PDF</Text>
      </View>

      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Could not load PDF.</Text>
          <Text style={styles.errorSub}>{error}</Text>
        </View>
      ) : (
        <WebView
          source={{ uri: url, headers: { Authorization: `Bearer ${token}` } }}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.center}>
              <ActivityIndicator color={colors.navy} />
              <Text style={styles.loadingText}>Loading contract...</Text>
            </View>
          )}
          onError={({ nativeEvent }) => setError(nativeEvent.description || 'Network error')}
          // Allow inline PDF rendering on Android
          androidLayerType="hardware"
          originWhitelist={['*']}
          style={{ flex: 1 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.navyDeep, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20 },
  back: { marginBottom: 8 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '800', color: colors.white },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { fontSize: 13, color: colors.t3, marginTop: 12 },
  errorText: { fontSize: 14, color: colors.red, fontWeight: '700' },
  errorSub: { fontSize: 12, color: colors.t3, marginTop: 6, textAlign: 'center' },
});
