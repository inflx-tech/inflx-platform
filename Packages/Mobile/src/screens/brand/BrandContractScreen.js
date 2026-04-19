import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { colors, fmtRupees } from '../../theme/tokens';
import { brandApi } from '../../services/api';

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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Editable fields (draft only)
  const [clauses, setClauses] = useState({});         // { commercial_rights: { enabled, value }, ... }
  const [bonusAmount, setBonusAmount] = useState('');
  const [extraNotes, setExtraNotes] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await brandApi.getContract(campaignInfluencerId);
    setLoading(false);
    if (!res.success) {
      Alert.alert('Error', res.error?.message || 'Could not load contract');
      return;
    }
    const data = res.data || {};
    const c = data.contract || data;
    setContract(c);
    setDeliverables(data.deliverables || []);

    // Hydrate editor from existing custom_clauses if already saved
    const cc = c.custom_clauses;
    if (cc) {
      const parsed = typeof cc === 'string' ? (() => { try { return JSON.parse(cc); } catch { return {}; } })() : cc;
      setClauses(parsed?.clauses || {});
      setExtraNotes(parsed?.notes || '');
    }
    if (c.bonus_amount) setBonusAmount(String(c.bonus_amount));
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

    Alert.alert(
      'Send to Influencer',
      'Once sent, the influencer can sign the contract. Confirm details below are final.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', onPress: async () => {
          setSubmitting(true);
          const res = await brandApi.approveContract(contract.id, {
            custom_clauses: { clauses, notes: extraNotes || null },
            bonus_amount: bonus,
          });
          setSubmitting(false);
          if (res.success) {
            Alert.alert('Sent', 'Contract sent to influencer for signing.', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          } else {
            Alert.alert('Failed', res.error?.message || 'Could not send contract');
          }
        }},
      ]
    );
  }

  async function handleBrandSign() {
    Alert.alert(
      'Sign Contract',
      'By signing, you commit to all terms shown above. Tranche 1 will be released to the influencer.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign', onPress: async () => {
          setSubmitting(true);
          const res = await brandApi.brandSign(contract.id);
          setSubmitting(false);
          if (res.success) {
            Alert.alert('Signed!', 'Contract is now active. Tranche 1 has been released.', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
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

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Big draft banner */}
        {isDraft && (
          <View style={styles.draftBanner}>
            <Text style={styles.draftTitle}>📝 Draft Contract — Your Review</Text>
            <Text style={styles.draftBody}>
              The influencer accepted your offer. Review the auto-filled terms below, optionally
              add clauses or a bonus, then tap "Approve & Send" to forward it for signing.
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

        {/* Clause toggles (draft only) */}
        {isDraft && (
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

            {showFee && (
              <>
                <Text style={[styles.cardTitle, { marginTop: 16 }]}>Bonus (optional)</Text>
                <Text style={styles.helpText}>Add a bonus on top of the agreed fee. Split across 3 tranches just like the base fee.</Text>
                <View style={styles.bonusRow}>
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
              </>
            )}
          </View>
        )}

        {/* Read-only clauses (after draft) */}
        {!isDraft && Object.keys(clauses).filter(k => clauses[k]?.enabled).length > 0 && (
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

        {/* Action button */}
        {isDraft && (
          <TouchableOpacity
            style={[styles.actionBtn, submitting && styles.actionBtnDisabled]}
            onPress={handleApproveAndSend}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.actionBtnText}>Approve &amp; Send to Influencer</Text>}
          </TouchableOpacity>
        )}
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
        {isPendingInf && (
          <View style={[styles.card, { backgroundColor: colors.goldPale, borderColor: '#E8D590' }]}>
            <Text style={[styles.cardTitle, { color: '#7A5500' }]}>⏳ Waiting on Influencer</Text>
            <Text style={styles.helpText}>You sent the contract. The influencer will get a notification to review and sign.</Text>
          </View>
        )}
        {isActive && (
          <View style={[styles.card, { backgroundColor: colors.tealPale }]}>
            <Text style={[styles.cardTitle, { color: colors.tealDeep }]}>✓ Contract Active</Text>
            <Text style={styles.helpText}>
              Both parties have signed. Tranche 1 has been released. The influencer will now create and submit content for review.
            </Text>
          </View>
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
});
