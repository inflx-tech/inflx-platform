import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput,
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

function formatDateTime(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const DELIVERABLE_LABELS = {
  reel: 'Instagram Reel',
  post: 'Instagram Post',
  story: 'Instagram Story',
  youtube_video: 'YouTube Video',
  youtube_short: 'YouTube Short',
};

function contractStatusLabel(status) {
  switch (status) {
    case 'draft':              return 'Brand Reviewing';
    case 'pending_influencer': return 'Awaiting Your Signature';
    case 'pending_brand':      return 'Awaiting Brand Signature';
    case 'active':             return 'Contract Active';
    case 'completed':          return 'Completed';
    case 'cancelled':          return 'Cancelled';
    default:                   return (status || '').replace(/_/g, ' ');
  }
}

const CLAUSE_LABELS = {
  commercial_rights:    'Commercial Usage Rights',
  category_exclusivity: 'Category Exclusivity',
  content_ownership:    'Content Ownership Transfer',
};
const CLAUSE_DESCS = {
  commercial_rights:    (v) => `The brand may use your content in paid ads / social / offline marketing for ${v} days after going live.`,
  category_exclusivity: (v) => `You agree not to promote a competing brand in the same category for ${v} days from contract signing.`,
  content_ownership:    ()  => `Final approved content becomes the brand's property. You retain the right to keep it on your own profile.`,
};

// ── Component ────────────────────────────────────────────────────────────────

export default function ContractScreen({ navigation, route }) {
  const { campaignInfluencerId } = route.params || {};
  const [contract, setContract] = useState(null);
  const [deliverables, setDeliverables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [typedName, setTypedName] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const res = await influencerApi.getContract(campaignInfluencerId);
    setLoading(false);
    if (res.success) {
      const data = res.data || {};
      setContract(data.contract || data);
      setDeliverables(data.deliverables || []);
    } else {
      Alert.alert('Error', res.error?.message || 'Failed to load contract');
    }
  }

  async function handleSign() {
    const name = typedName.trim();
    if (!name) {
      Alert.alert('Name Required', 'Please type your full name to sign the contract.');
      return;
    }

    Alert.alert(
      'Sign Contract',
      'This is legally binding. By signing, you agree to all terms stated in this contract including deliverables, payment schedule, and content requirements. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Now',
          onPress: async () => {
            setSigning(true);
            const res = await influencerApi.signContract(contract.id, {
              typed_name: name,
            });
            setSigning(false);
            if (res.success) {
              setSigned(true);
              // Update local contract state
              setContract(prev => ({
                ...prev,
                status: 'pending_brand',
                influencer_signed_at: new Date().toISOString(),
                influencer_signed_name: name,
              }));
            } else {
              Alert.alert('Failed', res.error?.message || 'Signing failed. Please try again.');
            }
          },
        },
      ]
    );
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.navy} />
        <Text style={styles.loadingText}>Loading contract...</Text>
      </View>
    );
  }

  if (!contract) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Contract not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackBtn}>
          <Text style={styles.goBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const influencerHasSigned = !!contract.influencer_signed_at;
  const brandHasSigned = !!contract.brand_signed_at;
  const fullyActive = contract.status === 'active' || (influencerHasSigned && brandHasSigned);
  const needsInfluencerSignature = contract.status === 'pending_influencer' && !influencerHasSigned;

  // influencer_fee is the BASE agreed fee. Total = base + bonus. The Payment
  // Terms tranche schedule + Total Fee display use the TOTAL.
  const baseFee = parseFloat(contract.influencer_fee || contract.agreed_fee || 0);
  const bonus   = parseFloat(contract.bonus_amount || 0);
  const fee     = baseFee + bonus;
  // Tranche defaults: 25/25/50
  const t1Pct = 25;
  const t2Pct = 25;
  const t3Pct = 50;

  return (
    <View style={styles.outer}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{"<-"} Back</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Contract</Text>
            <Text style={styles.sub}>{contract.campaign_name || 'Campaign'}</Text>
          </View>
          <StatusBadge status={contract.status} size={11} />
        </View>
      </View>

      {/* ── Contract Active Banner ──────────────────────────────────────── */}
      {fullyActive && (
        <View style={styles.activeBanner}>
          <Text style={styles.activeBannerText}>Contract Active -- Both parties have signed</Text>
        </View>
      )}

      {/* ── Draft state — brand is still reviewing ──────────────────────── */}
      {contract.status === 'draft' && (
        <View style={[styles.successBanner, { backgroundColor: '#FFF8E0', borderBottomColor: '#E8D590' }]}>
          <Text style={[styles.successBannerText, { color: '#7A5500' }]}>
            ⏳ Brand is reviewing the contract. You'll be notified when it's ready to sign.
          </Text>
        </View>
      )}

      {/* ── Just-signed success banner ──────────────────────────────────── */}
      {signed && !fullyActive && (
        <View style={styles.successBanner}>
          <Text style={styles.successBannerText}>Contract signed successfully. Waiting for brand to countersign.</Text>
        </View>
      )}

      {/* ── HIGHLIGHT: Special clauses + bonus the brand attached ───────── */}
      {(() => {
        let cc = contract.custom_clauses;
        if (typeof cc === 'string') { try { cc = JSON.parse(cc); } catch { cc = null; } }
        const enabledIds = cc ? Object.keys(cc.clauses || {}).filter(k => cc.clauses[k]?.enabled) : [];
        const hasNotes = cc?.notes;
        const bonus    = parseFloat(contract.bonus_amount || 0);
        if (enabledIds.length === 0 && !hasNotes && bonus <= 0) return null;
        return (
          <View style={styles.clauseHighlightBox}>
            <Text style={styles.clauseHighlightTitle}>⚠️ Important Terms Attached</Text>
            {bonus > 0 && (
              <Text style={styles.clauseHighlightItem}>
                💰 <Text style={{ fontWeight: '800' }}>+ ₹{bonus.toLocaleString('en-IN')} bonus</Text> on top of agreed fee
              </Text>
            )}
            {enabledIds.map(id => (
              <View key={id} style={{ marginTop: 6 }}>
                <Text style={styles.clauseHighlightItem}>
                  • <Text style={{ fontWeight: '800' }}>{CLAUSE_LABELS[id] || id}</Text>
                  {cc.clauses[id].value ? ` (${cc.clauses[id].value} days)` : ''}
                </Text>
                <Text style={styles.clauseHighlightDesc}>
                  {CLAUSE_DESCS[id] ? CLAUSE_DESCS[id](cc.clauses[id].value) : ''}
                </Text>
              </View>
            ))}
            {hasNotes && (
              <View style={{ marginTop: 6 }}>
                <Text style={styles.clauseHighlightItem}>• <Text style={{ fontWeight: '800' }}>Additional Notes</Text></Text>
                <Text style={styles.clauseHighlightDesc}>{cc.notes}</Text>
              </View>
            )}
          </View>
        );
      })()}

      {/* ── View PDF button (always available once a contract row exists) ─── */}
      <TouchableOpacity
        style={styles.pdfBtn}
        onPress={() => navigation.navigate('ContractPdf', { contractId: contract.id })}
      >
        <Text style={styles.pdfBtnText}>View Contract PDF</Text>
      </TouchableOpacity>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <ScrollView ref={scrollRef} style={styles.body}>

        {/* Campaign & Brand Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Campaign Details</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Campaign</Text>
              <Text style={styles.infoValue}>{contract.campaign_name || '--'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Brand</Text>
              <Text style={styles.infoValue}>{contract.brand_name || '--'}</Text>
            </View>
          </View>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Contract Status</Text>
              <Text style={styles.infoValue}>{contractStatusLabel(contract.status)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Posting Date</Text>
              <Text style={styles.infoValue}>{formatDate(contract.posting_date)}</Text>
            </View>
          </View>
        </View>

        {/* Agreed Fee */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Agreed Fee</Text>
          <View style={styles.feeHighlight}>
            <Text style={styles.feeLabel}>Total Influencer Fee</Text>
            <Text style={styles.feeValue}>{fmtRupees(fee)}</Text>
          </View>
        </View>

        {/* Deliverables */}
        {deliverables.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Deliverables</Text>
            {deliverables.map((d, i) => (
              <View key={d.id || i} style={styles.deliverableRow}>
                <View style={styles.deliverableDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.deliverableType}>
                    {DELIVERABLE_LABELS[d.type] || d.type}
                    {d.quantity > 1 ? ` x${d.quantity}` : ''}
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
        )}

        {/* Payment Terms / Tranche Schedule */}
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

        {/* Content Guidelines / Brief */}
        {(contract.content_requirements || contract.brief || contract.campaign_brief) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Content Guidelines</Text>
            <View style={styles.briefBox}>
              <Text style={styles.briefText}>
                {contract.content_requirements || contract.brief || contract.campaign_brief}
              </Text>
            </View>
          </View>
        )}

        {/* Revision Limits */}
        {contract.revision_limit != null && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Revision Policy</Text>
            <Text style={styles.revisionText}>
              Maximum {contract.revision_limit} revision round{contract.revision_limit !== 1 ? 's' : ''} allowed per deliverable.
              After revisions are exhausted, the content will be used as-is.
            </Text>
          </View>
        )}

        {/* Signature Status */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Signatures</Text>

          <View style={styles.sigSection}>
            <View style={[styles.sigBox, influencerHasSigned && styles.sigBoxSigned]}>
              <Text style={styles.sigLabel}>Influencer</Text>
              {influencerHasSigned ? (
                <>
                  <Text style={styles.sigCheck}>Signed</Text>
                  <Text style={styles.sigName}>{contract.influencer_signed_name || contract.influencer_name}</Text>
                  <Text style={styles.sigDate}>{formatDateTime(contract.influencer_signed_at)}</Text>
                </>
              ) : (
                <Text style={styles.sigPending}>Not yet signed</Text>
              )}
            </View>

            <View style={[styles.sigBox, brandHasSigned && styles.sigBoxSigned]}>
              <Text style={styles.sigLabel}>Brand</Text>
              {brandHasSigned ? (
                <>
                  <Text style={styles.sigCheck}>Signed</Text>
                  <Text style={styles.sigName}>{contract.brand_signed_by || 'Brand Representative'}</Text>
                  <Text style={styles.sigDate}>{formatDateTime(contract.brand_signed_at)}</Text>
                </>
              ) : (
                <Text style={styles.sigPending}>Awaiting brand</Text>
              )}
            </View>
          </View>
        </View>

        {/* ── Sign Section ──────────────────────────────────────────────── */}
        {needsInfluencerSignature && !signed && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign This Contract</Text>
            <Text style={styles.signHint}>
              Type your full legal name below to sign this contract. This is legally binding.
            </Text>
            <View style={styles.nameInputWrap}>
              <TextInput
                style={styles.nameInput}
                value={typedName}
                onChangeText={setTypedName}
                placeholder="Your full name"
                placeholderTextColor={colors.t3}
                autoCapitalize="words"
              />
            </View>
            <TouchableOpacity
              style={[styles.signBtn, (signing || !typedName.trim()) && styles.signBtnDisabled]}
              onPress={handleSign}
              disabled={signing || !typedName.trim()}
            >
              {signing ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.signBtnText}>Sign Contract</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Post-sign success state ───────────────────────────────────── */}
        {signed && !fullyActive && (
          <View style={styles.card}>
            <View style={styles.successState}>
              <Text style={styles.successCheck}>Signed</Text>
              <Text style={styles.successTitle}>Contract Signed Successfully</Text>
              <Text style={styles.successDesc}>
                The brand will be notified to countersign. Once both parties have signed,
                Tranche 1 will be released automatically.
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  loadingText: { fontSize: 13, color: colors.t3, marginTop: 12 },
  errorText: { fontSize: 14, color: colors.t2, marginBottom: 16 },
  goBackBtn: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.surface2, borderRadius: 12 },
  goBackBtnText: { fontSize: 14, fontWeight: '600', color: colors.navy },

  // Header
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  back: { marginBottom: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 20, fontWeight: '800', color: colors.white },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 },

  // Banners
  activeBanner: {
    backgroundColor: colors.teal,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  activeBannerText: { fontSize: 13, fontWeight: '700', color: colors.white },
  successBanner: {
    backgroundColor: colors.tealPale,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.teal,
  },
  successBannerText: { fontSize: 12, fontWeight: '600', color: colors.tealDeep },

  // View PDF button
  pdfBtn: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: colors.navy,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  pdfBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },

  // Highlight box for special clauses + bonus the brand attached
  clauseHighlightBox: {
    margin: 16,
    marginBottom: 0,
    padding: 14,
    backgroundColor: '#FFF8E0',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8D590',
  },
  clauseHighlightTitle: { fontSize: 14, fontWeight: '800', color: '#7A5500', marginBottom: 8 },
  clauseHighlightItem:  { fontSize: 13, color: '#5A3F00', lineHeight: 18 },
  clauseHighlightDesc:  { fontSize: 11, color: '#7A5500', lineHeight: 16, marginTop: 2, marginLeft: 12 },

  // Body
  body: { flex: 1 },

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

  // Brief / Guidelines
  briefBox: {
    backgroundColor: colors.surface2,
    borderRadius: 10,
    padding: 12,
  },
  briefText: { fontSize: 13, color: colors.t2, lineHeight: 20 },

  // Revision
  revisionText: { fontSize: 13, color: colors.t2, lineHeight: 20 },

  // Signatures
  sigSection: { flexDirection: 'row', gap: 12 },
  sigBox: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sigBoxSigned: {
    borderColor: colors.teal,
    backgroundColor: colors.tealPale,
  },
  sigLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.t3,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sigCheck: { fontSize: 13, fontWeight: '800', color: colors.teal, marginBottom: 4 },
  sigName: { fontSize: 12, fontWeight: '700', color: colors.t1 },
  sigDate: { fontSize: 10, color: colors.t3, marginTop: 2 },
  sigPending: { fontSize: 12, color: colors.t3, fontStyle: 'italic' },

  // Sign section
  signHint: { fontSize: 12, color: colors.t3, marginBottom: 12, lineHeight: 18 },
  nameInputWrap: {
    borderWidth: 2,
    borderColor: colors.border2,
    borderRadius: 12,
    marginBottom: 12,
  },
  nameInput: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '600',
    color: colors.t1,
  },
  signBtn: {
    backgroundColor: colors.navy,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  signBtnDisabled: { opacity: 0.5 },
  signBtnText: { fontSize: 15, fontWeight: '800', color: colors.white },

  // Success state
  successState: { alignItems: 'center', paddingVertical: 8 },
  successCheck: { fontSize: 18, fontWeight: '800', color: colors.teal, marginBottom: 8 },
  successTitle: { fontSize: 16, fontWeight: '800', color: colors.t1, marginBottom: 8 },
  successDesc: { fontSize: 13, color: colors.t3, textAlign: 'center', lineHeight: 20 },
});
