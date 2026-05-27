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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { brandPalette as P, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import StatusPill from '../../components/brand/StatusPill';

// ── Helpers ──────────────────────────────────────────────────────────────────

const DELIVERABLE_LABELS = {
  reel: 'Instagram Reel',
  post: 'Instagram Post',
  story: 'Instagram Story',
  youtube_video: 'YouTube Video',
  youtube_short: 'YouTube Short',
};

// Ordered status progression for timeline
const STATUS_TIMELINE = ['pending', 'submitted', 'under_review', 'approved', 'live'];

const TIMELINE_LABELS = {
  pending: 'Pending',
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  live: 'Live',
};

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

/**
 * DeliverableDetailScreen — alternate detail surface with 5-step status timeline,
 * revision UI, and live-URL submission flow.
 *
 * Flow 33 restyle (2026-05-27): brandPalette + Outfit/Plus Jakarta Sans/
 * JetBrains Mono fonts + StatusPill canonical for status badges.
 * Status timeline: yellow-active dots + ink-bordered yellow current step +
 * danger fill + "!" sigil for revision_requested override.
 * Revision card: dangerPale + danger border + white feedback body (locked
 * design call #2).
 * Live celebration: yellow tile MCI star + ink Outfit-Black title (locked
 * design call #3 — replaces 🎉 per design call #4).
 * 2-confirm Alert flow on submitContent + submitLive preserved verbatim.
 */

export default function DeliverableDetailScreen({ navigation, route }) {
  const { deliverable: initialDeliverable, campaign_name, brand_name } = route.params || {};
  const [deliverable, setDeliverable] = useState(initialDeliverable || null);
  const [submitUrl, setSubmitUrl] = useState('');
  const [notesToBrand, setNotesToBrand] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
              Alert.alert('Submitted', 'Your content has been sent for brand review.');
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
              Alert.alert('Done', 'Live URL submitted. The brand will confirm and Tranche 2 will be released.');
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshData} colors={[P.yellow]} />}
    >
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <Icon name="chevron-left" size={14} color="rgba(255,255,255,0.65)" />
          <Text style={styles.backText}>BACK</Text>
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
          <View style={{ alignSelf: 'flex-start', marginTop: 2 }}>
            <StatusPill status={deliverable.status} />
          </View>
        </View>
        <View style={styles.headerAccent} />
      </View>

      {/* ── Status Timeline ──────────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Status Timeline</Text>
        <View style={styles.timeline}>
          {STATUS_TIMELINE.map((step, idx) => {
            const isActive = idx <= currentTimelineIdx;
            const isCurrent = idx === currentTimelineIdx;
            const isLast = idx === STATUS_TIMELINE.length - 1;
            const isRevDot = isRevision && isCurrent;

            return (
              <View key={step} style={styles.timelineStep}>
                <View style={styles.timelineDotCol}>
                  {idx > 0 && (
                    <View style={[
                      styles.timelineLine,
                      isActive && styles.timelineLineActive,
                    ]} />
                  )}
                  <View
                    style={[
                      styles.timelineDot,
                      isActive && styles.timelineDotActive,
                      isCurrent && styles.timelineDotCurrent,
                      isRevDot && styles.timelineDotRevision,
                    ]}
                  >
                    {isActive && !isCurrent && (
                      <Icon name="check-bold" size={10} color={P.ink} />
                    )}
                    {isCurrent && !isRevDot && (
                      <Text style={styles.timelineDotNum}>{idx + 1}</Text>
                    )}
                    {isRevDot && (
                      <Text style={styles.timelineDotRevText}>!</Text>
                    )}
                    {!isActive && (
                      <Text style={styles.timelineDotNumInactive}>{idx + 1}</Text>
                    )}
                  </View>
                  {!isLast && (
                    <View style={[
                      styles.timelineLine,
                      isActive && idx < currentTimelineIdx && styles.timelineLineActive,
                    ]} />
                  )}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[
                    styles.timelineLabel,
                    isActive && styles.timelineLabelActive,
                    isCurrent && styles.timelineLabelCurrent,
                    isRevDot && styles.timelineLabelRevision,
                  ]}>
                    {isRevDot ? 'Revision Requested' : TIMELINE_LABELS[step]}
                  </Text>
                  {isRevDot && (
                    <Text style={styles.timelineHint}>RESUBMISSION NEEDED</Text>
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
            {(DELIVERABLE_LABELS[deliverable.type] || deliverable.type?.replace(/_/g, ' ') || '').toUpperCase()}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status</Text>
          <StatusPill status={deliverable.status} />
        </View>
        {deliverable.submission_deadline && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Deadline</Text>
            <Text style={[
              styles.detailValue,
              canSubmitContent && new Date(deliverable.submission_deadline) < new Date() && styles.detailValueDanger,
            ]}>
              {formatDate(deliverable.submission_deadline).toUpperCase()}
            </Text>
          </View>
        )}
        {deliverable.submitted_at && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Submitted</Text>
            <Text style={styles.detailValue}>{formatDateTime(deliverable.submitted_at).toUpperCase()}</Text>
          </View>
        )}
        {deliverable.live_confirmed_at && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Confirmed Live</Text>
            <Text style={styles.detailValue}>{formatDateTime(deliverable.live_confirmed_at).toUpperCase()}</Text>
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
            <Text style={styles.briefLabel}>CONTENT BRIEF</Text>
            <Text style={styles.briefText}>{deliverable.content_requirements}</Text>
          </View>
        )}
      </View>

      {/* ── Submitted Content URL ─────────────────────────────────────────── */}
      {deliverable.submitted_url && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Submitted Content</Text>
          <TouchableOpacity onPress={() => openUrl(deliverable.submitted_url)} style={styles.urlBox}>
            <Text style={styles.urlLabel}>DRAFT URL</Text>
            <Text style={styles.urlLink} numberOfLines={2}>{deliverable.submitted_url}</Text>
          </TouchableOpacity>
          {deliverable.notes_to_brand && (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>YOUR NOTES TO BRAND</Text>
              <Text style={styles.notesText}>{deliverable.notes_to_brand}</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Revision Feedback (prominent) ─────────────────────────────────── */}
      {isRevision && deliverable.brand_feedback && (
        <View style={styles.revisionCard}>
          <View style={styles.revisionHeader}>
            <View style={styles.revisionIcoWrap}>
              <Text style={styles.revisionIco}>!</Text>
            </View>
            <Text style={styles.revisionTitle}>REVISION REQUESTED</Text>
          </View>
          <View style={styles.revisionBody}>
            <Text style={styles.revisionFeedback}>{deliverable.brand_feedback}</Text>
          </View>
          <Text style={styles.revisionMeta}>
            REVISION {deliverable.revision_count || 1} OF {deliverable.revision_limit || 2}
          </Text>
        </View>
      )}

      {/* ── Live URL ──────────────────────────────────────────────────────── */}
      {deliverable.live_url && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Live Post</Text>
          <TouchableOpacity onPress={() => openUrl(deliverable.live_url)} style={styles.urlBox}>
            <Text style={styles.urlLabel}>LIVE URL</Text>
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
            placeholder="https://drive.google.com/…"
            placeholderTextColor={P.muted3}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <TextInput
            style={styles.notesInput}
            value={notesToBrand}
            onChangeText={setNotesToBrand}
            placeholder="Add a note for the brand (optional)…"
            placeholderTextColor={P.muted3}
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
              <ActivityIndicator size="small" color={P.yellow} />
            ) : (
              <Text style={styles.submitBtnText}>
                {isRevision ? 'RESUBMIT FOR REVIEW' : 'SUBMIT FOR REVIEW'}
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
            placeholder="https://instagram.com/p/…"
            placeholderTextColor={P.muted3}
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
              <ActivityIndicator size="small" color={P.white} />
            ) : (
              <Text style={styles.liveBtnText}>SUBMIT LIVE URL</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ── Live Celebration ──────────────────────────────────────────────── */}
      {isLive && (
        <View style={styles.liveCelCard}>
          <View style={styles.celTile}>
            <Icon name="star" size={30} color={P.ink} />
          </View>
          <Text style={styles.celebrationTitle}>Content is Live!</Text>
          <Text style={styles.celebrationText}>
            Tranche 2 has been released to your wallet. Tranche 3 will auto-release 30 days after the live confirmation date.
          </Text>
          {deliverable.live_confirmed_at && (
            <Text style={styles.celebrationDate}>
              CONFIRMED LIVE ON {formatDate(deliverable.live_confirmed_at).toUpperCase()}
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
  container: { flex: 1, backgroundColor: P.bg },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.bg },
  emptyText: { fontSize: 14, color: P.muted2, fontFamily: fonts.sansRegular },

  // Header
  header: { backgroundColor: P.ink, padding: 18, paddingTop: 50, paddingBottom: 22, position: 'relative' },
  headerAccent: {
    position: 'absolute', left: 18, bottom: 8, width: 30, height: 3,
    backgroundColor: P.yellow, borderRadius: 2,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 14 },
  backText: { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '800', letterSpacing: 0.3, fontFamily: fonts.monoBold },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: P.white, letterSpacing: -0.3, fontFamily: fonts.displayBlack },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 3, fontWeight: '700', fontFamily: fonts.monoMedium },

  // Card
  card: {
    margin: 14,
    marginBottom: 0,
    backgroundColor: P.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: P.border,
  },
  cardTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: P.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 12,
    fontFamily: fonts.displayBlack,
  },

  // Timeline — yellow-active + ink-bordered current + danger revision override
  timeline: { paddingLeft: 4 },
  timelineStep: { flexDirection: 'row', minHeight: 46 },
  timelineDotCol: { width: 26, alignItems: 'center' },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: P.bg2,
    borderWidth: 2,
    borderColor: P.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotActive: {
    backgroundColor: P.yellow,
    borderColor: P.yellow,
  },
  timelineDotCurrent: {
    borderWidth: 3,
    borderColor: P.ink,
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  timelineDotRevision: {
    backgroundColor: P.danger,
    borderColor: P.danger,
  },
  timelineDotNum: { fontSize: 10, color: P.ink, fontWeight: '900', fontFamily: fonts.displayBlack },
  timelineDotNumInactive: { fontSize: 10, color: P.muted3, fontWeight: '900', fontFamily: fonts.displayBlack },
  timelineDotRevText: { fontSize: 13, color: P.white, fontWeight: '900', fontFamily: fonts.displayBlack },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: P.border,
    marginVertical: 2,
  },
  timelineLineActive: { backgroundColor: P.yellow },
  timelineContent: { flex: 1, paddingLeft: 11, paddingBottom: 12 },
  timelineLabel: { fontSize: 12.5, color: P.muted2, fontWeight: '700', fontFamily: fonts.displayBold },
  timelineLabelActive: { color: P.ink, fontWeight: '800' },
  timelineLabelCurrent: { color: P.ink, fontWeight: '900', fontFamily: fonts.displayBlack },
  timelineLabelRevision: { color: P.dangerText, fontWeight: '900', fontFamily: fonts.displayBlack },
  timelineHint: { fontSize: 9.5, color: P.dangerText, marginTop: 2, fontWeight: '800', letterSpacing: 0.3, fontFamily: fonts.monoBold },

  // Details
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: P.borderSoft,
  },
  detailLabel: { fontSize: 11.5, color: P.muted, fontWeight: '600', fontFamily: fonts.sansRegular },
  detailValue: { fontSize: 11.5, color: P.ink, fontWeight: '800', letterSpacing: 0.2, fontFamily: fonts.monoBold },
  detailValueDanger: { color: P.dangerText, fontWeight: '900', fontFamily: fonts.monoBold },

  // Brief
  briefBox: { backgroundColor: P.bg2, borderRadius: 10, padding: 11, marginTop: 11 },
  briefLabel: {
    fontSize: 9.5, fontWeight: '800', color: P.muted2,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4,
    fontFamily: fonts.monoBold,
  },
  briefText: { fontSize: 11.5, color: P.ink, lineHeight: 17, fontFamily: fonts.sansRegular },

  // URL display
  urlBox: { backgroundColor: P.bg2, borderRadius: 10, padding: 11 },
  urlLabel: {
    fontSize: 9.5, fontWeight: '800', color: P.muted2,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4,
    fontFamily: fonts.monoBold,
  },
  urlLink: { fontSize: 11.5, color: P.info, textDecorationLine: 'underline', fontWeight: '700', fontFamily: fonts.monoMedium },

  // Notes
  notesBox: { backgroundColor: P.bg2, borderRadius: 10, padding: 11, marginTop: 10 },
  notesLabel: {
    fontSize: 9.5, fontWeight: '800', color: P.muted2,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4,
    fontFamily: fonts.monoBold,
  },
  notesText: { fontSize: 11.5, color: P.ink, lineHeight: 17, fontFamily: fonts.sansRegular },

  // Revision card (PROMINENT — locked design call #2)
  revisionCard: {
    margin: 14, marginBottom: 0,
    backgroundColor: P.dangerPale,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: P.danger,
  },
  revisionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  revisionIcoWrap: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: P.dangerText,
    alignItems: 'center', justifyContent: 'center',
  },
  revisionIco: { color: P.white, fontSize: 15, fontWeight: '900', fontFamily: fonts.displayBlack },
  revisionTitle: {
    fontSize: 13.5, fontWeight: '900', color: P.dangerText,
    textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: fonts.displayBlack,
  },
  revisionBody: {
    backgroundColor: P.white, borderRadius: 11, padding: 12,
    borderWidth: 1, borderColor: '#F8D0C2',
  },
  revisionFeedback: { fontSize: 12.5, color: P.ink, lineHeight: 18, fontFamily: fonts.sansRegular },
  revisionMeta: {
    fontSize: 10, color: P.dangerText, marginTop: 9, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: fonts.monoBold,
  },

  // Form
  hint: { fontSize: 11, color: P.muted, marginBottom: 12, lineHeight: 16, fontFamily: fonts.sansRegular },
  urlInput: {
    borderWidth: 1.5, borderColor: P.ink, borderRadius: 10,
    padding: 11, fontSize: 11.5, color: P.ink, marginBottom: 10,
    fontFamily: fonts.monoMedium,
  },
  notesInput: {
    borderWidth: 1.5, borderColor: P.muted4, borderRadius: 10,
    padding: 11, fontSize: 11.5, color: P.ink, marginBottom: 12, minHeight: 60,
    fontFamily: fonts.sansRegular,
  },
  submitBtn: { backgroundColor: P.ink, borderRadius: 11, paddingVertical: 13, alignItems: 'center' },
  liveBtnStyle: { backgroundColor: P.success, borderRadius: 11, paddingVertical: 13, alignItems: 'center' },
  submitBtnText: { fontSize: 13, fontWeight: '900', color: P.yellow, letterSpacing: 0.2, textTransform: 'uppercase', fontFamily: fonts.displayBlack },
  liveBtnText: { fontSize: 13, fontWeight: '900', color: P.white, letterSpacing: 0.2, textTransform: 'uppercase', fontFamily: fonts.displayBlack },
  disabledBtn: { opacity: 0.5 },

  // Live Celebration (yellow tile + MCI star per design call #3+#4)
  liveCelCard: {
    margin: 14, marginBottom: 0,
    backgroundColor: P.white,
    borderRadius: 14,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: P.border,
  },
  celTile: {
    width: 60, height: 60, borderRadius: 14, backgroundColor: P.yellow,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  celebrationTitle: { fontSize: 17, fontWeight: '900', color: P.ink, marginBottom: 7, letterSpacing: -0.2, fontFamily: fonts.displayBlack },
  celebrationText: { fontSize: 11.5, color: P.muted, textAlign: 'center', lineHeight: 17, paddingHorizontal: 8, fontFamily: fonts.sansRegular },
  celebrationDate: { fontSize: 10, color: P.muted2, marginTop: 10, fontWeight: '800', letterSpacing: 0.3, fontFamily: fonts.monoBold },
});
