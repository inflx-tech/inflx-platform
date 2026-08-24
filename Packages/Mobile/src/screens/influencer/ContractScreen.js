import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { brandPalette as P, fonts, fmtRupees } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import DateTimeChipPicker from '../../components/DateTimeChipPicker';
import StatusPill from '../../components/brand/StatusPill';

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
    case 'draft':              return 'BRAND REVIEWING';
    case 'pending_influencer': return 'AWAITING YOUR SIGNATURE';
    case 'pending_brand':      return 'AWAITING BRAND SIGNATURE';
    case 'active':             return 'CONTRACT ACTIVE';
    case 'completed':          return 'COMPLETED';
    case 'cancelled':          return 'CANCELLED';
    default:                   return (status || '').replace(/_/g, ' ').toUpperCase();
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

/**
 * ContractScreen — influencer-side contract signing + production coordination.
 *
 * Flow 37 restyle (2026-05-28) — bucket FINALE: brandPalette + Outfit/PJS/Mono
 * fonts + StatusPill canonical migration on contract / deliverable / production
 * event statuses (11 total, all in 43-entry map).
 *
 * Preserved verbatim: 6 contract states + 3 production modes + 5 event statuses
 * + 7 visit sub-states + 4 shipment sub-states + Sign Modal MIUI keyboard fix
 * + 2-party flip-to-remote state machine + goal-aware tranches/commission
 * + custom clauses highlight + bonus + DateTimeChipPicker + log history +
 * 6 Alert 2-confirm flows. All 10 APIs unchanged.
 */
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
  // Signing happens in a Modal — Modals render outside the parent ScrollView
  // so the keyboard show/hide doesn't trigger any re-layout race that yanks
  // focus from the input. Fixes MIUI/Redmi keyboard flicker on Redmi 13C 5G.
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={P.ink} />
        <Text style={styles.loadingText}>Loading contract…</Text>
      </View>
    );
  }

  if (!contract) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Contract not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackBtn}>
          <Text style={styles.goBackBtnText}>GO BACK</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const influencerHasSigned = !!contract.influencer_signed_at;
  const brandHasSigned = !!contract.brand_signed_at;
  const fullyActive = contract.status === 'active' || (influencerHasSigned && brandHasSigned);
  const needsInfluencerSignature = contract.status === 'pending_influencer' && !influencerHasSigned;

  const baseFee = parseFloat(contract.influencer_fee || contract.agreed_fee || 0);
  const bonus   = parseFloat(contract.bonus_amount || 0);
  const fee     = baseFee + bonus;
  const t1Pct = 25;
  const t2Pct = 25;
  const t3Pct = 50;

  const goalLc       = (contract.goal || 'engagement').toLowerCase();
  const isConversion = goalLc === 'conversion';
  const commissionPct = parseFloat(contract.commission_pct || 0);
  const showTranches = fee > 0 && !isConversion;
  const showCommissionCard = commissionPct > 0 || isConversion;

  return (
    <View style={styles.outer}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <Icon name="chevron-left" size={14} color={P.muted2} />
          <Text style={styles.backText}>BACK</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Contract</Text>
            <Text style={styles.sub}>{(contract.campaign_name || 'Campaign').toUpperCase()}</Text>
          </View>
          <View style={{ alignSelf: 'flex-start', marginTop: 4 }}>
            <StatusPill status={contract.status} />
          </View>
        </View>
      </View>

      {/* ── Contract Active Banner ──────────────────────────────────────── */}
      {fullyActive && (
        <View style={styles.activeBanner}>
          <Text style={styles.activeBannerText}>CONTRACT ACTIVE · BOTH PARTIES HAVE SIGNED</Text>
        </View>
      )}

      {/* ── Just-signed success banner ──────────────────────────────────── */}
      {signed && !fullyActive && (
        <View style={styles.successBanner}>
          <Text style={styles.successBannerText}>CONTRACT SIGNED · WAITING FOR BRAND TO COUNTERSIGN</Text>
        </View>
      )}

      {/* ── HIGHLIGHT: Special clauses + bonus the brand attached ───────── */}
      {(() => {
        let cc = contract.custom_clauses;
        if (typeof cc === 'string') { try { cc = JSON.parse(cc); } catch { cc = null; } }
        const enabledIds = cc ? Object.keys(cc.clauses || {}).filter(k => cc.clauses[k]?.enabled) : [];
        const hasNotes = cc?.notes;
        const bonusVal = parseFloat(contract.bonus_amount || 0);
        if (enabledIds.length === 0 && !hasNotes && bonusVal <= 0) return null;
        return (
          <View style={styles.clauseHighlightBox}>
            <Text style={styles.clauseHighlightTitle}>IMPORTANT TERMS ATTACHED</Text>
            {bonusVal > 0 && (
              <Text style={styles.clauseHighlightItem}>
                · <Text style={{ fontWeight: '900', fontFamily: fonts.displayBlack }}>+ ₹{bonusVal.toLocaleString('en-IN')} bonus</Text> on top of agreed fee
              </Text>
            )}
            {enabledIds.map(id => (
              <View key={id} style={{ marginTop: 6 }}>
                <Text style={styles.clauseHighlightItem}>
                  · <Text style={{ fontWeight: '900', fontFamily: fonts.displayBlack }}>{CLAUSE_LABELS[id] || id}</Text>
                  {cc.clauses[id].value ? ` (${cc.clauses[id].value} days)` : ''}
                </Text>
                <Text style={styles.clauseHighlightDesc}>
                  {CLAUSE_DESCS[id] ? CLAUSE_DESCS[id](cc.clauses[id].value) : ''}
                </Text>
              </View>
            ))}
            {hasNotes && (
              <View style={{ marginTop: 6 }}>
                <Text style={styles.clauseHighlightItem}>· <Text style={{ fontWeight: '900', fontFamily: fonts.displayBlack }}>Additional Notes</Text></Text>
                <Text style={styles.clauseHighlightDesc}>{cc.notes}</Text>
              </View>
            )}
          </View>
        );
      })()}

      {/* ── View PDF button ─────────────────────────────────────────────── */}
      {contract.status !== 'draft' && contract.pdf_url && (
        <TouchableOpacity
          style={styles.pdfBtn}
          onPress={() => navigation.navigate('ContractPdf', { contractId: contract.id })}
        >
          <Text style={styles.pdfBtnText}>VIEW CONTRACT PDF</Text>
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
        keyboardShouldPersistTaps="always"
      >
        {/* Campaign & Brand Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Campaign Details</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>CAMPAIGN</Text>
              <Text style={styles.infoValue}>{contract.campaign_name || '--'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>BRAND</Text>
              <Text style={styles.infoValue}>{contract.brand_name || '--'}</Text>
            </View>
          </View>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>STATUS</Text>
              <Text style={styles.infoValue}>{contractStatusLabel(contract.status)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>POSTING DATE</Text>
              <Text style={styles.infoValue}>{formatDate(contract.posting_date).toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* Agreed Fee */}
        {fee > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Agreed Fee</Text>
            <View style={styles.feeHighlight}>
              <Text style={styles.feeLabel}>TOTAL INFLUENCER FEE</Text>
              <Text style={styles.feeValue}>{fmtRupees(fee)}</Text>
            </View>
          </View>
        )}

        {/* Deliverables — live OR formats_json fallback */}
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
                      DEADLINE: {formatDate(d.submission_deadline).toUpperCase()}
                    </Text>
                  )}
                </View>
                <StatusPill status={d.status} />
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

        {/* Production Arrangement */}
        {contract.status !== 'draft' && (() => {
          const mode = contract.production_mode || 'remote';
          const pe = productionEvent || {};
          if (mode === 'remote') {
            return (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Production Arrangement</Text>
                <View style={styles.briefBox}>
                  <Text style={[styles.briefText, { fontWeight: '800', marginBottom: 4 }]}>💻 Remote</Text>
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
                <View style={styles.briefBox}>
                  <Text style={[styles.briefText, { fontWeight: '800', marginBottom: 4 }]}>🏬 Visit Brand Location</Text>
                  <Text style={styles.briefText}>
                    You'll visit the brand's premises to shoot the content.
                  </Text>
                  <View style={{ height: 8 }} />
                  <Text style={styles.infoLabel}>ADDRESS</Text>
                  <Text style={styles.infoValue}>{addr || 'To be confirmed by brand after both parties sign.'}</Text>
                  {pe.visit_scheduled_at && (
                    <>
                      <View style={{ height: 6 }} />
                      <Text style={styles.infoLabel}>SCHEDULED</Text>
                      <Text style={styles.infoValue}>
                        {formatDateTime(pe.visit_scheduled_at)}
                        {pe.visit_window_minutes ? ` · ${pe.visit_window_minutes} min window` : ''}
                      </Text>
                    </>
                  )}
                  {(pe.visit_contact_name || pe.visit_contact_phone) && (
                    <>
                      <View style={{ height: 6 }} />
                      <Text style={styles.infoLabel}>CONTACT</Text>
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
              <View style={styles.briefBox}>
                <Text style={[styles.briefText, { fontWeight: '800', marginBottom: 4 }]}>📦 Product Shipment</Text>
                <Text style={styles.briefText}>
                  The brand will ship product samples to you for content creation.
                </Text>
                <View style={{ height: 8 }} />
                <Text style={styles.infoLabel}>SHIPPING TO</Text>
                <Text style={styles.infoValue}>{shipAddr || 'Your registered address. Confirm or update after signing.'}</Text>
                {(pe.shipment_courier || pe.shipment_awb) && (
                  <>
                    <View style={{ height: 6 }} />
                    <Text style={styles.infoLabel}>TRACKING</Text>
                    <Text style={styles.infoValue}>
                      {[pe.shipment_courier, pe.shipment_awb].filter(Boolean).join(' · ')}
                    </Text>
                  </>
                )}
                {pe.shipment_dispatched_at && (
                  <>
                    <View style={{ height: 6 }} />
                    <Text style={styles.infoLabel}>DISPATCHED</Text>
                    <Text style={styles.infoValue}>{formatDate(pe.shipment_dispatched_at).toUpperCase()}</Text>
                  </>
                )}
              </View>
            </View>
          );
        })()}

        {/* Payment Terms / Tranche Schedule */}
        {showTranches && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Payment Terms</Text>
            <Text style={styles.paymentNote}>
              Your fee is paid in 3 tranches. You receive the full agreed amount.
            </Text>

            <View style={styles.trancheRow}>
              <View style={[styles.trancheDot, { backgroundColor: P.success }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.trancheTitle}>Tranche 1 ({t1Pct}%)</Text>
                <Text style={styles.trancheDesc}>Released when both parties sign the contract</Text>
              </View>
              <Text style={styles.trancheAmount}>{fmtRupees(Math.round(fee * t1Pct / 100))}</Text>
            </View>

            <View style={styles.trancheRow}>
              <View style={[styles.trancheDot, { backgroundColor: P.warn }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.trancheTitle}>Tranche 2 ({t2Pct}%)</Text>
                <Text style={styles.trancheDesc}>Released when content goes live</Text>
              </View>
              <Text style={styles.trancheAmount}>{fmtRupees(Math.round(fee * t2Pct / 100))}</Text>
            </View>

            <View style={styles.trancheRow}>
              <View style={[styles.trancheDot, { backgroundColor: P.ink }]} />
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
                <Text style={{ fontWeight: '800' }}>Note: </Text>
                10% TDS is deducted at the time of withdrawal, not at earning.
              </Text>
            </View>
          </View>
        )}

        {/* Commission Schedule */}
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
                  <Text style={styles.infoLabel}>COMMISSION RATE</Text>
                  <Text style={[styles.infoValue, { color: P.successText, fontWeight: '900', fontFamily: fonts.monoBold }]}>{commissionPct}%</Text>
                </View>
                {contract.offer_type && (
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>OFFER TYPE</Text>
                    <Text style={styles.infoValue}>{String(contract.offer_type).replace(/_/g, ' ').toUpperCase()}</Text>
                  </View>
                )}
              </View>
              {(offerValueLabel || contract.coupon_code) && (
                <View style={styles.infoGrid}>
                  {offerValueLabel && (
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>OFFER VALUE</Text>
                      <Text style={styles.infoValue}>{offerValueLabel}</Text>
                    </View>
                  )}
                  {contract.coupon_code && (
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>YOUR COUPON</Text>
                      <Text style={[styles.infoValue, { fontFamily: fonts.monoBold }]}>{contract.coupon_code}</Text>
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

        {/* Content Guidelines */}
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
              <Text style={styles.sigLabel}>INFLUENCER</Text>
              {influencerHasSigned ? (
                <>
                  <Text style={styles.sigCheck}>SIGNED</Text>
                  <Text style={styles.sigName}>{contract.influencer_signed_name || contract.influencer_name}</Text>
                  <Text style={styles.sigDate}>{formatDateTime(contract.influencer_signed_at)}</Text>
                </>
              ) : (
                <Text style={styles.sigPending}>Not yet signed</Text>
              )}
            </View>

            <View style={[styles.sigBox, brandHasSigned && styles.sigBoxSigned]}>
              <Text style={styles.sigLabel}>BRAND</Text>
              {brandHasSigned ? (
                <>
                  <Text style={styles.sigCheck}>SIGNED</Text>
                  <Text style={styles.sigName}>{contract.brand_signed_by || 'Brand Representative'}</Text>
                  <Text style={styles.sigDate}>{formatDateTime(contract.brand_signed_at)}</Text>
                </>
              ) : (
                <Text style={styles.sigPending}>Awaiting brand</Text>
              )}
            </View>
          </View>
        </View>

        {/* Sign CTA card */}
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
                <ActivityIndicator color={P.white} />
              ) : (
                <Text style={styles.signBtnText}>SIGN CONTRACT</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Post-sign success state */}
        {signed && !fullyActive && (
          <View style={styles.card}>
            <View style={styles.successState}>
              <Text style={styles.successCheck}>SIGNED</Text>
              <Text style={styles.successTitle}>Contract Signed Successfully</Text>
              <Text style={styles.successDesc}>
                {isConversion
                  ? 'The brand will be notified to countersign. Once both parties have signed, your tracking link goes live and you start earning commission on confirmed conversions.'
                  : 'The brand will be notified to countersign. Once both parties have signed, Tranche 1 will be released automatically.'}
              </Text>
            </View>
          </View>
        )}

        {/* Production coordination (visible after activation) */}
        {fullyActive && <InfluencerProductionPanel contractId={contract.id} />}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Sign Modal ──────────────────────────────────────────────────── */}
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
                placeholderTextColor={P.muted3}
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
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSignBtn, (signing || !typedName.trim()) && styles.signBtnDisabled]}
                onPress={() => {
                  if (typedName.trim()) handleSign();
                }}
                disabled={signing || !typedName.trim()}
              >
                {signing ? (
                  <ActivityIndicator color={P.white} />
                ) : (
                  <Text style={styles.signBtnText}>SIGN NOW</Text>
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

  const [slotDateTime, setSlotDateTime] = useState(null);
  const [slotWindow, setSlotWindow] = useState(60);
  const [slotNotes, setSlotNotes] = useState('');
  const [slotFormOpen, setSlotFormOpen] = useState(false);

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

  async function handleAccept() {
    if (!event) return;
    setBusy(true);
    const res = await influencerApi.acceptProduction(event.id);
    setBusy(false);
    if (res.success) load();
    else Alert.alert('Failed', res.error?.message || 'Could not accept');
  }

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

  if (loading) return <View style={ipStyles.loading}><ActivityIndicator color={P.ink} /></View>;
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

  const visit = event.mode === 'visit';
  const ship  = event.mode === 'shipment';

  return (
    <View style={ipStyles.panel}>
      <View style={ipStyles.head}>
        <Text style={ipStyles.title}>{visit ? '🏬 Visit Coordination' : '📦 Product Shipment'}</Text>
        <StatusPill status={event.status} />
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
            {flipPending && !flipByMe && !isCompleted && (
              <View style={ipStyles.flipBanner}>
                <Text style={ipStyles.flipBannerTxt}>
                  Brand wants to switch this to remote — no in-person shoot, you create content from the brief alone. Confirm?
                </Text>
                <TouchableOpacity style={ipStyles.flipConfirmBtn} disabled={busy} onPress={handleFlipToRemote}>
                  <Text style={ipStyles.flipConfirmBtnTxt}>CONFIRM FLIP</Text>
                </TouchableOpacity>
              </View>
            )}

            {hasLocation && (
              <View style={ipStyles.detailBox}>
                <Text style={ipStyles.label}>VISIT LOCATION</Text>
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
                    <Text style={[ipStyles.label, { marginTop: 8 }]}>CONTACT</Text>
                    <Text style={ipStyles.value}>
                      {event.visit_contact_name || ''}{event.visit_contact_phone ? ` · ${event.visit_contact_phone}` : ''}
                    </Text>
                  </>
                )}
              </View>
            )}

            {!hasLocation && !isCompleted && (
              <Text style={ipStyles.note}>
                The brand will send you their visit location shortly. You'll get a notification when they do.
              </Text>
            )}

            {hasLocation && !hasSlot && !isCompleted && (
              <>
                <Text style={ipStyles.helpHeader}>Pick a date + time when you can visit. Brand will confirm.</Text>
                <DateTimeChipPicker
                  minDate={dateRange?.earliest ? new Date(dateRange.earliest) : null}
                  maxDate={dateRange?.latest ? new Date(dateRange.latest) : null}
                  value={slotDateTime}
                  onChange={setSlotDateTime}
                />
                <Text style={[ipStyles.label, { marginTop: 8 }]}>NOTES (OPTIONAL)</Text>
                <TextInput style={[ipStyles.input, { height: 50 }]} multiline value={slotNotes} onChangeText={setSlotNotes} placeholder="Anything the brand should know…" placeholderTextColor={P.muted3} />
                <TouchableOpacity style={[ipStyles.primaryBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={handleProposeSlot}>
                  <Text style={ipStyles.primaryTxt}>{busy ? 'SENDING…' : 'SEND MY SLOT'}</Text>
                </TouchableOpacity>
                {!flipPending && (
                  <TouchableOpacity style={ipStyles.linkBtn} disabled={busy} onPress={handleFlipToRemote}>
                    <Text style={ipStyles.linkBtnTxt}>Can't visit? Switch to remote</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {hasLocation && hasSlot && proposedByBrand && event.status === 'proposed' && (
              <>
                <View style={ipStyles.slotCard}>
                  <Text style={ipStyles.slotLabel}>BRAND SUGGESTS</Text>
                  <Text style={ipStyles.slotTime}>
                    {formatDateTime(event.visit_scheduled_at)}
                  </Text>
                  {event.visit_window_minutes && (
                    <Text style={ipStyles.smallNote}>{event.visit_window_minutes} min slot</Text>
                  )}
                </View>
                {!slotFormOpen ? (
                  <>
                    <TouchableOpacity style={[ipStyles.primaryBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={handleAccept}>
                      <Text style={ipStyles.primaryTxt}>ACCEPT SLOT</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[ipStyles.altBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={() => setSlotFormOpen(true)}>
                      <Text style={ipStyles.altTxt}>SUGGEST A DIFFERENT TIME</Text>
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
                      <Text style={ipStyles.primaryTxt}>{busy ? 'SENDING…' : 'SEND COUNTER'}</Text>
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

            {hasLocation && hasSlot && proposedByInfluencer && event.status === 'proposed' && (
              <>
                <View style={ipStyles.slotCard}>
                  <Text style={ipStyles.slotLabel}>YOUR PROPOSED SLOT</Text>
                  <Text style={ipStyles.slotTime}>
                    {formatDateTime(event.visit_scheduled_at)}
                  </Text>
                  {event.visit_window_minutes && (
                    <Text style={ipStyles.smallNote}>{event.visit_window_minutes} min slot</Text>
                  )}
                </View>
                <Text style={ipStyles.note}>Waiting for brand to accept or counter your slot.</Text>
              </>
            )}

            {isConfirmed && (
              <>
                <View style={ipStyles.slotCard}>
                  <Text style={ipStyles.slotLabel}>CONFIRMED</Text>
                  <Text style={ipStyles.slotTime}>
                    {formatDateTime(event.visit_scheduled_at)}
                  </Text>
                </View>
                <TouchableOpacity style={[ipStyles.primaryBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={handleMarkVisitDone}>
                  <Text style={ipStyles.primaryTxt}>VISIT DONE — MARK COMPLETE</Text>
                </TouchableOpacity>
              </>
            )}

            {isCompleted && (
              <Text style={ipStyles.completeTxt}>Visit complete — start creating your content.</Text>
            )}

            {flipPending && flipByMe && !isCompleted && (
              <Text style={ipStyles.smallNote}>You requested a switch to remote. Waiting for brand to confirm.</Text>
            )}
          </>
        );
      })()}

      {ship && (
        <>
          <View style={ipStyles.detailBox}>
            <Text style={ipStyles.label}>SHIPPING TO</Text>
            <Text style={ipStyles.value}>
              {[event.shipment_to_address_line, event.shipment_to_city, event.shipment_to_state, event.shipment_to_pincode].filter(Boolean).join(', ') || '— address pending —'}
            </Text>
          </View>

          {event.status === 'proposed' && (
            <>
              <Text style={ipStyles.note}>The brand will ship to this address. Confirm or send a different one.</Text>
              <View style={ipStyles.actionRow}>
                <TouchableOpacity style={[ipStyles.primaryBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={handleAccept}>
                  <Text style={ipStyles.primaryTxt}>CONFIRM ADDRESS</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[ipStyles.altBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={() => setCounterOpen(o => !o)}>
                  <Text style={ipStyles.altTxt}>{counterOpen ? 'CANCEL' : 'USE DIFFERENT ADDRESS'}</Text>
                </TouchableOpacity>
              </View>
              {counterOpen && (
                <View style={ipStyles.counterBox}>
                  <Text style={ipStyles.label}>NEW ADDRESS</Text>
                  <TextInput style={[ipStyles.input, { height: 80 }]} multiline value={counterAddress} onChangeText={setCounterAddress} placeholder="Full shipping address with city + pincode" placeholderTextColor={P.muted3} />
                  <Text style={ipStyles.label}>NOTES (OPTIONAL)</Text>
                  <TextInput style={ipStyles.input} value={counterNotes} onChangeText={setCounterNotes} placeholder="Why you need a different address" placeholderTextColor={P.muted3} />
                  <TouchableOpacity style={[ipStyles.primaryBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={handleCounterShipment}>
                    <Text style={ipStyles.primaryTxt}>SEND NEW ADDRESS</Text>
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
                <Text style={ipStyles.label}>COURIER</Text>
                <Text style={ipStyles.value}>{event.shipment_courier || '—'}</Text>
                <Text style={[ipStyles.label, { marginTop: 6 }]}>TRACKING</Text>
                <Text style={ipStyles.value}>{event.shipment_awb || '—'}</Text>
                {event.shipment_expected_at && (
                  <>
                    <Text style={[ipStyles.label, { marginTop: 6 }]}>EXPECTED</Text>
                    <Text style={ipStyles.value}>{formatDate(event.shipment_expected_at).toUpperCase()}</Text>
                  </>
                )}
              </View>
              <TouchableOpacity style={[ipStyles.primaryBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={handleConfirmReceived}>
                <Text style={ipStyles.primaryTxt}>PACKAGE RECEIVED — CONFIRM</Text>
              </TouchableOpacity>
            </>
          )}
          {event.status === 'completed' && (
            <Text style={ipStyles.completeTxt}>Package received — go ahead and create content.</Text>
          )}
        </>
      )}

      {/* History strip */}
      {log.length > 0 && (
        <View style={ipStyles.logBox}>
          <Text style={ipStyles.logTitle}>HISTORY</Text>
          {log.slice(-5).reverse().map(l => (
            <Text key={l.id} style={ipStyles.logRow}>
              <Text style={ipStyles.logTime}>{new Date(l.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).toUpperCase()}</Text>
              {' · '}
              <Text style={ipStyles.logActor}>{(l.actor_role || '').toUpperCase()}</Text>
              {' · '}
              {(l.action || '').replace(/_/g, ' ')}{l.notes ? ` — ${l.notes}` : ''}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const ipStyles = StyleSheet.create({
  loading:      { padding: 24, alignItems: 'center' },
  panel:        { marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: P.bg2, borderWidth: 1, borderColor: P.border },
  head:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title:        { fontSize: 14, fontWeight: '900', color: P.ink, fontFamily: fonts.displayBlack },

  remoteBox:    { marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: P.bg2, borderWidth: 1, borderColor: P.border, alignItems: 'center' },
  remoteTitle:  { fontSize: 13, fontWeight: '800', color: P.ink, marginBottom: 4, fontFamily: fonts.displayBold },
  remoteBody:   { fontSize: 11, color: P.muted2, textAlign: 'center', lineHeight: 16, fontFamily: fonts.sansRegular },

  detailBox:    { padding: 11, backgroundColor: P.white, borderRadius: 10, borderWidth: 1, borderColor: P.border, marginBottom: 8 },
  label:        { fontSize: 9.5, fontWeight: '800', color: P.muted2, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2, fontFamily: fonts.monoBold },
  value:        { fontSize: 12, color: P.ink, fontFamily: fonts.sansRegular, fontWeight: '600' },
  note:         { fontSize: 11, color: P.muted, marginVertical: 6, lineHeight: 16, fontFamily: fonts.sansRegular },
  smallNote:    { fontSize: 10, color: P.muted2, marginTop: 6, textAlign: 'center', fontFamily: fonts.sansRegular },

  actionRow:    { flexDirection: 'row', gap: 8, marginTop: 8 },
  primaryBtn:   { flex: 1, paddingVertical: 12, backgroundColor: P.ink, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  primaryTxt:   { color: P.white, fontSize: 12, fontWeight: '900', letterSpacing: 0.3, textTransform: 'uppercase', fontFamily: fonts.displayBlack },
  altBtn:       { flex: 1, paddingVertical: 12, backgroundColor: P.white, borderRadius: 10, alignItems: 'center', marginTop: 8, borderWidth: 1.5, borderColor: P.ink },
  altTxt:       { color: P.ink, fontSize: 12, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase', fontFamily: fonts.displayBold },

  counterBox:   { marginTop: 10, padding: 11, backgroundColor: P.white, borderRadius: 10, borderWidth: 1, borderColor: P.border },
  input:        { backgroundColor: P.white, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 10, fontSize: 12, color: P.ink, marginBottom: 8, borderWidth: 1.5, borderColor: P.ink, fontFamily: fonts.sansRegular },
  helpHeader:   { fontSize: 11, color: P.muted, marginBottom: 6, lineHeight: 16, fontFamily: fonts.sansRegular },

  slotCard:     { padding: 12, backgroundColor: P.white, borderRadius: 10, borderWidth: 1.5, borderColor: P.success, marginVertical: 4 },
  slotLabel:    { fontSize: 9.5, fontWeight: '800', color: P.successText, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4, fontFamily: fonts.monoBold },
  slotTime:     { fontSize: 15, fontWeight: '900', color: P.ink, marginBottom: 4, fontFamily: fonts.monoBold },

  linkBtn:      { marginTop: 8, paddingVertical: 8, alignItems: 'center' },
  linkBtnTxt:   { color: P.muted2, fontSize: 11, fontWeight: '700', textDecorationLine: 'underline', fontFamily: fonts.sansRegular },

  flipBanner:   { backgroundColor: P.warnPale, borderRadius: 10, padding: 11, marginBottom: 10, borderWidth: 1, borderColor: P.warn },
  flipBannerTxt:{ fontSize: 11, color: P.ink, lineHeight: 15, marginBottom: 8, fontFamily: fonts.sansRegular },
  flipConfirmBtn:{ alignSelf: 'flex-start', paddingHorizontal: 13, paddingVertical: 7, backgroundColor: P.ink, borderRadius: 8 },
  flipConfirmBtnTxt: { color: P.white, fontSize: 11, fontWeight: '900', letterSpacing: 0.3, textTransform: 'uppercase', fontFamily: fonts.displayBlack },

  completeTxt:  { fontSize: 12, color: P.successText, fontWeight: '800', marginTop: 8, textAlign: 'center', fontFamily: fonts.displayBold },

  logBox:       { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: P.border },
  logTitle:     { fontSize: 9.5, fontWeight: '800', color: P.muted2, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4, fontFamily: fonts.monoBold },
  logRow:       { fontSize: 10, color: P.muted, marginBottom: 2, fontFamily: fonts.sansRegular },
  logTime:      { color: P.muted2, fontWeight: '700', fontFamily: fonts.monoMedium },
  logActor:     { color: P.ink, fontWeight: '800', fontFamily: fonts.monoBold },
});

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.bg },
  loadingText: { fontSize: 13, color: P.muted2, marginTop: 12, fontFamily: fonts.sansRegular },
  errorText: { fontSize: 14, color: P.muted, marginBottom: 16, fontFamily: fonts.sansRegular },
  goBackBtn: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: P.ink, borderRadius: 12 },
  goBackBtnText: { fontSize: 13, fontWeight: '900', color: P.white, letterSpacing: 0.3, fontFamily: fonts.displayBlack },

  // Header — white surface, ink text
  header: { backgroundColor: P.white, padding: 18, paddingTop: 50, paddingBottom: 22, position: 'relative', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
  backText: { fontSize: 10, color: P.muted2, fontWeight: '800', letterSpacing: 0.3, fontFamily: fonts.monoBold },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 20, fontWeight: '900', color: P.ink, letterSpacing: -0.3, fontFamily: fonts.displayBlack },
  sub: { fontSize: 11, color: P.muted2, marginTop: 4, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },

  // Banners
  activeBanner: { backgroundColor: P.success, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  activeBannerText: { fontSize: 12, fontWeight: '900', color: P.white, letterSpacing: 0.3, fontFamily: fonts.displayBlack },
  successBanner: { backgroundColor: P.successPale, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: P.success },
  successBannerText: { fontSize: 11, fontWeight: '800', color: P.successText, letterSpacing: 0.3, fontFamily: fonts.monoBold },

  // PDF button — ink + white
  pdfBtn: { margin: 16, marginBottom: 0, backgroundColor: P.ink, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  pdfBtnText: { fontSize: 13, fontWeight: '900', color: P.white, letterSpacing: 0.3, textTransform: 'uppercase', fontFamily: fonts.displayBlack },

  // Draft banner — warnPale (state)
  draftBanner: { margin: 16, marginBottom: 0, padding: 14, backgroundColor: P.warnPale, borderRadius: 12, borderWidth: 1, borderColor: P.warn },
  draftBannerTitle: { fontSize: 13, fontWeight: '800', color: P.warnText, marginBottom: 4, fontFamily: fonts.displayBold },
  draftBannerBody: { fontSize: 12, color: P.warnText, lineHeight: 17, fontFamily: fonts.sansRegular },

  // Clause highlight box — warnPale (state)
  clauseHighlightBox: { margin: 16, marginBottom: 0, padding: 14, backgroundColor: P.warnPale, borderRadius: 14, borderWidth: 1, borderColor: P.warn },
  clauseHighlightTitle: { fontSize: 13, fontWeight: '900', color: P.warnText, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: fonts.displayBlack },
  clauseHighlightItem: { fontSize: 12.5, color: P.ink, lineHeight: 17, fontFamily: fonts.sansRegular },
  clauseHighlightDesc: { fontSize: 11, color: P.warnText, lineHeight: 15, marginTop: 2, marginLeft: 12, fontFamily: fonts.sansRegular },

  body: { flex: 1 },

  card: { margin: 16, marginBottom: 0, backgroundColor: P.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: P.border },
  cardTitle: { fontSize: 13.5, fontWeight: '800', color: P.ink, marginBottom: 11, fontFamily: fonts.displayBold },

  infoGrid: { flexDirection: 'row', gap: 14, marginBottom: 11 },
  infoItem: { flex: 1 },
  infoLabel: { fontSize: 9.5, fontWeight: '800', color: P.muted2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4, fontFamily: fonts.monoBold },
  infoValue: { fontSize: 12.5, fontWeight: '700', color: P.ink, lineHeight: 17, fontFamily: fonts.monoMedium },

  // Fee highlight — successPale
  feeHighlight: { backgroundColor: P.successPale, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#A8E6CC' },
  feeLabel: { fontSize: 10, fontWeight: '800', color: P.successText, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, fontFamily: fonts.monoBold },
  feeValue: { fontSize: 28, fontWeight: '900', color: P.successText, fontFamily: fonts.monoBold },

  // Deliverables
  deliverableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: P.borderSoft, gap: 10 },
  deliverableDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: P.ink },
  deliverableType: { fontSize: 12.5, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },
  deliverableDeadline: { fontSize: 10, color: P.muted2, marginTop: 2, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },

  // Tranches
  paymentNote: { fontSize: 11.5, color: P.muted2, marginBottom: 12, lineHeight: 17, fontFamily: fonts.sansRegular },
  trancheRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: P.borderSoft, gap: 10 },
  trancheDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  trancheTitle: { fontSize: 12.5, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },
  trancheDesc: { fontSize: 10.5, color: P.muted2, marginTop: 2, lineHeight: 15, fontFamily: fonts.sansRegular },
  trancheAmount: { fontSize: 13.5, fontWeight: '900', color: P.ink, fontFamily: fonts.monoBold },
  trancheTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 4 },
  trancheTotalLabel: { fontSize: 13, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },
  trancheTotalValue: { fontSize: 18, fontWeight: '900', color: P.successText, fontFamily: fonts.monoBold },
  tdsNote: { backgroundColor: P.warnPale, borderRadius: 8, padding: 10, marginTop: 12, borderWidth: 1, borderColor: P.warn },
  tdsText: { fontSize: 11, color: P.warnText, lineHeight: 15, fontFamily: fonts.sansRegular },

  // Brief / Guidelines
  briefBox: { backgroundColor: P.bg2, borderRadius: 10, padding: 12 },
  briefText: { fontSize: 12.5, color: P.ink, lineHeight: 18, fontFamily: fonts.sansRegular },

  revisionText: { fontSize: 12.5, color: P.ink, lineHeight: 18, fontFamily: fonts.sansRegular },

  // Signatures
  sigSection: { flexDirection: 'row', gap: 11 },
  sigBox: { flex: 1, backgroundColor: P.bg2, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: P.border },
  sigBoxSigned: { borderColor: P.success, backgroundColor: P.successPale },
  sigLabel: { fontSize: 9.5, fontWeight: '800', color: P.muted2, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6, fontFamily: fonts.monoBold },
  sigCheck: { fontSize: 12, fontWeight: '900', color: P.successText, marginBottom: 4, letterSpacing: 0.3, fontFamily: fonts.displayBlack },
  sigName: { fontSize: 12, fontWeight: '700', color: P.ink, fontFamily: fonts.sansRegular },
  sigDate: { fontSize: 9.5, color: P.muted2, marginTop: 2, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },
  sigPending: { fontSize: 11.5, color: P.muted2, fontStyle: 'italic', fontFamily: fonts.sansRegular },

  // Sign section
  signHint: { fontSize: 11.5, color: P.muted, marginBottom: 12, lineHeight: 17, fontFamily: fonts.sansRegular },
  signBtn: { backgroundColor: P.ink, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  signBtnDisabled: { opacity: 0.5 },
  signBtnText: { fontSize: 14, fontWeight: '900', color: P.white, letterSpacing: 0.3, textTransform: 'uppercase', fontFamily: fonts.displayBlack },

  // Success state
  successState: { alignItems: 'center', paddingVertical: 8 },
  successCheck: { fontSize: 16, fontWeight: '900', color: P.successText, marginBottom: 8, letterSpacing: 0.3, fontFamily: fonts.displayBlack },
  successTitle: { fontSize: 16, fontWeight: '900', color: P.ink, marginBottom: 8, fontFamily: fonts.displayBlack },
  successDesc: { fontSize: 12.5, color: P.muted, textAlign: 'center', lineHeight: 18, fontFamily: fonts.sansRegular },

  // Sign Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: P.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 32 },
  modalTitle: { fontSize: 17, fontWeight: '900', color: P.ink, marginBottom: 6, fontFamily: fonts.displayBlack },
  modalSub: { fontSize: 12, color: P.muted, lineHeight: 18, marginBottom: 16, fontFamily: fonts.sansRegular },
  nameInputWrap: { borderWidth: 1.5, borderColor: P.ink, borderRadius: 12, marginBottom: 12 },
  nameInput: { paddingVertical: 12, paddingHorizontal: 14, fontSize: 15, fontWeight: '600', color: P.ink, fontFamily: fonts.sansRegular },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: P.white, borderWidth: 1.5, borderColor: P.ink, alignItems: 'center' },
  modalCancelText: { fontSize: 13, fontWeight: '800', color: P.ink, letterSpacing: 0.3, textTransform: 'uppercase', fontFamily: fonts.displayBold },
  modalSignBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: P.ink, alignItems: 'center' },
});
