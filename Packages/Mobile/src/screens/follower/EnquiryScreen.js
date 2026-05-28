import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { brandPalette as P, fonts } from '../../theme/tokens';
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
            placeholderTextColor={P.muted3}
            autoCapitalize="words"
          />

          <Text style={styles.fieldLabel}>Phone *</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="10-digit mobile number"
            placeholderTextColor={P.muted3}
            keyboardType="phone-pad"
            maxLength={15}
          />

          <Text style={styles.fieldLabel}>Email (optional)</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={P.muted3}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>Message / Query *</Text>
          <TextInput
            style={styles.msgInput}
            value={message}
            onChangeText={setMsg}
            placeholder="Tell the business what you're looking for..."
            placeholderTextColor={P.muted3}
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
            placeholderTextColor={P.muted3}
          />
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitBtn, (!canSubmit || loading) && { opacity: 0.5 }]}
            onPress={submit}
            disabled={loading || !canSubmit}
          >
            {loading
              ? <ActivityIndicator color={P.yellow} />
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
  container: { flex: 1, backgroundColor: P.bg },
  // ink hero header
  header: { backgroundColor: P.ink, padding: 20, paddingTop: 52 },
  back: { marginBottom: 12 },
  backText: { fontFamily: fonts.monoBold, fontSize: 11, color: 'rgba(255,255,255,0.65)', letterSpacing: 0.3 },
  title: { fontFamily: fonts.displayBlack, fontSize: 20, color: '#FFFFFF' },
  sub: { fontFamily: fonts.monoMedium, fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 },

  offerBanner: { marginHorizontal: 16, marginTop: 16, backgroundColor: P.yellowPale, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#F0DA88' },
  offerBannerLabel: { fontFamily: fonts.monoBold, fontSize: 10, color: P.muted2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  offerBannerTitle: { fontFamily: fonts.displayBold, fontSize: 15, color: P.ink, marginBottom: 2 },
  offerBannerDiscount: { fontFamily: fonts.monoBold, fontSize: 11, color: P.yellow, backgroundColor: P.ink, alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, overflow: 'hidden' },

  card: { margin: 16, marginBottom: 0, backgroundColor: P.white, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: P.border },
  cardTitle: { fontFamily: fonts.displayBold, fontSize: 15, color: P.ink, marginBottom: 16 },
  fieldLabel: { fontFamily: fonts.monoBold, fontSize: 10, color: P.muted2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, marginTop: 4 },
  input: { borderWidth: 1.5, borderColor: P.muted4, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.sansMedium, fontSize: 15, color: P.ink, marginBottom: 12, backgroundColor: P.white },
  msgInput: { borderWidth: 1.5, borderColor: P.muted4, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.sansMedium, fontSize: 14, color: P.ink, textAlignVertical: 'top', minHeight: 100, marginBottom: 12, backgroundColor: P.white },

  footer: { padding: 16 },
  submitBtn: { backgroundColor: P.ink, borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginBottom: 10 },
  submitBtnText: { fontFamily: fonts.displayBlack, fontSize: 16, color: P.yellow, textTransform: 'uppercase', letterSpacing: 0.3 },
  privacyNote: { fontFamily: fonts.monoMedium, fontSize: 11, color: P.muted2, textAlign: 'center', lineHeight: 18 },

  // Success state — yellow check-tile (locked success pattern, matches Flow 42/43)
  successContainer: { flex: 1, backgroundColor: P.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  successCard: { backgroundColor: P.white, borderRadius: 24, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: P.border, width: '100%' },
  successIconWrap: { width: 78, height: 78, borderRadius: 39, backgroundColor: P.yellow, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successIcon: { fontSize: 36, color: P.ink, fontFamily: fonts.displayBlack },
  successTitle: { fontFamily: fonts.displayBlack, fontSize: 22, color: P.ink, marginBottom: 12 },
  successMsg: { fontFamily: fonts.sansMedium, fontSize: 14, color: P.muted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  doneBtn: { backgroundColor: P.ink, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 48, alignItems: 'center' },
  doneBtnText: { fontFamily: fonts.displayBlack, fontSize: 16, color: P.yellow, textTransform: 'uppercase' },
});
