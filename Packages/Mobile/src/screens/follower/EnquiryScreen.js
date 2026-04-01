import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../theme/tokens';
import { followerApi } from '../../services/api';

export default function EnquiryScreen({ navigation, route }) {
  const { offer, store, trackingParams } = route.params || {};

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMsg] = useState('');
  const [preferredDateTime, setPreferredDateTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Pre-fill name and phone from logged-in user
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('inflx_user');
        if (raw) {
          const user = JSON.parse(raw);
          if (user.phone) setPhone(user.phone);
          if (user.name) setName(user.name);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  async function submit() {
    if (!name.trim() || !phone.trim() || !message.trim()) {
      Alert.alert('Fill all fields', 'Name, phone number and message are required');
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      Alert.alert('Invalid phone', 'Enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    const res = await followerApi.submitEnquiry({
      brand_id: store?.brand_id,
      campaign_id: trackingParams?.cid,
      set_id: trackingParams?.sid,
      campaign_influencer_id: trackingParams?.iid || null,
      form_data: {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        message: message.trim(),
        preferred_date_time: preferredDateTime.trim() || null,
        offer_title: offer?.title || null,
        offer_id: trackingParams?.oid || null,
      },
    });
    setLoading(false);

    if (res.success) {
      setSubmitted(true);
    } else {
      Alert.alert('Failed', res.error?.message || 'Please try again');
    }
  }

  // ── Success state ────────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successCard}>
          <View style={styles.successIconWrap}>
            <Text style={styles.successIcon}>{'✓'}</Text>
          </View>
          <Text style={styles.successTitle}>Enquiry Submitted!</Text>
          <Text style={styles.successMsg}>
            Your enquiry has been sent to {store?.brand_name || 'the business'}. They will get back to you soon.
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Form state ───────────────────────────────────────────────────────────────

  const canSubmit = name.trim() && phone.trim() && message.trim();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>{'<-'} Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Enquire at {store?.brand_name}</Text>
          <Text style={styles.sub}>via @{store?.instagram_handle}</Text>
        </View>

        {/* Offer info */}
        {offer && (
          <View style={styles.offerBanner}>
            <Text style={styles.offerBannerLabel}>ENQUIRING ABOUT</Text>
            <Text style={styles.offerBannerTitle}>{offer.title}</Text>
            {offer.offer_type === 'percentage' && offer.discount_value ? (
              <Text style={styles.offerBannerDiscount}>{offer.discount_value}% OFF</Text>
            ) : offer.offer_type === 'flat' && offer.discount_value ? (
              <Text style={styles.offerBannerDiscount}>Flat Discount Available</Text>
            ) : null}
          </View>
        )}

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Details</Text>

          <Text style={styles.fieldLabel}>Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
            placeholderTextColor={colors.t3}
            autoCapitalize="words"
          />

          <Text style={styles.fieldLabel}>Phone *</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="10-digit mobile number"
            placeholderTextColor={colors.t3}
            keyboardType="phone-pad"
            maxLength={15}
          />

          <Text style={styles.fieldLabel}>Email (optional)</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.t3}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>Message / Query *</Text>
          <TextInput
            style={styles.msgInput}
            value={message}
            onChangeText={setMsg}
            placeholder="Tell the business what you're looking for..."
            placeholderTextColor={colors.t3}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Text style={styles.fieldLabel}>Preferred Date / Time (optional)</Text>
          <TextInput
            style={styles.input}
            value={preferredDateTime}
            onChangeText={setPreferredDateTime}
            placeholder="e.g. 15 Apr, evening"
            placeholderTextColor={colors.t3}
          />
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitBtn, (!canSubmit || loading) && { opacity: 0.5 }]}
            onPress={submit}
            disabled={loading || !canSubmit}
          >
            {loading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.submitBtnText}>Submit Enquiry</Text>
            }
          </TouchableOpacity>
          <Text style={styles.privacyNote}>
            Your details will be shared with {store?.brand_name || 'the business'} to respond to your enquiry.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  back: { marginBottom: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '800', color: colors.white },
  sub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 },

  offerBanner: { marginHorizontal: 16, marginTop: 16, backgroundColor: colors.orangePale, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.orange + '30' },
  offerBannerLabel: { fontSize: 10, fontWeight: '700', color: colors.t3, textTransform: 'uppercase', marginBottom: 4 },
  offerBannerTitle: { fontSize: 15, fontWeight: '700', color: colors.t1, marginBottom: 2 },
  offerBannerDiscount: { fontSize: 13, fontWeight: '700', color: colors.orange, marginTop: 4 },

  card: { margin: 16, marginBottom: 0, backgroundColor: colors.white, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.t1, marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.t2, marginBottom: 6, marginTop: 4 },
  input: { borderWidth: 1.5, borderColor: colors.border2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.t1, marginBottom: 12, backgroundColor: colors.surface },
  msgInput: { borderWidth: 1.5, borderColor: colors.border2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.t1, textAlignVertical: 'top', minHeight: 100, marginBottom: 12, backgroundColor: colors.surface },

  footer: { padding: 16 },
  submitBtn: { backgroundColor: colors.orange, borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginBottom: 10 },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: colors.white },
  privacyNote: { fontSize: 11, color: colors.t3, textAlign: 'center', lineHeight: 18 },

  // Success state
  successContainer: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  successCard: { backgroundColor: colors.white, borderRadius: 24, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: colors.border, width: '100%' },
  successIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.tealPale, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successIcon: { fontSize: 36, color: colors.teal, fontWeight: '800' },
  successTitle: { fontSize: 22, fontWeight: '800', color: colors.t1, marginBottom: 12 },
  successMsg: { fontSize: 14, color: colors.t2, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  doneBtn: { backgroundColor: colors.teal, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 48, alignItems: 'center' },
  doneBtnText: { fontSize: 16, fontWeight: '800', color: colors.white },
});
