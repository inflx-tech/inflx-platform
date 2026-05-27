import React, { useEffect, useState } from 'react';
import {
  View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { WebView } from 'react-native-webview';
import { brandPalette as P, fonts } from '../../theme/tokens';
import { influencerApi, brandApi } from '../../services/api';

/**
 * ContractPdfScreen — shared between influencer + brand roles.
 *
 * Flow 35 restyle (2026-05-27): brandPalette + Outfit/PJS/Mono fonts.
 * Yellow-bg + ink-text + MCI download-outline Download CTA (inverts usual
 * ink/yellow pattern for pop against ink hero) per locked design call #3.
 * WebView + Google Docs Viewer wrap + androidLayerType + originWhitelist
 * preserved byte-for-byte.
 *
 *  1. Ask backend for a fresh presigned R2 GET URL via /contracts/:id/pdf-url.
 *     The backend ensures the PDF has been generated + uploaded first, so
 *     this call is safe to make any time the contract exists.
 *  2. Render the PDF inline in a WebView. iOS WKWebView renders PDFs
 *     natively; Android WebView can't, so we wrap the signed URL in Google
 *     Docs Viewer which displays the PDF as HTML pages.
 *  3. The Download button opens the raw signed URL via Linking.openURL —
 *     this hands off to the system browser / PDF app which downloads a
 *     real file (not the 0-byte stub that Android WebView was producing).
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <Icon name="chevron-left" size={14} color="rgba(255,255,255,0.65)" />
          <Text style={styles.backText}>BACK</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Contract PDF</Text>
          {signedUrl && (
            <TouchableOpacity onPress={handleOpen} style={styles.downloadBtn}>
              <Icon name="download" size={14} color={P.ink} />
              <Text style={styles.downloadBtnText}>DOWNLOAD</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.headerAccent} />
      </View>

      {loadingUrl && (
        <View style={styles.center}>
          <ActivityIndicator color={P.yellow} />
          <Text style={styles.loadingText}>Preparing contract…</Text>
        </View>
      )}

      {error && !loadingUrl && (
        <View style={styles.center}>
          <Text style={styles.errorText}>Could not load PDF.</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <TouchableOpacity onPress={loadUrl} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>TRY AGAIN</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loadingUrl && !error && viewerUrl && (
        <WebView
          source={{ uri: viewerUrl }}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.center}>
              <ActivityIndicator color={P.yellow} />
              <Text style={styles.loadingText}>Rendering contract…</Text>
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
  outer: { flex: 1, backgroundColor: P.bg },

  header: { backgroundColor: P.ink, paddingTop: 50, paddingBottom: 22, paddingHorizontal: 18, position: 'relative' },
  headerAccent: { position: 'absolute', left: 18, bottom: 8, width: 30, height: 3, backgroundColor: P.yellow, borderRadius: 2 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  backText: { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '800', letterSpacing: 0.3, fontFamily: fonts.monoBold },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '900', color: P.white, letterSpacing: -0.3, fontFamily: fonts.displayBlack },

  // Download CTA — yellow-bg + ink-text (inverts ink/yellow pattern per locked design call #3)
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: P.yellow,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10,
  },
  downloadBtnText: { color: P.ink, fontWeight: '900', fontSize: 11.5, letterSpacing: 0.3, fontFamily: fonts.displayBlack },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { fontSize: 12, color: P.muted2, marginTop: 12, fontFamily: fonts.sansRegular },
  errorText: { fontSize: 14, color: P.dangerText, fontWeight: '800', textAlign: 'center', fontFamily: fonts.displayBold },
  errorSub: { fontSize: 11.5, color: P.muted, marginTop: 6, textAlign: 'center', fontFamily: fonts.sansRegular },

  retryBtn: { marginTop: 14, backgroundColor: P.ink, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
  retryBtnText: { color: P.yellow, fontWeight: '900', fontSize: 12, letterSpacing: 0.3, fontFamily: fonts.displayBlack },
});
