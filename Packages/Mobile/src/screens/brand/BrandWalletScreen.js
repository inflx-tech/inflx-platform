import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, RefreshControl, Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fmtMoney, fmtRupees } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { openWebDashboard } from '../../utils/openWebDashboard';

const TX_ICONS = {
  topup: '⬆️', escrow_lock: '🔒', escrow_release: '🔓',
  payout: '💸', refund: '↩️', platform_fee: '📊',
};

const TX_LABELS = {
  topup: 'Wallet Top-up',
  escrow_lock: 'Escrow Lock',
  escrow_release: 'Escrow Release',
  payout: 'Payout',
  refund: 'Refund',
  platform_fee: 'Platform Fee',
};

/**
 * Build an HTML page that loads Razorpay checkout.js and opens the payment modal.
 * On success/failure/dismiss, posts a message back to React Native via WebView.
 */
function buildRazorpayCheckoutHTML({ orderId, amountPaise, keyId }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      display: flex; align-items: center; justify-content: center;
      height: 100vh; margin: 0; background: #F4F6FB;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .loader { text-align: center; color: #4A5278; }
    .loader p { margin-top: 16px; font-size: 14px; }
    .spinner {
      width: 40px; height: 40px; margin: 0 auto;
      border: 4px solid #E0E4EF; border-top-color: #1B2D5E;
      border-radius: 50%; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <p>Opening Razorpay...</p>
  </div>
  <script src="https://checkout.razorpay.com/v1/checkout.js"><\/script>
  <script>
    var options = {
      key: '${keyId}',
      amount: ${amountPaise},
      currency: 'INR',
      name: 'INFLX',
      description: 'Wallet Top-up',
      order_id: '${orderId}',
      prefill: { contact: '', email: '' },
      theme: { color: '#1B2D5E' },
      handler: function(response) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'PAYMENT_SUCCESS',
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        }));
      },
      modal: {
        ondismiss: function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'PAYMENT_DISMISSED',
          }));
        },
        escape: false,
        confirm_close: true,
      },
    };
    var rzp = new Razorpay(options);
    rzp.on('payment.failed', function(response) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'PAYMENT_FAILED',
        error: response.error ? response.error.description : 'Payment failed',
      }));
    });
    rzp.open();
  <\/script>
