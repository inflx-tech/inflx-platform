import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { brandPalette as P, fonts, fmtRupees } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PLACES, SHIPPING, toMode, fromMode } from '../../utils/workingStyle';
import DateTimeChipPicker from '../../components/DateTimeChipPicker';
import StatusPill from '../../components/brand/StatusPill';

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
  // Working style is two questions here too, in the same words the collaboration request
  // asked them — the brand should never meet a second vocabulary for a settled decision.
  // Contract: features/collab-working-style-two-questions
  const [carriedOver, setCarriedOver] = useState(false);
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
    if (c.production_mode) {
      setProductionMode(c.production_mode);
    } else if (c.agreed_mode) {
      // Nothing chosen yet — carry over what the two sides already settled at handshake
      // rather than asking the same question again from a blank slate.
      setProductionMode(c.agreed_mode);
      setCarriedOver(true);
    }

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
        <ActivityIndicator size="large" color={P.ink} />
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
          <Text style={styles.backText}>{'‹ Back'}</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Contract</Text>
            <Text style={styles.headerSub}>
              {influencerName || contract.influencer_name || 'Influencer'} · {contract.campaign_name}
            </Text>
          </View>
          <View style={styles.statusPillWrap}>
            <StatusPill status={status} />
          </View>
        </View>
        <View style={styles.headerRule} />
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
            <View style={[styles.row, { backgroundColor: P.successPale, borderRadius: 8, padding: 8, marginTop: 4 }]}>
              <Text style={[styles.rowLabel, { color: P.successText, fontFamily: fonts.monoBold }]}>+ Brand Bonus</Text>
              <Text style={[styles.rowValue, { color: P.successText }]}>{fmtRupees(bonus)}</Text>
            </View>
          )}
          {showFee && bonus > 0 && (
            <View style={[styles.row, { borderTopWidth: 1, borderTopColor: P.border, paddingTop: 8, marginTop: 8 }]}>
              <Text style={[styles.rowLabel, { fontFamily: fonts.displayBold, color: P.ink }]}>Total Influencer Fee</Text>
              <Text style={[styles.rowValue, { fontFamily: fonts.monoBold, color: P.ink, fontSize: 14 }]}>{fmtRupees(totalFee)}</Text>
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
              placeholderTextColor={P.muted3}
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
                          <Text style={[styles.optionChipText, cur.value === opt && { color: P.yellow }]}>
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
              placeholderTextColor={P.muted3}
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
                  <View style={[styles.bonusRow, isOver && { borderColor: P.danger }]}>
                    <Text style={styles.rupee}>₹</Text>
                    <TextInput
                      style={styles.bonusInput}
                      value={bonusAmount}
                      onChangeText={setBonusAmount}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={P.muted3}
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

            {/* Working style — the SAME two questions the collaboration request asked,
                in the same words, pre-answered from what was agreed. It used to be three
                cards named Visit / Shipment / Remote, remembered nothing, and let the
                brand contradict the terms the creator had already accepted. */}
            <Text style={[styles.cardTitle, { marginTop: 16 }]}>Where will she work?</Text>
            <View style={pmStyles.modeRow}>
              {PLACES.map(opt => {
                const on = fromMode(productionMode).place === opt.v;
                return (
                  <TouchableOpacity
                    key={opt.v}
                    style={[pmStyles.modeCard, on && pmStyles.modeCardActive]}
                    onPress={() => {
                      setCarriedOver(false);
                      setProductionMode(toMode(opt.v, opt.v === 'remote' ? fromMode(productionMode).shipping : null));
                    }}>
                    <Text style={[pmStyles.modeLabel, on && pmStyles.modeLabelActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {fromMode(productionMode).place === 'remote' && (
              <>
                <Text style={[styles.cardTitle, { marginTop: 12 }]}>Are you sending her products?</Text>
                <View style={pmStyles.modeRow}>
                  {SHIPPING.map(opt => {
                    const on = fromMode(productionMode).shipping === opt.v;
                    return (
                      <TouchableOpacity
                        key={opt.v}
                        style={[pmStyles.modeCard, on && pmStyles.modeCardActive]}
                        onPress={() => { setCarriedOver(false); setProductionMode(toMode('remote', opt.v)); }}>
                        <Text style={[pmStyles.modeLabel, on && pmStyles.modeLabelActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {carriedOver && (
              <Text style={pmStyles.carried}>
                Carried over from what you both agreed. Change it only if the plan changed.
              </Text>
            )}
            <Text style={styles.helpText}>
              {productionMode === 'visit'    ? "She comes to your store or location. You'll fill in the address and time after both parties sign."
               : productionMode === 'shipment' ? "You'll ship product to her. Her address comes from her profile; you add the courier and tracking number after dispatch."
               : "Nothing shipped. She creates content wherever she is, from your brief."}
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
              ? <ActivityIndicator color={P.yellow} />
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
              ? <ActivityIndicator color={P.yellow} />
              : <Text style={styles.actionBtnText}>Counter-sign Contract</Text>}
          </TouchableOpacity>
        )}
        {/* "Waiting on influencer" banner — only after they've actually signed,
            since editable pending_influencer is handled above. */}
        {isPendingInf && contract.influencer_signed_at && (
          <View style={[styles.card, { backgroundColor: P.yellowPale, borderColor: '#F0DA88' }]}>
            <Text style={[styles.cardTitle, { color: P.yellowText }]}>\u23F3 Waiting on Influencer</Text>
            <Text style={styles.helpText}>You sent the contract. The influencer will get a notification to review and sign.</Text>
          </View>
        )}
        {isActive && (
          <View style={[styles.card, { backgroundColor: P.successPale, borderColor: '#A8E6CC' }]}>
            <Text style={[styles.cardTitle, { color: P.successText }]}>✓ Contract Active</Text>
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
  outer:  { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: P.bg },
  loadingText: { fontSize: 13, color: P.muted2, marginTop: 12, fontFamily: fonts.sansMedium },
  emptyText:   { fontSize: 14, color: P.muted, marginBottom: 16, fontFamily: fonts.sansMedium },
  backBtn:     { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: P.ink, borderRadius: 10 },
  backBtnText: { color: P.yellow, fontFamily: fonts.displayBold, fontSize: 14, fontWeight: '800' },

  header: { backgroundColor: P.ink, paddingHorizontal: 18, paddingTop: 50, paddingBottom: 16, position: 'relative' },
  back:   { marginBottom: 8 },
  backText: { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontFamily: fonts.monoBold, fontWeight: '700' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: P.white, fontFamily: fonts.displayBold, letterSpacing: -0.2 },
  headerSub:   { fontSize: 11.5, color: 'rgba(255,255,255,0.7)', marginTop: 3, fontFamily: fonts.sansMedium },
  statusPillWrap: { backgroundColor: 'rgba(255,255,255,0.92)', padding: 3, borderRadius: 999, marginTop: 2 },
  headerRule: { position: 'absolute', left: 18, bottom: 6, width: 30, height: 3, backgroundColor: P.yellow, borderRadius: 2 },

  draftBanner: {
    margin: 14, padding: 13, backgroundColor: P.yellowPale,
    borderRadius: 12, borderWidth: 1, borderColor: '#F0DA88',
  },
  draftTitle: { fontSize: 13, fontWeight: '800', color: P.yellowText, marginBottom: 5, fontFamily: fonts.displayBold },
  draftBody:  { fontSize: 11.5, color: P.yellowText, lineHeight: 17, fontFamily: fonts.sansMedium },

  card: {
    margin: 14, marginBottom: 0, padding: 14,
    backgroundColor: P.white, borderRadius: 14,
    borderWidth: 1, borderColor: P.border,
  },
  cardTitle: { fontSize: 12.5, fontWeight: '800', color: P.ink, marginBottom: 9, fontFamily: fonts.displayBold, textTransform: 'uppercase', letterSpacing: 0.3 },
  helpText:  { fontSize: 11.5, color: P.muted, marginBottom: 9, lineHeight: 17, fontFamily: fonts.sansMedium },

  row:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  rowLabel: { fontSize: 11.5, color: P.muted, fontFamily: fonts.sansMedium },
  rowValue: { fontSize: 12.5, fontWeight: '800', color: P.ink, fontFamily: fonts.monoBold },

  clauseBox: {
    borderWidth: 1, borderColor: P.border, borderRadius: 11,
    padding: 10, marginBottom: 8,
  },
  clauseBoxOn: { borderColor: P.success, backgroundColor: P.successPale },
  clauseHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: P.muted4,
    justifyContent: 'center', alignItems: 'center', marginTop: 1, backgroundColor: P.white,
  },
  checkboxOn:   { backgroundColor: P.success, borderColor: P.success },
  checkboxTick: { color: P.white, fontSize: 13, fontWeight: '800', fontFamily: fonts.monoBold },
  clauseLabel:  { fontSize: 12, fontWeight: '800', color: P.ink, marginBottom: 2, fontFamily: fonts.displayBold },
  clauseDesc:   { fontSize: 10.5, color: P.muted, lineHeight: 15, fontFamily: fonts.sansMedium },
  optionRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 9, marginLeft: 29 },
  optionChip: {
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
    backgroundColor: P.white, borderWidth: 1, borderColor: P.border,
  },
  optionChipOn:   { backgroundColor: P.ink, borderColor: P.ink },
  optionChipText: { fontSize: 9.5, fontWeight: '800', color: P.muted2, fontFamily: fonts.monoBold },

  textArea: {
    borderWidth: 1, borderColor: P.border, borderRadius: 10,
    padding: 11, fontSize: 12, color: P.ink, minHeight: 60,
    textAlignVertical: 'top', fontFamily: fonts.sansMedium, backgroundColor: P.bg,
  },
  bonusRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 2, borderColor: P.ink, borderRadius: 11,
    backgroundColor: P.white,
  },
  rupee:      { paddingHorizontal: 11, fontSize: 17, fontWeight: '800', color: P.muted, fontFamily: fonts.monoBold },
  bonusInput: { flex: 1, paddingVertical: 11, fontSize: 17, fontWeight: '800', color: P.ink, fontFamily: fonts.monoBold },

  clauseReadonly: { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: P.borderSoft },

  sigRow:    { flexDirection: 'row', gap: 8 },
  sigBox:    { flex: 1, padding: 10, borderRadius: 10, backgroundColor: P.bg2, borderWidth: 1, borderColor: P.border },
  sigBoxSigned: { backgroundColor: P.successPale, borderColor: '#A8E6CC' },
  sigLabel:  { fontSize: 9, color: P.muted2, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4, fontFamily: fonts.monoBold, letterSpacing: 0.4 },
  sigCheck:  { fontSize: 12, fontWeight: '800', color: P.successText, marginBottom: 2, fontFamily: fonts.monoBold },
  sigName:   { fontSize: 11.5, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },
  sigDate:   { fontSize: 9.5, color: P.muted2, marginTop: 2, fontFamily: fonts.monoMedium },
  sigPending:{ fontSize: 11, color: P.muted2, fontStyle: 'italic', fontFamily: fonts.sansMedium },

  actionBtn: {
    margin: 14, paddingVertical: 14, backgroundColor: P.ink,
    borderRadius: 12, alignItems: 'center',
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { color: P.yellow, fontSize: 14, fontWeight: '900', fontFamily: fonts.displayBlack, letterSpacing: 0.2 },
  pdfBtn: {
    marginHorizontal: 14, marginTop: 12, borderRadius: 11, paddingVertical: 11,
    alignItems: 'center', backgroundColor: P.white, borderWidth: 1.5, borderColor: P.ink,
  },
  pdfBtnText: { color: P.ink, fontSize: 11.5, fontWeight: '800', fontFamily: fonts.monoBold, letterSpacing: 0.3 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  restoreDefaultText: { fontSize: 10, fontWeight: '800', color: P.ink, fontFamily: fonts.monoBold, borderBottomWidth: 1, borderBottomColor: P.ink, borderStyle: 'dashed' },
  requirementsInput: {
    marginTop: 6,
    borderWidth: 1, borderColor: P.border, backgroundColor: P.bg,
    borderRadius: 10, padding: 10,
    fontSize: 11.5, color: P.ink, fontFamily: fonts.monoMedium,
    minHeight: 130, textAlignVertical: 'top', lineHeight: 18,
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
  // Which place the brand tapped, while the shipping question is still open. Local to
  // the set-up panel — nothing is written until both questions are answered.
  const [pendingPlace, setPendingPlace] = useState(null);

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

  if (loading) return <View style={pmStyles.loadingBox}><ActivityIndicator color={P.ink} /></View>;
  if (mode === 'remote') {
    return (
      <View style={pmStyles.remoteBox}>
        <Text style={pmStyles.remoteTitle}><Text style={pmStyles.remoteIco}>[REMOTE]</Text>  Remote production</Text>
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
          Where will she work?
        </Text>
        {/* Same two questions as the collaboration request and the draft above, in the
            same words. Nothing is written until both are answered — tapping Remote no
            longer commits before the brand has said whether a box is moving. */}
        <View style={pmStyles.modeRow}>
          {PLACES.map(opt => (
            <TouchableOpacity
              key={opt.v}
              style={[pmStyles.modeCard, pendingPlace === opt.v && pmStyles.modeCardActive]}
              disabled={saving}
              onPress={async () => {
                setPendingPlace(opt.v);
                if (opt.v !== 'remote') {
                  setSave(true);
                  const res = await brandApi.initialiseProduction(contractId, 'visit');
                  setSave(false);
                  if (res.success) load();
                  else Alert.alert('Failed', res.error?.message || 'Could not initialise');
                }
              }}
            >
              <Text style={[pmStyles.modeLabel, pendingPlace === opt.v && pmStyles.modeLabelActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {pendingPlace === 'remote' && (
          <>
            <Text style={[pmStyles.helpHeader, { marginTop: 10 }]}>Are you sending her products?</Text>
            <View style={pmStyles.modeRow}>
              {SHIPPING.map(opt => (
                <TouchableOpacity
                  key={opt.v}
                  style={pmStyles.modeCard}
                  disabled={saving}
                  onPress={async () => {
                    setSave(true);
                    const res = await brandApi.initialiseProduction(contractId, toMode('remote', opt.v));
                    setSave(false);
                    if (res.success) load();
                    else Alert.alert('Failed', res.error?.message || 'Could not initialise');
                  }}
                >
                  <Text style={pmStyles.modeLabel}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        {saving && <Text style={pmStyles.smallNote}>Setting up…</Text>}
      </View>
    );
  }

  return (
    <View style={pmStyles.panel}>
      <View style={pmStyles.panelHead}>
        <Text style={pmStyles.panelTitle}>
          <Text style={pmStyles.panelIco}>{event.mode === 'visit' ? '[VISIT]' : '[SHIP]'}</Text>
          {event.mode === 'visit' ? '  Visit Coordination' : '  Product Shipment'}
        </Text>
        <StatusPill status={event.status} />
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
                <TextInput style={pmStyles.input} value={vAddress} onChangeText={setVAddress} placeholder="Plot 42, Silicon Valley..." placeholderTextColor={P.muted2} />
                <View style={pmStyles.row2}>
                  <TextInput style={[pmStyles.input, { flex: 1 }]} value={vCity} onChangeText={setVCity} placeholder="City" placeholderTextColor={P.muted2} />
                  <TextInput style={[pmStyles.input, { flex: 1 }]} value={vPincode} onChangeText={setVPincode} placeholder="Pincode" keyboardType="numeric" placeholderTextColor={P.muted2} />
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
                  <TextInput style={[pmStyles.input, { flex: 1 }]} value={vName} onChangeText={setVName} placeholder="Contact name" placeholderTextColor={P.muted2} />
                  <TextInput style={[pmStyles.input, { flex: 1 }]} value={vPhone} onChangeText={setVPhone} placeholder="Contact phone" keyboardType="phone-pad" placeholderTextColor={P.muted2} />
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
              <TextInput style={pmStyles.input} value={courier} onChangeText={setCourier} placeholder="Bluedart / Delhivery / Shiprocket / DTDC" placeholderTextColor={P.muted2} />
              <Text style={pmStyles.fieldLabel}>AWB / Tracking</Text>
              <TextInput style={pmStyles.input} value={awb} onChangeText={setAwb} placeholder="Enter tracking number" placeholderTextColor={P.muted2} />
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
  carried: { fontSize: 11, fontWeight: '700', color: '#1A7F52', marginTop: 8, lineHeight: 16 },
  loadingBox: { padding: 24, alignItems: 'center' },
  panel:      { marginHorizontal: 14, marginTop: 12, padding: 13, borderRadius: 14, backgroundColor: P.yellow50, borderWidth: 1, borderColor: P.border },
  panelHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  panelTitle: { fontSize: 13, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold, textTransform: 'uppercase', letterSpacing: 0.3, flex: 1 },
  panelIco:   { fontFamily: fonts.monoBold, fontSize: 10, color: P.yellow, backgroundColor: P.ink, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden', letterSpacing: 0.4, textTransform: 'none' },

  remoteBox:   { marginHorizontal: 14, marginTop: 12, padding: 18, borderRadius: 14, backgroundColor: P.bg2, borderWidth: 1, borderColor: P.border, alignItems: 'center' },
  remoteTitle: { fontSize: 14, fontWeight: '800', color: P.ink, marginBottom: 4, fontFamily: fonts.displayBold, textAlign: 'center' },
  remoteIco:   { fontFamily: fonts.monoBold, fontSize: 11, color: P.ink, backgroundColor: P.yellow, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5, overflow: 'hidden', letterSpacing: 0.4 },
  remoteBody:  { fontSize: 11, color: P.muted, textAlign: 'center', lineHeight: 16, fontFamily: fonts.sansMedium },

  fieldLabel: { fontSize: 9.5, fontWeight: '800', color: P.muted, marginTop: 9, marginBottom: 4, fontFamily: fonts.monoBold, textTransform: 'uppercase', letterSpacing: 0.4 },
  input:      { backgroundColor: P.white, borderRadius: 9, borderWidth: 1, borderColor: P.border, paddingHorizontal: 10, paddingVertical: 9, fontSize: 11.5, color: P.ink, marginBottom: 5, fontFamily: fonts.monoMedium },
  row2:       { flexDirection: 'row', gap: 8 },
  windowRow:  { flexDirection: 'row', gap: 5, marginVertical: 6, flexWrap: 'wrap' },
  windowChip: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: P.white, borderRadius: 14, borderWidth: 1, borderColor: P.border },
  windowChipActive: { backgroundColor: P.ink, borderColor: P.ink },
  windowChipTxt: { fontSize: 10, fontWeight: '800', color: P.muted2, fontFamily: fonts.monoBold },
  windowChipTxtActive: { color: P.yellow },

  primaryBtn:    { marginTop: 10, paddingVertical: 11, backgroundColor: P.ink, borderRadius: 10, alignItems: 'center' },
  primaryBtnTxt: { color: P.yellow, fontSize: 12, fontWeight: '800', fontFamily: fonts.displayBold, letterSpacing: 0.2 },
  primaryBtnAlt: { marginTop: 7, paddingVertical: 11, backgroundColor: P.success, borderRadius: 10, alignItems: 'center' },
  primaryBtnAltTxt: { color: P.white, fontSize: 12, fontWeight: '800', fontFamily: fonts.displayBold },
  secondaryBtn:  { marginTop: 7, paddingVertical: 10, backgroundColor: P.white, borderRadius: 10, borderWidth: 1.5, borderColor: P.ink, alignItems: 'center' },
  secondaryBtnTxt: { color: P.ink, fontSize: 11.5, fontWeight: '700', fontFamily: fonts.displayBold },
  linkBtn:       { marginTop: 7, paddingVertical: 7, alignItems: 'center' },
  linkBtnTxt:    { color: P.muted, fontSize: 10.5, fontWeight: '700', textDecorationLine: 'underline', fontFamily: fonts.monoBold },
  smallNote:     { fontSize: 9.5, color: P.muted2, marginTop: 5, textAlign: 'center', fontFamily: fonts.monoMedium },
  helpHeader:    { fontSize: 11, color: P.muted, marginBottom: 4, lineHeight: 16, fontFamily: fonts.sansMedium },
  dateHint:      { fontSize: 9.5, color: P.yellowText, marginTop: 4, marginBottom: 4, textAlign: 'center', fontWeight: '700', fontFamily: fonts.monoBold, backgroundColor: P.yellowPale, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },

  slotCard:      { padding: 11, backgroundColor: P.white, borderRadius: 10, borderWidth: 1.5, borderColor: P.success, marginVertical: 4 },
  slotLabel:     { fontSize: 9.5, fontWeight: '800', color: P.muted2, textTransform: 'uppercase', marginBottom: 4, fontFamily: fonts.monoBold, letterSpacing: 0.4 },
  slotTime:      { fontSize: 15, fontWeight: '800', color: P.ink, marginBottom: 3, fontFamily: fonts.displayBold },
  slotMeta:      { fontSize: 10.5, color: P.muted, fontFamily: fonts.monoMedium },

  flipBanner:    { backgroundColor: P.yellowPale, borderRadius: 10, padding: 10, marginBottom: 9, borderWidth: 1, borderColor: '#F0DA88' },
  flipBannerTxt: { fontSize: 11, color: P.ink2, lineHeight: 15, marginBottom: 7, fontFamily: fonts.sansMedium },
  flipConfirmBtn:{ alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 5, backgroundColor: P.ink, borderRadius: 7 },
  flipConfirmBtnTxt: { color: P.yellow, fontSize: 10, fontWeight: '800', fontFamily: fonts.monoBold },

  addrBox:    { padding: 10, backgroundColor: P.white, borderRadius: 10, borderWidth: 1, borderColor: P.border, marginBottom: 9 },
  addrLabel:  { fontSize: 9, fontWeight: '800', color: P.muted2, textTransform: 'uppercase', marginBottom: 4, fontFamily: fonts.monoBold, letterSpacing: 0.4 },
  addrText:   { fontSize: 11.5, color: P.ink, fontFamily: fonts.sansMedium },
  statusBox:  { padding: 10, backgroundColor: P.white, borderRadius: 10, borderWidth: 1, borderColor: P.border, marginTop: 8 },
  statusLine: { fontSize: 11, color: P.ink, marginBottom: 2, fontFamily: fonts.monoMedium },
  completeBox:{ marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: P.successPale, borderWidth: 1, borderColor: '#A8E6CC' },
  completeTxt:{ fontSize: 11.5, color: P.successText, fontWeight: '800', fontFamily: fonts.displayBold },

  logBox:   { marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: P.border },
  logTitle: { fontSize: 9, fontWeight: '800', color: P.muted2, textTransform: 'uppercase', marginBottom: 5, fontFamily: fonts.monoBold, letterSpacing: 0.4 },
  logRow:   { fontSize: 9.5, color: P.muted, marginBottom: 2, lineHeight: 14, fontFamily: fonts.monoMedium },
  logTime:  { color: P.muted2 },
  logActor: { color: P.ink, fontWeight: '700', fontFamily: fonts.monoBold },

  // Mode picker (mono-bracket icons — used inline in editing card AND in setup-production picker)
  modeRow:        { flexDirection: 'row', gap: 7, marginTop: 6 },
  modeCard:       { flex: 1, paddingVertical: 11, paddingHorizontal: 6, alignItems: 'center', backgroundColor: P.white, borderRadius: 11, borderWidth: 2, borderColor: P.border },
  modeCardActive: { borderColor: P.ink, backgroundColor: P.yellowPale },
  modeIcon:       { fontFamily: fonts.monoBold, fontSize: 11, color: P.muted2, backgroundColor: P.bg2, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, overflow: 'hidden', letterSpacing: 0.4 },
  modeIconActive: { backgroundColor: P.ink, color: P.yellow },
  modeLabel:      { fontSize: 11, fontWeight: '800', color: P.muted2, marginTop: 6, fontFamily: fonts.displayBold },
  modeLabelActive:{ color: P.ink },
});

// Wallet-check breakdown shown next to the bonus input on approve.
const walletStyles = StyleSheet.create({
  breakdownBox: {
    marginTop: 9,
    padding: 11,
    backgroundColor: P.bg2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: P.border,
  },
  breakdownBoxOver: {
    backgroundColor: P.dangerPale,
    borderColor: '#F2BFB4',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  rowLabel:  { fontSize: 10.5, color: P.muted, fontFamily: fonts.monoMedium },
  rowValue:  { fontSize: 10.5, color: P.ink, fontFamily: fonts.monoMedium },
  rowStrong: { fontSize: 11, color: P.ink, fontWeight: '800', fontFamily: fonts.monoBold },
  divider:   { borderTopWidth: 1, borderTopColor: P.border, marginTop: 4, paddingTop: 6 },
  shortageText: {
    marginTop: 7,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: 'rgba(232,64,26,0.25)',
    fontSize: 10.5,
    color: P.dangerText,
    fontWeight: '700',
    lineHeight: 15,
    fontFamily: fonts.sansMedium,
  },
});
