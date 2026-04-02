import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { colors, fmtMoney, fmtRupees } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    if (!expiresAt) return;
    function tick() {
      const diff = new Date(expiresAt) - Date.now();
      setRemaining(Math.max(0, diff));
    }
    tick();
    timer.current = setInterval(tick, 1000);
    return () => clearInterval(timer.current);
  }, [expiresAt]);

  if (remaining === null) return null;
  if (remaining <= 0) return 'Expired';

  const hours = Math.floor(remaining / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  return `${hours}h ${mins}m ${secs}s`;
}

const DELIVERABLE_LABELS = {
  reel: 'Instagram Reel',
  post: 'Instagram Post',
  story: 'Instagram Story',
  youtube_video: 'YouTube Video',
  youtube_short: 'YouTube Short',
};

const DECLINE_REASONS = [
  { key: 'not_relevant', label: 'Not Relevant' },
  { key: 'fee_too_low', label: 'Fee Too Low' },
  { key: 'schedule_conflict', label: 'Schedule Conflict' },
  { key: 'already_partnered', label: 'Already Partnered' },
  { key: 'other', label: 'Other' },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function OfferDetailScreen({ navigation, route }) {
  const { offer: passedOffer } = route.params || {};
  const [offer, setOffer] = useState(passedOffer);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showNegotiate, setShowNegotiate] = useState(false);
  const [showDeclineReasons, setShowDeclineReasons] = useState(false);
  const [negotiatingFee, setNegotiatingFee] = useState('');
  const [note, setNote] = useState('');

  const countdown = useCountdown(offer?.offer_expires_at);

  // Fetch full offer detail on mount
  useEffect(() => {
    if (!passedOffer?.id) return;
    loadDetail();
  }, [passedOffer?.id]);

  async function loadDetail() {
    setLoading(true);
    const res = await influencerApi.getOfferDetail(passedOffer.id);
    setLoading(false);
    if (res.success) {
      setOffer(res.data?.offer || passedOffer);
    }
    // If the detail fetch fails, we still show the passed-in data
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  async function accept() {
    Alert.alert(
      'Accept Offer',
      'Are you sure you want to accept this offer? A contract will be generated for signing.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setActionLoading(true);
            const res = await influencerApi.acceptOffer(offer.id);
            setActionLoading(false);
            if (res.success) {
              Alert.alert('Success', 'Offer accepted! A contract will be ready for signing.');
              navigation.goBack();
            } else {
              Alert.alert('Failed', res.error?.message || 'Could not accept offer');
            }
          },
        },
      ]
    );
  }

  async function decline(reason) {
    setActionLoading(true);
    const res = await influencerApi.declineOffer(offer.id, { reason });
    setActionLoading(false);
    if (res.success) {
      Alert.alert('Declined', 'Offer has been declined.');
      navigation.goBack();
    } else {
      Alert.alert('Failed', res.error?.message || 'Could not decline offer');
    }
  }

  async function submitCounter() {
    const feeAmount = parseFloat(negotiatingFee);
    if (!feeAmount || feeAmount <= 0) {
      Alert.alert('Invalid Fee', 'Please enter a valid fee amount.');
      return;
    }

    setActionLoading(true);

    // If no negotiation thread exists yet, initiate one
    if (!offer.negotiation?.id && !offer.negotiation_id) {
      const negRes = await influencerApi.negotiateOffer(offer.id, {
        proposed_fee: feeAmount,
        note: note || undefined,
      });
      setActionLoading(false);
      if (negRes.success) {
        Alert.alert('Sent', 'Counter offer sent! The brand will review it.');
        navigation.goBack();
      } else {
        Alert.alert('Failed', negRes.error?.message || 'Could not send counter offer');
      }
      return;
    }

    const negId = offer.negotiation?.id || offer.negotiation_id;
    const res = await influencerApi.submitNegotiationTurn(negId, {
      proposed_fee: feeAmount,
      note: note || undefined,
      action: 'counter',
    });
    setActionLoading(false);
    if (res.success) {
      Alert.alert('Sent', 'Counter offer sent!');
      navigation.goBack();
    } else {
      Alert.alert('Failed', res.error?.message || 'Could not send counter offer');
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (!offer) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No offer data</Text>
      </View>
    );
  }

  const fee = offer.agreed_fee || offer.influencer_budget || offer.per_influencer_budget || offer.set_budget || 0;
  const isActionable = offer.status === 'invited';
  const isNegotiating = offer.status === 'negotiating';
  const deliverables = offer.deliverables || [];

  // Tranche breakdown (spec defaults: 25/25/50)
  const t1Pct = 25;
  const t2Pct = 25;
  const t3Pct = 50;

  return (
    <ScrollView style={styles.container}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {/* Brand logo + name (tappable → BrandProfile) */}
        <TouchableOpacity
          style={styles.brandRow}
          onPress={() => {
            if (offer.brand_id) {
              navigation.navigate('BrandProfile', { brand_id: offer.brand_id });
            }
          }}
          activeOpacity={offer.brand_id ? 0.7 : 1}
        >
          {offer.brand_logo_url ? (
            <Image source={{ uri: offer.brand_logo_url }} style={styles.brandLogo} />
          ) : (
            <View style={styles.brandLogoFallback}>
              <Text style={styles.brandLogoInitial}>
                {(offer.brand_name || offer.business_name || 'B').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.brandName}>{offer.brand_name || offer.business_name || 'Brand'}</Text>
            {(offer.brand_category || offer.brand_city) && (
              <Text style={styles.brandMeta}>
                {[offer.brand_category, offer.brand_city].filter(Boolean).join(' · ')}
              </Text>
            )}
            <Text style={styles.campaignName}>{offer.campaign_name || 'Campaign'}</Text>
          </View>
          <StatusBadge status={offer.status} size={11} />
          {offer.brand_id && <Text style={styles.brandArrow}>›</Text>}
        </TouchableOpacity>

        {/* Expiry countdown for pending offers */}
        {isActionable && countdown && (
          <View style={styles.timerBar}>
            <Text style={styles.timerIcon}>&#9200;</Text>
            <Text style={[styles.timerText, countdown === 'Expired' && { color: colors.red }]}>
              {countdown === 'Expired' ? 'Offer Expired' : `Expires in ${countdown}`}
            </Text>
          </View>
        )}
      </View>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.navy} />
          <Text style={styles.loadingText}>Loading full details...</Text>
        </View>
      )}

      {/* ── Campaign Info ──────────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Campaign Info</Text>

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Campaign</Text>
            <Text style={styles.infoValue}>{offer.campaign_name || '--'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Brand</Text>
            <Text style={styles.infoValue}>{offer.brand_name || offer.business_name || '--'}</Text>
          </View>
        </View>

        {(offer.brand_category || offer.brand_city) && (
          <View style={styles.infoGrid}>
            {offer.brand_category && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Category</Text>
                <Text style={styles.infoValue}>{offer.brand_category}</Text>
              </View>
            )}
            {offer.brand_city && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Location</Text>
                <Text style={styles.infoValue}>{offer.brand_city}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Start Date</Text>
            <Text style={styles.infoValue}>{formatDate(offer.campaign_start_date || offer.content_start_date)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>End Date</Text>
            <Text style={styles.infoValue}>{formatDate(offer.campaign_end_date || offer.content_end_date)}</Text>
          </View>
        </View>

        {offer.goal && (
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Goal</Text>
              <Text style={styles.infoValue}>{(offer.goal || '').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())}</Text>
            </View>
            {offer.set_name && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Set</Text>
                <Text style={styles.infoValue}>{offer.set_name}</Text>
              </View>
            )}
          </View>
        )}

        {(offer.campaign_brief || offer.brief) && (
          <View style={styles.briefBox}>
            <Text style={styles.infoLabel}>Campaign Description</Text>
            <Text style={styles.briefText}>{offer.campaign_brief || offer.brief}</Text>
          </View>
        )}
      </View>

      {/* ── Offer Details ──────────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Offer Details</Text>

        <View style={styles.feeHighlight}>
          <Text style={styles.feeLabel}>Offered Fee</Text>
          <Text style={styles.feeValue}>{fmtRupees(fee)}</Text>
        </View>

        {/* Deliverables list */}
        {deliverables.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Deliverables Required</Text>
            {deliverables.map((d, i) => (
              <View key={d.id || i} style={styles.deliverableRow}>
                <View style={styles.deliverableDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.deliverableType}>
                    {DELIVERABLE_LABELS[d.type] || d.type} {d.quantity > 1 ? `x${d.quantity}` : ''}
                  </Text>
                  {d.submission_deadline && (
                    <Text style={styles.deliverableDeadline}>
                      Deadline: {formatDate(d.submission_deadline)}
                    </Text>
                  )}
                </View>
                <StatusBadge status={d.status} size={9} />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Deliverable</Text>
            <Text style={styles.infoValue}>
              {DELIVERABLE_LABELS[offer.deliverable_type] || offer.deliverable_type || 'To be confirmed'}
            </Text>
          </View>
        )}

        {/* Posting date / deadlines */}
        <View style={styles.infoGrid}>
          {offer.posting_date && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Posting Date</Text>
              <Text style={styles.infoValue}>{formatDate(offer.posting_date)}</Text>
            </View>
          )}
          {offer.submission_deadline && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Submission Deadline</Text>
              <Text style={styles.infoValue}>{formatDate(offer.submission_deadline)}</Text>
            </View>
          )}
        </View>

        {/* Commission info for conversion/hybrid goals */}
        {offer.commission_pct && (
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Commission Rate</Text>
              <Text style={styles.infoValue}>{parseFloat(offer.commission_pct)}%</Text>
            </View>
            {offer.coupon_code && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Coupon Code</Text>
                <Text style={[styles.infoValue, { fontFamily: 'monospace' }]}>{offer.coupon_code}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* ── Payment Terms ──────────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Payment Terms</Text>
        <Text style={styles.paymentNote}>
          Your fee is paid in 3 tranches. You receive the full agreed amount.
        </Text>

        <View style={styles.trancheRow}>
          <View style={[styles.trancheDot, { backgroundColor: colors.teal }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.trancheTitle}>Tranche 1 ({t1Pct}%)</Text>
            <Text style={styles.trancheDesc}>Released when both parties sign the contract</Text>
          </View>
          <Text style={styles.trancheAmount}>{fmtRupees(Math.round(fee * t1Pct / 100))}</Text>
        </View>

        <View style={styles.trancheRow}>
          <View style={[styles.trancheDot, { backgroundColor: colors.orange }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.trancheTitle}>Tranche 2 ({t2Pct}%)</Text>
            <Text style={styles.trancheDesc}>Released when content goes live</Text>
          </View>
          <Text style={styles.trancheAmount}>{fmtRupees(Math.round(fee * t2Pct / 100))}</Text>
        </View>

        <View style={styles.trancheRow}>
          <View style={[styles.trancheDot, { backgroundColor: colors.navy }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.trancheTitle}>Tranche 3 ({t3Pct}%)</Text>
            <Text style={styles.trancheDesc}>Auto-released 30 days after content live</Text>
          </View>
          <Text style={styles.trancheAmount}>{fmtRupees(Math.round(fee * t3Pct / 100))}</Text>
        </View>

        <View style={styles.trancheTotalRow}>
          <Text style={styles.trancheTotalLabel}>Total Fee</Text>
          <Text style={styles.trancheTotalValue}>{fmtRupees(fee)}</Text>
        </View>

        <View style={styles.tdsNote}>
          <Text style={styles.tdsText}>
            Note: 10% TDS is deducted at the time of withdrawal, not at earning.
          </Text>
        </View>
      </View>

      {/* ── Requirements / Brief ───────────────────────────────────────── */}
      {(offer.brief || offer.campaign_brief) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Requirements</Text>
          <View style={styles.briefBox}>
            <Text style={styles.infoLabel}>Brief / Instructions</Text>
            <Text style={styles.briefText}>{offer.brief || offer.campaign_brief}</Text>
          </View>
          {deliverables.length > 0 && deliverables[0].revision_limit && (
            <View style={styles.guidelineRow}>
              <Text style={styles.guidelineBullet}>*</Text>
              <Text style={styles.guidelineText}>
                Max {deliverables[0].revision_limit} revision rounds allowed per deliverable
              </Text>
            </View>
          )}
          {offer.physical_delivery && (
            <View style={styles.guidelineRow}>
              <Text style={styles.guidelineBullet}>*</Text>
              <Text style={styles.guidelineText}>
                Physical product delivery required{offer.delivery_address ? ` to: ${offer.delivery_address}` : ''}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Action Buttons ─────────────────────────────────────────────── */}
      {isActionable && countdown !== 'Expired' && (
        <View style={styles.card}>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.acceptBtn, actionLoading && styles.disabledBtn]}
              onPress={accept}
              disabled={actionLoading}
            >
              <Text style={styles.acceptText}>Accept Offer</Text>
            </TouchableOpacity>

            <View style={styles.actionSecondaryRow}>
              <TouchableOpacity
                style={[styles.negotiateBtn, actionLoading && styles.disabledBtn]}
                onPress={() => { setShowNegotiate(!showNegotiate); setShowDeclineReasons(false); }}
                disabled={actionLoading}
              >
                <Text style={styles.negotiateText}>Negotiate</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.declineBtn, actionLoading && styles.disabledBtn]}
                onPress={() => { setShowDeclineReasons(!showDeclineReasons); setShowNegotiate(false); }}
                disabled={actionLoading}
              >
                <Text style={styles.declineText}>Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── Decline Reasons ────────────────────────────────────────────── */}
      {showDeclineReasons && isActionable && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reason for Declining</Text>
          <Text style={styles.declineHint}>Please select a reason:</Text>
          {DECLINE_REASONS.map((r) => (
            <TouchableOpacity
              key={r.key}
              style={styles.declineReasonBtn}
              onPress={() => {
                Alert.alert(
                  'Decline Offer',
                  `Are you sure you want to decline? Reason: ${r.label}`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Decline', style: 'destructive', onPress: () => decline(r.key) },
                  ]
                );
              }}
              disabled={actionLoading}
            >
              <Text style={styles.declineReasonText}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Negotiate Section ──────────────────────────────────────────── */}
      {(showNegotiate || isNegotiating) && (offer.status === 'invited' || offer.status === 'negotiating') && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Counter Offer</Text>
          <Text style={styles.negotiateHint}>
            Enter your proposed fee and optionally add a note explaining your rate.
          </Text>
          <View style={styles.inputWrap}>
            <Text style={styles.rupee}>&#8377;</Text>
            <TextInput
              style={styles.feeInput}
              value={negotiatingFee}
              onChangeText={setNegotiatingFee}
              keyboardType="numeric"
              placeholder="Your proposed fee"
              placeholderTextColor={colors.t3}
            />
          </View>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Add a note (optional)..."
            placeholderTextColor={colors.t3}
            multiline
            numberOfLines={3}
          />
          <TouchableOpacity
            style={[styles.counterSubmitBtn, (actionLoading || !negotiatingFee) && styles.disabledBtn]}
            onPress={submitCounter}
            disabled={actionLoading || !negotiatingFee}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.counterSubmitText}>Send Counter Offer</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ── Negotiation Status (for negotiating offers) ────────────────── */}
      {isNegotiating && offer.negotiation && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Negotiation Status</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Status</Text>
              <StatusBadge status={offer.negotiation.status} size={10} />
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Waiting For</Text>
              <Text style={styles.infoValue}>
                {offer.negotiation.current_turn === 'brand' ? 'Brand to respond' : 'Your response'}
              </Text>
            </View>
          </View>
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
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandLogo: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)' },
  brandLogoFallback: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  brandLogoInitial: { fontSize: 20, fontWeight: '800', color: colors.white },
  brandName: { fontSize: 18, fontWeight: '800', color: colors.white },
  brandMeta: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  brandArrow: { fontSize: 22, color: 'rgba(255,255,255,0.4)', marginLeft: 4 },
  campaignName: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2 },

  // Timer
  timerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  timerIcon: { fontSize: 14, marginRight: 8 },
  timerText: { fontSize: 13, fontWeight: '700', color: colors.gold },

  // Loading
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8 },
  loadingText: { fontSize: 12, color: colors.t3 },

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

  // Info grid
  infoGrid: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  infoItem: { flex: 1 },
  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.t3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoValue: { fontSize: 13, fontWeight: '600', color: colors.t1, lineHeight: 18 },

  // Fee highlight
  feeHighlight: {
    backgroundColor: colors.tealPale,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  feeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.tealDeep,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  feeValue: { fontSize: 28, fontWeight: '800', color: colors.tealDeep },

  // Section
  section: { marginBottom: 12 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.t3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  // Deliverables
  deliverableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  deliverableDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.navy,
  },
  deliverableType: { fontSize: 13, fontWeight: '600', color: colors.t1 },
  deliverableDeadline: { fontSize: 11, color: colors.t3, marginTop: 2 },

  // Brief
  briefBox: {
    backgroundColor: colors.surface2,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  briefText: { fontSize: 13, color: colors.t2, lineHeight: 20, marginTop: 4 },

  // Payment terms / Tranches
  paymentNote: { fontSize: 12, color: colors.t3, marginBottom: 14, lineHeight: 18 },
  trancheRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  trancheDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  trancheTitle: { fontSize: 13, fontWeight: '700', color: colors.t1 },
  trancheDesc: { fontSize: 11, color: colors.t3, marginTop: 2, lineHeight: 16 },
  trancheAmount: { fontSize: 14, fontWeight: '800', color: colors.t1 },
  trancheTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 4,
  },
  trancheTotalLabel: { fontSize: 13, fontWeight: '700', color: colors.t1 },
  trancheTotalValue: { fontSize: 18, fontWeight: '800', color: colors.tealDeep },
  tdsNote: {
    backgroundColor: colors.goldPale,
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  tdsText: { fontSize: 11, color: '#7A5500', lineHeight: 16 },

  // Guidelines
  guidelineRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  guidelineBullet: { fontSize: 12, color: colors.t3, fontWeight: '700' },
  guidelineText: { fontSize: 12, color: colors.t2, flex: 1, lineHeight: 18 },

  // Actions
  actions: { gap: 10 },
  acceptBtn: {
    backgroundColor: colors.teal,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  acceptText: { fontSize: 15, fontWeight: '700', color: colors.white },
  actionSecondaryRow: { flexDirection: 'row', gap: 10 },
  negotiateBtn: {
    flex: 1,
    backgroundColor: colors.navyPale,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  negotiateText: { fontSize: 14, fontWeight: '700', color: colors.navy },
  declineBtn: {
    flex: 1,
    backgroundColor: colors.redPale,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  declineText: { fontSize: 14, fontWeight: '700', color: colors.red },
  disabledBtn: { opacity: 0.5 },

  // Decline reasons
  declineHint: { fontSize: 12, color: colors.t3, marginBottom: 10 },
  declineReasonBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    marginBottom: 8,
  },
  declineReasonText: { fontSize: 13, fontWeight: '600', color: colors.t1 },

  // Negotiate form
  negotiateHint: { fontSize: 12, color: colors.t3, marginBottom: 12, lineHeight: 18 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border2,
    borderRadius: 12,
    marginBottom: 10,
  },
  rupee: { paddingHorizontal: 12, fontSize: 18, fontWeight: '700', color: colors.t2 },
  feeInput: { flex: 1, paddingVertical: 12, fontSize: 18, fontWeight: '700', color: colors.t1 },
  noteInput: {
    borderWidth: 2,
    borderColor: colors.border2,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: colors.t1,
    marginBottom: 12,
    textAlignVertical: 'top',
  },
  counterSubmitBtn: {
    backgroundColor: colors.navy,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  counterSubmitText: { fontSize: 14, fontWeight: '700', color: colors.white },
});