</body>
</html>`;
}

export default function BrandWalletScreen({ navigation }) {
  const [wallet, setWallet]             = useState(null);
  const [transactions, setTxns]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [topupAmt, setTopupAmt]         = useState('');
  const [toppingUp, setToppingUp]       = useState(false);
  const [showRazorpay, setShowRazorpay] = useState(false);
  const [razorpayHTML, setRazorpayHTML]  = useState('');
  const [verifying, setVerifying]       = useState(false);
  const pendingOrderRef = useRef(null);

  // ── Data loading ────────────────────────────────────────────────────────────

  async function load() {
    const token = await AsyncStorage.getItem('inflx_token');
    if (!token) {
      setLoading(false);
      Alert.alert(
        'Session Expired',
        'Please log in again to view your wallet.',
        [{ text: 'OK', onPress: () => navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Auth' }] }) }]
      );
      return;
    }

    const [walletRes, txRes] = await Promise.all([
      brandApi.getWallet(),
      brandApi.getWalletTransactions(),
    ]);
    setLoading(false);

    if (walletRes.success) {
      setWallet(walletRes.data?.wallet || walletRes.data);
    } else if (walletRes.error?.code === 'UNAUTHORIZED') {
      Alert.alert(
        'Session Expired',
        'Your session has expired. Please log in again.',
        [{ text: 'OK', onPress: () => navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Auth' }] }) }]
      );
      return;
    }

    if (txRes.success) {
      setTxns(txRes.data?.transactions || []);
    }
  }

  useEffect(() => { load(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, []);

  // ── Top-up flow ─────────────────────────────────────────────────────────────

  async function topup() {
    const amountRupees = parseFloat(topupAmt);
    if (!amountRupees || amountRupees < 1) {
      Alert.alert('Invalid Amount', 'Minimum top-up is \u20B91');
      return;
    }

    const token = await AsyncStorage.getItem('inflx_token');
    if (!token) {
      Alert.alert(
        'Session Expired',
        'Please log in again to top up your wallet.',
        [{ text: 'OK', onPress: () => navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Auth' }] }) }]
      );
      return;
    }

    setToppingUp(true);
    // Backend accepts rupees and converts to paise only for the Razorpay API.
    const res = await brandApi.createTopup(amountRupees);
    setToppingUp(false);

    if (!res.success) {
      if (res.error?.code === 'UNAUTHORIZED') {
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please log in again.',
          [{ text: 'OK', onPress: () => navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Auth' }] }) }]
        );
      } else {
        Alert.alert('Failed', res.error?.message || 'Top-up failed');
      }
      return;
    }

    const { order_id, amount, key_id } = res.data;
    pendingOrderRef.current = { order_id, amount, key_id };

    // Mock mode: order_id starts with "order_mock_" — auto-verify without Razorpay UI
    if (order_id && order_id.startsWith('order_mock_')) {
      await verifyPayment({
        razorpay_order_id: order_id,
        razorpay_payment_id: `pay_mock_${Date.now()}`,
        razorpay_signature: 'mock_signature',
      });
      return;
    }

    // Real mode: open Razorpay checkout in a WebView modal
    const html = buildRazorpayCheckoutHTML({
      orderId: order_id,
      amountPaise: amount,
      keyId: key_id,
    });
    setRazorpayHTML(html);
    setShowRazorpay(true);
  }

  async function verifyPayment(paymentData) {
    setVerifying(true);
    const res = await brandApi.verifyTopup(paymentData);
    setVerifying(false);

    if (res.success) {
      // Update wallet balance from verify response
      if (res.data?.wallet_balance != null) {
        setWallet(prev => prev ? { ...prev, wallet_balance: res.data.wallet_balance } : prev);
      }
      const displayAmt = topupAmt;
      setTopupAmt('');
      Alert.alert(
        'Top-up Successful',
        `₹${displayAmt} has been added to your wallet.`,
        [{ text: 'OK' }]
      );
      // Refresh to get updated wallet stats and transactions
      load();
    } else {
      Alert.alert(
        'Verification Failed',
        res.error?.message || 'Could not verify payment. If amount was debited, it will be refunded.',
      );
    }
  }

  function handleWebViewMessage(event) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      setShowRazorpay(false);

      if (data.type === 'PAYMENT_SUCCESS') {
        verifyPayment({
          razorpay_order_id: data.razorpay_order_id,
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_signature: data.razorpay_signature,
        });
      } else if (data.type === 'PAYMENT_FAILED') {
        Alert.alert('Payment Failed', data.error || 'Payment could not be completed. Please try again.');
      } else if (data.type === 'PAYMENT_DISMISSED') {
        Alert.alert('Payment Cancelled', 'You cancelled the payment. No amount was charged.');
      }
    } catch {
      // Ignore non-JSON messages from the WebView
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.navy} /></View>;
  }

  const balance        = wallet?.wallet_balance || 0;
  const escrowLocked   = wallet?.escrow_locked || 0;
  const totalDeposited = wallet?.total_deposited || 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Wallet</Text>
        </View>

        {/* ── Balance Card ───────────────────────────────────────────────
            wallet_balance / escrow_locked / total_deposited are stored in
            PAISE in the DB — fmtMoney handles the /100 conversion. Using
            fmtRupees here was showing every value 100× too big. */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmt}>{fmtMoney(balance)}</Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceStat}>
              <Text style={styles.balanceStatLabel}>Locked in Escrow</Text>
              <Text style={styles.balanceStatVal}>{fmtMoney(escrowLocked)}</Text>
            </View>
            <View style={styles.balanceStat}>
              <Text style={styles.balanceStatLabel}>Total Deposited</Text>
              <Text style={styles.balanceStatVal}>{fmtMoney(totalDeposited)}</Text>
            </View>
          </View>
        </View>

        {/* ── Add Funds ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Funds</Text>
          <View style={styles.quickRow}>
            {[5000, 10000, 25000, 50000].map(amt => (
              <TouchableOpacity
                key={amt}
                style={[styles.quickChip, topupAmt === String(amt) && styles.quickChipActive]}
                onPress={() => setTopupAmt(String(amt))}
              >
                <Text style={[styles.quickText, topupAmt === String(amt) && styles.quickTextActive]}>
                  {fmtRupees(amt)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.topupRow}>
            <View style={styles.topupInput}>
              <Text style={styles.rupeeSign}>₹</Text>
              <TextInput
                style={styles.topupField}
                value={topupAmt}
                onChangeText={setTopupAmt}
                placeholder="Custom amount"
                placeholderTextColor={colors.t3}
                keyboardType="numeric"
              />
            </View>
            <TouchableOpacity
              style={[styles.topupBtn, (toppingUp || verifying || !topupAmt) && { opacity: 0.5 }]}
              onPress={topup}
              disabled={toppingUp || verifying || !topupAmt}
            >
              {(toppingUp || verifying)
                ? <ActivityIndicator color={colors.white} size="small" />
                : <Text style={styles.topupBtnText}>Top Up</Text>
              }
            </TouchableOpacity>
          </View>
          {verifying && (
            <View style={styles.verifyingRow}>
              <ActivityIndicator size="small" color={colors.navy} />
              <Text style={styles.verifyingText}>Verifying payment...</Text>
            </View>
          )}
        </View>

        {/* ── Recent Transactions ──────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {transactions.length === 0 ? (
            <View style={styles.emptyTx}>
              <Text style={styles.emptyTxText}>No transactions yet. Top up your wallet to get started.</Text>
            </View>
          ) : (
            transactions.slice(0, 15).map((tx, i) => {
              const isCredit = ['topup', 'escrow_release', 'refund'].includes(tx.type);
              const txAmount = parseFloat(tx.amount || 0);
              return (
                <View key={tx.id || i} style={styles.txRow}>
                  <Text style={styles.txIcon}>{TX_ICONS[tx.type] || '•'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txType}>{TX_LABELS[tx.type] || tx.type?.replace(/_/g, ' ')}</Text>
                    {tx.razorpay_payment_id ? (
                      <Text style={styles.txRef}>Ref: {tx.razorpay_payment_id}</Text>
                    ) : null}
                    <Text style={styles.txDate}>
                      {tx.created_at ? new Date(tx.created_at).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      }) : ''}
                    </Text>
                  </View>
                  <Text style={[styles.txAmount, { color: isCredit ? colors.teal : colors.red }]}>
                    {isCredit ? '+' : '-'}{fmtMoney(Math.abs(txAmount))}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* ── View full history on web ─────────────────────────────────── */}
        {transactions.length > 0 && (
          <TouchableOpacity style={styles.webLink} onPress={() => openWebDashboard('/dashboard/wallet')}>
            <Text style={styles.webLinkIcon}>🌐</Text>
            <Text style={styles.webLinkText}>View full transaction history on web</Text>
            <Text style={styles.webLinkArrow}>›</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Razorpay WebView Modal ──────────────────────────────────────── */}
      <Modal
        visible={showRazorpay}
        animationType="slide"
        onRequestClose={() => {
          setShowRazorpay(false);
          Alert.alert('Payment Cancelled', 'You closed the payment window. No amount was charged.');
        }}
      >
        <View style={styles.webviewContainer}>
          <View style={styles.webviewHeader}>
            <TouchableOpacity
              style={styles.webviewClose}
              onPress={() => {
                setShowRazorpay(false);
                Alert.alert('Payment Cancelled', 'You closed the payment window. No amount was charged.');
              }}
            >
              <Text style={styles.webviewCloseText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.webviewTitle}>Razorpay Payment</Text>
            <View style={{ width: 60 }} />
          </View>
          {razorpayHTML ? (
            <WebView
              source={{ html: razorpayHTML }}
              onMessage={handleWebViewMessage}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.webviewLoading}>
                  <ActivityIndicator size="large" color={colors.navy} />
                  <Text style={{ marginTop: 12, color: colors.t2 }}>Loading payment gateway...</Text>
                </View>
              )}
              style={{ flex: 1 }}
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  title: { fontSize: 22, fontWeight: '800', color: colors.white },

  // Balance card
  balanceCard: { margin: 16, marginBottom: 0, backgroundColor: colors.navy, borderRadius: 20, padding: 20 },
  balanceLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: 1 },
  balanceAmt: { fontSize: 36, fontWeight: '900', color: colors.white, marginTop: 4, marginBottom: 12 },
  balanceRow: { flexDirection: 'row', gap: 16 },
  balanceStat: { flex: 1 },
  balanceStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  balanceStatVal: { fontSize: 16, fontWeight: '700', color: colors.white, marginTop: 2 },

  // Add funds
  section: { margin: 16, marginBottom: 0 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.t1, marginBottom: 10 },
  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  quickChip: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.surface2, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  quickChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  quickText: { fontSize: 12, fontWeight: '700', color: colors.t2 },
  quickTextActive: { color: colors.white },
  topupRow: { flexDirection: 'row', gap: 10 },
  topupInput: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: colors.border2, borderRadius: 12 },
  rupeeSign: { paddingHorizontal: 12, fontSize: 16, fontWeight: '700', color: colors.t2 },
  topupField: { flex: 1, paddingVertical: 12, fontSize: 16, color: colors.t1 },
  topupBtn: { backgroundColor: colors.navy, borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center' },
  topupBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },

  // Verifying state
  verifyingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.navyPale, borderRadius: 8 },
  verifyingText: { fontSize: 12, fontWeight: '600', color: colors.navy },

  // Transactions
  emptyTx: { paddingVertical: 24, alignItems: 'center' },
  emptyTxText: { fontSize: 13, color: colors.t3, textAlign: 'center' },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  txIcon: { fontSize: 18 },
  txType: { fontSize: 13, color: colors.t1, fontWeight: '600' },
  txRef: { fontSize: 10, color: colors.t3, marginTop: 1 },
  txDate: { fontSize: 10, color: colors.t3, marginTop: 1 },
  txAmount: { fontSize: 14, fontWeight: '700' },

  // Web link
  webLink: { margin: 16, backgroundColor: colors.white, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border },
  webLinkIcon: { fontSize: 18 },
  webLinkText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.navy },
  webLinkArrow: { fontSize: 18, color: colors.t3 },

  // Razorpay WebView modal
  webviewContainer: { flex: 1, backgroundColor: colors.bg },
  webviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.navyDeep, paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16 },
  webviewClose: { width: 60 },
  webviewCloseText: { fontSize: 14, fontWeight: '600', color: colors.orange },
  webviewTitle: { fontSize: 16, fontWeight: '700', color: colors.white },
  webviewLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
});
