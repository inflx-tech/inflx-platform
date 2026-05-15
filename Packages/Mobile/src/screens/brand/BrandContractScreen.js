import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { colors, fmtRupees } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import DateTimeChipPicker from '../../components/DateTimeChipPicker';

function formatDateTime(s) {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const STANDARD_CLAUSES = [
  {
    id: 'commercial_rights',
    label: 'Commercial Usage Rights',
    description: 'Brand may repurpose your content in paid ads / social / offline marketing for the chosen number of days after content goes live.',
    options: [30, 60, 90, 180, 365],
    optionLabel: 'days after live',
  },
  {
    id: 'category_exclusivity',
    label: 'Category Exclusivity',
    description: 'Influencer agrees not to promote a competing brand in the same category for the chosen number of days from contract signing.',
    options: [7, 14, 30],
    optionLabel: 'days from signing',
  },
  {
    id: 'content_ownership',
    label: 'Content Ownership Transfer',
    description: 'Final approved content (raw + edited) becomes the brand\'s property. Influencer retains right to keep it on their own profile.',
    options: [],
  },
];

/**
 * BrandContractScreen
 * Brand-side flow:
 *  - Status 'draft'           → review + edit clauses + bonus, then "Approve & Send"
 *  - Status 'pending_brand'   → influencer already signed, brand counter-signs
 *  - Status 'pending_influencer' → waiting on influencer (read-only here)
 *  - Status 'active'          → fully signed (read-only)
 */
export default function BrandContractScreen({ route, navigation }) {
  const { campaignInfluencerId, influencerName, goal } = route.params || {};

  const [contract, setContract] = useState(null);
  const [deliverables, setDeliverables] = useState([]);
  const [suggestedRequirements, setSuggestedRequirements] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Editable fields (draft + pending_influencer-unsigned)
  const [clauses, setClauses] = useState({});         // { commercial_rights: { enabled, value }, ... }
  const [bonusAmount, setBonusAmount] = useState('');
  const [extraNotes, setExtraNotes] = useState('');
  const [contentReq, setContentReq] = useState('');
  const [productionMode, setProductionMode] = useState('remote');
  // Wallet snapshot — used for the live "can the brand actually pay this
  // contract?" check next to the bonus input. Refreshed at mount.
  const [walletBalance, setWalletBalance] = useState(0);
  const [platformFeePct, setPlatformFeePct] = useState(8);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    // Fetch contract + brand wallet in parallel.
    const [contractRes, brandRes] = await Promise.all([
      brandApi.getContract(campaignInfluencerId),
      brandApi.getMe(),
    ]);
    setLoading(false);
    if (!contractRes.success) {
      Alert.alert('Error', contractRes.error?.message || 'Could not load contract');
      return;
    }
    if (brandRes.success) {
      const b = brandRes.data?.brand || brandRes.data || {};
      setWalletBalance(parseFloat(b.wallet_balance || 0));
      if (b.platform_fee_pct != null) setPlatformFeePct(parseFloat(b.platform_fee_pct));
    }
    const data = contractRes.data || {};
    const c = data.contract || data;
    setContract(c);
    setDeliverables(data.deliverables || []);
    setSuggestedRequirements(data.suggested_content_requirements || '');

    // Hydrate editor from existing custom_clauses if already saved
    const cc = c.custom_clauses;
    if (cc) {
      const parsed = typeof cc === 'string' ? (() => { try { return JSON.parse(cc); } catch { return {}; } })() : cc;
      setClauses(parsed?.clauses || {});
      setExtraNotes(parsed?.notes || '');
    }
    if (c.bonus_amount) setBonusAmount(String(c.bonus_amount));
    if (c.production_mode) setProductionMode(c.production_mode);

    // Prefer saved text; fall back to backend-composed suggestion.
    const savedReq = (c.content_requirements || '').trim();
    setContentReq(savedReq || data.suggested_content_requirements || '');
  }

  function toggleClause(id) {
    setClauses(prev => {
      const cur = prev[id];
      if (cur?.enabled) {
        return { ...prev, [id]: { ...cur, enabled: false } };
      }
      const def = STANDARD_CLAUSES.find(c => c.id === id);
      return { ...prev, [id]: { enabled: true, value: def?.options?.[0] || null } };
    });
  }

  function setClauseValue(id, value) {
    setClauses(prev => ({ ...prev, [id]: { ...(prev[id] || {}), enabled: true, value } }));
  }

  async function handleApproveAndSend() {
    const bonus = parseFloat(bonusAmount) || 0;
    if (bonus < 0) { Alert.alert('Invalid bonus', 'Bonus must be 0 or positive.'); return; }

    const reApprove = contract.status === 'pending_influencer' && !contract.influencer_signed_at;
    Alert.alert(
      reApprove ? 'Update & Re-send' : 'Send to Influencer',
      reApprove
        ? 'The updated terms will be sent to the influencer and they will be notified to re-review before signing.'
        : 'Once sent, the influencer can sign the contract. Confirm details below are final.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: reApprove ? 'Update' : 'Send', onPress: async () => {
          setSubmitting(true);
          const res = await brandApi.approveContract(contract.id, {
            custom_clauses:       { clauses, notes: extraNotes || null },
            bonus_amount:         bonus,
            content_requirements: contentReq || null,
            production_mode:      productionMode,
          });
          setSubmitting(false);
          if (res.success) {
            Alert.alert(
              reApprove ? 'Updated' : 'Sent',
              reApprove
                ? 'Updated terms delivered. Influencer has been notified to re-review.'
                : 'Contract sent to influencer for signing.',
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          } else {
            Alert.alert('Failed', res.error?.message || 'Could not send contract');
          }
        }},
      ]
    );
  }

  async function handleBrandSign() {
    const isConversion = (goal || '').toLowerCase() === 'conversion';
    Alert.alert(
      'Sign Contract',
      isConversion
        ? 'By signing, you commit to commission-only terms. The influencer’s tracking link goes live — they earn commission on confirmed conversions.'
        : 'By signing, you commit to all terms shown above. Tranche 1 will be released to the influencer.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign', onPress: async () => {
          setSubmitting(true);
          const res = await brandApi.brandSign(contract.id);
          setSubmitting(false);
          if (res.success) {
            Alert.alert(
              'Signed!',
              isConversion
                ? 'Contract is now active. The influencer can start sharing their tracking link.'
                : 'Contract is now active. Tranche 1 has been released.',
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          } else {
            Alert.alert('Failed', res.error?.message || 'Could not sign');
          }
        }},
      ]
    );
  }

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
        <Text style={styles.emptyText}>No contract found.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const status            = contract.status;
  const isDraft           = status === 'draft';
  const isPendingBrand    = status === 'pending_brand';
  const isPendingInf      = status === 'pending_influencer';
  const isActive          = status === 'active';
  // Re-approve flow: brand can still edit while waiting on influencer,
  // as long as the influencer hasn't signed yet.
  const isReApprove       = isPendingInf && !contract.influencer_signed_at;
  const isEditing         = isDraft || isReApprove;

  // contracts.influencer_fee is the BASE agreed fee (after the F.2 fix).
  // Total = base + bonus, where bonus comes either from contract.bonus_amount
  // (after brand has approved) or from the editable bonusAmount input
  // (during draft review before approval).
  const baseFee  = parseFloat(contract.influencer_fee || 0);
  const bonus    = parseFloat(bonusAmount || contract.bonus_amount || 0);
  const totalFee = baseFee + bonus;

  const goalLower      = (goal || contract.goal || 'engagement').toLowerCase();
  const showFee        = goalLower === 'engagement' || goalLower === 'hybrid';
  const showCommission = goalLower === 'conversion' || goalLower === 'hybrid';

  return (
    <View style={styles.outer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{'<- Back'}</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Contract</Text>
            <Text style={styles.headerSub}>
              {influencerName || contract.influencer_name || 'Influencer'} · {contract.campaign_name}
            </Text>
          </View>
          <View style={[styles.statusPill,
            isDraft && { backgroundColor: 'rgba(255,184,0,0.25)' },
            (isPendingInf || isPendingBrand) && { backgroundColor: 'rgba(0,184,148,0.25)' },
            isActive && { backgroundColor: 'rgba(0,184,148,0.45)' },
          ]}>
            <Text style={styles.statusPillText}>
              {isDraft ? 'Draft' : isPendingBrand ? 'Your Sign' : isPendingInf ? 'Influencer Sign' : 'Active'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        // See ContractScreen.js for the rationale — 'always' is the safest
        // setting on Android to keep the keyboard up when tapping inputs.
        keyboardShouldPersistTaps="always"
      >
        {/* Big draft / re-approve banner */}
        {isEditing && (
          <View style={styles.draftBanner}>
            <Text style={styles.draftTitle}>
              {isReApprove ? 'Update Terms Before Influencer Signs' : 'Draft Contract — Your Review'}
            </Text>
            <Text style={styles.draftBody}>
              {isReApprove
                ? 'The influencer has not signed yet, so you can still edit the content requirements, clauses, and bonus. Tap "Update & Re-send" to notify them of the new terms.'
                : 'The influencer accepted your offer. Confirm the content requirements below, optionally add clauses or a bonus, then tap "Approve & Send" to forward it for signing.'}
            </Text>
          </View>
        )}

        {/* Core terms */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Terms (auto-filled from campaign)</Text>
          {showFee && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Base Fee</Text>
              <Text style={styles.rowValue}>{fmtRupees(baseFee)}</Text>
            </View>
          )}
          {showCommission && contract.commission_pct && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Commission</Text>
              <Text style={styles.rowValue}>{parseFloat(contract.commission_pct)}% per conversion</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Posting Date</Text>
            <Text style={styles.rowValue}>{contract.posting_date ? new Date(contract.posting_date).toLocaleDateString('en-IN') : '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Revision Limit</Text>
            <Text style={styles.rowValue}>{contract.revision_limit ?? 2} rounds</Text>
          </View>
          {bonus > 0 && (
            <View style={[styles.row, { backgroundColor: colors.tealPale, borderRadius: 8, padding: 8, marginTop: 4 }]}>
              <Text style={[styles.rowLabel, { color: colors.tealDeep, fontWeight: '700' }]}>+ Brand Bonus</Text>
              <Text style={[styles.rowValue, { color: colors.tealDeep }]}>{fmtRupees(bonus)}</Text>
            </View>
          )}
          {showFee && bonus > 0 && (
            <View style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 8 }]}>
              <Text style={[styles.rowLabel, { fontWeight: '700' }]}>Total Influencer Fee</Text>
              <Text style={[styles.rowValue, { fontWeight: '800', color: colors.navy }]}>{fmtRupees(totalFee)}</Text>
            </View>
          )}
        </View>

        {/* Content Requirements — auto-filled from deliverables + brief. */}
        {isEditing && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>Content Requirements</Text>
              {suggestedRequirements && contentReq !== suggestedRequirements && (
                <TouchableOpacity onPress={() => setContentReq(suggestedRequirements)}>
                  <Text style={styles.restoreDefaultText}>Restore default</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.helpText}>
              Pre-filled from the campaign brief + deliverables. Edit freely — this is what the influencer sees in the signed PDF.
            </Text>
            <TextInput
              style={styles.requirementsInput}
              value={contentReq}
              onChangeText={setContentReq}
              placeholder="What exactly should the influencer create?"
              placeholderTextColor={colors.t3}
              multiline
              numberOfLines={10}
              textAlignVertical="top"
            />
          </View>
        )}

        {/* Clause toggles (draft + pending_influencer-unsigned) */}
        {isEditing && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Optional Clauses</Text>
            <Text style={styles.helpText}>Tick any clause that should apply to this contract. The influencer will see them highlighted before signing.</Text>
            {STANDARD_CLAUSES.map(c => {
              const cur = clauses[c.id];
              const enabled = !!cur?.enabled;
              return (
                <View key={c.id} style={[styles.clauseBox, enabled && styles.clauseBoxOn]}>
                  <TouchableOpacity onPress={() => toggleClause(c.id)} style={styles.clauseHeader}>
                    <View style={[styles.checkbox, enabled && styles.checkboxOn]}>
                      {enabled && <Text style={styles.checkboxTick}>✓</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.clauseLabel}>{c.label}</Text>
                      <Text style={styles.clauseDesc}>{c.description}</Text>
                    </View>
                  </TouchableOpacity>
                  {enabled && c.options?.length > 0 && (
                    <View style={styles.optionRow}>
                      {c.options.map(opt => (
                        <TouchableOpacity
                          key={opt}
                          onPress={() => setClauseValue(c.id, opt)}
                          style={[styles.optionChip, cur.value === opt && styles.optionChipOn]}
                        >
                          <Text style={[styles.optionChipText, cur.value === opt && { color: colors.white }]}>
                            {opt} {c.optionLabel || ''}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}

            <Text style={[styles.cardTitle, { marginTop: 16 }]}>Additional Notes (optional)</Text>
            <TextInput
              style={styles.textArea}
              value={extraNotes}
              onChangeText={setExtraNotes}
              placeholder="e.g. must wear blue shirt, tag our outlet, etc."
              placeholderTextColor={colors.t3}
              multiline
              numberOfLines={3}
            />

            {showFee && (() => {
              // Live wallet sufficiency. Lock = (base + bonus) × (1 + fee%).
              // If brand wallet is short, surface the breakdown + block
              // the approve button below. Backend also enforces this.
              const baseFeeNum  = parseFloat(contract.influencer_fee || 0);
              const bonusNum    = parseFloat(bonusAmount) || 0;
              const totalFeeNum = baseFeeNum + bonusNum;
              const lockNeeded  = totalFeeNum * (1 + platformFeePct / 100);
              const isOver      = lockNeeded > walletBalance + 0.01;
              return (
                <>
                  <Text style={[styles.cardTitle, { marginTop: 16 }]}>Bonus (optional)</Text>
                  <Text style={styles.helpText}>Add a bonus on top of the agreed fee. Split across 3 tranches just like the base fee.</Text>
                  <View style={[styles.bonusRow, isOver && { borderColor: colors.red }]}>
                    <Text style={styles.rupee}>₹</Text>
                    <TextInput
                      style={styles.bonusInput}
                      value={bonusAmount}
                      onChangeText={setBonusAmount}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.t3}
                    />
                  </View>
                  {(bonusNum > 0 || isOver) && (
                    <View style={[walletStyles.breakdownBox, isOver && walletStyles.breakdownBoxOver]}>
                      <View style={walletStyles.row}>
                        <Text style={walletStyles.rowLabel}>Base fee</Text>
                        <Text style={walletStyles.rowValue}>₹{baseFeeNum.toLocaleString('en-IN')}</Text>
                      </View>
                      <View style={walletStyles.row}>
                        <Text style={walletStyles.rowLabel}>+ Bonus</Text>
                        <Text style={walletStyles.rowValue}>₹{bonusNum.toLocaleString('en-IN')}</Text>
                      </View>
                      <View style={[walletStyles.row, walletStyles.divider]}>
                        <Text style={walletStyles.rowStrong}>Influencer total</Text>
                        <Text style={walletStyles.rowStrong}>₹{totalFeeNum.toLocaleString('en-IN')}</Text>
                      </View>
                      <View style={walletStyles.row}>
                        <Text style={walletStyles.rowLabel}>+ {platformFeePct}% platform fee</Text>
                        <Text style={walletStyles.rowValue}>₹{(lockNeeded - totalFeeNum).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                      </View>
                      <View style={[walletStyles.row, walletStyles.divider]}>
                        <Text style={walletStyles.rowStrong}>Wallet escrow at signing</Text>
                        <Text style={walletStyles.rowStrong}>₹{lockNeeded.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                      </View>
                      <View style={walletStyles.row}>
                        <Text style={walletStyles.rowLabel}>Wallet balance</Text>
                        <Text style={walletStyles.rowValue}>₹{walletBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                      </View>
                      {isOver && (
                        <Text style={walletStyles.shortageText}>
                          Wallet short by ₹{(lockNeeded - walletBalance).toLocaleString('en-IN', { maximumFractionDigits: 2 })}.
                          Top up your wallet from the Wallet tab or reduce the bonus.
                        </Text>
                      )}
                    </View>
                  )}
                </>
              );
            })()}

            {/* Production mode — how will content actually get made? */}
            <Text style={[styles.cardTitle, { marginTop: 16 }]}>How will the content be produced?</Text>
            <View style={pmStyles.modeRow}>
              {[
                { v: 'visit',    label: 'Visit',    icon: '🏬' },
                { v: 'shipment', label: 'Shipment', icon: '📦' },
                { v: 'remote',   label: 'Remote',   icon: '💻' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.v}
                  style={[pmStyles.modeCard, productionMode === opt.v && pmStyles.modeCardActive]}
                  onPress={() => setProductionMode(opt.v)}>
                  <Text style={pmStyles.modeIcon}>{opt.icon}</Text>
                  <Text style={[pmStyles.modeLabel, productionMode === opt.v && pmStyles.modeLabelActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.helpText}>
              {productionMode === 'visit'    ? "Influencer will visit your store / location. You'll fill in address + time after both parties sign."
               : productionMode === 'shipment' ? "You'll ship product to the influencer. Address comes from their profile; you provide AWB after dispatch."
               : "No physical exchange. Influencer creates content from your brief."}
            </Text>
          </View>
        )}

        {/* Read-only clauses — shown after brand has locked the draft AND is
            no longer editing (i.e. influencer signed or contract is active). */}
        {!isEditing && Object.keys(clauses).filter(k => clauses[k]?.enabled).length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Special Clauses Attached</Text>
            {STANDARD_CLAUSES.filter(c => clauses[c.id]?.enabled).map(c => (
              <View key={c.id} style={styles.clauseReadonly}>
                <Text style={styles.clauseLabel}>• {c.label}{clauses[c.id].value ? ` (${clauses[c.id].value} ${c.optionLabel || ''})` : ''}</Text>
                <Text style={styles.clauseDesc}>{c.description}</Text>
              </View>
            ))}
            {extraNotes ? (
              <View style={styles.clauseReadonly}>
                <Text style={styles.clauseLabel}>• Additional Notes</Text>
                <Text style={styles.clauseDesc}>{extraNotes}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Deliverables */}
        {deliverables.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Deliverables ({deliverables.length})</Text>
            {deliverables.map((d, i) => (
              <View key={d.id || i} style={styles.row}>
                <Text style={styles.rowLabel}>• {(d.type || '').replace(/_/g, ' ')}</Text>
                <Text style={styles.rowValue}>{d.status}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Signatures */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Signatures</Text>
          <View style={styles.sigRow}>
            <View style={[styles.sigBox, contract.influencer_signed_at && styles.sigBoxSigned]}>
              <Text style={styles.sigLabel}>Influencer</Text>
              {contract.influencer_signed_at ? (
                <>
                  <Text style={styles.sigCheck}>✓ Signed</Text>
                  <Text style={styles.sigName}>{contract.influencer_signed_name || contract.influencer_name}</Text>
                  <Text style={styles.sigDate}>{formatDateTime(contract.influencer_signed_at)}</Text>
                </>
              ) : <Text style={styles.sigPending}>Not yet signed</Text>}
            </View>
            <View style={[styles.sigBox, contract.brand_signed_at && styles.sigBoxSigned]}>
              <Text style={styles.sigLabel}>Brand</Text>
              {contract.brand_signed_at ? (
                <>
                  <Text style={styles.sigCheck}>✓ Signed</Text>
                  <Text style={styles.sigDate}>{formatDateTime(contract.brand_signed_at)}</Text>
                </>
              ) : <Text style={styles.sigPending}>Not yet signed</Text>}
            </View>
          </View>
        </View>

        {/* Primary action — Approve & Send (draft) or Update & Re-send (re-approve) */}
        {isEditing && (() => {
          // Same wallet check as the breakdown card above. Block button
          // when over so the brand can't send a contract they can't pay
          // for. Backend re-enforces, but this keeps the UX honest.
          const baseFeeNum = parseFloat(contract.influencer_fee || 0);
          const bonusNum   = parseFloat(bonusAmount) || 0;
          const lockNeeded = (baseFeeNum + bonusNum) * (1 + platformFeePct / 100);
          const walletShort = showFee && lockNeeded > walletBalance + 0.01;
          const disabled = submitting || walletShort;
          return (
          <TouchableOpacity
            style={[styles.actionBtn, disabled && styles.actionBtnDisabled]}
            onPress={handleApproveAndSend}
            disabled={disabled}
          >
            {submitting
              ? <ActivityIndicator color={colors.white} />
              : walletShort
              ? <Text style={styles.actionBtnText}>Top up wallet to send</Text>
              : <Text style={styles.actionBtnText}>
                  {isReApprove ? 'Update \u0026 Re-send to Influencer' : 'Approve \u0026 Send to Influencer'}
                </Text>}
          </TouchableOpacity>
          );
        })()}
        {isPendingBrand && (
          <TouchableOpacity
            style={[styles.actionBtn, submitting && styles.actionBtnDisabled]}
            onPress={handleBrandSign}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.actionBtnText}>Counter-sign Contract</Text>}
          </TouchableOpacity>
        )}
        {/* "Waiting on influencer" banner — only after they've actually signed,
            since editable pending_influencer is handled above. */}
        {isPendingInf && contract.influencer_signed_at && (
          <View style={[styles.card, { backgroundColor: colors.goldPale, borderColor: '#E8D590' }]}>
            <Text style={[styles.cardTitle, { color: '#7A5500' }]}>\u23F3 Waiting on Influencer</Text>
            <Text style={styles.helpText}>You sent the contract. The influencer will get a notification to review and sign.</Text>
          </View>
        )}
        {isActive && (
          <View style={[styles.card, { backgroundColor: colors.tealPale }]}>
            <Text style={[styles.cardTitle, { color: colors.tealDeep }]}>✓ Contract Active</Text>
            <Text style={styles.helpText}>
              {(goal || '').toLowerCase() === 'conversion'
                ? 'Both parties have signed. The influencer’s tracking link is active — they earn commission on confirmed conversions. Content will be submitted for your review.'
                : 'Both parties have signed. Tranche 1 has been released. The influencer will now create and submit content for review.'}
            </Text>
          </View>
        )}

        {/* Production coordination panel — visit form / shipment dispatch /
            remote notice. Only relevant after contract activation. */}
        {isActive && <BrandProductionPanel contractId={contract.id} />}

        {/* View Contract PDF — available once a contract row exists (any state) */}
        {contract?.id && (
          <TouchableOpacity
            style={styles.pdfBtn}
            onPress={() => navigation.navigate('ContractPdf', { contractId: contract.id, role: 'brand' })}
          >
            <Text style={styles.pdfBtnText}>View Contract PDF</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.bg },
  loadingText: { fontSize: 13, color: colors.t3, marginTop: 12 },
  emptyText: { fontSize: 14, color: colors.t2, marginBottom: 16 },
  backBtn: { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: colors.navy, borderRadius: 10 },
  backBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },

  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  back: { marginBottom: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)' },
  statusPillText: { color: colors.white, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },

  draftBanner: {
    margin: 16, padding: 14, backgroundColor: '#FFF8E0',
    borderRadius: 12, borderWidth: 1, borderColor: '#E8D590',
  },
  draftTitle: { fontSize: 14, fontWeight: '800', color: '#7A5500', marginBottom: 6 },
  draftBody:  { fontSize: 12, color: '#7A5500', lineHeight: 18 },

  card: {
    margin: 16, marginBottom: 0, padding: 16,
    backgroundColor: colors.white, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.t1, marginBottom: 10 },
  helpText:  { fontSize: 12, color: colors.t3, marginBottom: 10, lineHeight: 18 },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  rowLabel: { fontSize: 12, color: colors.t3 },
  rowValue: { fontSize: 13, fontWeight: '700', color: colors.t1 },

  clauseBox: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 12, marginBottom: 10,
  },
  clauseBoxOn: { borderColor: colors.teal, backgroundColor: colors.tealPale },
  clauseHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border2,
    justifyContent: 'center', alignItems: 'center', marginTop: 2,
  },
  checkboxOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  checkboxTick: { color: colors.white, fontSize: 14, fontWeight: '800' },
  clauseLabel: { fontSize: 13, fontWeight: '700', color: colors.t1, marginBottom: 2 },
  clauseDesc:  { fontSize: 11, color: colors.t2, lineHeight: 16 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, marginLeft: 32 },
  optionChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
  },
  optionChipOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  optionChipText: { fontSize: 11, fontWeight: '700', color: colors.t2 },

  textArea: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    padding: 12, fontSize: 13, color: colors.t1, minHeight: 60,
    textAlignVertical: 'top',
  },
  bonusRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 2, borderColor: colors.navy, borderRadius: 10,
    backgroundColor: colors.white,
  },
  rupee: { paddingHorizontal: 12, fontSize: 18, fontWeight: '800', color: colors.t2 },
  bonusInput: { flex: 1, paddingVertical: 12, fontSize: 18, fontWeight: '800', color: colors.t1 },

  clauseReadonly: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },

  sigRow: { flexDirection: 'row', gap: 10 },
  sigBox: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  sigBoxSigned: { backgroundColor: colors.tealPale, borderColor: colors.teal },
  sigLabel: { fontSize: 10, color: colors.t3, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  sigCheck: { fontSize: 13, fontWeight: '800', color: colors.teal, marginBottom: 2 },
  sigName: { fontSize: 12, fontWeight: '700', color: colors.t1 },
  sigDate: { fontSize: 10, color: colors.t3, marginTop: 2 },
  sigPending: { fontSize: 12, color: colors.t3, fontStyle: 'italic' },

  actionBtn: {
    margin: 16, paddingVertical: 16, backgroundColor: colors.navy,
    borderRadius: 14, alignItems: 'center',
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  pdfBtn: {
    marginHorizontal: 16, marginTop: 12, borderRadius: 12, paddingVertical: 12,
    alignItems: 'center', backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.navy,
  },
  pdfBtnText: { color: colors.navy, fontSize: 13, fontWeight: '700' },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  restoreDefaultText: { fontSize: 11, fontWeight: '700', color: colors.navy, textDecorationLine: 'underline' },
  requirementsInput: {
    marginTop: 8,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg,
    borderRadius: 10, padding: 10,
    fontSize: 12, color: colors.t1, fontFamily: 'monospace',
    minHeight: 180, textAlignVertical: 'top',
  },
});

// ─── Production Panel ─────────────────────────────────────────────────────────

function formatDay(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function BrandProductionPanel({ contractId }) {
  const [event, setEvent]   = useState(null);
  const [mode, setMode]     = useState(null);
  const [log, setLog]       = useState([]);
  const [loading, setLoad]  = useState(true);
  const [saving, setSave]   = useState(false);
  const [dateRange, setDateRange] = useState(null);  // { earliest, latest } ISO

  // Location form (sent without date/time on first save)
  const [vAddress, setVAddress] = useState('');
  const [vCity, setVCity]       = useState('');
  const [vPincode, setVPincode] = useState('');
  const [vWindow, setVWindow]   = useState(60);
  const [vName, setVName]       = useState('');
  const [vPhone, setVPhone]     = useState('');

  // Counter-propose form (only shown when influencer proposed a slot brand
  // wants to push back on). Single Date value sourced from DateTimeChipPicker.
  const [showCounter, setShowCounter] = useState(false);
  const [counterDate, setCounterDate] = useState(null);

  // Reschedule form (only after confirmed — counts against brand limit)
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(null);

  const [courier, setCourier] = useState('');
  const [awb, setAwb]         = useState('');

  async function load() {
    setLoad(true);
    const [res, rangeRes] = await Promise.all([
      brandApi.getProduction(contractId),
      brandApi.getProductionDateRange(contractId).catch(() => null),
    ]);
    setLoad(false);
    if (res.success) {
      setEvent(res.data?.production_event || null);
      setMode(res.data?.production_mode || null);
      setLog(res.data?.log || []);
      const e = res.data?.production_event;
      if (e) {
        setVAddress(e.visit_address || '');
        setVCity(e.visit_city || '');
        setVPincode(e.visit_pincode || '');
        if (e.visit_window_minutes) setVWindow(e.visit_window_minutes);
        setVName(e.visit_contact_name || '');
        setVPhone(e.visit_contact_phone || '');
        setCourier(e.shipment_courier || '');
        setAwb(e.shipment_awb || '');
      }
    }
    if (rangeRes?.success) setDateRange(rangeRes.data?.range || null);
  }
  useEffect(() => { load(); }, [contractId]);

  // Pretty date hint shown to the brand in the form footer.
  const dateHint = dateRange
    ? `Visit must be between ${formatDay(dateRange.earliest)} and ${formatDay(dateRange.latest)}`
    : null;

  // Save location only (no date/time). First-send hands the ball to influencer.
  async function saveLocationOnly() {
    if (!vAddress.trim()) { Alert.alert('Missing', 'Address is required'); return; }
    setSave(true);
    const res = await brandApi.setProductionVisitDetails(contractId, {
      visit_address: vAddress.trim(),
      visit_city: vCity.trim() || null,
      visit_pincode: vPincode.trim() || null,
      visit_window_minutes: Number(vWindow) || null,
      visit_contact_name:  vName.trim() || null,
      visit_contact_phone: vPhone.trim() || null,
    });
    setSave(false);
    if (res.success) {
      Alert.alert('Sent', 'Influencer can now pick their available slot.');
      load();
    } else Alert.alert('Save failed', res.error?.message || 'Could not save location.');
  }

  // Accept influencer's proposed slot.
  async function acceptSlot() {
    if (!event) return;
    setSave(true);
    const res = await brandApi.acceptProduction(event.id);
    setSave(false);
    if (res.success) { Alert.alert('Confirmed', 'Visit slot confirmed.'); load(); }
    else Alert.alert('Failed', res.error?.message || 'Could not accept slot.');
  }

  // Counter-propose a different slot.
  async function sendCounter() {
    if (!counterDate) { Alert.alert('Missing', 'Pick a date and time'); return; }
    setSave(true);
    const res = await brandApi.counterProposeProduction(event.id, {
      visit_scheduled_at: counterDate.toISOString(),
      visit_window_minutes: Number(vWindow) || null,
    });
    setSave(false);
    if (res.success) {
      Alert.alert('Counter sent', 'Influencer will see your suggested slot.');
      setShowCounter(false); setCounterDate(null);
      load();
    } else Alert.alert('Failed', res.error?.message || 'Counter failed.');
  }

  // Reschedule after confirmed (counts toward brand's 2-counter limit).
  async function sendReschedule() {
    if (!rescheduleDate) { Alert.alert('Missing', 'Pick a date and time'); return; }
    setSave(true);
    const res = await brandApi.setProductionVisitDetails(contractId, {
      visit_scheduled_at: rescheduleDate.toISOString(),
      visit_window_minutes: Number(vWindow) || null,
    });
    setSave(false);
    if (res.success) {
      Alert.alert('Reschedule sent', 'Influencer will confirm the new slot.');
      setShowReschedule(false); setRescheduleDate(null);
      load();
    } else Alert.alert('Failed', res.error?.message || 'Reschedule failed.');
  }

  // Request mutual flip to remote (no shoot). Other side confirms via same endpoint.
  async function flipToRemote() {
    if (!event) return;
    Alert.alert(
      'Switch to remote?',
      'This skips the in-person shoot. The influencer will create content from your brief alone. The other side has to confirm before it takes effect.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: event.remote_flip_requested_by && event.remote_flip_requested_by !== 'brand'
            ? 'Confirm flip' : 'Request flip',
          onPress: async () => {
            setSave(true);
            const res = await brandApi.flipProductionToRemote(event.id);
            setSave(false);
            if (res.success) load();
            else Alert.alert('Failed', res.error?.message || 'Flip failed.');
          },
        },
      ]
    );
  }

  async function saveDispatch() {
    if (!event) return;
    if (!courier.trim() || !awb.trim()) { Alert.alert('Missing', 'Courier and AWB are required'); return; }
    setSave(true);
    const res = await brandApi.dispatchProduction(event.id, {
      courier: courier.trim(), awb: awb.trim(),
    });
    setSave(false);
    if (res.success) load();
    else Alert.alert('Failed', res.error?.message || 'Dispatch failed');
  }

  async function markVisitDone() {
    if (!event) return;
    Alert.alert('Mark visit complete?', 'This signals the influencer that the shoot is done.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => {
        setSave(true);
        const res = await brandApi.completeProduction(event.id, {});
        setSave(false);
        if (res.success) load();
        else Alert.alert('Failed', res.error?.message || 'Complete failed');
      }},
    ]);
  }

  if (loading) return <View style={pmStyles.loadingBox}><ActivityIndicator color={colors.navy} /></View>;
  if (mode === 'remote') {
    return (
      <View style={pmStyles.remoteBox}>
        <Text style={pmStyles.remoteTitle}>💻 Remote production</Text>
        <Text style={pmStyles.remoteBody}>No physical exchange needed. The influencer will create content directly from your brief.</Text>
      </View>
    );
  }
  // No event yet — give the brand a clear way to initialise one. This is the
  // escape hatch for legacy contracts (signed before Phase P) AND for cases
  // where the auto-create at brand-sign didn't fire for any reason.
  if (!event) {
    return (
      <View style={pmStyles.panel}>
        <Text style={pmStyles.panelTitle}>Set up production</Text>
        <Text style={[pmStyles.helpHeader, { marginTop: 4 }]}>
          Pick how the influencer will get what they need for the shoot.
        </Text>
        <View style={pmStyles.modeRow}>
          <TouchableOpacity
            style={[pmStyles.modeCard, mode === 'visit' && pmStyles.modeCardActive]}
            disabled={saving}
            onPress={async () => {
              setSave(true);
              const res = await brandApi.initialiseProduction(contractId, 'visit');
              setSave(false);
              if (res.success) load();
              else Alert.alert('Failed', res.error?.message || 'Could not initialise');
            }}
          >
            <Text style={pmStyles.modeIcon}>🏬</Text>
            <Text style={pmStyles.modeLabel}>Visit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[pmStyles.modeCard, mode === 'shipment' && pmStyles.modeCardActive]}
            disabled={saving}
            onPress={async () => {
              setSave(true);
              const res = await brandApi.initialiseProduction(contractId, 'shipment');
              setSave(false);
              if (res.success) load();
              else Alert.alert('Failed', res.error?.message || 'Could not initialise');
            }}
          >
            <Text style={pmStyles.modeIcon}>📦</Text>
            <Text style={pmStyles.modeLabel}>Shipment</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[pmStyles.modeCard, mode === 'remote' && pmStyles.modeCardActive]}
            disabled={saving}
            onPress={async () => {
              Alert.alert('Switch to remote?', 'No coordination needed — content is created from your brief alone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Confirm', onPress: async () => {
                  setSave(true);
                  const res = await brandApi.initialiseProduction(contractId, 'remote');
                  setSave(false);
                  if (res.success) load();
                  else Alert.alert('Failed', res.error?.message || 'Could not initialise');
                }},
              ]);
            }}
          >
            <Text style={pmStyles.modeIcon}>💻</Text>
            <Text style={pmStyles.modeLabel}>Remote</Text>
          </TouchableOpacity>
        </View>
        {saving && <Text style={pmStyles.smallNote}>Setting up…</Text>}
      </View>
    );
  }

  const STATUS_PILL = {
    proposed:    { bg: '#FFF4D6', fg: '#7A5500', label: 'Awaiting influencer' },
    confirmed:   { bg: '#E0FAF5', fg: '#007A63', label: 'Confirmed' },
    in_progress: { bg: '#EEEDFE', fg: '#5C50C8', label: 'In progress' },
    completed:   { bg: '#E0FAF5', fg: '#007A63', label: 'Completed' },
    cancelled:   { bg: '#FDEEE9', fg: '#E8401A', label: 'Cancelled' },
  }[event.status] || { bg: colors.surface2, fg: colors.t2, label: event.status };

  return (
    <View style={pmStyles.panel}>
      <View style={pmStyles.panelHead}>
        <Text style={pmStyles.panelTitle}>
          {event.mode === 'visit' ? '🏬 Visit Coordination' : '📦 Product Shipment'}
        </Text>
        <View style={[pmStyles.statusPill, { backgroundColor: STATUS_PILL.bg }]}>
          <Text style={[pmStyles.statusPillTxt, { color: STATUS_PILL.fg }]}>{STATUS_PILL.label}</Text>
        </View>
      </View>

      {event.mode === 'visit' && (() => {
        const hasLocation  = !!event.visit_address;
        const hasSlot      = !!event.visit_scheduled_at;
        const isConfirmed  = event.status === 'confirmed';
        const isCompleted  = event.status === 'completed';
        const influencerProposed = event.slot_proposed_by === 'influencer';
        const brandProposed      = event.slot_proposed_by === 'brand';
        const flipPending  = !!event.remote_flip_requested_by;
        const flipByMe     = event.remote_flip_requested_by === 'brand';

        return (
          <>
            {/* Remote-flip pending banner (when other side requested) */}
            {flipPending && !flipByMe && !isCompleted && (
              <View style={pmStyles.flipBanner}>
                <Text style={pmStyles.flipBannerTxt}>
                  Influencer wants to switch this to remote (no shoot, content from brief alone). Confirm?
                </Text>
                <TouchableOpacity style={pmStyles.flipConfirmBtn} disabled={saving} onPress={flipToRemote}>
                  <Text style={pmStyles.flipConfirmBtnTxt}>Confirm flip</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STATE 1: no location yet — brand fills the form */}
            {!hasLocation && !isCompleted && (
              <>
                <Text style={pmStyles.helpHeader}>
                  Tell the influencer WHERE to come. They'll then pick a time that works for them.
                </Text>
                <Text style={pmStyles.fieldLabel}>Address *</Text>
                <TextInput style={pmStyles.input} value={vAddress} onChangeText={setVAddress} placeholder="Plot 42, Silicon Valley..." placeholderTextColor={colors.t3} />
                <View style={pmStyles.row2}>
                  <TextInput style={[pmStyles.input, { flex: 1 }]} value={vCity} onChangeText={setVCity} placeholder="City" placeholderTextColor={colors.t3} />
                  <TextInput style={[pmStyles.input, { flex: 1 }]} value={vPincode} onChangeText={setVPincode} placeholder="Pincode" keyboardType="numeric" placeholderTextColor={colors.t3} />
                </View>
                <Text style={pmStyles.fieldLabel}>How long the visit will take</Text>
                <View style={pmStyles.windowRow}>
                  {[30, 60, 120, 240].map(m => (
                    <TouchableOpacity key={m} style={[pmStyles.windowChip, vWindow === m && pmStyles.windowChipActive]} onPress={() => setVWindow(m)}>
                      <Text style={[pmStyles.windowChipTxt, vWindow === m && pmStyles.windowChipTxtActive]}>
                        {m < 60 ? `${m} min` : m === 240 ? 'Half day' : `${m / 60} hr`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={pmStyles.row2}>
                  <TextInput style={[pmStyles.input, { flex: 1 }]} value={vName} onChangeText={setVName} placeholder="Contact name" placeholderTextColor={colors.t3} />
                  <TextInput style={[pmStyles.input, { flex: 1 }]} value={vPhone} onChangeText={setVPhone} placeholder="Contact phone" keyboardType="phone-pad" placeholderTextColor={colors.t3} />
                </View>
                <TouchableOpacity style={[pmStyles.primaryBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={saveLocationOnly}>
                  <Text style={pmStyles.primaryBtnTxt}>{saving ? 'Sending…' : 'Send to influencer for scheduling'}</Text>
                </TouchableOpacity>
              </>
            )}

            {/* STATE 2: location set, no slot yet — waiting on influencer */}
            {hasLocation && !hasSlot && !isCompleted && (
              <>
                <View style={pmStyles.addrBox}>
                  <Text style={pmStyles.addrLabel}>Visit location</Text>
                  <Text style={pmStyles.addrText}>
                    {[event.visit_address, event.visit_city, event.visit_pincode].filter(Boolean).join(', ')}
                  </Text>
                </View>
                <Text style={pmStyles.smallNote}>Waiting for influencer to pick their visit slot.</Text>
                {dateHint && <Text style={pmStyles.dateHint}>{dateHint}</Text>}
                {!flipPending && (
                  <TouchableOpacity style={pmStyles.linkBtn} disabled={saving} onPress={flipToRemote}>
                    <Text style={pmStyles.linkBtnTxt}>Or skip the visit — switch to remote</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* STATE 3: influencer proposed a slot — brand can accept or counter */}
            {hasLocation && hasSlot && influencerProposed && event.status === 'proposed' && (
              <>
                <View style={pmStyles.slotCard}>
                  <Text style={pmStyles.slotLabel}>Influencer wants to come on</Text>
                  <Text style={pmStyles.slotTime}>{formatDateTime(event.visit_scheduled_at)}</Text>
                  <Text style={pmStyles.slotMeta}>
                    {event.visit_window_minutes ? `${event.visit_window_minutes} min slot · ` : ''}
                    at {event.visit_address || '—'}
                  </Text>
                </View>
                {!showCounter ? (
                  <>
                    <TouchableOpacity style={[pmStyles.primaryBtnAlt, saving && { opacity: 0.6 }]} disabled={saving} onPress={acceptSlot}>
                      <Text style={pmStyles.primaryBtnAltTxt}>Accept slot</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={pmStyles.secondaryBtn} disabled={saving} onPress={() => setShowCounter(true)}>
                      <Text style={pmStyles.secondaryBtnTxt}>Suggest another time</Text>
                    </TouchableOpacity>
                    {!flipPending && (
                      <TouchableOpacity style={pmStyles.linkBtn} disabled={saving} onPress={flipToRemote}>
                        <Text style={pmStyles.linkBtnTxt}>Skip the visit — switch to remote</Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <>
                    <DateTimeChipPicker
                      minDate={dateRange?.earliest ? new Date(dateRange.earliest) : null}
                      maxDate={dateRange?.latest ? new Date(dateRange.latest) : null}
                      value={counterDate}
                      onChange={setCounterDate}
                    />
                    <TouchableOpacity style={[pmStyles.primaryBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={sendCounter}>
                      <Text style={pmStyles.primaryBtnTxt}>{saving ? 'Sending…' : 'Send counter-proposal'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={pmStyles.linkBtn} disabled={saving} onPress={() => setShowCounter(false)}>
                      <Text style={pmStyles.linkBtnTxt}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                )}
                {event.reschedule_count_brand > 0 && (
                  <Text style={pmStyles.smallNote}>Reschedules used: {event.reschedule_count_brand} of 2</Text>
                )}
              </>
            )}

            {/* STATE 4: brand proposed/countered — waiting on influencer */}
            {hasLocation && hasSlot && brandProposed && event.status === 'proposed' && (
              <>
                <View style={pmStyles.slotCard}>
                  <Text style={pmStyles.slotLabel}>Your proposed slot</Text>
                  <Text style={pmStyles.slotTime}>{formatDateTime(event.visit_scheduled_at)}</Text>
                  <Text style={pmStyles.slotMeta}>
                    {event.visit_window_minutes ? `${event.visit_window_minutes} min slot · ` : ''}
                    at {event.visit_address || '—'}
                  </Text>
                </View>
                <Text style={pmStyles.smallNote}>Waiting for influencer to accept or counter.</Text>
                {event.reschedule_count_brand > 0 && (
                  <Text style={pmStyles.smallNote}>Reschedules used: {event.reschedule_count_brand} of 2</Text>
                )}
              </>
            )}

            {/* STATE 5: confirmed — mark visit done + optional reschedule */}
            {isConfirmed && (
              <>
                <View style={pmStyles.slotCard}>
                  <Text style={pmStyles.slotLabel}>✓ Confirmed visit</Text>
                  <Text style={pmStyles.slotTime}>{formatDateTime(event.visit_scheduled_at)}</Text>
                  <Text style={pmStyles.slotMeta}>
                    {event.visit_window_minutes ? `${event.visit_window_minutes} min slot · ` : ''}
                    at {event.visit_address || '—'}
                  </Text>
                  {event.visit_contact_name && (
                    <Text style={pmStyles.slotMeta}>Contact: {event.visit_contact_name}{event.visit_contact_phone ? ` (${event.visit_contact_phone})` : ''}</Text>
                  )}
                </View>
                <TouchableOpacity style={[pmStyles.primaryBtnAlt, saving && { opacity: 0.6 }]} disabled={saving} onPress={markVisitDone}>
                  <Text style={pmStyles.primaryBtnAltTxt}>Mark visit done</Text>
                </TouchableOpacity>
                {!showReschedule ? (
                  <TouchableOpacity style={pmStyles.linkBtn} disabled={saving} onPress={() => setShowReschedule(true)}>
                    <Text style={pmStyles.linkBtnTxt}>Reschedule the visit</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <DateTimeChipPicker
                      minDate={dateRange?.earliest ? new Date(dateRange.earliest) : null}
                      maxDate={dateRange?.latest ? new Date(dateRange.latest) : null}
                      value={rescheduleDate}
                      onChange={setRescheduleDate}
                    />
                    <TouchableOpacity style={[pmStyles.primaryBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={sendReschedule}>
                      <Text style={pmStyles.primaryBtnTxt}>{saving ? 'Sending…' : 'Propose new slot'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={pmStyles.linkBtn} disabled={saving} onPress={() => setShowReschedule(false)}>
                      <Text style={pmStyles.linkBtnTxt}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                )}
                {event.reschedule_count_brand > 0 && (
                  <Text style={pmStyles.smallNote}>Reschedules used: {event.reschedule_count_brand} of 2</Text>
                )}
              </>
            )}

            {/* STATE 6: completed */}
            {isCompleted && (
              <View style={pmStyles.completeBox}>
                <Text style={pmStyles.completeTxt}>
                  ✓ Visit complete{event.visit_completed_at ? ` on ${formatDay(event.visit_completed_at)}` : ''}.
                </Text>
              </View>
            )}

            {/* Pending request banner from this side (info-only) */}
            {flipPending && flipByMe && !isCompleted && (
              <Text style={pmStyles.smallNote}>You requested a switch to remote. Waiting for influencer to confirm.</Text>
            )}
          </>
        );
      })()}

      {event.mode === 'shipment' && (
        <>
          <View style={pmStyles.addrBox}>
            <Text style={pmStyles.addrLabel}>Shipping to</Text>
            <Text style={pmStyles.addrText}>
              {[event.shipment_to_address_line, event.shipment_to_city, event.shipment_to_state, event.shipment_to_pincode].filter(Boolean).join(', ') || '— address pending —'}
            </Text>
          </View>

          {event.status === 'proposed' && (
            <Text style={pmStyles.smallNote}>Waiting for influencer to confirm address.</Text>
          )}

          {event.status === 'confirmed' && (
            <>
              <Text style={pmStyles.fieldLabel}>Courier</Text>
              <TextInput style={pmStyles.input} value={courier} onChangeText={setCourier} placeholder="Bluedart / Delhivery / Shiprocket / DTDC" placeholderTextColor={colors.t3} />
              <Text style={pmStyles.fieldLabel}>AWB / Tracking</Text>
              <TextInput style={pmStyles.input} value={awb} onChangeText={setAwb} placeholder="Enter tracking number" placeholderTextColor={colors.t3} />
              <TouchableOpacity style={[pmStyles.primaryBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={saveDispatch}>
                <Text style={pmStyles.primaryBtnTxt}>{saving ? 'Marking…' : 'Mark as dispatched'}</Text>
              </TouchableOpacity>
            </>
          )}

          {event.status === 'in_progress' && (
            <View style={pmStyles.statusBox}>
              <Text style={pmStyles.statusLine}>Courier: {event.shipment_courier || '—'}</Text>
              <Text style={pmStyles.statusLine}>AWB: {event.shipment_awb || '—'}</Text>
              <Text style={[pmStyles.smallNote, { marginTop: 6 }]}>Awaiting influencer to confirm receipt.</Text>
            </View>
          )}

          {event.status === 'completed' && (
            <View style={pmStyles.completeBox}>
              <Text style={pmStyles.completeTxt}>✓ Package received{event.shipment_received_confirmed_at ? ` on ${new Date(event.shipment_received_confirmed_at).toLocaleDateString('en-IN')}` : ''}.</Text>
            </View>
          )}
        </>
      )}

      {/* Audit log */}
      {log.length > 0 && (
        <View style={pmStyles.logBox}>
          <Text style={pmStyles.logTitle}>History</Text>
          {log.slice(-5).reverse().map(l => (
            <Text key={l.id} style={pmStyles.logRow}>
              <Text style={pmStyles.logTime}>{new Date(l.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
              {' · '}
              <Text style={pmStyles.logActor}>{l.actor_role}</Text>
              {' · '}
              {(l.action || '').replace(/_/g, ' ')}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const pmStyles = StyleSheet.create({
  loadingBox:    { padding: 24, alignItems: 'center' },
  panel:         { marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: colors.navyPale, borderWidth: 1, borderColor: colors.border },
  panelHead:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  panelTitle:    { fontSize: 14, fontWeight: '800', color: colors.t1 },
  statusPill:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusPillTxt: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },

  remoteBox:     { marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  remoteTitle:   { fontSize: 13, fontWeight: '800', color: colors.t1, marginBottom: 4 },
  remoteBody:    { fontSize: 11, color: colors.t3, textAlign: 'center', lineHeight: 16 },

  fieldLabel:    { fontSize: 11, fontWeight: '700', color: colors.t2, marginTop: 10, marginBottom: 4 },
  input:         { backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 10, fontSize: 12, color: colors.t1, marginBottom: 6 },
  row2:          { flexDirection: 'row', gap: 8 },
  windowRow:     { flexDirection: 'row', gap: 6, marginVertical: 8, flexWrap: 'wrap' },
  windowChip:    { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  windowChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  windowChipTxt: { fontSize: 11, fontWeight: '700', color: colors.t2 },
  windowChipTxtActive: { color: colors.white },

  primaryBtn:    { marginTop: 12, paddingVertical: 12, backgroundColor: colors.navy, borderRadius: 10, alignItems: 'center' },
  primaryBtnTxt: { color: colors.white, fontSize: 13, fontWeight: '800' },
  primaryBtnAlt: { marginTop: 8, paddingVertical: 12, backgroundColor: colors.teal, borderRadius: 10, alignItems: 'center' },
  primaryBtnAltTxt: { color: colors.white, fontSize: 13, fontWeight: '800' },
  secondaryBtn:  { marginTop: 8, paddingVertical: 11, backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.navy, alignItems: 'center' },
  secondaryBtnTxt: { color: colors.navy, fontSize: 12, fontWeight: '700' },
  linkBtn:       { marginTop: 8, paddingVertical: 8, alignItems: 'center' },
  linkBtnTxt:    { color: colors.t3, fontSize: 11, fontWeight: '600', textDecorationLine: 'underline' },
  smallNote:     { fontSize: 10, color: colors.t3, marginTop: 6, textAlign: 'center' },
  helpHeader:    { fontSize: 11, color: colors.t3, marginBottom: 4, lineHeight: 16 },
  dateHint:      { fontSize: 10, color: colors.orange, marginTop: 4, marginBottom: 4, textAlign: 'center', fontWeight: '700' },

  slotCard:      { padding: 12, backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.teal, marginVertical: 4 },
  slotLabel:     { fontSize: 10, fontWeight: '800', color: colors.t3, textTransform: 'uppercase', marginBottom: 4 },
  slotTime:      { fontSize: 15, fontWeight: '800', color: colors.t1, marginBottom: 4 },
  slotMeta:      { fontSize: 11, color: colors.t3 },

  flipBanner:    { backgroundColor: colors.orange + '20', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: colors.orange },
  flipBannerTxt: { fontSize: 11, color: colors.t1, lineHeight: 15, marginBottom: 8 },
  flipConfirmBtn:{ alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.orange, borderRadius: 8 },
  flipConfirmBtnTxt: { color: colors.white, fontSize: 11, fontWeight: '800' },

  addrBox:       { padding: 10, backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  addrLabel:     { fontSize: 9, fontWeight: '800', color: colors.t3, textTransform: 'uppercase', marginBottom: 4 },
  addrText:      { fontSize: 12, color: colors.t1 },
  statusBox:     { padding: 10, backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginTop: 8 },
  statusLine:    { fontSize: 12, color: colors.t1, marginBottom: 2 },
  completeBox:   { marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: colors.tealPale, borderWidth: 1, borderColor: colors.teal },
  completeTxt:   { fontSize: 12, color: colors.tealDeep, fontWeight: '700' },

  logBox:        { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  logTitle:      { fontSize: 10, fontWeight: '800', color: colors.t3, textTransform: 'uppercase', marginBottom: 4 },
  logRow:        { fontSize: 10, color: colors.t2, marginBottom: 2 },
  logTime:       { color: colors.t3 },
  logActor:      { color: colors.t2, fontWeight: '700' },

  // Mode picker (used inline in editing card; not nested but referenced from outer scope)
  modeRow:       { flexDirection: 'row', gap: 6, marginTop: 4 },
  modeCard:      { flex: 1, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', backgroundColor: colors.white, borderRadius: 10, borderWidth: 2, borderColor: colors.border },
  modeCardActive:{ borderColor: colors.navy, backgroundColor: colors.navyPale },
  modeIcon:      { fontSize: 22 },
  modeLabel:     { fontSize: 11, fontWeight: '700', color: colors.t2, marginTop: 4 },
  modeLabelActive:{ color: colors.navy },
});

// Wallet-check breakdown shown next to the bonus input on approve.
const walletStyles = StyleSheet.create({
  breakdownBox: {
    marginTop: 10,
    padding: 12,
    backgroundColor: colors.surface2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  breakdownBoxOver: {
    backgroundColor: '#FDEEE9',
    borderColor: colors.red,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  rowLabel:  { fontSize: 12, color: colors.t2 },
  rowValue:  { fontSize: 12, color: colors.t1 },
  rowStrong: { fontSize: 12, color: colors.t1, fontWeight: '700' },
  divider:   { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 6 },
  shortageText: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(232,64,26,0.3)',
    fontSize: 11,
    color: colors.red,
    fontWeight: '700',
    lineHeight: 16,
  },
});
