import React, { useEffect, useState } from 'react';
import {
  View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../../theme/tokens';
import { influencerApi, brandApi } from '../../services/api';

/**
 * ContractPdfScreen — shared between influencer + brand roles.
 *
 * Flow:
 *  1. Ask backend for a fresh presigned R2 GET URL via /contracts/:id/pdf-url.
 *     The backend ensures the PDF has been generated + uploaded first, so
 *     this call is safe to make any time the contract exists.
 *  2. Render the PDF inline in a WebView. iOS WKWebView renders PDFs
 *     natively; Android WebView can't, so we wrap the signed URL in Google
 *     Docs Viewer which displays the PDF as HTML pages. Signed URLs work
 *     because Google fetches with no auth headers.
 *  3. The Download / Open in Browser button opens the raw signed URL via
 *     Linking.openURL — this hands off to the system browser / PDF app
 *     which downloads a real file (not the 0-byte stub that Android WebView
 *     was producing with the auth-protected streaming endpoint).
 *
 * Route params:
 *  - contractId (required)
 *  - role (optional, 'brand' | 'influencer') — routes through the correct
 *    api client. Defaults to influencer.
 */
export default function ContractPdfScreen({ route, navigation }) {
  const { contractId, role } = route.params || {};
  const [signedUrl, setSignedUrl] = useState(null);
  const [viewerUrl, setViewerUrl] = useState(null);
  const [loadingUrl, setLoadingUrl] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadUrl();
  }, [contractId]);

  async function loadUrl() {
    setLoadingUrl(true);
    setError(null);
    const client = role === 'brand' ? brandApi : influencerApi;
    const res = await client.getContractPdfUrl(contractId);
    setLoadingUrl(false);
    if (!res?.success) {
      setError(res?.error?.message || 'Could not fetch contract PDF URL');
      return;
    }
    const url = res.data?.url;
    if (!url) {
      setError('Backend did not return a PDF URL');
      return;
    }
    setSignedUrl(url);
    // Google Docs Viewer renders PDFs as HTML so Android WebView can show
    // them inline. iOS Safari/WKWebView could render the signed URL
    // directly, but Docs Viewer works on both and keeps the code simple.
    setViewerUrl(`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`);
  }

  async function handleOpen() {
    if (!signedUrl) return;
    try {
      await Linking.openURL(signedUrl);
    } catch (e) {
      Alert.alert('Unable to open', e?.message || 'Could not open the PDF externally.');
    }
  }

  if (!contractId) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Missing contract ID.</Text>
      </View>
    );
  }

  return (
    <View style={styles.outer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{'<-'} Back</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Contract PDF</Text>
          {signedUrl && (
            <TouchableOpacity onPress={handleOpen} style={styles.downloadBtn}>
              <Text style={styles.downloadBtnText}>Download</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loadingUrl && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.navy} />
          <Text style={styles.loadingText}>Preparing contract...</Text>
        </View>
      )}

      {error && !loadingUrl && (
        <View style={styles.center}>
          <Text style={styles.errorText}>Could not load PDF.</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <TouchableOpacity onPress={loadUrl} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loadingUrl && !error && viewerUrl && (
        <WebView
          source={{ uri: viewerUrl }}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.center}>
              <ActivityIndicator color={colors.navy} />
              <Text style={styles.loadingText}>Rendering contract...</Text>
            </View>
          )}
          onError={({ nativeEvent }) => setError(nativeEvent.description || 'Render error')}
          androidLayerType="hardware"
          originWhitelist={['*']}
          style={{ flex: 1 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outer:     { flex: 1, backgroundColor: colors.bg },
  header:    { backgroundColor: colors.navyDeep, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20 },
  back:      { marginBottom: 8 },
  backText:  { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:     { fontSize: 18, fontWeight: '800', color: colors.white },
  downloadBtn: { backgroundColor: colors.orange, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  downloadBtnText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { fontSize: 13, color: colors.t3, marginTop: 12 },
  errorText: { fontSize: 14, color: colors.red, fontWeight: '700', textAlign: 'center' },
  errorSub:  { fontSize: 12, color: colors.t3, marginTop: 6, textAlign: 'center' },
  retryBtn:  { marginTop: 14, backgroundColor: colors.navy, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: colors.white, fontWeight: '700', fontSize: 12 },
});
