import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, RefreshControl, Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { brandPalette as P, fonts, fmtMoney, fmtRupees } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { openWebDashboard } from '../../utils/openWebDashboard';

/**
 * BrandWalletScreen — wallet balance + Razorpay top-up + payout bank
 * details + transaction history.
 *
 * Flow 26 (2026-05-26): navy + orange → brandPalette + Outfit/PJS/JetBrains-
 * Mono. SDK boundary preserved verbatim (react-native-webview + AsyncStorage
 * + Razorpay checkout.js CDN + 3-message-type handler + mock-order auto-
 * verify branching). Single HTML-string change: theme color '#1B2D5E' →
 * '#0A0A0A' inside buildRazorpayCheckoutHTML (Razorpay modal accent).
 */

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
 * Build the Razorpay checkout HTML loaded inside the WebView.
 * Flow 26: theme color '#1B2D5E' (navy) → '#0A0A0A' (ink) for brandPalette
 * consistency. All other structure preserved verbatim (key/amount/order
 * placeholders, postMessage handlers for SUCCESS/FAILED/DISMISSED).
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
      height: 100vh; margin: 0; background: #FAFAFA;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .loader { text-align: center; color: #52525B; }
    .loader p { margin-top: 16px; font-size: 14px; }
    .spinner {
      width: 40px; height: 40px; margin: 0 auto;
      border: 4px solid #E4E4E7; border-top-color: #0A0A0A;
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
      theme: { color: '#0A0A0A' },
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

  const [brand, setBrand]                = useState(null);
  const [bank, setBank]                  = useState({
    account_holder_name: '', bank_name: '', account_number: '', ifsc_code: '', upi_id: '',
  });
  const [savingBank, setSavingBank]      = useState(false);

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

    const [walletRes, txRes, brandRes] = await Promise.all([
      brandApi.getWallet(),
      brandApi.getWalletTransactions(),
      brandApi.getMe().catch(() => null),
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

    if (brandRes?.success) {
      const b = brandRes.data?.brand || brandRes.data;
      setBrand(b);
      const bd = b?.listing_data?.bank_details || {};
      setBank({
        account_holder_name: bd.account_holder_name || '',
        bank_name:           bd.bank_name || '',
        account_number:      bd.account_number || '',
        ifsc_code:           bd.ifsc_code || '',
        upi_id:              bd.upi_id || '',
      });
    }
  }

  async function saveBankDetails() {
    const holder = bank.account_holder_name.trim();
    const acct   = bank.account_number.trim();
    const ifsc   = bank.ifsc_code.trim().toUpperCase();
    if (!holder)  { Alert.alert('Required', 'Account holder name is required.'); return; }
    if (!acct)    { Alert.alert('Required', 'Account number is required.'); return; }
    if (!ifsc)    { Alert.alert('Required', 'IFSC code is required.'); return; }

    setSavingBank(true);
    const currentLd = brand?.listing_data || {};
    const payload = {
      listing_data: {
        ...currentLd,
        bank_details: {
          account_holder_name: holder,
          bank_name:           bank.bank_name.trim(),
          account_number:      acct,
          ifsc_code:           ifsc,
          upi_id:              bank.upi_id.trim(),
        },
      },
    };
    const res = await brandApi.updateMe(payload);
    setSavingBank(false);
    if (!res.success) { Alert.alert('Save failed', res.error?.message || 'Could not save payout details.'); return; }
    Alert.alert('Saved', 'Payout details saved. You can now receive payouts to this account.');
    setBrand(prev => ({ ...prev, listing_data: payload.listing_data }));
  }

  useEffect(() => { load(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, []);

  async function topup() {
    const amountRupees = parseFloat(topupAmt);
    if (!amountRupees || amountRupees < 1) { Alert.alert('Invalid Amount', 'Minimum top-up is ₹1'); return; }

    const token = await AsyncStorage.getItem('inflx_token');
    if (!token) {
      Alert.alert('Session Expired', 'Please log in again to top up your wallet.',
        [{ text: 'OK', onPress: () => navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Auth' }] }) }]);
      return;
    }

    setToppingUp(true);
    const res = await brandApi.createTopup(amountRupees);
    setToppingUp(false);

    if (!res.success) {
      if (res.error?.code === 'UNAUTHORIZED') {
        Alert.alert('Session Expired', 'Your session has expired. Please log in again.',
          [{ text: 'OK', onPress: () => navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Auth' }] }) }]);
      } else {
        Alert.alert('Failed', res.error?.message || 'Top-up failed');
      }
      return;
    }

    const { order_id, amount, key_id } = res.data;
    pendingOrderRef.current = { order_id, amount, key_id };

    // Mock mode: order_id startsWith "order_mock_" → auto-verify without WebView
    if (order_id && order_id.startsWith('order_mock_')) {
      await verifyPayment({
        razorpay_order_id: order_id,
        razorpay_payment_id: `pay_mock_${Date.now()}`,
        razorpay_signature: 'mock_signature',
      });
      return;
    }

    const html = buildRazorpayCheckoutHTML({ orderId: order_id, amountPaise: amount, keyId: key_id });
    setRazorpayHTML(html);
    setShowRazorpay(true);
  }

  async function verifyPayment(paymentData) {
    setVerifying(true);
    const res = await brandApi.verifyTopup(paymentData);
    setVerifying(false);

    if (res.success) {
      if (res.data?.wallet_balance != null) {
        setWallet(prev => prev ? { ...prev, wallet_balance: res.data.wallet_balance } : prev);
      }
      const displayAmt = topupAmt;
      setTopupAmt('');
      Alert.alert('Top-up Successful', `₹${displayAmt} has been added to your wallet.`, [{ text: 'OK' }]);
      load();
    } else {
      Alert.alert('Verification Failed', res.error?.message || 'Could not verify payment. If amount was debited, it will be refunded.');
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

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={P.yellow} size="large" /></View>;
  }

  const balance        = wallet?.wallet_balance || 0;
  const escrowLocked   = wallet?.escrow_locked || 0;
  const totalDeposited = wallet?.total_deposited || 0;

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        style={s.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.yellow} colors={[P.yellow]} />}
      >
        <View style={s.header}>
          <Text style={s.title}>Wallet</Text>
        </View>

        <View style={s.balanceCard}>
          <Text style={s.balanceLabel}>Available Balance</Text>
          <Text style={s.balanceAmt}>{fmtMoney(balance)}</Text>
          <View style={s.balanceRow}>
            <View style={s.balanceStat}>
              <Text style={s.balanceStatLabel}>Locked in Escrow</Text>
              <Text style={s.balanceStatVal}>{fmtMoney(escrowLocked)}</Text>
            </View>
            <View style={s.balanceStat}>
              <Text style={s.balanceStatLabel}>Total Deposited</Text>
              <Text style={s.balanceStatVal}>{fmtMoney(totalDeposited)}</Text>
            </View>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Add Funds</Text>
          <View style={s.quickRow}>
            {[5000, 10000, 25000, 50000].map(amt => (
              <TouchableOpacity
                key={amt}
                style={[s.quickChip, topupAmt === String(amt) && s.quickChipActive]}
                onPress={() => setTopupAmt(String(amt))}
                activeOpacity={0.7}
              >
                <Text style={[s.quickText, topupAmt === String(amt) && s.quickTextActive]}>{fmtRupees(amt)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.topupRow}>
            <View style={s.topupInput}>
              <Text style={s.rupeeSign}>₹</Text>
              <TextInput
                style={s.topupField}
                value={topupAmt}
                onChangeText={setTopupAmt}
                placeholder="Custom amount"
                placeholderTextColor={P.muted3}
                keyboardType="numeric"
              />
            </View>
            <TouchableOpacity
              style={[s.topupBtn, (toppingUp || verifying || !topupAmt) && { opacity: 0.5 }]}
              onPress={topup}
              disabled={toppingUp || verifying || !topupAmt}
              activeOpacity={0.85}
            >
              {(toppingUp || verifying)
                ? <ActivityIndicator color={P.yellow} size="small" />
                : <Text style={s.topupBtnText}>Top Up</Text>}
            </TouchableOpacity>
          </View>
          {verifying && (
            <View style={s.verifyingRow}>
              <ActivityIndicator size="small" color={P.yellowText} />
              <Text style={s.verifyingText}>Verifying payment…</Text>
            </View>
          )}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Payout Details</Text>
          <Text style={s.bankHint}>Where refunds and payouts will land.</Text>

          <View style={s.bankField}>
            <Text style={s.bankLabel}>Account holder name *</Text>
            <TextInput
              style={s.bankInput}
              value={bank.account_holder_name}
              onChangeText={(v) => setBank(p => ({ ...p, account_holder_name: v }))}
              placeholder="As on bank account"
              placeholderTextColor={P.muted3}
            />
          </View>

          <View style={s.bankField}>
            <Text style={s.bankLabel}>Bank name</Text>
            <TextInput
              style={s.bankInput}
              value={bank.bank_name}
              onChangeText={(v) => setBank(p => ({ ...p, bank_name: v }))}
              placeholder="e.g. HDFC Bank"
              placeholderTextColor={P.muted3}
            />
          </View>

          <View style={s.bankField}>
            <Text style={s.bankLabel}>Account number *</Text>
            <TextInput
              style={[s.bankInput, { fontFamily: fonts.monoMedium }]}
              value={bank.account_number}
              onChangeText={(v) => setBank(p => ({ ...p, account_number: v.replace(/\D/g, '') }))}
              placeholder="Digits only"
              placeholderTextColor={P.muted3}
              keyboardType="numeric"
            />
          </View>

          <View style={s.bankField}>
            <Text style={s.bankLabel}>IFSC code *</Text>
            <TextInput
              style={[s.bankInput, { fontFamily: fonts.monoMedium }]}
              value={bank.ifsc_code}
              onChangeText={(v) => setBank(p => ({ ...p, ifsc_code: v.toUpperCase() }))}
              placeholder="e.g. HDFC0001234"
              placeholderTextColor={P.muted3}
              autoCapitalize="characters"
              maxLength={11}
            />
          </View>

          <View style={s.bankField}>
            <Text style={s.bankLabel}>UPI ID</Text>
            <TextInput
              style={[s.bankInput, { fontFamily: fonts.monoMedium }]}
              value={bank.upi_id}
              onChangeText={(v) => setBank(p => ({ ...p, upi_id: v }))}
              placeholder="e.g. brand@hdfc"
              placeholderTextColor={P.muted3}
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[s.bankSaveBtn, savingBank && { opacity: 0.5 }]}
            onPress={saveBankDetails}
            disabled={savingBank}
            activeOpacity={0.85}
          >
            {savingBank
              ? <ActivityIndicator color={P.ink} size="small" />
              : <Text style={s.bankSaveBtnText}>Save Payout Details</Text>}
          </TouchableOpacity>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Recent Transactions</Text>
          {transactions.length === 0 ? (
            <View style={s.emptyTx}>
              <Text style={s.emptyTxText}>No transactions yet. Top up your wallet to get started.</Text>
            </View>
          ) : (
            transactions.slice(0, 15).map((tx, i) => {
              const isCredit = ['topup', 'escrow_release', 'refund'].includes(tx.type);
              const txAmount = parseFloat(tx.amount || 0);
              return (
                <View key={tx.id || i} style={s.txRow}>
                  <Text style={s.txIcon}>{TX_ICONS[tx.type] || '•'}</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.txType}>{TX_LABELS[tx.type] || tx.type?.replace(/_/g, ' ')}</Text>
                    {tx.razorpay_payment_id ? (
                      <Text style={s.txRef}>Ref: {tx.razorpay_payment_id}</Text>
                    ) : null}
                    <Text style={s.txDate}>
                      {tx.created_at ? new Date(tx.created_at).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      }) : ''}
                    </Text>
                  </View>
                  <Text style={[s.txAmount, { color: isCredit ? P.successText : P.dangerText }]}>
                    {isCredit ? '+' : '-'}{fmtMoney(Math.abs(txAmount))}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {transactions.length > 0 && (
          <TouchableOpacity style={s.webLink} onPress={() => openWebDashboard('/dashboard/wallet')} activeOpacity={0.85}>
            <Text style={s.webLinkIcon}>🌐</Text>
            <Text style={s.webLinkText}>View full transaction history on web</Text>
            <Text style={s.webLinkArrow}>›</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal
        visible={showRazorpay}
        animationType="slide"
        onRequestClose={() => {
          setShowRazorpay(false);
          Alert.alert('Payment Cancelled', 'You closed the payment window. No amount was charged.');
        }}
      >
        <View style={s.webviewContainer}>
          <View style={s.webviewHeader}>
            <TouchableOpacity
              style={s.webviewClose}
              onPress={() => {
                setShowRazorpay(false);
                Alert.alert('Payment Cancelled', 'You closed the payment window. No amount was charged.');
              }}
            >
              <Text style={s.webviewCloseText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.webviewTitle}>Razorpay Payment</Text>
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
                <View style={s.webviewLoading}>
                  <ActivityIndicator size="large" color={P.yellow} />
                  <Text style={{ marginTop: 12, color: P.muted, fontFamily: fonts.sansMedium }}>Loading payment gateway…</Text>
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { backgroundColor: P.ink, padding: 20, paddingTop: 52 },
  title: { fontFamily: fonts.displayBold, fontSize: 22, fontWeight: '800', color: P.white, letterSpacing: -0.3 },

  // Balance card — ink hero with yellow accent on mini-stats
  balanceCard: { margin: 14, marginBottom: 0, backgroundColor: P.ink, borderRadius: 18, padding: 18 },
  balanceLabel: { fontFamily: fonts.monoBold, fontSize: 10, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: 1 },
  balanceAmt: { fontFamily: fonts.monoBold, fontSize: 34, fontWeight: '900', color: P.white, marginTop: 4, marginBottom: 14, letterSpacing: -0.5 },
  balanceRow: { flexDirection: 'row', gap: 14 },
  balanceStat: { flex: 1 },
  balanceStatLabel: { fontFamily: fonts.monoBold, fontSize: 9.5, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.4 },
  balanceStatVal: { fontFamily: fonts.monoBold, fontSize: 15, fontWeight: '800', color: P.yellow, marginTop: 3 },

  // Sections
  section: { margin: 14, marginTop: 18, marginBottom: 0 },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: 13, fontWeight: '800', color: P.ink, marginBottom: 11, textTransform: 'uppercase', letterSpacing: 0.4 },

  // Quick chips
  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  quickChip: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: P.bg2, alignItems: 'center', borderWidth: 1, borderColor: P.border },
  quickChipActive: { backgroundColor: P.ink, borderColor: P.ink },
  quickText: { fontFamily: fonts.sansBold, fontSize: 11.5, fontWeight: '700', color: P.muted },
  quickTextActive: { fontFamily: fonts.monoBold, color: P.yellow, fontWeight: '800' },

  // Topup
  topupRow: { flexDirection: 'row', gap: 10 },
  topupInput: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: P.border, borderRadius: 12, backgroundColor: P.white },
  rupeeSign: { paddingHorizontal: 12, fontFamily: fonts.monoBold, fontSize: 16, fontWeight: '700', color: P.muted },
  topupField: { flex: 1, paddingVertical: 11, fontFamily: fonts.monoMedium, fontSize: 15, color: P.ink },
  topupBtn: { backgroundColor: P.ink, borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center' },
  topupBtnText: { fontFamily: fonts.monoBold, fontSize: 13, fontWeight: '800', color: P.yellow, letterSpacing: 0.2 },

  // Verifying
  verifyingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: P.yellowPale, borderRadius: 8 },
  verifyingText: { fontFamily: fonts.sansBold, fontSize: 12, fontWeight: '600', color: P.yellowText },

  // Bank
  bankHint: { fontFamily: fonts.sansMedium, fontSize: 11, color: P.muted2, marginTop: -4, marginBottom: 12 },
  bankField: { marginBottom: 10 },
  bankLabel: { fontFamily: fonts.monoBold, fontSize: 9.5, fontWeight: '800', color: P.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 },
  bankInput: { fontFamily: fonts.sansMedium, borderWidth: 1, borderColor: P.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: P.ink, backgroundColor: P.white },
  bankSaveBtn: { marginTop: 8, backgroundColor: P.yellow, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  bankSaveBtnText: { fontFamily: fonts.displayBold, fontSize: 13.5, fontWeight: '800', color: P.ink, letterSpacing: 0.3 },

  // Transactions
  emptyTx: { paddingVertical: 24, alignItems: 'center' },
  emptyTxText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: P.muted2, textAlign: 'center' },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: P.borderSoft },
  txIcon: { fontSize: 18 },
  txType: { fontFamily: fonts.sansBold, fontSize: 12.5, color: P.ink, fontWeight: '700' },
  txRef: { fontFamily: fonts.monoMedium, fontSize: 9.5, color: P.muted3, marginTop: 1 },
  txDate: { fontFamily: fonts.monoMedium, fontSize: 9.5, color: P.muted3, marginTop: 1 },
  txAmount: { fontFamily: fonts.monoBold, fontSize: 13.5, fontWeight: '800' },

  // Web link
  webLink: { margin: 14, backgroundColor: P.white, borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: P.border },
  webLinkIcon: { fontSize: 18 },
  webLinkText: { flex: 1, fontFamily: fonts.sansBold, fontSize: 12.5, fontWeight: '600', color: P.ink },
  webLinkArrow: { fontFamily: fonts.monoBold, fontSize: 16, color: P.muted3, fontWeight: '800' },

  // Razorpay WebView modal
  webviewContainer: { flex: 1, backgroundColor: P.bg },
  webviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: P.ink, paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16 },
  webviewClose: { width: 60 },
  webviewCloseText: { fontFamily: fonts.sansBold, fontSize: 13, fontWeight: '700', color: P.yellow },
  webviewTitle: { fontFamily: fonts.displayBold, fontSize: 15, fontWeight: '800', color: P.white },
  webviewLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: P.bg },
});
