import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { fmtRupees } from '../../theme/tokens';
import { evalExpr } from '../../utils/exprEval';

/**
 * SchemaCard — schema-driven follower discovery card.
 *
 * Single component for restaurant menu items, salon services, and any
 * future schema-driven card type. The diff between "RestaurantCard" and
 * "SalonCard" is the schema's `card_config`, NOT the component code.
 * `RestaurantCard.js` and `SalonCard.js` are thin re-exports that exist
 * for searchability and conceptual naming.
 *
 * Reads from template.card_config (PRESCRIPTIVE per contracts-v1.3 §3):
 *   - accent / accent_dim       — color treatment (advisory; cover uses these)
 *   - cta_primary { label, action } — primary CTA (label is shown verbatim)
 *   - cta_secondary?            — optional secondary CTA
 *   - subtitle_template         — "{key} · {key}" substitution from item.subtitle_data
 *   - tags                      — TagRule[] applied against item.attributes
 *   - price_display { source, unit } — price line composition
 *
 * Influencer attribution overlay (top-left badge + bottom strip) renders
 * when `attribution` prop is present.
 *
 * `available.orderable === false` greys the primary CTA and shows
 * `available.reason` beneath it (per v1.1 AvailabilityState change —
 * listings stay visible in discovery when not currently orderable).
 *
 * `tracking` is forwarded to `onPressPrimary` by the parent — the card
 * itself doesn't dispatch; it calls handlers.
 */

export default function SchemaCard({
  item,
  template,
  attribution,
  onPress,
  onPressPrimary,
  onPressSecondary,
  onPressSave,
}) {
  const cfg = template?.card_config || {};
  const accent = cfg.accent || '#F59E0B';
  const accentDim = cfg.accent_dim || 'rgba(245,158,11,0.1)';
  const fallbackIcon = cfg.icon || '📋';

  const subtitle = renderSubtitle(cfg.subtitle_template, item?.subtitle_data || {});
  const priceMain = readPath(item, cfg.price_display?.source) ?? item?.price?.amount;
  const originalPrice = item?.price?.original_amount;
  const perUnit = item?.price?.per_unit_label || cfg.price_display?.unit || '';

  const tagRules = Array.isArray(cfg.tags) ? cfg.tags : [];
  const renderedTags = tagRules
    .map((rule, i) => buildTag(rule, item?.attributes || {}, i))
    .filter(Boolean);

  const orderable = item?.available?.orderable !== false;
  const unavailReason = orderable ? null : (item?.available?.reason || 'Currently unavailable');

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Cover */}
      <View style={[styles.cover, { backgroundColor: '#0A1D3E' }]}>
        {item?.cover?.image_url
          ? <Image source={{ uri: item.cover.image_url }} style={styles.coverImg} />
          : <Text style={styles.coverIcon}>{item?.cover?.icon || fallbackIcon}</Text>}

        {attribution && (
          <View style={[styles.discountBadge, { backgroundColor: accent }]}>
            <Text style={styles.discountText}>{attribution.discount_label}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.heartBtn} onPress={onPressSave} activeOpacity={0.7}>
          <Text style={{ fontSize: 13, color: '#fff' }}>♡</Text>
        </TouchableOpacity>

        {attribution?.influencer_name && (
          <View style={styles.infStrip}>
            <View style={[styles.infAvatar, { backgroundColor: attribution.influencer_color || accent }]}>
              <Text style={styles.infInitial}>{attribution.influencer_initial || attribution.influencer_name[0]}</Text>
            </View>
            <Text style={styles.infText} numberOfLines={1}>{attribution.influencer_name} recommends</Text>
            <Text style={[styles.infDiscount, { color: accent }]}>{attribution.discount_label}</Text>
          </View>
        )}
      </View>

      {/* Body */}
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{item?.name}</Text>
            {!!subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
          </View>
          {item?.rating?.value && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.ratingText, { color: accent }]}>★ {item.rating.value}</Text>
              {item.rating.review_count && (
                <Text style={styles.ratingCount}>{item.rating.review_count} reviews</Text>
              )}
            </View>
          )}
        </View>

        {renderedTags.length > 0 && (
          <View style={styles.tagsRow}>
            {renderedTags.map((t, i) => (
              <View key={i} style={[styles.tag, t.highlight && { backgroundColor: accentDim, borderColor: accent + '40', borderWidth: 1 }]}>
                <Text style={[styles.tagText, t.highlight && { color: accent }]}>{t.text}</Text>
              </View>
            ))}
          </View>
        )}

        {item?.location && (
          <View style={styles.locRow}>
            <Text style={styles.locIcon}>📍</Text>
            <Text style={styles.locText} numberOfLines={1}>
              {item.location.name}{item.location.distance_text ? ` · ${item.location.distance_text}` : ''}
            </Text>
          </View>
        )}

        <View style={styles.priceRow}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.price}>{priceMain != null ? fmtRupees(priceMain) : '—'}</Text>
              {originalPrice && originalPrice > priceMain && (
                <Text style={styles.originalPrice}>{fmtRupees(originalPrice)}</Text>
              )}
            </View>
            {!!perUnit && <Text style={styles.perUnit}>{perUnit}</Text>}
          </View>
          <View style={styles.ctaRow}>
            {cfg.cta_secondary && (
              <TouchableOpacity style={styles.ctaSecondary} onPress={onPressSecondary}>
                <Text style={styles.ctaSecondaryText}>{cfg.cta_secondary.label}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.ctaPrimary, { backgroundColor: orderable ? accent : '#3a4150' }]}
              onPress={orderable ? onPressPrimary : undefined}
              activeOpacity={orderable ? 0.7 : 1}>
              <Text style={[styles.ctaPrimaryText, !orderable && { color: 'rgba(255,255,255,0.5)' }]}>
                {cfg.cta_primary?.label || 'Open'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {!orderable && (
          <Text style={styles.unavailText}>{unavailReason}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderSubtitle(template, data) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = data[k];
    return v == null ? '' : String(v);
  }).trim();
}

