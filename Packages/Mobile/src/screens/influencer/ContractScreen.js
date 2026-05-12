import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, fmtMoney, fmtRupees } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import DateTimeChipPicker from '../../components/DateTimeChipPicker';
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
  const [formatsJson, setFormatsJson] = useState([]);
  const [productionEvent, setProductionEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [typedName, setTypedName] = useState('');
  // Signing happens in a Modal — Modals render outside the parent
  // ScrollView so the keyboard show/hide doesn't trigger any re-layout
  // race that yanks focus from the input. Fixes MIUI/Redmi keyboard
  // flicker bug where 'tap input → keyboard pops up → keyboard closes
  // immediately' was happening on Redmi 13C 5G (Android 13).
  const [signModalOpen, setSignModalOpen] = useState(false);
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
      const c = data.contract || data;
      setContract(c);
      setDeliverables(data.deliverables || []);
      setProductionEvent(data.production_event || null);
      // formats_json lives on the campaign_set and gets included on the
      // contract row by getContractByIdOrThrow. Used as the source for
      // the Deliverables card before brandSign auto-creates real rows.
      let fj = c.formats_json || c.set_formats_json || [];
      if (typeof fj === 'string') {
        try { fj = JSON.parse(fj); } catch { fj = []; }
      }
      setFormatsJson(Array.isArray(fj) ? fj : []);
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
      'Confirm signature',
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
              setSignModalOpen(false);
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

  // Goal-aware gating. Backend now ships `goal` + `commission_pct` on the
  // contract row (K.1 / L.2 joins). Conversion contracts have no fee and no
  // tranches; they get a Commission Schedule card instead.
  const goalLc       = (contract.goal || 'engagement').toLowerCase();
  const isConversion = goalLc === 'conversion';
  const commissionPct = parseFloat(contract.commission_pct || 0);
  const showTranches = fee > 0 && !isConversion;
  const showCommissionCard = commissionPct > 0 || isConversion;

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

      {/* ── View PDF button ─────────────────────────────────────────────────
         Only show after the brand has actually SENT the contract. While
         it's still in 'draft', the brand is privately preparing the
         terms — influencer shouldn't see a PDF button because there is
         no agreed contract to view yet. The button also requires a PDF
         key on the contract row (pdf_url is set at generation time). */}
      {contract.status !== 'draft' && contract.pdf_url && (
        <TouchableOpacity
          style={styles.pdfBtn}
          onPress={() => navigation.navigate('ContractPdf', { contractId: contract.id })}
        >
          <Text style={styles.pdfBtnText}>View Contract PDF</Text>
        </TouchableOpacity>
      )}

      {contract.status === 'draft' && (
        <View style={styles.draftBanner}>
          <Text style={styles.draftBannerTitle}>Brand is preparing your contract</Text>
          <Text style={styles.draftBannerBody}>You'll be notified once the contract is ready to review and sign.</Text>
        </View>
      )}

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        style={styles.body}
        // 'always' — keyboard NEVER auto-dismisses when tapping inside the
        // ScrollView, including the surrounding whitespace around the
        // signature input. Switched from 'handled' because Android was
        // interpreting the very first tap on the input as a 1-pixel drag,
        // dismissing the keyboard the instant it appeared.
        // 'on-drag' explicitly removed for the same reason — tap micro-
        // movements were being treated as drags on some Android builds.
        keyboardShouldPersistTaps="always"
      >

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

        {/* Agreed Fee — shown only when there's an upfront fee (engagement / hybrid). */}
        {fee > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Agreed Fee</Text>
            <View style={styles.feeHighlight}>
              <Text style={styles.feeLabel}>Total Influencer Fee</Text>
              <Text style={styles.feeValue}>{fmtRupees(fee)}</Text>
            </View>
          </View>
        )}

        {/* Deliverables — show live deliverables once they exist (after both
            sign), otherwise fall back to formats_json so the influencer
            sees what they're agreeing to BEFORE signing. Critical for
            informed consent across engagement / conversion / hybrid. */}
        {deliverables.length > 0 ? (
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
        ) : formatsJson.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Deliverables to be Created</Text>
            <Text style={[styles.paymentNote, { marginBottom: 6 }]}>
              These will be auto-created as trackable items once both parties sign.
            </Text>
            {formatsJson.map((f, i) => {
              const name = (typeof f === 'string') ? f : (f.name || f.type || 'Format');
              const count = (typeof f === 'string') ? 1 : (Number(f.count) || 1);
              return (
                <View key={i} style={styles.deliverableRow}>
                  <View style={styles.deliverableDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deliverableType}>
                      {name}{count > 1 ? ` x${count}` : ''}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Production Arrangement — what the influencer is signing up for
            logistically. Shown from pending_influencer onwards (the mode is
            picked at brand-approve time, well before influencer signs).
            Visit address / shipping AWB only fill in after activation; pre-
            activation we show a sensible placeholder. Applies to all goals. */}
        {contract.status !== 'draft' && (() => {
          const mode = contract.production_mode || 'remote';
          const pe = productionEvent || {};
          if (mode === 'remote') {
            return (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Production Arrangement</Text>
                <View style={[styles.briefBox, { backgroundColor: colors.surface2 }]}>
                  <Text style={[styles.briefText, { fontWeight: '700', marginBottom: 4 }]}>💻 Remote</Text>
                  <Text style={styles.briefText}>
                    No physical exchange. You'll create content directly from the brand brief and any uploaded reference assets.
                  </Text>
                </View>
              </View>
            );
          }
          if (mode === 'visit') {
            const addr = [pe.visit_address, pe.visit_city, pe.visit_state, pe.visit_pincode].filter(Boolean).join(', ');
            return (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Production Arrangement</Text>
                <View style={[styles.briefBox, { backgroundColor: colors.surface2 }]}>
                  <Text style={[styles.briefText, { fontWeight: '700', marginBottom: 4 }]}>🏬 Visit Brand Location</Text>
                  <Text style={styles.briefText}>
                    You'll visit the brand's premises to shoot the content.
                  </Text>
                  <View style={{ height: 8 }} />
                  <Text style={styles.infoLabel}>Address</Text>
                  <Text style={styles.infoValue}>{addr || 'To be confirmed by brand after both parties sign.'}</Text>
                  {pe.visit_scheduled_at && (
                    <>
                      <View style={{ height: 6 }} />
                      <Text style={styles.infoLabel}>Scheduled</Text>
                      <Text style={styles.infoValue}>
                        {new Date(pe.visit_scheduled_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {pe.visit_window_minutes ? ` · ${pe.visit_window_minutes} min window` : ''}
                      </Text>
                    </>
                  )}
                  {(pe.visit_contact_name || pe.visit_contact_phone) && (
                    <>
                      <View style={{ height: 6 }} />
                      <Text style={styles.infoLabel}>Contact</Text>
                      <Text style={styles.infoValue}>
                        {[pe.visit_contact_name, pe.visit_contact_phone].filter(Boolean).join(' · ')}
                      </Text>
                    </>
                  )}
                </View>
              </View>
            );
          }
          // shipment
          const shipAddr = [pe.shipment_to_address_line, pe.shipment_to_city, pe.shipment_to_state, pe.shipment_to_pincode].filter(Boolean).join(', ');
          return (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Production Arrangement</Text>
              <View style={[styles.briefBox, { backgroundColor: colors.surface2 }]}>
                <Text style={[styles.briefText, { fontWeight: '700', marginBottom: 4 }]}>📦 Product Shipment</Text>
                <Text style={styles.briefText}>
                  The brand will ship product samples to you for content creation.
                </Text>
                <View style={{ height: 8 }} />
                <Text style={styles.infoLabel}>Shipping to</Text>
                <Text style={styles.infoValue}>{shipAddr || 'Your registered address. Confirm or update after signing.'}</Text>
                {(pe.shipment_courier || pe.shipment_awb) && (
                  <>
                    <View style={{ height: 6 }} />
                    <Text style={styles.infoLabel}>Tracking</Text>
                    <Text style={styles.infoValue}>
                      {[pe.shipment_courier, pe.shipment_awb].filter(Boolean).join(' · ')}
                    </Text>
                  </>
                )}
                {pe.shipment_dispatched_at && (
                  <>
                    <View style={{ height: 6 }} />
                    <Text style={styles.infoLabel}>Dispatched</Text>
                    <Text style={styles.infoValue}>{formatDate(pe.shipment_dispatched_at)}</Text>
                  </>
                )}
              </View>
            </View>
          );
        })()}

        {/* Payment Terms / Tranche Schedule — fee-bearing contracts only.
            Conversion contracts (no upfront fee) get Commission Schedule below. */}
        {showTranches && (
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
        )}

        {/* Commission Schedule — conversion / hybrid contracts. */}
        {showCommissionCard && (() => {
          let offerCfg = contract.offer_config_json;
          if (typeof offerCfg === 'string') {
            try { offerCfg = JSON.parse(offerCfg); } catch { offerCfg = null; }
          }
          const offerValueLabel = offerCfg && offerCfg.value != null
            ? (contract.offer_type === 'percentage' ? `${offerCfg.value}%` : fmtRupees(offerCfg.value))
            : null;
          return (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Commission Schedule</Text>
              <Text style={styles.paymentNote}>
                You earn on every sale or booking driven by your tracking link. No upfront payment.
              </Text>
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Commission Rate</Text>
                  <Text style={[styles.infoValue, { color: colors.tealDeep, fontWeight: '800' }]}>{commissionPct}%</Text>
                </View>
                {contract.offer_type && (
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Offer Type</Text>
                    <Text style={styles.infoValue}>{String(contract.offer_type).replace(/_/g, ' ')}</Text>
                  </View>
                )}
              </View>
              {(offerValueLabel || contract.coupon_code) && (
                <View style={styles.infoGrid}>
                  {offerValueLabel && (
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Offer Value</Text>
                      <Text style={styles.infoValue}>{offerValueLabel}</Text>
                    </View>
                  )}
                  {contract.coupon_code && (
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Your Coupon</Text>
                      <Text style={[styles.infoValue, { fontFamily: 'monospace' }]}>{contract.coupon_code}</Text>
                    </View>
                  )}
                </View>
              )}
              <View style={styles.tdsNote}>
                <Text style={styles.tdsText}>
                  Commissions credit to your pending balance immediately and move to withdrawable balance after a 30-day return window. 10% TDS is deducted at withdrawal.
                </Text>
              </View>
            </View>
          );
        })()}

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
        {/* The actual TextInput lives inside a Modal (rendered below this
            ScrollView's tree) so the keyboard show/hide doesn't trigger
            ScrollView re-layout that races with focus on MIUI/Redmi. */}
        {needsInfluencerSignature && !signed && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign This Contract</Text>
            <Text style={styles.signHint}>
              Tap below and type your full legal name to sign. This is legally binding.
            </Text>
            <TouchableOpacity
              style={[styles.signBtn, signing && styles.signBtnDisabled]}
              onPress={() => { setTypedName(''); setSignModalOpen(true); }}
              disabled={signing}
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

        {/* ── Production coordination (visible after activation) ─────────── */}
        {fullyActive && <InfluencerProductionPanel contractId={contract.id} />}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Sign Modal ──────────────────────────────────────────────────────
          Renders in its own root view, not inside the ScrollView, so the
          keyboard appearing doesn't trigger ScrollView re-layout / focus
          loss. Fixes the MIUI Redmi 13C "keyboard pops up and closes"
          flicker. KeyboardAvoidingView pushes the form up on iOS; on
          Android, AndroidManifest.xml's adjustResize handles it. */}
      <Modal
        visible={signModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSignModalOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sign Contract</Text>
            <Text style={styles.modalSub}>
              Type your full legal name to sign. This is legally binding —
              you agree to all terms in the contract above.
            </Text>
            <View style={styles.nameInputWrap}>
              <TextInput
                style={styles.nameInput}
                value={typedName}
                onChangeText={setTypedName}
                placeholder="Your full name"
                placeholderTextColor={colors.t3}
                autoCapitalize="words"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (typedName.trim()) handleSign();
                }}
              />
            </View>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setSignModalOpen(false)}
                disabled={signing}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSignBtn, (signing || !typedName.trim()) && styles.signBtnDisabled]}
                onPress={() => {
                  if (typedName.trim()) handleSign();
                }}
                disabled={signing || !typedName.trim()}
              >
                {signing ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.signBtnText}>Sign Now</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Production Panel (influencer side) ──────────────────────────────────────

function InfluencerProductionPanel({ contractId }) {
  const [event, setEvent]  = useState(null);
  const [mode, setMode]    = useState(null);
  const [log, setLog]      = useState([]);
  const [loading, setLoad] = useState(true);
  const [busy, setBusy]    = useState(false);
  const [dateRange, setDateRange] = useState(null);

  // Slot proposal form (influencer's primary input). slotDateTime is a single
  // Date value populated by DateTimeChipPicker — replaced the old separate
  // YYYY-MM-DD / HH:MM text inputs to avoid hand-typed dates.
  const [slotDateTime, setSlotDateTime] = useState(null);
  const [slotWindow, setSlotWindow] = useState(60);
  const [slotNotes, setSlotNotes] = useState('');
  const [slotFormOpen, setSlotFormOpen] = useState(false);

  // Shipment counter form (address)
  const [counterAddress, setCounterAddress] = useState('');
  const [counterNotes, setCounterNotes]   = useState('');
  const [counterOpen, setCounterOpen]     = useState(false);

  async function load() {
    setLoad(true);
    const [res, rangeRes] = await Promise.all([
      influencerApi.getProduction(contractId),
      influencerApi.getProductionDateRange(contractId).catch(() => null),
    ]);
    setLoad(false);
    if (res.success) {
      setEvent(res.data?.production_event || null);
      setMode(res.data?.production_mode || null);
      setLog(res.data?.log || []);
      const e = res.data?.production_event;
      if (e?.visit_window_minutes) setSlotWindow(e.visit_window_minutes);
    }
    if (rangeRes?.success) setDateRange(rangeRes.data?.range || null);
  }
  useEffect(() => { load(); }, [contractId]);

  const dateHint = dateRange
    ? `Pick a date between ${new Date(dateRange.earliest).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} and ${new Date(dateRange.latest).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
    : null;

  async function handleAccept() {
    if (!event) return;
    setBusy(true);
    const res = await influencerApi.acceptProduction(event.id);
    setBusy(false);
    if (res.success) load();
    else Alert.alert('Failed', res.error?.message || 'Could not accept');
  }

  // Influencer first-time slot proposal OR re-proposal (counts as reschedule).
  async function handleProposeSlot() {
    if (!slotDateTime) { Alert.alert('Missing', 'Pick a date and time'); return; }
    setBusy(true);
    const res = await influencerApi.proposeProductionSlot(event.id, {
      visit_scheduled_at: slotDateTime.toISOString(),
      visit_window_minutes: Number(slotWindow) || null,
      notes: slotNotes.trim() || undefined,
    });
    setBusy(false);
    if (res.success) {
      Alert.alert('Slot sent', 'Brand will accept or counter your proposed slot.');
      setSlotFormOpen(false); setSlotDateTime(null); setSlotNotes('');
      load();
    } else {
      Alert.alert('Failed', res.error?.message || 'Could not propose slot.');
    }
  }

  // Counter brand's proposed slot OR brand's counter-of-influencer's slot.
  async function handleCounterSlot() {
    if (!slotDateTime) { Alert.alert('Missing', 'Pick a date and time'); return; }
    setBusy(true);
    const res = await influencerApi.counterProposeProduction(event.id, {
      visit_scheduled_at: slotDateTime.toISOString(),
      visit_window_minutes: Number(slotWindow) || null,
      notes: slotNotes.trim() || undefined,
    });
    setBusy(false);
    if (res.success) {
      Alert.alert('Counter sent', 'Brand will see your suggestion.');
      setSlotFormOpen(false); setSlotDateTime(null); setSlotNotes('');
      load();
    } else {
      Alert.alert('Failed', res.error?.message || 'Counter failed.');
    }
  }

  // Shipment-only counter (different address).
  async function handleCounterShipment() {
    if (!counterAddress.trim()) { Alert.alert('Missing', 'Enter the new address'); return; }
    setBusy(true);
    const res = await influencerApi.counterProposeProduction(event.id, {
      shipment_to_address_line: counterAddress.trim(),
      notes: counterNotes.trim() || undefined,
    });
    setBusy(false);
    if (res.success) { setCounterOpen(false); load(); }
    else Alert.alert('Failed', res.error?.message || 'Counter failed.');
  }

  // Mutual flip to remote.
  async function handleFlipToRemote() {
    if (!event) return;
    Alert.alert(
      'Switch to remote?',
      'No in-person shoot needed — you create content directly from the brief. The other side has to confirm.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: event.remote_flip_requested_by && event.remote_flip_requested_by !== 'influencer'
            ? 'Confirm flip' : 'Request flip',
          onPress: async () => {
            setBusy(true);
            const res = await influencerApi.flipProductionToRemote(event.id);
            setBusy(false);
            if (res.success) load();
            else Alert.alert('Failed', res.error?.message || 'Flip failed.');
          },
        },
      ]
    );
  }

  async function handleConfirmReceived() {
    if (!event) return;
    Alert.alert('Confirm package received?', 'This signals the brand that the shipment arrived.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => {
        setBusy(true);
        const res = await influencerApi.confirmProductionReceived(event.id, {});
        setBusy(false);
        if (res.success) load();
        else Alert.alert('Failed', res.error?.message || 'Could not confirm');
      }},
    ]);
  }

  async function handleMarkVisitDone() {
    if (!event) return;
    Alert.alert('Mark visit complete?', 'Signal the brand that the shoot is done.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => {
        setBusy(true);
        const res = await influencerApi.completeProduction(event.id, {});
        setBusy(false);
        if (res.success) load();
        else Alert.alert('Failed', res.error?.message || 'Could not complete');
      }},
    ]);
  }

  if (loading) return <View style={ipStyles.loading}><ActivityIndicator color={colors.navy} /></View>;
  if (mode === 'remote') {
    return (
      <View style={ipStyles.remoteBox}>
        <Text style={ipStyles.remoteTitle}>💻 Remote production</Text>
        <Text style={ipStyles.remoteBody}>No coordination needed — you can start creating content directly from the brief.</Text>
      </View>
    );
  }
  if (!event) {
    return (
      <View style={ipStyles.remoteBox}>
        <Text style={ipStyles.remoteTitle}>
          {mode === 'visit' ? '🏬 Visit production' : mode === 'shipment' ? '📦 Shipment production' : 'Production'}
        </Text>
        <Text style={ipStyles.remoteBody}>
          The brand is setting up coordination. Pull to refresh — details will appear here once they've shared them.
        </Text>
      </View>
    );
  }

  const STATUS_PILL = {
    proposed:    { bg: '#FFF4D6', fg: '#7A5500', label: 'Action needed' },
    confirmed:   { bg: '#E0FAF5', fg: '#007A63', label: 'Confirmed' },
    in_progress: { bg: '#EEEDFE', fg: '#5C50C8', label: 'In transit' },
    completed:   { bg: '#E0FAF5', fg: '#007A63', label: 'Completed' },
    cancelled:   { bg: '#FDEEE9', fg: '#E8401A', label: 'Cancelled' },
  }[event.status] || { bg: colors.surface2, fg: colors.t2, label: event.status };

  const visit = event.mode === 'visit';
  const ship  = event.mode === 'shipment';

  return (
    <View style={ipStyles.panel}>
      <View style={ipStyles.head}>
        <Text style={ipStyles.title}>{visit ? '🏬 Visit Coordination' : '📦 Product Shipment'}</Text>
        <View style={[ipStyles.pill, { backgroundColor: STATUS_PILL.bg }]}>
          <Text style={[ipStyles.pillTxt, { color: STATUS_PILL.fg }]}>{STATUS_PILL.label}</Text>
        </View>
      </View>

      {visit && (() => {
        const hasLocation = !!event.visit_address;
        const hasSlot     = !!event.visit_scheduled_at;
        const proposedByBrand      = event.slot_proposed_by === 'brand';
        const proposedByInfluencer = event.slot_proposed_by === 'influencer';
        const isConfirmed = event.status === 'confirmed';
        const isCompleted = event.status === 'completed';
        const flipPending = !!event.remote_flip_requested_by;
        const flipByMe    = event.remote_flip_requested_by === 'influencer';

        return (
          <>
            {/* Remote flip confirmation banner (other side initiated) */}
            {flipPending && !flipByMe && !isCompleted && (
              <View style={ipStyles.flipBanner}>
                <Text style={ipStyles.flipBannerTxt}>
                  Brand wants to switch this to remote — no in-person shoot, you create content from the brief alone. Confirm?
                </Text>
                <TouchableOpacity style={ipStyles.flipConfirmBtn} disabled={busy} onPress={handleFlipToRemote}>
                  <Text style={ipStyles.flipConfirmBtnTxt}>Confirm flip</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Always show location once set */}
            {hasLocation && (
              <View style={ipStyles.detailBox}>
                <Text style={ipStyles.label}>Visit location</Text>
                <Text style={ipStyles.value}>
                  {event.visit_address}
                  {event.visit_city ? `, ${event.visit_city}` : ''}
                  {event.visit_pincode ? ` ${event.visit_pincode}` : ''}
                </Text>
                {event.visit_window_minutes && (
                  <Text style={[ipStyles.smallNote, { marginTop: 4 }]}>
                    Brand expects the visit to take ~{event.visit_window_minutes} min.
                  </Text>
                )}
                {(event.visit_contact_name || event.visit_contact_phone) && (
                  <>
                    <Text style={[ipStyles.label, { marginTop: 8 }]}>Contact</Text>
                    <Text style={ipStyles.value}>
                      {event.visit_contact_name || ''}{event.visit_contact_phone ? ` · ${event.visit_contact_phone}` : ''}
                    </Text>
                  </>
                )}
              </View>
            )}

            {/* STATE 1: brand hasn't sent location yet */}
            {!hasLocation && !isCompleted && (
              <Text style={ipStyles.note}>
                The brand will send you their visit location shortly. You'll get a notification when they do.
              </Text>
            )}

            {/* STATE 2: location sent, no slot yet — INFLUENCER PICKS SLOT */}
            {hasLocation && !hasSlot && !isCompleted && (
              <>
                <Text style={ipStyles.helpHeader}>Pick a date + time when you can visit. Brand will confirm.</Text>
                <DateTimeChipPicker
                  minDate={dateRange?.earliest ? new Date(dateRange.earliest) : null}
                  maxDate={dateRange?.latest ? new Date(dateRange.latest) : null}
                  value={slotDateTime}
                  onChange={setSlotDateTime}
                />
                <Text style={[ipStyles.label, { marginTop: 8 }]}>Notes (optional)</Text>
                <TextInput style={[ipStyles.input, { height: 50 }]} multiline value={slotNotes} onChangeText={setSlotNotes} placeholder="Anything the brand should know…" placeholderTextColor={colors.t3} />
                <TouchableOpacity style={[ipStyles.primaryBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={handleProposeSlot}>
                  <Text style={ipStyles.primaryTxt}>{busy ? 'Sending…' : 'Send my slot'}</Text>
                </TouchableOpacity>
                {!flipPending && (
                  <TouchableOpacity style={ipStyles.linkBtn} disabled={busy} onPress={handleFlipToRemote}>
                    <Text style={ipStyles.linkBtnTxt}>Can't visit? Switch to remote</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* STATE 3: BRAND proposed/countered a slot — accept or counter */}
            {hasLocation && hasSlot && proposedByBrand && event.status === 'proposed' && (
              <>
                <View style={ipStyles.slotCard}>
                  <Text style={ipStyles.slotLabel}>Brand suggests</Text>
                  <Text style={ipStyles.slotTime}>
                    {new Date(event.visit_scheduled_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {event.visit_window_minutes && (
                    <Text style={ipStyles.smallNote}>{event.visit_window_minutes} min slot</Text>
                  )}
                </View>
                {!slotFormOpen ? (
                  <>
                    <TouchableOpacity style={[ipStyles.primaryBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={handleAccept}>
                      <Text style={ipStyles.primaryTxt}>Accept slot</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[ipStyles.altBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={() => setSlotFormOpen(true)}>
                      <Text style={ipStyles.altTxt}>Suggest a different time</Text>
                    </TouchableOpacity>
                    {!flipPending && (
                      <TouchableOpacity style={ipStyles.linkBtn} disabled={busy} onPress={handleFlipToRemote}>
                        <Text style={ipStyles.linkBtnTxt}>Switch to remote</Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <>
                    <DateTimeChipPicker
                      minDate={dateRange?.earliest ? new Date(dateRange.earliest) : null}
                      maxDate={dateRange?.latest ? new Date(dateRange.latest) : null}
                      value={slotDateTime}
                      onChange={setSlotDateTime}
                    />
                    <TouchableOpacity style={[ipStyles.primaryBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={handleCounterSlot}>
                      <Text style={ipStyles.primaryTxt}>{busy ? 'Sending…' : 'Send counter'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={ipStyles.linkBtn} disabled={busy} onPress={() => setSlotFormOpen(false)}>
                      <Text style={ipStyles.linkBtnTxt}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                )}
                {event.reschedule_count_influencer > 0 && (
                  <Text style={ipStyles.smallNote}>You've used {event.reschedule_count_influencer} of 2 reschedules.</Text>
                )}
              </>
            )}

            {/* STATE 4: SELF proposed — waiting on brand */}
            {hasLocation && hasSlot && proposedByInfluencer && event.status === 'proposed' && (
              <>
                <View style={ipStyles.slotCard}>
                  <Text style={ipStyles.slotLabel}>Your proposed slot</Text>
                  <Text style={ipStyles.slotTime}>
                    {new Date(event.visit_scheduled_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {event.visit_window_minutes && (
                    <Text style={ipStyles.smallNote}>{event.visit_window_minutes} min slot</Text>
                  )}
                </View>
                <Text style={ipStyles.note}>Waiting for brand to accept or counter your slot.</Text>
              </>
            )}

            {/* STATE 5: confirmed — mark visit done */}
            {isConfirmed && (
              <>
                <View style={ipStyles.slotCard}>
                  <Text style={ipStyles.slotLabel}>✓ Confirmed</Text>
                  <Text style={ipStyles.slotTime}>
                    {new Date(event.visit_scheduled_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <TouchableOpacity style={[ipStyles.primaryBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={handleMarkVisitDone}>
                  <Text style={ipStyles.primaryTxt}>Visit done — mark complete</Text>
                </TouchableOpacity>
              </>
            )}

            {/* STATE 6: completed */}
            {isCompleted && (
              <Text style={ipStyles.completeTxt}>✓ Visit complete — start creating your content.</Text>
            )}

            {/* Self-initiated flip request — info note */}
            {flipPending && flipByMe && !isCompleted && (
              <Text style={ipStyles.smallNote}>You requested a switch to remote. Waiting for brand to confirm.</Text>
            )}
          </>
        );
      })()}

      {ship && (
        <>
          <View style={ipStyles.detailBox}>
            <Text style={ipStyles.label}>Shipping to</Text>
            <Text style={ipStyles.value}>
              {[event.shipment_to_address_line, event.shipment_to_city, event.shipment_to_state, event.shipment_to_pincode].filter(Boolean).join(', ') || '— address pending —'}
            </Text>
          </View>

          {event.status === 'proposed' && (
            <>
              <Text style={ipStyles.note}>The brand will ship to this address. Confirm or send a different one.</Text>
              <View style={ipStyles.actionRow}>
                <TouchableOpacity style={[ipStyles.primaryBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={handleAccept}>
                  <Text style={ipStyles.primaryTxt}>Confirm address</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[ipStyles.altBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={() => setCounterOpen(o => !o)}>
                  <Text style={ipStyles.altTxt}>{counterOpen ? 'Cancel' : 'Use a different address'}</Text>
                </TouchableOpacity>
              </View>
              {counterOpen && (
                <View style={ipStyles.counterBox}>
                  <Text style={ipStyles.label}>New address</Text>
                  <TextInput style={[ipStyles.input, { height: 80 }]} multiline value={counterAddress} onChangeText={setCounterAddress} placeholder="Full shipping address with city + pincode" placeholderTextColor={colors.t3} />
                  <Text style={ipStyles.label}>Notes (optional)</Text>
                  <TextInput style={ipStyles.input} value={counterNotes} onChangeText={setCounterNotes} placeholder="Why you need a different address" placeholderTextColor={colors.t3} />
                  <TouchableOpacity style={[ipStyles.primaryBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={handleCounter}>
                    <Text style={ipStyles.primaryTxt}>Send new address</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
          {event.status === 'confirmed' && (
            <Text style={ipStyles.note}>Address confirmed. Brand will dispatch your package shortly.</Text>
          )}
          {event.status === 'in_progress' && (
            <>
              <View style={ipStyles.detailBox}>
                <Text style={ipStyles.label}>Courier</Text>
                <Text style={ipStyles.value}>{event.shipment_courier || '—'}</Text>
                <Text style={[ipStyles.label, { marginTop: 6 }]}>Tracking</Text>
                <Text style={ipStyles.value}>{event.shipment_awb || '—'}</Text>
                {event.shipment_expected_at && (
                  <>
                    <Text style={[ipStyles.label, { marginTop: 6 }]}>Expected</Text>
                    <Text style={ipStyles.value}>{new Date(event.shipment_expected_at).toLocaleDateString('en-IN')}</Text>
                  </>
                )}
              </View>
              <TouchableOpacity style={[ipStyles.primaryBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={handleConfirmReceived}>
                <Text style={ipStyles.primaryTxt}>Package received — confirm</Text>
              </TouchableOpacity>
            </>
          )}
          {event.status === 'completed' && (
            <Text style={ipStyles.completeTxt}>✓ Package received — go ahead and create content.</Text>
          )}
        </>
      )}

      {/* History strip */}
      {log.length > 0 && (
        <View style={ipStyles.logBox}>
          <Text style={ipStyles.logTitle}>History</Text>
          {log.slice(-5).reverse().map(l => (
            <Text key={l.id} style={ipStyles.logRow}>
              <Text style={ipStyles.logTime}>{new Date(l.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
              {' · '}
              <Text style={ipStyles.logActor}>{l.actor_role}</Text>
              {' · '}
              {(l.action || '').replace(/_/g, ' ')}{l.notes ? ` — ${l.notes}` : ''}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const ipStyles = StyleSheet.create({
  loading:      { padding: 24, alignItems: 'center' },
  panel:        { marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: colors.navyPale, borderWidth: 1, borderColor: colors.border },
  head:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title:        { fontSize: 14, fontWeight: '800', color: colors.t1 },
  pill:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pillTxt:      { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },

  remoteBox:    { marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  remoteTitle:  { fontSize: 13, fontWeight: '800', color: colors.t1, marginBottom: 4 },
  remoteBody:   { fontSize: 11, color: colors.t3, textAlign: 'center', lineHeight: 16 },

  detailBox:    { padding: 10, backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  label:        { fontSize: 9, fontWeight: '800', color: colors.t3, textTransform: 'uppercase', marginBottom: 2 },
  value:        { fontSize: 12, color: colors.t1 },
  note:         { fontSize: 11, color: colors.t3, marginVertical: 6, lineHeight: 16 },
  smallNote:    { fontSize: 10, color: colors.t3, marginTop: 6, textAlign: 'center' },

  actionRow:    { flexDirection: 'row', gap: 8, marginTop: 8 },
  primaryBtn:   { flex: 1, paddingVertical: 11, backgroundColor: colors.navy, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  primaryTxt:   { color: colors.white, fontSize: 12, fontWeight: '800' },
  altBtn:       { flex: 1, paddingVertical: 11, backgroundColor: colors.surface2, borderRadius: 10, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: colors.border },
  altTxt:       { color: colors.t2, fontSize: 12, fontWeight: '800' },

  counterBox:   { marginTop: 10, padding: 10, backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  input:        { backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 12, color: colors.t1, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  row2:         { flexDirection: 'row', gap: 8 },
  helpHeader:   { fontSize: 11, color: colors.t3, marginBottom: 6, lineHeight: 16 },
  dateHint:     { fontSize: 10, color: colors.orange, marginTop: 2, marginBottom: 4, textAlign: 'center', fontWeight: '700' },

  slotCard:     { padding: 12, backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.teal, marginVertical: 4 },
  slotLabel:    { fontSize: 10, fontWeight: '800', color: colors.t3, textTransform: 'uppercase', marginBottom: 4 },
  slotTime:     { fontSize: 15, fontWeight: '800', color: colors.t1, marginBottom: 4 },

  linkBtn:      { marginTop: 8, paddingVertical: 8, alignItems: 'center' },
  linkBtnTxt:   { color: colors.t3, fontSize: 11, fontWeight: '600', textDecorationLine: 'underline' },

  flipBanner:   { backgroundColor: colors.orange + '20', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: colors.orange },
  flipBannerTxt:{ fontSize: 11, color: colors.t1, lineHeight: 15, marginBottom: 8 },
  flipConfirmBtn:{ alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.orange, borderRadius: 8 },
  flipConfirmBtnTxt: { color: colors.white, fontSize: 11, fontWeight: '800' },

  completeTxt:  { fontSize: 12, color: colors.tealDeep, fontWeight: '700', marginTop: 8, textAlign: 'center' },

  logBox:       { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  logTitle:     { fontSize: 10, fontWeight: '800', color: colors.t3, textTransform: 'uppercase', marginBottom: 4 },
  logRow:       { fontSize: 10, color: colors.t2, marginBottom: 2 },
  logTime:      { color: colors.t3 },
  logActor:     { color: colors.t2, fontWeight: '700' },
});

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

  // Draft banner — shown while brand is still preparing the contract
  draftBanner: {
    margin: 16,
    marginBottom: 0,
    padding: 14,
    backgroundColor: '#FFF4D6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0D987',
  },
  draftBannerTitle: { fontSize: 13, fontWeight: '700', color: '#7A5A00', marginBottom: 4 },
  draftBannerBody:  { fontSize: 12, color: '#6B5200', lineHeight: 18 },

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

  // Sign Modal — bottom-sheet-style card to keep input out of the
  // ScrollView's resize-on-keyboard race.
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface || '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 32,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.t1,
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 12,
    color: colors.t3,
    lineHeight: 18,
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.surface2 || '#F2F4F9',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.t2,
  },
  modalSignBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.navy,
    alignItems: 'center',
  },
});
