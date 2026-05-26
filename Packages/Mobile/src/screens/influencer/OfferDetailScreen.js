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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { brandPalette as P, fonts, fmtRupees } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import StatusPill from '../../components/brand/StatusPill';

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
    // Open-group is an "application" — copy reflects that the brand still
    // has to pick, no contract is generated yet.
    const openGroup = offer.influencer_mode === 'open_group';

    const confirmTitle = openGroup ? 'Apply to this offer?' : 'Accept Offer';
    const confirmBody  = openGroup
      ? "You'll be added to the applicants list for this campaign. The brand will review applications and pick up to their cap of influencers."
      : isConversionAccept
        ? "You'll get a contract covering the agreed commission terms. No upfront fee — you earn on every sale or booking driven by your tracking link once signed."
        : 'Are you sure you want to accept this offer? A contract will be generated for signing.';
    const confirmAction = openGroup ? 'Apply' : 'Accept';
    const successBody = openGroup
      ? "Thanks for applying! The brand will review your application and let you know if you're selected."
      : 'Offer accepted! A contract will be ready for signing.';

    Alert.alert(
      confirmTitle,
      confirmBody,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: confirmAction,
          onPress: async () => {
            setActionLoading(true);
            const res = await influencerApi.acceptOffer(offer.id);
            setActionLoading(false);
            if (res.success) {
              Alert.alert(openGroup ? 'Application submitted' : 'Success', successBody);
              navigation.goBack();
            } else {
              Alert.alert('Failed', res.error?.message || (openGroup ? 'Could not submit application' : 'Could not accept offer'));
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

  // Open-group flow: influencer applies, brand picks. No negotiation allowed.
  // Apply button replaces Accept; status='applied' surfaces a waiting state.
  const isOpenGroup    = offer.influencer_mode === 'open_group';
  const hasApplied     = offer.status === 'applied';
  const wasRejected    = offer.status === 'rejected_by_brand';
  const slotsFilled    = offer.status === 'slots_filled';

  // Tranche breakdown (spec defaults: 25/25/50)
  const t1Pct = 25;
  const t2Pct = 25;
  const t3Pct = 50;

  return (
    <ScrollView style={styles.container}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Icon name="chevron-left" size={16} color="rgba(255,255,255,0.65)" />
          <Text style={styles.backText}>Back</Text>
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
          <StatusPill status={offer.status} />
          {offer.brand_id && <Text style={styles.brandArrow}>›</Text>}
        </TouchableOpacity>

        <View style={styles.headerRule} />

        {/* Expiry countdown for pending offers */}
        {isActionable && countdown && (
          <View style={[styles.timerBar, countdown === 'Expired' && styles.timerBarExpired]}>
            <Icon
              name="timer-outline"
              size={15}
              color={countdown === 'Expired' ? P.dangerText : P.yellow}
              style={{ marginRight: 7 }}
            />
            <Text style={[styles.timerText, countdown === 'Expired' && styles.timerTextExpired]}>
              {countdown === 'Expired' ? 'OFFER EXPIRED' : `EXPIRES IN ${countdown}`}
            </Text>
          </View>
        )}
      </View>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={P.ink} />
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
                <StatusPill status={d.status} />
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
            <View style={[styles.briefBox, { marginTop: 12, backgroundColor: P.yellowPale, borderColor: '#F0DA88', borderWidth: 1 }]}>
              <Text style={[styles.infoLabel, { color: P.yellowText }]}>PHYSICAL SAMPLE</Text>
              <Text style={[styles.briefText, { color: P.yellowText }]}>
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
          <View style={[styles.trancheDot, { backgroundColor: P.success }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.trancheTitle}>Tranche 1 ({t1Pct}%)</Text>
            <Text style={styles.trancheDesc}>Released when both parties sign the contract</Text>
          </View>
          <Text style={styles.trancheAmount}>{fmtRupees(Math.round(fee * t1Pct / 100))}</Text>
        </View>

        <View style={styles.trancheRow}>
          <View style={[styles.trancheDot, { backgroundColor: P.yellow }]} />
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
            Note: 10% TDS is deducted at the time of withdrawal, not at earning.
          </Text>
        </View>

        {/* For HYBRID, the fee tranches above are the fixed part. The
            commission is paid separately whenever conversions happen. */}
        {isHybrid && (
          <View style={[styles.tdsNote, { backgroundColor: P.successPale, marginTop: 8 }]}>
            <Text style={[styles.tdsText, { color: P.successText }]}>
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

      {/* ── Application waiting state (open-group, status='applied') ─────── */}
      {isOpenGroup && hasApplied && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Application submitted ✓</Text>
          <Text style={styles.fixedTermsHint}>
            You've applied to this open call. The brand will review applications and select up to {offer.max_cap || 'their cap of'} influencer{(offer.max_cap || 0) !== 1 ? 's' : ''}. You'll be notified when they decide.
          </Text>
        </View>
      )}

      {/* ── Application closed states ──────────────────────────────────── */}
      {isOpenGroup && wasRejected && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Not selected this time</Text>
          <Text style={styles.fixedTermsHint}>
            The brand chose other applicants for this campaign. Look out for similar opportunities — you can still apply to other open calls.
          </Text>
        </View>
      )}
      {isOpenGroup && slotsFilled && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Campaign filled</Text>
          <Text style={styles.fixedTermsHint}>
            All slots for this campaign were filled by other applicants. We'll surface similar campaigns when they go live.
          </Text>
        </View>
      )}

      {/* ── Action Buttons ─────────────────────────────────────────────── */}
      {isActionable && countdown !== 'Expired' && (
        <View style={styles.card}>
          <View style={styles.actions}>
            {/* Primary action: Apply (open-group) vs Accept Offer (handpick) */}
            <TouchableOpacity
              style={[styles.acceptBtn, actionLoading && styles.disabledBtn]}
              onPress={accept}
              disabled={actionLoading}
            >
              <Text style={styles.acceptText}>{isOpenGroup ? 'Apply for this offer' : 'Accept Offer'}</Text>
            </TouchableOpacity>

            <View style={styles.actionSecondaryRow}>
              {/* Negotiate hidden when open-group OR when brand disabled negotiation */}
              {!isOpenGroup && offer.allow_negotiation !== false && (
                <TouchableOpacity
                  style={[styles.negotiateBtn, actionLoading && styles.disabledBtn]}
                  onPress={() => { setShowNegotiate(!showNegotiate); setShowDeclineReasons(false); }}
                  disabled={actionLoading}
                >
                  <Text style={styles.negotiateText}>Negotiate</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.declineBtn,
                  actionLoading && styles.disabledBtn,
                  (isOpenGroup || offer.allow_negotiation === false) && { flex: 1 },
                ]}
                onPress={() => { setShowDeclineReasons(!showDeclineReasons); setShowNegotiate(false); }}
                disabled={actionLoading}
              >
                <Text style={styles.declineText}>{isOpenGroup ? 'Pass' : 'Decline'}</Text>
              </TouchableOpacity>
            </View>
            {isOpenGroup && (
              <Text style={styles.fixedTermsHint}>
                Open call: apply if interested. Brand picks up to {offer.max_cap || 'their cap of'} influencer{(offer.max_cap || 0) !== 1 ? 's' : ''} from applicants.
              </Text>
            )}
            {!isOpenGroup && offer.allow_negotiation === false && (
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
                placeholderTextColor={P.muted2}
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
                placeholderTextColor={P.muted2}
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
            placeholderTextColor={P.muted2}
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
              <ActivityIndicator size="small" color={P.yellow} />
            ) : (
              <Text style={styles.counterSubmitText}>SEND COUNTER OFFER</Text>
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
              <StatusPill status={offer.negotiation.status} />
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
  container: { flex: 1, backgroundColor: P.bg },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.bg },
  emptyText: { fontFamily: fonts.sansMedium, fontSize: 13, color: P.muted2 },

  // Header (ink topbar with yellow rule)
  header: { backgroundColor: P.ink, paddingHorizontal: 18, paddingTop: 50, paddingBottom: 18, position: 'relative' },
  headerRule: { position: 'absolute', left: 18, bottom: 6, width: 30, height: 3, backgroundColor: P.yellow, borderRadius: 2 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  backText: { fontFamily: fonts.monoBold, fontSize: 10.5, color: 'rgba(255,255,255,0.65)', fontWeight: '700' },
  brandRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  brandLogo: { width: 48, height: 48, borderRadius: 12, backgroundColor: P.yellow },
  brandLogoFallback: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: P.yellow,
    justifyContent: 'center', alignItems: 'center',
  },
  brandLogoInitial: { fontFamily: fonts.displayBlack, fontSize: 22, fontWeight: '900', color: P.ink },
  brandName: { fontFamily: fonts.displayBold, fontSize: 17, fontWeight: '800', color: P.white },
  brandMeta: { fontFamily: fonts.monoBold, fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  brandArrow: { fontFamily: fonts.monoBold, fontSize: 18, color: 'rgba(255,255,255,0.5)', marginLeft: 4, alignSelf: 'center', fontWeight: '800' },
  campaignName: { fontFamily: fonts.sansMedium, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  // Timer (yellow chip on ink; danger-pale on Expired)
  timerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    backgroundColor: 'rgba(255,193,7,0.16)',
    borderWidth: 1,
    borderColor: P.yellow,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 11,
  },
  timerBarExpired: { backgroundColor: P.dangerPale, borderColor: P.danger },
  timerText: { fontFamily: fonts.monoBold, fontSize: 11.5, fontWeight: '800', color: P.yellow, letterSpacing: 0.3 },
  timerTextExpired: { color: P.dangerText },

  // Loading
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8 },
  loadingText: { fontFamily: fonts.sansMedium, fontSize: 12, color: P.muted2 },

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
  cardTitle: { fontFamily: fonts.displayBold, fontSize: 12.5, fontWeight: '800', color: P.ink, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 },

  // Info grid
  infoGrid: { flexDirection: 'row', gap: 14, marginBottom: 10 },
  infoItem: { flex: 1, minWidth: 0 },
  infoLabel: {
    fontFamily: fonts.monoBold,
    fontSize: 9.5,
    fontWeight: '700',
    color: P.muted2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  infoValue: { fontFamily: fonts.sansMedium, fontSize: 12.5, fontWeight: '600', color: P.ink, lineHeight: 17 },

  // Fee highlight (successPale per locked design call #3)
  feeHighlight: {
    backgroundColor: P.successPale,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
  },
  feeLabel: {
    fontFamily: fonts.monoBold,
    fontSize: 9.5,
    fontWeight: '800',
    color: P.successText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  feeValue: { fontFamily: fonts.monoBold, fontSize: 28, fontWeight: '900', color: P.successText, letterSpacing: -0.5 },
  commissionHint: { fontFamily: fonts.sansMedium, fontSize: 11, color: P.successText, marginTop: 6, opacity: 0.9, textAlign: 'center', lineHeight: 16 },
  productRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: P.borderSoft,
  },
  productDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: P.ink },
  productName: { fontFamily: fonts.sansBold, fontSize: 12.5, fontWeight: '700', color: P.ink },
  productPrice: { fontFamily: fonts.monoBold, fontSize: 11, color: P.muted2, marginTop: 2 },

  // Section
  section: { marginBottom: 10 },
  sectionLabel: {
    fontFamily: fonts.monoBold,
    fontSize: 9.5,
    fontWeight: '800',
    color: P.muted2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 7,
  },

  // Deliverables
  deliverableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: P.borderSoft,
    gap: 10,
  },
  deliverableDot: {
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: P.ink,
  },
  deliverableType: { fontFamily: fonts.displayBold, fontSize: 12.5, fontWeight: '800', color: P.ink },
  deliverableDeadline: { fontFamily: fonts.monoBold, fontSize: 9.5, color: P.muted2, marginTop: 1 },
  deliverableHint: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: P.muted, marginBottom: 8 },

  // Brief
  briefBox: {
    backgroundColor: P.bg2,
    borderRadius: 10,
    padding: 11,
    marginBottom: 8,
  },
  briefText: { fontFamily: fonts.sansMedium, fontSize: 12, color: P.ink2, lineHeight: 17, marginTop: 4 },

  // Payment terms / Tranches (3-stage progression per locked design call #4)
  paymentNote: { fontFamily: fonts.sansMedium, fontSize: 12, color: P.muted, marginBottom: 11, lineHeight: 17 },
  trancheRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: P.borderSoft,
    gap: 10,
  },
  trancheDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  trancheTitle: { fontFamily: fonts.displayBold, fontSize: 12.5, fontWeight: '800', color: P.ink },
  trancheDesc: { fontFamily: fonts.sansMedium, fontSize: 11, color: P.muted, marginTop: 1, lineHeight: 15 },
  trancheAmount: { fontFamily: fonts.monoBold, fontSize: 13.5, fontWeight: '800', color: P.ink },
  trancheTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 11,
    marginTop: 5,
    borderTopWidth: 1,
    borderTopColor: P.border,
  },
  trancheTotalLabel: { fontFamily: fonts.displayBold, fontSize: 12.5, fontWeight: '800', color: P.ink },
  trancheTotalValue: { fontFamily: fonts.monoBold, fontSize: 17, fontWeight: '900', color: P.successText, letterSpacing: -0.3 },
  tdsNote: {
    backgroundColor: P.yellowPale,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  tdsText: { fontFamily: fonts.sansMedium, fontSize: 10.5, color: P.yellowText, lineHeight: 15 },

  // Guidelines
  guidelineRow: { flexDirection: 'row', gap: 6, marginTop: 7 },
  guidelineBullet: { fontFamily: fonts.monoBold, fontSize: 11, color: P.muted2, fontWeight: '800' },
  guidelineText: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: P.muted, flex: 1, lineHeight: 17 },

  // Actions (ink primary + ghost-ink negotiate + danger-pale decline)
  actions: { gap: 8 },
  acceptBtn: {
    backgroundColor: P.ink,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  acceptText: { fontFamily: fonts.displayBlack, fontSize: 14, fontWeight: '900', color: P.yellow, textTransform: 'uppercase', letterSpacing: 0.2 },
  actionSecondaryRow: { flexDirection: 'row', gap: 8 },
  negotiateBtn: {
    flex: 1,
    backgroundColor: P.white,
    borderWidth: 1.5,
    borderColor: P.ink,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  negotiateText: { fontFamily: fonts.displayBold, fontSize: 13, fontWeight: '800', color: P.ink },
  declineBtn: {
    flex: 1,
    backgroundColor: P.dangerPale,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  declineText: { fontFamily: fonts.displayBold, fontSize: 13, fontWeight: '800', color: P.dangerText },
  fixedTermsHint: { fontFamily: fonts.monoBold, fontSize: 9.5, color: P.muted2, textAlign: 'center', marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  disabledBtn: { opacity: 0.5 },

  // Next-step CTA rows (yellow-pale + 1.5px ink border + chevron-right)
  nextStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: P.yellowPale,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: P.ink,
  },
  nextStepTitle: { fontFamily: fonts.displayBold, fontSize: 13, fontWeight: '800', color: P.ink },
  nextStepDesc:  { fontFamily: fonts.sansMedium, fontSize: 11, color: P.muted, marginTop: 2, lineHeight: 15 },
  nextStepArrow: { fontFamily: fonts.monoBold, fontSize: 20, fontWeight: '800', color: P.ink, marginLeft: 8 },

  // Decline reasons
  declineHint: { fontFamily: fonts.sansMedium, fontSize: 12, color: P.muted, marginBottom: 9 },
  declineReasonBtn: {
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 10,
    marginBottom: 7,
    backgroundColor: P.white,
  },
  declineReasonText: { fontFamily: fonts.displayBold, fontSize: 12.5, fontWeight: '700', color: P.ink },

  // Negotiate form
  negotiateHint: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: P.muted, marginBottom: 10, lineHeight: 17 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: P.ink,
    borderRadius: 11,
    backgroundColor: P.white,
    marginBottom: 8,
  },
  rupee: { paddingHorizontal: 11, fontFamily: fonts.monoBold, fontSize: 17, fontWeight: '800', color: P.muted },
  feeInput: { flex: 1, paddingVertical: 11, fontFamily: fonts.monoBold, fontSize: 16, fontWeight: '800', color: P.ink },
  noteInput: {
    borderWidth: 1.5,
    borderColor: P.border,
    borderRadius: 10,
    padding: 11,
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: P.ink,
    backgroundColor: P.bg,
    marginBottom: 9,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  counterSubmitBtn: {
    backgroundColor: P.ink,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  counterSubmitText: { fontFamily: fonts.displayBlack, fontSize: 14, fontWeight: '900', color: P.yellow, textTransform: 'uppercase', letterSpacing: 0.2 },
});
