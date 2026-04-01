import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  RefreshControl,
} from 'react-native';
import { colors } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

// ── Helpers ──────────────────────────────────────────────────────────────────

const DELIVERABLE_LABELS = {
  reel: 'Instagram Reel',
  post: 'Instagram Post',
  story: 'Instagram Story',
  youtube_video: 'YouTube Video',
  youtube_short: 'YouTube Short',
};

const STATUS_CONFIG = {
  pending:            { label: 'Pending',          color: colors.t3,       bg: colors.surface2, icon: '○' },
  submitted:          { label: 'Submitted',        color: colors.navy,     bg: colors.navyPale, icon: '◉' },
  under_review:       { label: 'Under Review',     color: colors.orange,   bg: colors.orangePale, icon: '◉' },
  revision_requested: { label: 'Revision Needed',  color: colors.red,      bg: colors.redPale, icon: '!' },
  approved:           { label: 'Approved',         color: colors.teal,     bg: colors.tealPale, icon: '✓' },
  live:               { label: 'Live',             color: colors.tealDeep, bg: colors.tealPale, icon: '★' },
};

// Ordered status progression for timeline
const STATUS_TIMELINE = ['pending', 'submitted', 'under_review', 'approved', 'live'];

function formatDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getTimelineIndex(status) {
  // revision_requested maps back to the submitted step (content was submitted, then revision requested)
  if (status === 'revision_requested') return 1;
  const idx = STATUS_TIMELINE.indexOf(status);
  return idx >= 0 ? idx : 0;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DeliverableDetailScreen({ navigation, route }) {
  const { deliverable: initialDeliverable, campaign_name, brand_name } = route.params || {};
  const [deliverable, setDeliverable] = useState(initialDeliverable || null);
  const [submitUrl, setSubmitUrl] = useState('');
  const [notesToBrand, setNotesToBrand] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const statusCfg = STATUS_CONFIG[deliverable?.status] || STATUS_CONFIG.pending;
  const currentTimelineIdx = getTimelineIndex(deliverable?.status);
  const isRevision = deliverable?.status === 'revision_requested';
  const canSubmitContent = deliverable?.status === 'pending' || isRevision;
  const canSubmitLive = deliverable?.status === 'approved' && !deliverable?.live_url;
  const isLive = deliverable?.status === 'live';

  // Refresh deliverable data from the contract endpoint
  const refreshData = useCallback(async () => {
    if (!deliverable?.campaign_influencer_id) return;
    setRefreshing(true);
    const res = await influencerApi.getContractWithDeliverables(deliverable.campaign_influencer_id);
    setRefreshing(false);
    if (res.success && res.data?.deliverables) {
      const updated = res.data.deliverables.find(d => d.id === deliverable.id);
      if (updated) setDeliverable(updated);
    }
  }, [deliverable?.campaign_influencer_id, deliverable?.id]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleSubmitContent() {
    const url = submitUrl.trim();
    if (!url) {
      Alert.alert('URL Required', 'Please paste the URL of your content draft.');
      return;
    }

    Alert.alert(
      isRevision ? 'Submit Revised Content' : 'Submit Content',
      'Are you sure you want to submit this content for brand review?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setSubmitting(true);
            const res = await influencerApi.submitDeliverable(deliverable.id, {
              submitted_url: url,
              notes_to_brand: notesToBrand.trim() || undefined,
            });
            setSubmitting(false);
            if (res.success) {
              const updated = res.data?.deliverable || {
                ...deliverable,
                status: 'submitted',
                submitted_url: url,
                submitted_at: new Date().toISOString(),
              };
              setDeliverable(updated);
              setSubmitUrl('');
              setNotesToBrand('');
              Alert.alert('Submitted!', 'Your content has been sent for brand review.');
            } else {
              Alert.alert('Failed', res.error?.message || 'Could not submit content');
            }
          },
        },
      ]
    );
  }

  async function handleSubmitLive() {
    const url = liveUrl.trim();
    if (!url) {
      Alert.alert('URL Required', 'Please paste the URL of your live post.');
      return;
    }

    Alert.alert(
      'Submit Live URL',
      'Confirm that your content is posted live and you want to submit this URL for brand confirmation.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setSubmitting(true);
            const res = await influencerApi.submitLive(deliverable.id, { live_url: url });
            setSubmitting(false);
            if (res.success) {
              const updated = res.data?.deliverable || {
                ...deliverable,
                status: 'approved',
                live_url: url,
              };
              setDeliverable(updated);
              setLiveUrl('');
              Alert.alert('Done!', 'Live URL submitted. The brand will confirm and Tranche 2 will be released.');
            } else {
              Alert.alert('Failed', res.error?.message || 'Could not submit live URL');
            }
          },
        },
      ]
    );
  }

  function openUrl(url) {
    if (url) Linking.openURL(url).catch(() => {});
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!deliverable) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No deliverable data</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshData} tintColor={colors.navy} />}
    >
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              {DELIVERABLE_LABELS[deliverable.type] || deliverable.type?.replace(/_/g, ' ') || 'Deliverable'}
            </Text>
            <Text style={styles.headerSub}>
              {brand_name ? `${brand_name}` : ''}{brand_name && campaign_name ? ' — ' : ''}{campaign_name || ''}
            </Text>
          </View>
          <View style={[styles.statusBadgeLarge, { backgroundColor: statusCfg.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          </View>
        </View>
      </View>

      {/* ── Status Timeline ──────────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Status Timeline</Text>
        <View style={styles.timeline}>
          {STATUS_TIMELINE.map((step, idx) => {
            const isActive = idx <= currentTimelineIdx;
            const isCurrent = idx === currentTimelineIdx;
            const stepCfg = STATUS_CONFIG[step];
            const isLast = idx === STATUS_TIMELINE.length - 1;

            return (
              <View key={step} style={styles.timelineStep}>
                <View style={styles.timelineDotCol}>
                  <View
                    style={[
                      styles.timelineDot,
                      isActive && { backgroundColor: stepCfg.color },
                      isCurrent && styles.timelineDotCurrent,
                      isRevision && isCurrent && { backgroundColor: colors.red, borderColor: colors.red },
                    ]}
                  >
                    {isActive && (
                      <Text style={styles.timelineDotIcon}>
                        {isCurrent && isRevision ? '!' : isActive ? (isCurrent ? stepCfg.icon : '✓') : ''}
                      </Text>
                    )}
                  </View>
                  {!isLast && (
                    <View style={[styles.timelineLine, isActive && idx < currentTimelineIdx && { backgroundColor: stepCfg.color }]} />
                  )}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineLabel, isActive && { color: colors.t1, fontWeight: '700' }]}>
                    {isCurrent && isRevision ? 'Revision Requested' : stepCfg.label}
                  </Text>
                  {isCurrent && isRevision && (
                    <Text style={styles.timelineHint}>Resubmission needed</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* ── Details Card ──────────────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Type</Text>
          <Text style={styles.detailValue}>
            {DELIVERABLE_LABELS[deliverable.type] || deliverable.type?.replace(/_/g, ' ')}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status</Text>
          <StatusBadge status={deliverable.status} size={10} />
        </View>
        {deliverable.submission_deadline && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Deadline</Text>
            <Text style={[
              styles.detailValue,
              canSubmitContent && new Date(deliverable.submission_deadline) < new Date() && { color: colors.red, fontWeight: '700' },
            ]}>
              {formatDate(deliverable.submission_deadline)}
            </Text>
          </View>
        )}
        {deliverable.submitted_at && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Submitted</Text>
            <Text style={styles.detailValue}>{formatDateTime(deliverable.submitted_at)}</Text>
          </View>
        )}
        {deliverable.live_confirmed_at && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Confirmed Live</Text>
            <Text style={styles.detailValue}>{formatDateTime(deliverable.live_confirmed_at)}</Text>
          </View>
        )}
        {deliverable.revision_count > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Revisions Used</Text>
            <Text style={styles.detailValue}>
              {deliverable.revision_count} / {deliverable.revision_limit || 2}
            </Text>
          </View>
        )}
        {deliverable.content_requirements && (
          <View style={styles.briefBox}>
            <Text style={styles.briefLabel}>Content Brief</Text>
            <Text style={styles.briefText}>{deliverable.content_requirements}</Text>
          </View>
        )}
      </View>

      {/* ── Submitted Content URL ─────────────────────────────────────────── */}
      {deliverable.submitted_url && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Submitted Content</Text>
          <TouchableOpacity onPress={() => openUrl(deliverable.submitted_url)} style={styles.urlBox}>
            <Text style={styles.urlLabel}>Draft URL</Text>
            <Text style={styles.urlLink} numberOfLines={2}>{deliverable.submitted_url}</Text>
          </TouchableOpacity>
          {deliverable.notes_to_brand && (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Your Notes to Brand</Text>
              <Text style={styles.notesText}>{deliverable.notes_to_brand}</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Revision Feedback (prominent) ─────────────────────────────────── */}
      {isRevision && deliverable.brand_feedback && (
        <View style={[styles.card, styles.revisionCard]}>
          <View style={styles.revisionHeader}>
            <Text style={styles.revisionIcon}>!</Text>
            <Text style={styles.revisionTitle}>Revision Requested by Brand</Text>
          </View>
          <Text style={styles.revisionFeedback}>{deliverable.brand_feedback}</Text>
          <Text style={styles.revisionMeta}>
            Revision {deliverable.revision_count || 1} of {deliverable.revision_limit || 2}
          </Text>
        </View>
      )}

      {/* ── Live URL ──────────────────────────────────────────────────────── */}
      {deliverable.live_url && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Live Post</Text>
          <TouchableOpacity onPress={() => openUrl(deliverable.live_url)} style={styles.urlBox}>
            <Text style={styles.urlLabel}>Live URL</Text>
            <Text style={styles.urlLink} numberOfLines={2}>{deliverable.live_url}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── ACTION: Submit Content ────────────────────────────────────────── */}
      {canSubmitContent && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {isRevision ? 'Submit Revised Content' : 'Submit Content for Review'}
          </Text>
          <Text style={styles.hint}>
            {isRevision
              ? 'Address the brand feedback above, then paste the URL of your revised content.'
              : 'Paste the URL of your content draft (Google Drive, Dropbox, etc.)'}
          </Text>

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

          <TextInput
            style={styles.notesInput}
            value={notesToBrand}
            onChangeText={setNotesToBrand}
            placeholder="Add a note for the brand (optional)..."
            placeholderTextColor={colors.t3}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitBtn, (submitting || !submitUrl.trim()) && styles.disabledBtn]}
            onPress={handleSubmitContent}
            disabled={submitting || !submitUrl.trim()}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.submitBtnText}>
                {isRevision ? 'Resubmit for Review' : 'Submit for Review'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ── ACTION: Submit Live URL ───────────────────────────────────────── */}
      {canSubmitLive && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Submit Live Post URL</Text>
          <Text style={styles.hint}>
            Your content has been approved! Once posted live on Instagram/YouTube, paste the public URL here.
          </Text>

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
            style={[styles.liveBtnStyle, (submitting || !liveUrl.trim()) && styles.disabledBtn]}
            onPress={handleSubmitLive}
            disabled={submitting || !liveUrl.trim()}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.submitBtnText}>Submit Live URL</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ── Live Celebration ──────────────────────────────────────────────── */}
      {isLive && (
        <View style={[styles.card, { alignItems: 'center', paddingVertical: 24 }]}>
          <Text style={{ fontSize: 36, marginBottom: 10 }}>🎉</Text>
          <Text style={styles.celebrationTitle}>Content is Live!</Text>
          <Text style={styles.celebrationText}>
            Tranche 2 has been released to your wallet. Tranche 3 will auto-release 30 days after the live confirmation date.
          </Text>
          {deliverable.live_confirmed_at && (
            <Text style={styles.celebrationDate}>
              Confirmed live on {formatDate(deliverable.live_confirmed_at)}
            </Text>
          )}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  emptyText: { fontSize: 14, color: colors.t3 },

  // Header
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  back: { marginBottom: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 },
  statusBadgeLarge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginTop: 2 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  // Card
  card: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 12 },

  // Timeline
  timeline: { paddingLeft: 4 },
  timelineStep: { flexDirection: 'row', minHeight: 48 },
  timelineDotCol: { width: 28, alignItems: 'center' },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surface2,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotCurrent: {
    borderWidth: 3,
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  timelineDotIcon: { fontSize: 10, color: colors.white, fontWeight: '800' },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  timelineContent: { flex: 1, paddingLeft: 10, paddingBottom: 12 },
  timelineLabel: { fontSize: 13, color: colors.t3, fontWeight: '500' },
  timelineHint: { fontSize: 10, color: colors.red, marginTop: 2, fontWeight: '600' },

  // Details
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: { fontSize: 12, color: colors.t3, fontWeight: '600' },
  detailValue: { fontSize: 12, color: colors.t1, fontWeight: '700', textTransform: 'capitalize' },

  // Brief
  briefBox: {
    backgroundColor: colors.surface2,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  briefLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.t3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  briefText: { fontSize: 12, color: colors.t2, lineHeight: 18 },

  // URL display
  urlBox: {
    backgroundColor: colors.surface2,
    borderRadius: 10,
    padding: 12,
  },
  urlLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.t3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  urlLink: { fontSize: 12, color: colors.navy, textDecorationLine: 'underline' },

  // Notes
  notesBox: {
    backgroundColor: colors.surface2,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  notesLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.t3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  notesText: { fontSize: 12, color: colors.t2, lineHeight: 18 },

  // Revision card (prominent)
  revisionCard: {
    borderColor: colors.red,
    borderWidth: 2,
    backgroundColor: colors.redPale,
  },
  revisionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  revisionIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.red,
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 24,
    overflow: 'hidden',
  },
  revisionTitle: { fontSize: 14, fontWeight: '700', color: colors.red },
  revisionFeedback: {
    fontSize: 13,
    color: colors.t1,
    lineHeight: 20,
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.red + '33',
  },
  revisionMeta: {
    fontSize: 11,
    color: colors.t3,
    marginTop: 8,
    fontWeight: '600',
  },

  // Form
  hint: { fontSize: 11, color: colors.t3, marginBottom: 12, lineHeight: 16 },
  urlInput: {
    borderWidth: 2,
    borderColor: colors.border2,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: colors.t1,
    marginBottom: 10,
  },
  notesInput: {
    borderWidth: 2,
    borderColor: colors.border2,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: colors.t1,
    marginBottom: 12,
    minHeight: 70,
  },
  submitBtn: {
    backgroundColor: colors.navy,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  liveBtnStyle: {
    backgroundColor: colors.teal,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
  disabledBtn: { opacity: 0.5 },

  // Celebration
  celebrationTitle: { fontSize: 18, fontWeight: '800', color: colors.tealDeep, marginBottom: 8 },
  celebrationText: { fontSize: 12, color: colors.t2, textAlign: 'center', lineHeight: 18, paddingHorizontal: 8 },
  celebrationDate: { fontSize: 11, color: colors.t3, marginTop: 10, fontWeight: '600' },
});
