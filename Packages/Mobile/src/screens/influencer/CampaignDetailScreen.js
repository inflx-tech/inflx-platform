import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
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

const DELIVERABLE_LABELS = {
  reel: 'Instagram Reel',
  post: 'Instagram Post',
  story: 'Instagram Story',
  youtube_video: 'YouTube Video',
  youtube_short: 'YouTube Short',
};

const DELIVERABLE_ICONS = {
  reel: '[R]',
  post: '[P]',
  story: '[S]',
  youtube_video: '[YV]',
  youtube_short: '[YS]',
};

// Status flow for the progress indicator
const STATUS_STEPS = [
  { key: 'invited', label: 'Invited' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'contracted', label: 'Contracted' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
];

function getStepIndex(status) {
  const idx = STATUS_STEPS.findIndex(s => s.key === status);
  return idx >= 0 ? idx : 0;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CampaignDetailScreen({ navigation, route }) {
  const { campaignInfluencerId } = route.params || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [negotiationData, setNegotiationData] = useState(null);
  const [negotiationLoading, setNegotiationLoading] = useState(false);

  useEffect(() => {
    if (!campaignInfluencerId) {
      setError('Missing campaign ID. Please go back and try again.');
      setLoading(false);
      return;
    }
    loadDetail();
  }, []);

  async function loadDetail() {
    setLoading(true);
    setError(null);
    try {
      console.log('[CampaignDetail] Loading ciId:', campaignInfluencerId);
      const res = await influencerApi.getMyCampaignDetail(campaignInfluencerId);
      console.log('[CampaignDetail] Response:', JSON.stringify(res).substring(0, 500));
      if (res.success) {
        setData(res.data);
        // If negotiating, fetch negotiation data
        const status = res.data?.campaign?.influencer_status;
        if (status === 'negotiating') {
          loadNegotiation();
        }
      } else {
        const errMsg = res.error?.message || res.error?.code || 'Failed to load campaign details';
        console.log('[CampaignDetail] API Error:', errMsg);
        setError(errMsg);
      }
    } catch (e) {
      const msg = e?.message || String(e);
      console.log('[CampaignDetail] Exception:', msg);
      setError('Error: ' + msg);
    }
    setLoading(false);
  }

  async function loadNegotiation() {
    setNegotiationLoading(true);
    try {
      const res = await influencerApi.getNegotiationByCampaignInfluencer(campaignInfluencerId);
      if (res.success) {
        setNegotiationData(res.data?.negotiation || res.data);
      }
    } catch (e) {
      // Non-critical: negotiation data is supplementary
    }
    setNegotiationLoading(false);
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.navy} />
        <Text style={styles.loadingText}>Loading campaign...</Text>
      </View>
    );
  }

  if (error || !data || !data.campaign) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>{error || 'Campaign not found'}</Text>
        <Text style={{ fontSize: 11, color: '#999', marginBottom: 16, textAlign: 'center' }}>
          ID: {campaignInfluencerId || 'none'}
        </Text>
        <TouchableOpacity onPress={loadDetail} style={[styles.backBtn, { marginBottom: 8 }]}>
          <Text style={styles.backBtnText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const campaign = data.campaign || {};
  const deliverables = data.deliverables || [];
  const contract = data.contract || null;
  const tranches = data.tranches || [];
  // Product counts for the "Publish to Store" badge + CTA banner. Backend
  // populates these on /influencers/me/campaigns/:ci_id; absent on older
  // payloads, in which case the badge hides cleanly.
  const productsTotal     = Number(data.products_total     || 0);
  const productsPublished = Number(data.products_published || 0);
  const productsPending   = Math.max(0, productsTotal - productsPublished);

  // contracts.influencer_fee is the BASE agreed fee (after the F.2 backend fix
  // that stopped overwriting it with base+bonus). Total payout = base + bonus.
  const baseFee     = parseFloat(contract?.influencer_fee || campaign.agreed_fee || campaign.influencer_budget || campaign.per_influencer_budget || 0);
  const bonusAmount = parseFloat(contract?.bonus_amount || 0);
  const totalFee    = baseFee + bonusAmount;
  // Backwards-compat alias used by older render code below — uses TOTAL so
  // tranche math (fee × 25%) gives the right amount.
  const fee = totalFee;
  const commissionPct = campaign.commission_pct ? parseFloat(campaign.commission_pct) : 0;
  const currentStep = getStepIndex(campaign.influencer_status);
  const influencerStatus = campaign.influencer_status || 'invited';

  // Goal-based visibility — matches OfferDetailScreen.
  // Conversion campaigns have no fee → no tranches; engagement/hybrid keep them.
  const goal = (campaign.goal || 'engagement').toLowerCase();
  const isConversion   = goal === 'conversion';
  const isHybrid       = goal === 'hybrid';
  const isEngagement   = goal === 'engagement';
  const showFee        = isEngagement || isHybrid;
  const showCommission = isConversion || isHybrid;
  const showTranches   = isEngagement || isHybrid;

  // ── Render helpers ───────────────────────────────────────────────────────

  function renderContractSection() {
    switch (influencerStatus) {
      case 'invited':
        return (
          <Text style={styles.noDataText}>
            Contract will be generated after you accept the offer.
          </Text>
        );

      case 'negotiating':
        return (
          <View>
            <View style={styles.negotiationInfoBox}>
              <Text style={styles.negotiationInfoIcon}>{'[N]'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.negotiationInfoTitle}>Negotiation in Progress</Text>
                <Text style={styles.negotiationInfoSub}>
                  You are currently negotiating terms for this campaign. The contract will be generated once both parties agree.
                </Text>
                {negotiationLoading && (
                  <ActivityIndicator size="small" color={colors.orange} style={{ marginTop: 8 }} />
                )}
                {negotiationData && (
                  <View style={styles.negotiationSummary}>
                    <Text style={styles.negotiationSummaryText}>
                      Current turn: {negotiationData.current_turn === 'influencer' ? 'Your turn' : "Brand's turn"}
                    </Text>
                    {negotiationData.turns && negotiationData.turns.length > 0 && (
                      <Text style={styles.negotiationSummaryText}>
                        Latest offer: {fmtRupees(negotiationData.turns[negotiationData.turns.length - 1]?.proposed_fee || 0)}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => {
                const negId = negotiationData?.id || negotiationData?.negotiation_id;
                navigation.navigate('Negotiation', {
                  negotiation_id: negId || undefined,
                  campaign_influencer_id: campaignInfluencerId,
                });
              }}
            >
              <Text style={styles.actionBtnText}>View Negotiation</Text>
            </TouchableOpacity>
          </View>
        );

      case 'accepted':
      case 'contracted':
      case 'active':
      case 'completed': {
        // After accept, the brand has to APPROVE the contract draft before
        // the influencer can sign. The actual UX state is the contract row's
        // status, not the CI status. Map every meaningful state explicitly.
        if (!contract) {
          return (
            <View style={styles.preparingBox}>
              <ActivityIndicator size="small" color={colors.navy} />
              <Text style={styles.preparingText}>
                Contract is being created. Pull to refresh in a few seconds.
              </Text>
            </View>
          );
        }
        const cs = contract.status;
        const isDraft           = cs === 'draft';
        const isPendingInf      = cs === 'pending_influencer';
        const isPendingBrand    = cs === 'pending_brand';
        const isFullyActive     = cs === 'active';
        return (
          <View>
            {/* State-specific banner */}
            {isDraft && (
              <View style={[styles.preparingBox, { backgroundColor: '#FFF8E0', borderColor: '#E8D590' }]}>
                <Text style={[styles.preparingText, { color: '#7A5500', fontWeight: '700' }]}>
                  Brand is reviewing the contract draft. You'll be notified when it's ready to sign.
                </Text>
              </View>
            )}
            {isPendingInf && (
              <View style={[styles.preparingBox, { backgroundColor: colors.tealPale, borderColor: colors.teal }]}>
                <Text style={[styles.preparingText, { color: colors.tealDeep, fontWeight: '700' }]}>
                  Brand approved the contract — your turn to sign.
                </Text>
              </View>
            )}
            {isPendingBrand && (
              <View style={[styles.preparingBox, { backgroundColor: colors.navyPale, borderColor: colors.navy }]}>
                <Text style={[styles.preparingText, { color: colors.navy, fontWeight: '700' }]}>
                  {isConversion
                    ? 'You signed. Waiting for brand counter-signature to activate your tracking link.'
                    : 'You signed. Waiting for brand counter-signature to release Tranche 1.'}
                </Text>
              </View>
            )}
            {isFullyActive && (
              <View style={[styles.preparingBox, { backgroundColor: colors.tealPale, borderColor: colors.teal }]}>
                <Text style={[styles.preparingText, { color: colors.tealDeep, fontWeight: '700' }]}>
                  {isConversion
                    ? 'Contract active — both parties signed. Your tracking link is live.'
                    : 'Contract active — both parties signed. Tranche 1 released.'}
                </Text>
              </View>
            )}

            {/* Signature timeline (always shown when contract exists) */}
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Your Signature</Text>
                <Text style={styles.infoValue}>
                  {contract.influencer_signed_at ? formatDate(contract.influencer_signed_at) : 'Not signed'}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Brand Signature</Text>
                <Text style={styles.infoValue}>
                  {contract.brand_signed_at ? formatDate(contract.brand_signed_at) : 'Not signed'}
                </Text>
              </View>
            </View>

            {/* Action button — only when sign is required */}
            {isPendingInf && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => navigation.navigate('Contract', {
                  campaignInfluencerId: campaign.campaign_influencer_id,
                })}
              >
                <Text style={styles.actionBtnText}>Review &amp; Sign Contract</Text>
              </TouchableOpacity>
            )}

            {/* View contract — text-card view always */}
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('Contract', {
                campaignInfluencerId: campaign.campaign_influencer_id,
              })}
            >
              <Text style={styles.secondaryBtnText}>View Contract Details</Text>
            </TouchableOpacity>

            {/* PDF view — only after BOTH parties signed (contract is fully active) */}
            {isFullyActive && (
              <TouchableOpacity
                style={[styles.secondaryBtn, { marginTop: 8, backgroundColor: colors.navy }]}
                onPress={() => navigation.navigate('ContractPdf', { contractId: contract.id })}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.white }]}>View Contract PDF</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }

      case 'declined':
      case 'expired':
        return (
          <Text style={styles.noDataText}>
            This campaign assignment has been {influencerStatus}.
          </Text>
        );

      default:
        return (
          <Text style={styles.noDataText}>
            Contract information is not available for this status.
          </Text>
        );
    }
  }

  function renderRequirementsSection() {
    const hasDeliverables = deliverables.length > 0;
    const hasBrief = !!campaign.brief;
    const hasPostingDate = !!campaign.posting_date;

    if (!hasDeliverables && !hasBrief && !hasPostingDate) return null;

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Requirements & Deliverables</Text>

        {/* Campaign Brief */}
        {hasBrief && (
          <View style={styles.briefBox}>
            <Text style={styles.infoLabel}>Campaign Brief</Text>
            <Text style={styles.briefText}>{campaign.brief}</Text>
          </View>
        )}

        {/* Posting Date */}
        {hasPostingDate && (
          <View style={styles.requirementRow}>
            <Text style={styles.infoLabel}>Posting Date</Text>
            <Text style={styles.infoValue}>{formatDate(campaign.posting_date)}</Text>
          </View>
        )}

        {/* Content Requirements from contract */}
        {contract && contract.content_requirements && (
          <View style={styles.briefBox}>
            <Text style={styles.infoLabel}>Content Requirements</Text>
            <Text style={styles.briefText}>{contract.content_requirements}</Text>
          </View>
        )}

        {/* Deliverables Table */}
        {hasDeliverables && (
          <View style={styles.deliverablesTable}>
            <Text style={styles.sectionLabel}>Deliverables Summary</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { flex: 2 }]}>Type</Text>
              <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>Qty</Text>
              <Text style={[styles.tableHeaderText, { flex: 2, textAlign: 'center' }]}>Deadline</Text>
              <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>Rev.</Text>
              <Text style={[styles.tableHeaderText, { flex: 1.5, textAlign: 'right' }]}>Status</Text>
            </View>
            {deliverables.map((d, i) => (
              <View key={d.id || i} style={styles.tableRow}>
                <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.deliverableIcon}>{DELIVERABLE_ICONS[d.type] || '[?]'}</Text>
                  <Text style={styles.tableCell} numberOfLines={1}>
                    {DELIVERABLE_LABELS[d.type] || d.type}
                  </Text>
                </View>
                <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>
                  {d.quantity || 1}
                </Text>
                <Text style={[styles.tableCell, { flex: 2, textAlign: 'center', fontSize: 10 }]}>
                  {formatDate(d.submission_deadline)}
                </Text>
                <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>
                  {d.revision_count || 0}/{d.revision_limit || 2}
                </Text>
                <View style={{ flex: 1.5, alignItems: 'flex-end' }}>
                  <StatusBadge status={d.status} size={8} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Brand Feedback per deliverable */}
        {deliverables.some(d => d.brand_feedback) && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.sectionLabel}>Brand Feedback</Text>
            {deliverables.filter(d => d.brand_feedback).map((d, i) => (
              <View key={d.id || i} style={styles.feedbackRow}>
                <Text style={styles.feedbackLabel}>
                  {DELIVERABLE_LABELS[d.type] || d.type}:
                </Text>
                <Text style={styles.feedbackText}>{d.brand_feedback}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Upload Content — every deliverable has its own row + upload entry
            in DeliverableList, so the influencer sees ALL deliverables (not
            just the first). Available throughout the active phase: pending /
            revision_requested → upload media; approved → submit live URL. */}
        {(influencerStatus === 'active' || influencerStatus === 'contracted') &&
         deliverables.some(d => ['pending', 'revision_requested'].includes(d.status)) && (
          <TouchableOpacity
            style={[styles.actionBtn, { marginTop: 14 }]}
            onPress={() => navigation.navigate('DeliverableList', {
              campaign_influencer_id: campaign.campaign_influencer_id,
              campaign_name: campaign.campaign_name,
              brand_name: campaign.brand_name,
            })}
          >
            <Text style={styles.actionBtnText}>
              Upload Content ({deliverables.filter(d => ['pending', 'revision_requested'].includes(d.status)).length} pending)
            </Text>
          </TouchableOpacity>
        )}

        {/* Submit Live URL — once brand approves, influencer needs to post
            on Instagram and submit the live URL. Without this CTA, after
            brand approval the upload button disappears and the live-URL
            submit form is hidden 2-3 navigations deep. */}
        {deliverables.some(d => d.status === 'approved' && !d.live_url) && (
          <TouchableOpacity
            style={[styles.actionBtn, { marginTop: 10, backgroundColor: colors.tealDeep }]}
            onPress={() => navigation.navigate('DeliverableList', {
              campaign_influencer_id: campaign.campaign_influencer_id,
              campaign_name: campaign.campaign_name,
              brand_name: campaign.brand_name,
            })}
          >
            <Text style={styles.actionBtnText}>
              Submit Live URL ({deliverables.filter(d => d.status === 'approved' && !d.live_url).length} approved, awaiting URL)
            </Text>
          </TouchableOpacity>
        )}

        {/* Pre-contract hint: deliverables visible but not yet uploadable. */}
        {influencerStatus !== 'active' && deliverables.length > 0 && (
          <Text style={[styles.briefText, { marginTop: 10, fontStyle: 'italic', color: colors.t3 }]}>
            You'll be able to upload content once the contract is fully signed by both parties.
          </Text>
        )}
      </View>
    );
  }

  // ── Main Render (wrapped in try-catch via ErrorBoundary pattern) ────────

  try {
    return (
      <ScrollView style={styles.container}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>{'<-'} Back</Text>
          </TouchableOpacity>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.brandNameHeader}>{campaign.brand_name || 'Brand'}</Text>
              <Text style={styles.campaignNameHeader}>{campaign.campaign_name || 'Campaign'}</Text>
            </View>
            <StatusBadge status={influencerStatus} size={11} />
          </View>
        </View>

        {/* ── Completion Banner ─────────────────────────────────────────── */}
        {influencerStatus === 'completed' && (
          <TouchableOpacity
            style={styles.completionBanner}
            onPress={() => navigation.navigate('CampaignCompletion', {
              campaignInfluencerId: campaign.campaign_influencer_id,
            })}
          >
            <Text style={styles.completionBannerIcon}>{'[OK]'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.completionBannerTitle}>Campaign Completed!</Text>
              <Text style={styles.completionBannerSub}>View your earnings summary and stats</Text>
            </View>
            <Text style={styles.completionBannerArrow}>{'>'}</Text>
          </TouchableOpacity>
        )}

        {/* ── Publish-products CTA (conversion/hybrid only, after contract
            activation, when at least one product is still unpublished). The
            yellow banner is the primary nudge so the creator knows publishing
            is the next step — without it the "Publish to Store" grid button
            blends in with the others. */}
        {showCommission &&
         contract?.status === 'active' &&
         productsTotal > 0 &&
         productsPending > 0 && (
          <TouchableOpacity
            style={styles.publishCtaCard}
            onPress={() => navigation.navigate('CampaignProducts', {
              campaignInfluencerId: campaignInfluencerId,
              campaignName: campaign?.campaign_name || 'Campaign',
            })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.publishCtaTitle}>
                {productsPublished === 0
                  ? 'Publish products so followers can see them'
                  : `${productsPending} more product${productsPending === 1 ? '' : 's'} to publish`}
              </Text>
              <Text style={styles.publishCtaSub}>
                {productsPublished === 0
                  ? `${productsTotal} product${productsTotal === 1 ? '' : 's'} waiting on your store`
                  : `${productsPublished} of ${productsTotal} live · tap to publish the rest`}
              </Text>
            </View>
            <Text style={styles.publishCtaArrow}>{'›'}</Text>
          </TouchableOpacity>
        )}

        {/* ── Quick Actions (TOP) ────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {contract && (
              <TouchableOpacity
                style={styles.gridBtn}
                onPress={() => navigation.navigate('Contract', {
                  campaignInfluencerId: campaign.campaign_influencer_id,
                })}
              >
                <Text style={styles.gridBtnIcon}>{'[C]'}</Text>
                <Text style={styles.gridBtnLabel}>Contract</Text>
              </TouchableOpacity>
            )}

            {influencerStatus === 'negotiating' && (
              <TouchableOpacity
                style={styles.gridBtn}
                onPress={() => {
                  const negId = negotiationData?.id || negotiationData?.negotiation_id;
                  navigation.navigate('Negotiation', {
                    negotiation_id: negId || undefined,
                    campaign_influencer_id: campaignInfluencerId,
                  });
                }}
              >
                <Text style={styles.gridBtnIcon}>{'[N]'}</Text>
                <Text style={styles.gridBtnLabel}>Negotiation</Text>
              </TouchableOpacity>
            )}

            {/* Publish-to-Store button — only for conversion/hybrid campaigns.
                Label changed from "Products" so creators understand this is
                where they push items to followers, not a passive viewer. The
                (X/Y) counter renders when backend populated the counts. */}
            {showCommission && (
              <TouchableOpacity
                style={styles.gridBtn}
                onPress={() => navigation.navigate('CampaignProducts', {
                  campaignInfluencerId: campaignInfluencerId,
                  campaignName: campaign?.campaign_name || 'Campaign',
                })}
              >
                <Text style={styles.gridBtnIcon}>{'[P]'}</Text>
                <Text style={styles.gridBtnLabel}>Publish to Store</Text>
                {productsTotal > 0 && (
                  <Text style={styles.publishCount}>
                    {productsPublished}/{productsTotal}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.gridBtn}
              onPress={() => navigation.navigate('Earnings')}
            >
              <Text style={styles.gridBtnIcon}>{'[$]'}</Text>
              <Text style={styles.gridBtnLabel}>Earnings</Text>
            </TouchableOpacity>

            {campaign.coupon_code ? (
              <View style={styles.gridBtn}>
                <Text style={styles.gridBtnIcon}>{'[%]'}</Text>
                <Text style={styles.gridBtnLabel}>Coupon</Text>
                <Text style={styles.couponCode}>{campaign.coupon_code}</Text>
              </View>
            ) : null}

            {showCommission && campaign.commission_pct ? (
              <View style={styles.gridBtn}>
                <Text style={styles.gridBtnIcon}>{'[*]'}</Text>
                <Text style={styles.gridBtnLabel}>Commission</Text>
                <Text style={styles.commissionRate}>{parseFloat(campaign.commission_pct)}%</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Progress Indicator ─────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Campaign Progress</Text>
          <View style={styles.progressRow}>
            {STATUS_STEPS.map((step, i) => {
              const isActive = i <= currentStep;
              const isCurrent = i === currentStep;
              return (
                <View key={step.key} style={styles.stepContainer}>
                  <View style={styles.stepDotRow}>
                    {i > 0 && (
                      <View style={[styles.stepLine, isActive && styles.stepLineActive]} />
                    )}
                    <View style={[
                      styles.stepDot,
                      isActive && styles.stepDotActive,
                      isCurrent && styles.stepDotCurrent,
                    ]} />
                  </View>
                  <Text style={[
                    styles.stepLabel,
                    isActive && styles.stepLabelActive,
                    isCurrent && styles.stepLabelCurrent,
                  ]}>
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Campaign Info ──────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Campaign Info</Text>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Campaign</Text>
              <Text style={styles.infoValue}>{campaign.campaign_name || '--'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Campaign Status</Text>
              <StatusBadge status={campaign.campaign_status} size={10} />
            </View>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Start Date</Text>
              <Text style={styles.infoValue}>{formatDate(campaign.start_date || campaign.content_start_date)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>End Date</Text>
              <Text style={styles.infoValue}>{formatDate(campaign.end_date || campaign.content_end_date)}</Text>
            </View>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Type</Text>
              <Text style={styles.infoValue}>
                {(campaign.goal || '--').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())}
              </Text>
            </View>
            {/* Set name intentionally hidden — brand-side grouping concept */}
          </View>
        </View>

        {/* ── Requirements & Deliverables (BUG 2 fix) ────────────────────── */}
        {renderRequirementsSection()}

        {/* ── Brand Info ─────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Brand Info</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Business Name</Text>
              <Text style={styles.infoValue}>{campaign.brand_name || '--'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Contact</Text>
              <Text style={styles.infoValue}>{campaign.brand_contact_name || '--'}</Text>
            </View>
          </View>
        </View>

        {/* ── Fee & Payment ──────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment</Text>

          {/* Fee — engagement & hybrid only. Show base + bonus breakdown
              when the brand attached a bonus on top of the agreed fee. */}
          {showFee && (
            <View style={styles.feeHighlight}>
              <Text style={styles.feeLabel}>Total Fee</Text>
              <Text style={styles.feeValue}>{fmtRupees(totalFee)}</Text>
              {bonusAmount > 0 && (
                <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)', width: '100%' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 11, color: colors.tealDeep }}>Base agreed fee</Text>
                    <Text style={{ fontSize: 11, color: colors.tealDeep, fontWeight: '700' }}>{fmtRupees(baseFee)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={{ fontSize: 11, color: colors.tealDeep }}>+ Brand bonus</Text>
                    <Text style={{ fontSize: 11, color: colors.tealDeep, fontWeight: '700' }}>{fmtRupees(bonusAmount)}</Text>
                  </View>
                  <Text style={{ fontSize: 10, color: colors.tealDeep, opacity: 0.75, marginTop: 6, fontStyle: 'italic' }}>
                    Bonus added by the brand for the special clauses you accepted in the contract.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Commission — conversion & hybrid only */}
          {showCommission && (
            <View style={[styles.feeHighlight, showFee && { marginTop: 10 }]}>
              <Text style={styles.feeLabel}>Commission per Conversion</Text>
              <Text style={styles.feeValue}>{commissionPct ? `${commissionPct}%` : 'Not set'}</Text>
            </View>
          )}

          {/* For pure-conversion: no fee → no tranches, show earning flow instead */}
          {!showTranches && (
            <Text style={[styles.paymentNote, { marginTop: 12 }]}>
              You earn {commissionPct ? `${commissionPct}% commission` : 'commission'} on every
              conversion driven through your tracking link. Earnings sit in your pending balance
              during a 30-day return window, then move to your wallet for withdrawal.
            </Text>
          )}

          {/* Tranche progress — engagement/hybrid only */}
          {showTranches && tranches.length > 0 ? (
            <View>
              <Text style={styles.sectionLabel}>Tranche Progress</Text>
              {tranches.map(t => {
                const dotColor = t.status === 'released'
                  ? colors.teal
                  : t.status === 'locked'
                  ? colors.navy
                  : colors.orange;
                return (
                  <View key={t.tranche_number} style={styles.trancheRow}>
                    <View style={[styles.trancheDot, { backgroundColor: dotColor }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.trancheTitle}>
                        Tranche {t.tranche_number}
                      </Text>
                      <Text style={styles.trancheDesc}>
                        {t.trigger_event
                          ? t.trigger_event.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
                          : '--'}
                      </Text>
                      {t.released_at && (
                        <Text style={styles.trancheDate}>Released: {formatDate(t.released_at)}</Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.trancheAmount}>{fmtRupees(t.net_to_influencer)}</Text>
                      <StatusBadge status={t.status} size={9} />
                    </View>
                  </View>
                );
              })}
            </View>
          ) : showTranches ? (
            <View>
              <Text style={styles.paymentNote}>
                Payment terms will appear once the contract is signed.
              </Text>
              <Text style={styles.sectionLabel}>Expected Payment Schedule</Text>
              {[
                { pct: 25, label: 'Tranche 1 (25%)', desc: 'Both parties sign the contract', color: colors.teal },
                { pct: 25, label: 'Tranche 2 (25%)', desc: 'Content goes live', color: colors.orange },
                { pct: 50, label: 'Tranche 3 (50%)', desc: '30 days after content live', color: colors.navy },
              ].map((t, i) => (
                <View key={i} style={styles.trancheRow}>
                  <View style={[styles.trancheDot, { backgroundColor: t.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trancheTitle}>{t.label}</Text>
                    <Text style={styles.trancheDesc}>{t.desc}</Text>
                  </View>
                  <Text style={styles.trancheAmount}>
                    {fmtRupees(Math.round(fee * t.pct / 100))}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* TDS note only for campaigns with a fee (tranches/withdrawal). Pure
              commission campaigns show it implicitly via the withdrawal flow. */}
          {showTranches && (
            <View style={styles.tdsNote}>
              <Text style={styles.tdsText}>
                Note: 10% TDS is deducted at the time of withdrawal, not at earning.
              </Text>
            </View>
          )}
        </View>

        {/* ── Contract Status — all goals flow through the contract state
            machine now. Conversion contracts cover agreed commission terms
            (no upfront fee, no tranches); the ContractScreen is goal-aware
            and shows the right schedule card. */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contract</Text>
          {renderContractSection()}
        </View>

        {/* (Deliverables list lives inside Requirements & Deliverables now —
            duplicate section removed. Upload action moved to a single
            "Upload All Content" button there that opens DeliverableList,
            which lets the influencer pick + upload each deliverable.) */}

        {/* (Quick Actions moved to TOP of the screen, right after the
            completion banner and progress indicator.) */}

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  } catch (renderError) {
    // BUG 3 fix: catch render errors gracefully
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Something went wrong displaying this campaign.</Text>
        <Text style={styles.loadingText}>{String(renderError?.message || '')}</Text>
        <TouchableOpacity onPress={loadDetail} style={[styles.backBtn, { marginTop: 12 }]}>
          <Text style={styles.backBtnText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.secondaryBtn, { marginTop: 8, paddingHorizontal: 24 }]}>
          <Text style={styles.secondaryBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: 24 },
  emptyText: { fontSize: 14, color: colors.t3, marginBottom: 16, textAlign: 'center' },
  loadingText: { fontSize: 13, color: colors.t3, marginTop: 12, textAlign: 'center' },

  // Header
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  back: { marginBottom: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brandNameHeader: { fontSize: 20, fontWeight: '800', color: colors.white },
  campaignNameHeader: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 },

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

  // Progress indicator
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 4,
  },
  stepContainer: { alignItems: 'center', flex: 1 },
  stepDotRow: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
  },
  stepLineActive: { backgroundColor: colors.teal },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.border,
  },
  stepDotActive: { backgroundColor: colors.teal },
  stepDotCurrent: {
    backgroundColor: colors.teal,
    borderWidth: 3,
    borderColor: colors.tealPale,
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  stepLabel: { fontSize: 9, color: colors.t3, marginTop: 6, fontWeight: '600', textAlign: 'center' },
  stepLabelActive: { color: colors.tealDeep },
  stepLabelCurrent: { fontWeight: '800', color: colors.tealDeep },

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

  // Brief
  briefBox: {
    backgroundColor: colors.surface2,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  briefText: { fontSize: 13, color: colors.t2, lineHeight: 20, marginTop: 4 },

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
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.t3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  paymentNote: { fontSize: 12, color: colors.t3, marginBottom: 14, lineHeight: 18 },

  // Tranche rows
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
  trancheDate: { fontSize: 10, color: colors.teal, marginTop: 2 },
  trancheAmount: { fontSize: 14, fontWeight: '800', color: colors.t1, marginBottom: 4 },

  tdsNote: {
    backgroundColor: colors.goldPale,
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  tdsText: { fontSize: 11, color: '#7A5500', lineHeight: 16 },

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
  deliverableRevisions: { fontSize: 11, color: colors.orange, marginTop: 2 },
  liveDate: { fontSize: 9, color: colors.teal },

  noDataText: { fontSize: 13, color: colors.t3, lineHeight: 18 },

  // Action buttons
  actionBtn: {
    backgroundColor: colors.teal,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },

  secondaryBtn: {
    backgroundColor: colors.navyPale,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '700', color: colors.navy },

  backBtn: {
    backgroundColor: colors.navy,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  backBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },

  // Quick actions grid
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridBtn: {
    flex: 1,
    minWidth: '40%',
    backgroundColor: colors.surface2,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  gridBtnIcon: { fontSize: 20, marginBottom: 6 },
  gridBtnLabel: { fontSize: 11, fontWeight: '700', color: colors.t1, textAlign: 'center' },
  publishCount: { fontSize: 12, fontWeight: '800', color: colors.orange, marginTop: 4 },
  couponCode: { fontSize: 12, fontWeight: '700', color: colors.tealDeep, marginTop: 4, fontFamily: 'monospace' },
  commissionRate: { fontSize: 14, fontWeight: '800', color: colors.tealDeep, marginTop: 4 },

  // Publish-products CTA banner (above Quick Actions when contract active +
  // unpublished products remain).
  publishCtaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFF8E0',
    borderWidth: 1,
    borderColor: '#E8D590',
    borderRadius: 12,
  },
  publishCtaTitle: { fontSize: 13, fontWeight: '800', color: '#7A5500' },
  publishCtaSub:   { fontSize: 11, color: '#7A5500', marginTop: 2 },
  publishCtaArrow: { fontSize: 22, color: '#7A5500', marginLeft: 8, fontWeight: '300' },

  // Completion banner
  completionBanner: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: colors.tealPale,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.teal,
  },
  completionBannerIcon: { fontSize: 18, fontWeight: '800', color: colors.tealDeep },
  completionBannerTitle: { fontSize: 14, fontWeight: '700', color: colors.tealDeep },
  completionBannerSub: { fontSize: 11, color: colors.tealDeep, marginTop: 2, opacity: 0.7 },
  completionBannerArrow: { fontSize: 16, fontWeight: '700', color: colors.tealDeep },

  // Negotiation info box (BUG 1 fix)
  negotiationInfoBox: {
    backgroundColor: colors.orangePale,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.orange,
  },
  negotiationInfoIcon: { fontSize: 18, fontWeight: '800', color: colors.orangeDeep },
  negotiationInfoTitle: { fontSize: 13, fontWeight: '700', color: colors.orangeDeep },
  negotiationInfoSub: { fontSize: 12, color: colors.t2, marginTop: 4, lineHeight: 18 },
  negotiationSummary: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.orange,
  },
  negotiationSummaryText: { fontSize: 12, fontWeight: '600', color: colors.t1, marginBottom: 2 },

  // Preparing box (accepted status)
  preparingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.navyPale,
    borderRadius: 10,
    padding: 14,
  },
  preparingText: { flex: 1, fontSize: 13, color: colors.t2, lineHeight: 18 },

  // Requirements & Deliverables table (BUG 2 fix)
  requirementRow: { marginBottom: 12 },
  deliverablesTable: { marginTop: 12 },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: colors.border2,
    marginBottom: 4,
  },
  tableHeaderText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.t3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableCell: { fontSize: 11, color: colors.t1, fontWeight: '500' },
  deliverableIcon: { fontSize: 10, fontWeight: '700', color: colors.navy },

  // Feedback
  feedbackRow: { marginBottom: 8 },
  feedbackLabel: { fontSize: 11, fontWeight: '700', color: colors.t2 },
  feedbackText: { fontSize: 11, color: colors.red, marginTop: 2, fontStyle: 'italic' },
});
