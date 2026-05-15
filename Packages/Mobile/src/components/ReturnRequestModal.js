import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput, ScrollView, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { darkColors } from '../theme/tokens';
import { followerApi } from '../services/api';

/**
 * ReturnRequestModal — Fashion-1b customer-side return initiation.
 *
 * Mounted from OrderDetailScreen. Captures reason + optional reason_text,
 * fires POST /follower/returns, surfaces success / 422 (out-of-window) /
 * 409 (already-active-return) errors cleanly.
 *
 * Props:
 *   · visible
 *   · onClose                  — call when modal dismisses
 *   · onSuccess(returnRow)     — call when return is created
 *   · transactionId            — required
 *   · orderItems               — array of { product_id, name, image_url, ... }
 *                                lets the customer pick WHICH item they're
 *                                returning when the order has multiple
 *                                items (online_order). For single-item
 *                                transactions, auto-selected.
 */

const REASONS = [
  { value: 'wrong_size',       label: 'Wrong size / fit' },
  { value: 'damaged',          label: 'Damaged or defective' },
  { value: 'not_as_described', label: 'Not as described' },
  { value: 'changed_mind',     label: 'Changed my mind' },
  { value: 'other',            label: 'Other' },
];

export default function ReturnRequestModal({
  visible, onClose, onSuccess, transactionId, orderItems = [],
}) {
  const [reason, setReason] = useState(null);
  const [reasonText, setReasonText] = useState('');
  const [productId, setProductId] = useState(orderItems[0]?.product_id || null);
  const [submitting, setSubmitting] = useState(false);

  // Reset state each time modal opens
  React.useEffect(() => {
    if (visible) {
      setReason(null);
      setReasonText('');
      setProductId(orderItems[0]?.product_id || null);
    }
  }, [visible, orderItems]);

  async function handleSubmit() {
    if (!reason) {
      Alert.alert('Pick a reason', 'Please select a return reason');
      return;
    }
    setSubmitting(true);
    try {
      const res = await followerApi.initiateReturn({
        transaction_id: transactionId,
        product_id: productId || undefined,
        reason,
        reason_text: reasonText.trim() || undefined,
      });
      if (res?.success || res?.data) {
        const returnRow = res.data || res;
        if (onSuccess) onSuccess(returnRow);
        Alert.alert('Return requested', 'Your return request has been submitted. You will be notified once it is reviewed.');
        onClose();
      } else {
        Alert.alert('Could not submit', res?.error?.message || 'Please try again');
      }
    } catch (e) {
      Alert.alert('Could not submit', e?.message || 'Please try again');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Request a return</Text>
            <Text style={styles.sub}>Tell us what's wrong — we'll review within 24 hours.</Text>

            {orderItems.length > 1 && (
              <View style={styles.section}>
                <Text style={styles.label}>Which item?</Text>
                {orderItems.map(it => (
                  <TouchableOpacity
                    key={it.product_id}
                    style={[styles.itemRow, productId === it.product_id && styles.itemRowActive]}
                    onPress={() => setProductId(it.product_id)}
                  >
                    <Text style={styles.itemName}>{it.name || 'Item'}</Text>
                    {productId === it.product_id && <Text style={styles.checkIcon}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.label}>Reason</Text>
              {REASONS.map(r => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.itemRow, reason === r.value && styles.itemRowActive]}
                  onPress={() => setReason(r.value)}
                >
                  <Text style={styles.itemName}>{r.label}</Text>
                  {reason === r.value && <Text style={styles.checkIcon}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Details (optional)</Text>
              <TextInput
                style={styles.textarea}
                placeholder="Anything else we should know..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={reasonText}
                onChangeText={setReasonText}
                multiline
                numberOfLines={4}
                maxLength={500}
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, (!reason || submitting) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!reason || submitting}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitText}>Submit return</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0B1A2A',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '88%',
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 6,
  },
  content: { padding: 18, paddingBottom: 24 },
  title: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  sub: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  section: { marginTop: 16 },
  label: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 7 },
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#142438', borderRadius: 10, padding: 12, marginBottom: 6,
    borderWidth: 1, borderColor: 'transparent',
  },
  itemRowActive: { borderColor: '#ec4899', backgroundColor: 'rgba(236,72,153,0.1)' },
  itemName: { fontSize: 13, color: '#fff', fontWeight: '500', flex: 1 },
  checkIcon: { fontSize: 14, fontWeight: '900', color: '#ec4899' },
  textarea: {
    backgroundColor: '#142438', borderRadius: 10, padding: 12,
    fontSize: 13, color: '#fff', minHeight: 80, textAlignVertical: 'top',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  footer: { flexDirection: 'row', padding: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 11, alignItems: 'center', backgroundColor: '#142438' },
  cancelText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  submitBtn: { flex: 2, paddingVertical: 13, borderRadius: 11, alignItems: 'center', backgroundColor: '#ec4899' },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { fontSize: 13, fontWeight: '800', color: '#fff' },
});
