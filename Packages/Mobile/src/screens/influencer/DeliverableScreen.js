import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { colors } from '../../theme/tokens';
import { influencerApi } from '../../services/api';

const STATUS_CONFIG = {
  pending:           { label: 'Pending',           color: colors.t3,    bg: colors.surface2 },
  submitted:         { label: 'Under Review',       color: colors.orange, bg: colors.orange + '22' },
  under_review:      { label: 'Under Review',       color: colors.orange, bg: colors.orange + '22' },
  revision_requested:{ label: 'Revision Needed',    color: colors.red,   bg: colors.redPale },
  approved:          { label: 'Approved',           color: colors.teal,  bg: colors.teal + '22' },
  live:              { label: 'Live',               color: colors.navy,  bg: colors.navy + '22' },
};

export default function DeliverableScreen({ navigation, route }) {
  const { deliverable: initialDeliverable } = route.params || {};
  const [deliverable, setDeliverable] = useState(initialDeliverable || null);
  const [submitUrl, setSubmitUrl] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const statusCfg = STATUS_CONFIG[deliverable?.status] || STATUS_CONFIG.pending;

  async function handleSubmit() {
    if (!submitUrl.trim()) {
      Alert.alert('URL required', 'Please paste the content draft URL');
      return;
    }
    setSubmitting(true);
    const res = await influencerApi.submitDeliverable(deliverable.id, {
      submitted_url: submitUrl.trim(),
    });
    setSubmitting(false);
    if (res.success) {
      setDeliverable(res.data?.deliverable || { ...deliverable, status: 'submitted', submission_url: submitUrl });
      Alert.alert('Submitted!', 'Your content has been sent for brand review.');
    } else {
      Alert.alert('Failed', res.error?.message || 'Submission failed');
    }
  }

  async function handleSubmitLive() {
    if (!liveUrl.trim()) {
      Alert.alert('URL required', 'Please paste the live post URL');
      return;
    }
    setSubmitting(true);
    const res = await influencerApi.submitLive(deliverable.id, { live_url: liveUrl.trim() });
    setSubmitting(false);
    if (res.success) {
      setDeliverable(res.data?.deliverable || { ...deliverable, status: 'live', live_url: liveUrl });
      Alert.alert('Done!', 'Live URL submitted. Brand will confirm and Tranche 2 will be released.');
    } else {
      Alert.alert('Failed', res.error?.message || 'Failed');
    }
  }

  if (!deliverable) {
    return <View style={styles.center}><Text style={styles.errorText}>No deliverable data</Text></View>;
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{deliverable.type?.toUpperCase() || 'DELIVERABLE'}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          </View>
        </View>
        <Text style={styles.sub}>{deliverable.campaign_name || ''}</Text>
      </View>

      {/* Status card */}
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Type</Text>
          <Text style={styles.rowValue}>{deliverable.type?.replace(/_/g, ' ')}</Text>
        </View>
        {deliverable.posting_date && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Post By</Text>
            <Text style={styles.rowValue}>{new Date(deliverable.posting_date).toLocaleDateString('en-IN')}</Text>
          </View>
        )}
        {deliverable.content_requirements && (
          <View style={styles.requirementsBox}>
            <Text style={styles.requirementsLabel}>Content Brief</Text>
            <Text style={styles.requirementsText}>{deliverable.content_requirements}</Text>
          </View>
        )}
      </View>

      {/* Submitted URL */}
      {deliverable.submission_url && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Submitted Content</Text>
          <TouchableOpacity onPress={() => Linking.openURL(deliverable.submission_url)}>
            <Text style={styles.link}>{deliverable.submission_url}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Brand feedback (revision) */}
      {deliverable.status === 'revision_requested' && deliverable.brand_feedback && (
        <View style={[styles.card, styles.revisionCard]}>
          <Text style={styles.revisionTitle}>Revision Requested</Text>
          <Text style={styles.revisionText}>{deliverable.brand_feedback}</Text>
        </View>
      )}

      {/* Live URL if live */}
      {deliverable.live_url && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Live Post</Text>
          <TouchableOpacity onPress={() => Linking.openURL(deliverable.live_url)}>
            <Text style={styles.link}>{deliverable.live_url}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ACTION: Submit draft (pending or revision_requested) */}
      {(deliverable.status === 'pending' || deliverable.status === 'revision_requested') && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {deliverable.status === 'revision_requested' ? 'Submit Revised Content' : 'Submit Content for Review'}
          </Text>
          <Text style={styles.hint}>Paste the URL of your draft (Google Drive, Dropbox, etc.)</Text>
          <TextInput
            style={styles.urlInput}
            value={submitUrl}
            onChangeText={setSubmitUrl}
            placeholder="https://drive.google.com/..."
            placeholderTextColor={colors.t3}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TouchableOpacity
            style={[styles.submitBtn, (submitting || !submitUrl.trim()) && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={submitting || !submitUrl.trim()}
          >
            {submitting
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.submitBtnText}>Submit for Review</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* ACTION: Submit live URL (approved — waiting for brand confirm-live) */}
      {deliverable.status === 'approved' && !deliverable.live_url && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Submit Live Post URL</Text>
          <Text style={styles.hint}>Once your content is posted live, paste the Instagram/YouTube URL here.</Text>
          <TextInput
            style={styles.urlInput}
            value={liveUrl}
            onChangeText={setLiveUrl}
            placeholder="https://instagram.com/p/..."
            placeholderTextColor={colors.t3}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TouchableOpacity
            style={[styles.liveBtn, (submitting || !liveUrl.trim()) && { opacity: 0.5 }]}
            onPress={handleSubmitLive}
            disabled={submitting || !liveUrl.trim()}
          >
            {submitting
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.submitBtnText}>Mark as Live</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {deliverable.status === 'live' && (
        <View style={[styles.card, { alignItems: 'center' }]}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>🎉</Text>
          <Text style={styles.cardTitle}>Content is Live!</Text>
          <Text style={styles.hint}>Tranche 2 has been queued. Tranche 3 releases in 30 days.</Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 14, color: colors.t2 },
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  back: { marginBottom: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 20, fontWeight: '800', color: colors.white },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 },
  card: { margin: 16, marginBottom: 0, backgroundColor: colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { fontSize: 12, color: colors.t3, fontWeight: '600' },
  rowValue: { fontSize: 12, color: colors.t1, fontWeight: '700', textTransform: 'capitalize' },
  requirementsBox: { backgroundColor: colors.surface2, borderRadius: 10, padding: 12, marginTop: 10 },
  requirementsLabel: { fontSize: 10, fontWeight: '700', color: colors.t3, textTransform: 'uppercase', marginBottom: 4 },
  requirementsText: { fontSize: 12, color: colors.t2, lineHeight: 18 },
  link: { fontSize: 12, color: colors.navy, textDecorationLine: 'underline' },
  revisionCard: { borderColor: colors.red, borderWidth: 1.5 },
  revisionTitle: { fontSize: 13, fontWeight: '700', color: colors.red, marginBottom: 6 },
  revisionText: { fontSize: 12, color: colors.t2, lineHeight: 18 },
  hint: { fontSize: 11, color: colors.t3, marginBottom: 10, lineHeight: 16 },
  urlInput: { borderWidth: 2, borderColor: colors.border2, borderRadius: 12, padding: 12, fontSize: 13, color: colors.t1, marginBottom: 12 },
  submitBtn: { backgroundColor: colors.navy, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  liveBtn: { backgroundColor: colors.teal, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
});