function readPath(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

function buildTag(rule, attributes, idx) {
  // Resolve source value
  const value = readPath(attributes, rule.source);

  // show_if filter — boolean attributes that should render only when truthy
  if (rule.show_if === true && !value) return null;

  // For string/number values, format via {value} template if present
  let text = rule.text;
  if (!text) {
    if (rule.format) {
      let displayValue = value;
      if (Array.isArray(value)) {
        displayValue = rule.show_first ? value.slice(0, rule.show_first).join(', ') : value.join(', ');
      } else if (typeof value === 'string' && rule.use_first) {
        displayValue = value.split(/\s*[/,]\s*/)[0];
      }
      text = rule.format.replace(/\{value\}/g, displayValue == null ? '' : String(displayValue));
    } else if (value != null && value !== false) {
      text = String(value);
    }
  }

  if (text == null || text === '') return null;

  // highlight: unconditional OR highlight_if expression evaluation
  let highlight = !!rule.highlight;
  if (!highlight && rule.highlight_if) {
    highlight = evalExpr(rule.highlight_if, { value, ...attributes });
  }

  return { text, highlight };
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginBottom: 13,
    borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: '#0D1D2E',
  },
  cover: { height: 150, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  coverImg: { width: '100%', height: '100%' },
  coverIcon: { fontSize: 64, opacity: 0.6 },
  discountBadge: { position: 'absolute', top: 9, left: 9, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  discountText: { fontSize: 9, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  heartBtn: {
    position: 'absolute', top: 9, right: 9,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  infStrip: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.62)',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  infAvatar: { width: 17, height: 17, borderRadius: 8.5, alignItems: 'center', justifyContent: 'center' },
  infInitial: { fontSize: 7, fontWeight: '800', color: '#000' },
  infText: { flex: 1, fontSize: 10, color: 'rgba(255,255,255,0.82)' },
  infDiscount: { fontSize: 10, fontWeight: '700' },
  body: { padding: 11 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  name: { fontSize: 14, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  ratingText: { fontSize: 11, fontWeight: '700' },
  ratingCount: { fontSize: 9, color: 'rgba(255,255,255,0.3)' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 7 },
  tag: { backgroundColor: '#142438', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  tagText: { fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 9 },
  locIcon: { fontSize: 9 },
  locText: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { fontSize: 17, fontWeight: '800', color: '#fff' },
  originalPrice: { fontSize: 10, color: 'rgba(255,255,255,0.3)', textDecorationLine: 'line-through' },
  perUnit: { fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  ctaRow: { flexDirection: 'row', gap: 7 },
  ctaPrimary: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10 },
  ctaPrimaryText: { fontSize: 11, fontWeight: '800', color: '#000' },
  ctaSecondary: {
    backgroundColor: '#142438', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  ctaSecondaryText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.65)' },
  unavailText: { fontSize: 10, color: 'rgba(255,180,90,0.85)', marginTop: 6, fontStyle: 'italic' },
});
