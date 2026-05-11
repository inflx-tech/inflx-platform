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
  const [negotiatingCommission, setNegotiatingCommission] = useState('');
  const [note, setNote] = useState('');

  const countdown = useCountdown(offer?.offer_expires_at);

  // Fetch full offer detail on mount
  useEffect(() => {
    if (!passedOffer?.id) return;
    loadDetail();
  }, [passedOffer?.id]);

  const [products, setProducts] = useState([]);

  async function loadDetail() {
    setLoading(true);
    // Fetch offer detail + linked products in parallel. Products endpoint
    // returns the brand catalogue items the influencer is supposed to promote
    // (relevant for conversion / hybrid campaigns).
    const [res, prodRes] = await Promise.all([
      influencerApi.getOfferDetail(passedOffer.id),
      influencerApi.getCampaignProducts(passedOffer.id).catch(() => ({ success: false })),
    ]);
    setLoading(false);
    if (res.success) {
      setOffer(res.data?.offer || passedOffer);
    }
    if (prodRes?.success) {
      setProducts(prodRes.data?.products || prodRes.data || []);
    }
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  async function accept() {
    const goalLc = (offer.goal || 'engagement').toLowerCase();
    const isConversionAccept = goalLc === 'conversion';
    Alert.alert(
      'Accept Offer',
      isConversionAccept
        ? "You'll get a contract covering the agreed commission terms. No upfront fee — you earn on every sale or booking driven by your tracking link once signed."
        : 'Are you sure you want to accept this offer? A contract will be generated for signing.',
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
    // Goal-aware validation. We rely on showFee / showCommission flags
    // computed below. Recompute here too because submitCounter runs early.
    const _goal = (offer?.goal || 'engagement').toLowerCase();
    const _showFee        = _goal === 'engagement' || _goal === 'hybrid';
    const _showCommission = _goal === 'conversion' || _goal === 'hybrid';
    const _allowCommission = offer?.allow_commission_negotiation !== false;

    const feeAmount = _showFee ? parseFloat(negotiatingFee) : null;
    const commissionAmount = (_showCommission && _allowCommission)
      ? parseFloat(negotiatingCommission)
      : null;

    if (_showFee && (!feeAmount || feeAmount <= 0)) {
      Alert.alert('Invalid Fee', 'Please enter a valid fee amount.');
      return;
    }
    if (_showCommission && _allowCommission && (!commissionAmount || commissionAmount <= 0 || commissionAmount > 100)) {
      Alert.alert('Invalid Commission', 'Please enter a commission % between 0 and 100.');
      return;
    }

    const payloadFields = {
      ...(feeAmount        != null && { proposed_fee: feeAmount }),
      ...(commissionAmount != null && { proposed_commission_pct: commissionAmount }),
      note: note || undefined,
    };

    setActionLoading(true);

    // If no negotiation thread exists yet, initiate one and open the chat.
    if (!offer.negotiation?.id && !offer.negotiation_id) {
      const negRes = await influencerApi.negotiateOffer(offer.id, payloadFields);
      setActionLoading(false);
      if (negRes.success) {
        const negId = negRes.data?.negotiation?.id;
        // Replace this screen with the chat thread so the user can SEE the
        // brand's reply when it lands. Replace (not push) so back button
        // returns to the offer list, not back into this offer detail.
        if (negId) {
          navigation.replace('Negotiation', { negotiation_id: negId });
        } else {
          // Fallback if for some reason negotiation_id wasn't returned
          navigation.navigate('Negotiation', { campaign_influencer_id: offer.id });
        }
      } else {
        Alert.alert('Failed', negRes.error?.message || 'Could not send counter offer');
      }
      return;
    }

    // Negotiation already exists — submit a counter turn, then jump to the chat.
    const negId = offer.negotiation?.id || offer.negotiation_id;
    const res = await influencerApi.submitNegotiationTurn(negId, {
      ...payloadFields,
      action: 'counter',
    });
    setActionLoading(false);
    if (res.success) {
      navigation.replace('Negotiation', { negotiation_id: negId });
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
  const commissionPct = offer.commission_pct ? parseFloat(offer.commission_pct) : 0;
  const isActionable = offer.status === 'invited';
  const isNegotiating = offer.status === 'negotiating';
  const deliverables = offer.deliverables || [];

  // Goal-based behaviour. The whole screen branches on these three flags.
  const goal           = (offer.goal || 'engagement').toLowerCase();
  const isConversion   = goal === 'conversion';
  const isHybrid       = goal === 'hybrid';
  const isEngagement   = goal === 'engagement';
  const showFee        = isEngagement || isHybrid;
  const showCommission = isConversion || isHybrid;
  const showTranches   = isEngagement || isHybrid;   // No fee → no tranches.
  const allowCommissionNegotiation = offer.allow_commission_negotiation !== false;

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

        {/* Set name is intentionally hidden — sets are a brand-side
            grouping concept and only confuse the influencer. */}
        {offer.goal && (
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Type</Text>
              <Text style={styles.infoValue}>{(offer.goal || '').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())}</Text>
            </View>
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

        {/* Fee highlight — engagement & hybrid only */}
        {showFee && (
          <View style={styles.feeHighlight}>
            <Text style={styles.feeLabel}>Offered Fee</Text>
            <Text style={styles.feeValue}>{fmtRupees(fee)}</Text>
          </View>
        )}

        {/* Commission highlight — conversion & hybrid only */}
        {showCommission && (
          <View style={[styles.feeHighlight, showFee && { marginTop: 10 }]}>
            <Text style={styles.feeLabel}>Commission per Conversion</Text>
            <Text style={styles.feeValue}>{commissionPct ? `${commissionPct}%` : 'Not set'}</Text>
            <Text style={styles.commissionHint}>
              You earn this on every sale/booking made via your tracking link.
            </Text>
          </View>
        )}

        {/* Deliverables list ─────────────────────────────────────────────
            Three states:
            1. Post-sign: deliverables table has rows (one per item). Use those.
            2. Pre-sign: no deliverable rows yet, but the campaign set's
               formats_json defines what you'll be asked to produce after
               signing. Parse it and show counts so the influencer can size
               up the work before accepting.
            3. Neither (legacy/broken row): single deliverable_type fallback. */}
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
        ) : (() => {
          // Parse formats_json (string-or-object array). Normalise to
          // [{ type: canonical, count }] then aggregate counts per type.
          const FORMAT_ALIAS = {
            'instagram reel':   'reel',
            'instagram post':   'post',
            'instagram story':  'story',
            'instagram stories':'story',
            'youtube short':    'youtube_short',
            'youtube video':    'youtube_video',
          };
          const toCanonical = (raw) => {
            if (!raw) return 'reel';
            const key = String(raw).toLowerCase().trim();
            return FORMAT_ALIAS[key] || key.replace(/\s+/g, '_');
          };
          let formats = offer.formats_json;
          if (typeof formats === 'string') { try { formats = JSON.parse(formats); } catch { formats = null; } }
          if (Array.isArray(formats) && formats.length > 0) {
            const counts = {};
            for (const f of formats) {
              let type, count;
              if (typeof f === 'string') { type = toCanonical(f); count = 1; }
              else { type = toCanonical(f.type || f.name || f.label); count = Math.max(1, parseInt(f.count, 10) || 1); }
              counts[type] = (counts[type] || 0) + count;
            }
            return (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>What You'll Deliver</Text>
                <Text style={styles.deliverableHint}>For the fee shown above, you'll create:</Text>
                {Object.entries(counts).map(([type, n]) => (
                  <View key={type} style={styles.deliverableRow}>
                    <View style={styles.deliverableDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.deliverableType}>
                        {DELIVERABLE_LABELS[type] || type} {n > 1 ? `x${n}` : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            );
          }
          return (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Deliverable</Text>
              <Text style={styles.infoValue}>
                {DELIVERABLE_LABELS[offer.deliverable_type] || offer.deliverable_type || 'To be confirmed'}
              </Text>
            </View>
          );
        })()}

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

        {/* Coupon code for conversion/hybrid (commission rate already shown above) */}
        {showCommission && offer.coupon_code && (
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Coupon Code</Text>
              <Text style={[styles.infoValue, { fontFamily: 'monospace' }]}>{offer.coupon_code}</Text>
            </View>
          </View>
        )}
      </View>

      {/* ── What you're promoting ────────────────────────────────────────
          Only relevant for conversion/hybrid campaigns — engagement
          campaigns don't have offers/products to promote. Shows discount
          type/value, BOGO config, bundle, free gift, product list and
          physical-delivery info. */}
      {(isConversion || isHybrid) && (offer.offer_config_json || offer.offer_type || products.length > 0 || offer.physical_delivery) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>What You're Promoting</Text>

          {/* Offer type + breakdown */}
          {offer.offer_type && (() => {
            // offer_config_json may be a string or already an object
            let cfg = offer.offer_config_json;
            if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg); } catch { cfg = {}; } }
            cfg = cfg || {};
            const type = (offer.offer_type || '').toLowerCase().trim();
            return (
              <View style={styles.briefBox}>
                <Text style={styles.infoLabel}>Offer Type</Text>
                <Text style={[styles.infoValue, { textTransform: 'capitalize', marginBottom: 6 }]}>{offer.offer_type}</Text>

                {type === 'discount' && (
                  <Text style={styles.briefText}>
                    {cfg.sub_type === 'flat'
                      ? `Flat ₹${cfg.value || '?'} off`
                      : `${cfg.value || '?'}% off`}
                    {(cfg.products?.length || 0) > 0 ? ` on ${cfg.products.length} selected products` : ' on eligible items'}
                  </Text>
                )}
                {(type === 'volume' || type === 'volume discount') && cfg.tiers && (
                  <View>
                    {cfg.tiers.map((t, i) => (
                      <Text key={i} style={styles.briefText}>
                        {`Spend ₹${t.min_spend || '?'} → get ${t.pct_off || '?'}% off`}
                      </Text>
                    ))}
                  </View>
                )}
                {type === 'bogo' && (
                  <Text style={styles.briefText}>
                    Buy 1 (selected product) → Get 1 free
                  </Text>
                )}
                {type === 'bundle' && (
                  <Text style={styles.briefText}>
                    {`Bundle of ${cfg.products?.length || '?'} products at ₹${cfg.bundle_price || '?'}`}
                  </Text>
                )}
                {(type === 'free gift' || type === 'free_gift') && cfg.offers && (
                  <View>
                    {cfg.offers.map((o, i) => (
                      <Text key={i} style={styles.briefText}>
                        {`Buy product → get free gift`}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            );
          })()}

          {/* Product list */}
          {products.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.infoLabel}>Products in this Offer ({products.length})</Text>
              {products.slice(0, 8).map((p, i) => (
                <View key={p.id || i} style={styles.productRow}>
                  <View style={styles.productDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{p.name || p.product_name}</Text>
                    {p.price > 0 && (
                      <Text style={styles.productPrice}>{fmtRupees(p.price)}</Text>
                    )}
                  </View>
                </View>
              ))}
              {products.length > 8 && (
                <Text style={[styles.briefText, { marginTop: 6, textAlign: 'center' }]}>
                  + {products.length - 8} more
                </Text>
              )}
            </View>
          )}

          {/* Physical delivery info */}
          {offer.physical_delivery && (
            <View style={[styles.briefBox, { marginTop: 12, backgroundColor: colors.goldPale }]}>
              <Text style={[styles.infoLabel, { color: '#7A5500' }]}>📦 Physical Sample</Text>
              <Text style={[styles.briefText, { color: '#7A5500' }]}>
                The brand will ship a physical product to you for content creation.
                {offer.delivery_address ? ` Delivery to: ${offer.delivery_address}` : ''}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Payment Terms ──────────────────────────────────────────────── */}
      {/* Conversion-only campaigns have no fee → no tranches. We replace the
          tranche schedule with a one-liner explaining commission payouts. */}
      {!showTranches && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Terms</Text>
          <Text style={styles.paymentNote}>
            You earn {commissionPct ? `${commissionPct}% commission` : 'commission'} on every conversion driven through your tracking link.
            Earnings sit in your pending balance during a 30-day return window, then move to your wallet for withdrawal.
          </Text>
        </View>
      )}

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

        {/* For HYBRID, the fee tranches above are the fixed part. The
            commission is paid separately whenever conversions happen. */}
        {isHybrid && (
          <View style={[styles.tdsNote, { backgroundColor: colors.tealPale, marginTop: 8 }]}>
            <Text style={[styles.tdsText, { color: colors.tealDeep }]}>
              Plus {commissionPct ? `${commissionPct}% commission` : 'commission'} on every conversion driven through your tracking link.
            </Text>
          </View>
        )}
      </View>
      )}

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

      {/* ── Post-accept actions: contract + content submission ───────────
          Contracts are now created for every goal (conversion included).
          Copy is tailored for commission-only vs fee-bearing contracts. */}
      {['accepted', 'contracted', 'active'].includes(offer.status) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Next Steps</Text>

          <TouchableOpacity
            style={styles.nextStepBtn}
            onPress={() => navigation.navigate('Contract', { campaignInfluencerId: offer.id })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.nextStepTitle}>
                {offer.status === 'accepted' ? 'Review & Sign Contract' : 'View Contract'}
              </Text>
              <Text style={styles.nextStepDesc}>
                {offer.status === 'accepted'
                  ? (isConversion
                      ? 'Sign the commission-terms contract to activate your tracking link.'
                      : 'Sign the contract to unlock Tranche 1 payment.')
                  : (isConversion
                      ? 'See agreed commission, offer details, and clauses.'
                      : 'See terms, signatures, and payment schedule.')}
              </Text>
            </View>
            <Text style={styles.nextStepArrow}>›</Text>
          </TouchableOpacity>

          {/* Submit content — unlocks once the contract is fully signed
              ('contracted' or 'active'). Same gating for every goal now. */}
          {['contracted', 'active'].includes(offer.status) && deliverables.length > 0 && (
            <TouchableOpacity
              style={[styles.nextStepBtn, { marginTop: 8 }]}
              onPress={() => navigation.navigate('DeliverableList', { campaignInfluencerId: offer.id })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.nextStepTitle}>Submit Content</Text>
                <Text style={styles.nextStepDesc}>
                  {`Upload your ${deliverables.length} deliverable${deliverables.length > 1 ? 's' : ''} for brand review.`}
                </Text>
              </View>
              <Text style={styles.nextStepArrow}>›</Text>
            </TouchableOpacity>
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
              {offer.allow_negotiation !== false && (
                <TouchableOpacity
                  style={[styles.negotiateBtn, actionLoading && styles.disabledBtn]}
                  onPress={() => { setShowNegotiate(!showNegotiate); setShowDeclineReasons(false); }}
                  disabled={actionLoading}
                >
                  <Text style={styles.negotiateText}>Negotiate</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.declineBtn, actionLoading && styles.disabledBtn, offer.allow_negotiation === false && { flex: 1 }]}
                onPress={() => { setShowDeclineReasons(!showDeclineReasons); setShowNegotiate(false); }}
                disabled={actionLoading}
              >
                <Text style={styles.declineText}>Decline</Text>
              </TouchableOpacity>
            </View>
            {offer.allow_negotiation === false && (
              <Text style={styles.fixedTermsHint}>This brand has set fixed terms — Accept or Decline only.</Text>
            )}
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
            {showFee && showCommission && 'Propose a fee and/or commission %.'}
            {showFee && !showCommission && 'Enter your proposed fee and optionally add a note explaining your rate.'}
            {!showFee && showCommission && 'Propose a commission % per conversion.'}
            {showCommission && !allowCommissionNegotiation &&
              ' Commission negotiation is currently disabled by the platform — only the brand can change it.'}
          </Text>

          {/* Fee input — engagement & hybrid */}
          {showFee && (
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
          )}

          {/* Commission input — conversion & hybrid (locked if admin disabled) */}
          {showCommission && (
            <View style={[styles.inputWrap, !allowCommissionNegotiation && styles.disabledBtn]}>
              <TextInput
                style={[styles.feeInput, { paddingLeft: 14 }]}
                value={negotiatingCommission}
                onChangeText={setNegotiatingCommission}
                keyboardType="numeric"
                placeholder="Proposed commission %"
                placeholderTextColor={colors.t3}
                editable={allowCommissionNegotiation}
              />
              <Text style={styles.rupee}>%</Text>
            </View>
          )}

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
            style={[
              styles.counterSubmitBtn,
              actionLoading && styles.disabledBtn,
              showFee && !negotiatingFee && styles.disabledBtn,
              showCommission && allowCommissionNegotiation && !negotiatingCommission && !showFee && styles.disabledBtn,
            ]}
            onPress={submitCounter}
            disabled={
              actionLoading ||
              (showFee && !negotiatingFee) ||
              (showCommission && allowCommissionNegotiation && !showFee && !negotiatingCommission)
            }
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

          {/* Re-open the chat thread any time */}
          <TouchableOpacity
            style={[styles.nextStepBtn, { marginTop: 12 }]}
            onPress={() => navigation.navigate('Negotiation', {
              negotiation_id: offer.negotiation.id,
              campaign_influencer_id: offer.id,
            })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.nextStepTitle}>Open Chat Thread</Text>
              <Text style={styles.nextStepDesc}>
                See the full conversation with the brand and respond to any pending offers.
              </Text>
            </View>
            <Text style={styles.nextStepArrow}>›</Text>
          </TouchableOpacity>
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
  commissionHint: { fontSize: 11, color: colors.tealDeep, marginTop: 6, opacity: 0.85, textAlign: 'center' },
  productRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  productDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.navy },
  productName: { fontSize: 13, fontWeight: '600', color: colors.t1 },
  productPrice: { fontSize: 11, color: colors.t3, marginTop: 2 },

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
  deliverableHint: { fontSize: 12, color: colors.t3, marginBottom: 8 },

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
  fixedTermsHint: { fontSize: 11, color: colors.t3, textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
  disabledBtn: { opacity: 0.5 },

  // Next-step CTA rows (View Contract / Submit Content)
  nextStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navyPale,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.navy,
  },
  nextStepTitle: { fontSize: 14, fontWeight: '800', color: colors.navy },
  nextStepDesc:  { fontSize: 11, color: colors.t2, marginTop: 2, lineHeight: 15 },
  nextStepArrow: { fontSize: 22, fontWeight: '800', color: colors.navy, marginLeft: 8 },

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
