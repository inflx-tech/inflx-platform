import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { colors } from '../../theme/tokens';
import { followerApi } from '../../services/api';

export default function EnquiryScreen({ navigation, route }) {
  const { offer, influencer, brand } = route.params || {};
  const [name, setName]     = useState('');
  const [phone, setPhone]   = useState('');
  const [message, setMsg]   = useState('');
  const [loading, setLoading] = useState(false);

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
      offer_id: offer?.id,
      influencer_id: influencer?.id,
      campaign_id: offer?.campaign_id,
      campaign_set_id: offer?.campaign_set_id,
      name: name.trim(),
      phone: phone.trim(),
      message: message.trim(),
    });
    setLoading(false);

    if (res.success) {
      Alert.alert(
        'Enquiry Sent!',
        `We've sent your enquiry to ${brand?.business_name || 'the brand'}. They'll reach out to you soon.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }]
      );
    } else {
      Alert.alert('Failed', res.error?.message || 'Please try again');
    }
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Send Enquiry</Text>
        {brand?.business_name && <Text style={styles.sub}>{brand.business_name}</Text>}
      </View>

      {/* Offer info */}
      {offer && (
        <View style={styles.card}>
          <Text style={styles.label}>About</Text>
          <Text style={styles.offerName}>{offer.name || offer.title}</Text>
          {offer.description ? <Text style={styles.offerDesc}>{offer.description}</Text> : null}
        </View>
      )}

      {/* Form */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Details</Text>

        <Text style={styles.fieldLabel}>Your Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          placeholderTextColor={colors.t3}
        />

        <Text style={styles.fieldLabel}>Phone Number</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="10-digit mobile number"
          placeholderTextColor={colors.t3}
          keyboardType="phone-pad"
          maxLength={15}
        />

        <Text style={styles.fieldLabel}>Your Message</Text>
        <TextInput
          style={styles.msgInput}
          value={message}
          onChangeText={setMsg}
          placeholder="What would you like to know? Any specific requirements?"
          placeholderTextColor={colors.t3}
          multiline
          numberOfLines={4}
        />
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, (loading || !name || !phone || !message) && { opacity: 0.5 }]}
          onPress={submit}
          disabled={loading || !name || !phone || !message}
        >
          {loading
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.submitBtnText}>Send Enquiry</Text>
          }
        </TouchableOpacity>
        <Text style={styles.privacyNote}>
          Your contact details will only be shared with the brand to respond to your enquiry.
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  back: { marginBottom: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '800', color: colors.white },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 },
  card: { margin: 16, marginBottom: 0, backgroundColor: colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 12 },
  label: { fontSize: 10, fontWeight: '700', color: colors.t3, textTransform: 'uppercase', marginBottom: 4 },
  offerName: { fontSize: 15, fontWeight: '700', color: colors.t1, marginBottom: 4 },
  offerDesc: { fontSize: 12, color: colors.t3, lineHeight: 18 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.t3, textTransform: 'uppercase', marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 2, borderColor: colors.border2, borderRadius: 12, padding: 12, fontSize: 14, color: colors.t1, marginBottom: 4 },
  msgInput: { borderWidth: 2, borderColor: colors.border2, borderRadius: 12, padding: 12, fontSize: 13, color: colors.t1, textAlignVertical: 'top', minHeight: 100 },
  footer: { padding: 16 },
  submitBtn: { backgroundColor: colors.navy, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  submitBtnText: { fontSize: 15, fontWeight: '800', color: colors.white },
  privacyNote: { fontSize: 10, color: colors.t3, textAlign: 'center', lineHeight: 14 },
});
