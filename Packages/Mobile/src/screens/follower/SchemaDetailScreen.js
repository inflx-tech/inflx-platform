import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, FlatList } from 'react-native';
import { fmtRupees } from '../../theme/tokens';

/**
 * SchemaDetailScreen — schema-driven full-screen detail view for a listing.
 *
 * Renders sections from template.card_config.detail_sections in order.
 * Supported section types (per contracts-v1 §4 DetailSection union):
 *   - description        text from item.attributes[source]
 *   - spec_grid          field-by-field grid; emphasized_field renders accent-tinted
 *   - feature_chips      horizontal chip row from string[] source
 *   - pricing_tabs       multi-tab pricing (car_rental uses; salon doesn't)
 *   - pickup_options     opt-list with extra_charge (car_rental uses)
 *   - gallery            image carousel/grid (salon's before_after_images uses)
 *   - repeatable_list    nested item list (placeholder — not exercised by restaurant or salon today)
 *
 * Path B tracking propagation: the "View [brand_name]" affordance at the
 * top calls onOpenBrandStore(brandId, tracking). When the screen was
 * entered via an influencer link to a specific listing, tracking carries
 * the original campaign attribution so brand-level CTAs (book table,
 * walkin pay) credit the same influencer. NON-NEGOTIABLE per spec.
 *
 * Sticky bottom CTA dispatches via onActionPrimary(action, ctx). Action
 * enum is determined by template.card_config.cta_primary.action; the
 * parent screen is responsible for the action-specific flow (cart add,
 * slot picker entry, etc.).
 */

export default function SchemaDetailScreen({ navigation, route }) {
  const { item, template, attribution, tracking, brandId, brandName } = route.params || {};
  const cfg = template?.card_config || {};
  const accent = cfg.accent || '#F59E0B';
  const accentDim = cfg.accent_dim || 'rgba(245,158,11,0.1)';

  const sections = Array.isArray(cfg.detail_sections) ? cfg.detail_sections : [];
  const orderable = item?.available?.orderable !== false;
  const unavailReason = orderable ? null : (item?.available?.reason || 'Currently unavailable');

  function handlePrimary() {
    const action = cfg.cta_primary?.action;
    // Parent screen receives (action, ctx) and dispatches accordingly.
    // For online_order → add to cart; for book_slot → navigate to SlotPickerScreen; etc.
    navigation.navigate('__action_dispatch', {
      action,
      item,
      template,
      attribution,
      tracking,
      brandId,
      brandName,
    });
  }

  function handleViewBrand() {
    // Path B tracking propagation: forward tracking when navigating to brand store.
    navigation.navigate('BrandStore', { brandId, tracking });
  }

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: '#0A1D3E' }]}>
          {item?.cover?.image_url
            ? <Image source={{ uri: item.cover.image_url }} style={styles.heroImg} />
            : <Text style={styles.heroIcon}>{item?.cover?.icon || cfg.icon || '📋'}</Text>}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* Title */}
          <Text style={styles.itemName}>{item?.name}</Text>
          <Text style={styles.itemSubtitle}>{renderSubtitle(cfg.subtitle_template, item?.subtitle_data)}</Text>

          {/* Brand link — Path B tracking forward */}
          {brandId && brandName && (
            <TouchableOpacity style={styles.brandLink} onPress={handleViewBrand}>
              <Text style={[styles.brandLinkText, { color: accent }]}>View {brandName} →</Text>
            </TouchableOpacity>
          )}

          {/* Influencer attribution strip */}
          {attribution?.influencer_name && (
            <View style={[styles.dealStrip, { backgroundColor: accentDim, borderColor: accent + '40' }]}>
              <View style={[styles.dealAvatar, { backgroundColor: accent }]}>
                <Text style={styles.dealInitial}>{attribution.influencer_initial || attribution.influencer_name[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dealName, { color: accent }]}>{attribution.influencer_name}'s deal</Text>
                <Text style={styles.dealSub}>@{attribution.influencer_handle}</Text>
              </View>
              <View style={[styles.dealBadge, { backgroundColor: accent }]}>
                <Text style={styles.dealBadgeText}>{attribution.discount_label}</Text>
              </View>
            </View>
          )}

          {/* Sections from template.detail_sections */}
          {sections.map((section, i) => (
            <SectionRenderer
              key={i}
              section={section}
              item={item}
              template={template}
              accent={accent}
              accentDim={accentDim}
            />
          ))}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.ctaWrap}>
        {!orderable && (
          <Text style={styles.unavailBanner}>{unavailReason}</Text>
        )}
        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: orderable ? accent : '#3a4150' }]}
          onPress={orderable ? handlePrimary : undefined}
          activeOpacity={orderable ? 0.7 : 1}>
          <Text style={[styles.ctaBtnText, !orderable && { color: 'rgba(255,255,255,0.5)' }]}>
            {cfg.cta_primary?.label || 'Open'}
          </Text>
          <Text style={{ fontSize: 16, color: orderable ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.3)' }}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Section renderers ──────────────────────────────────────────────────────

function SectionRenderer({ section, item, template, accent, accentDim }) {
  const attrs = item?.attributes || {};

  if (section.type === 'description') {
    const text = readPath(attrs, section.source);
    if (!text) return null;
    return (
      <View style={styles.section}>
        {section.title && <Text style={styles.sectionLabel}>{section.title}</Text>}
        <Text style={styles.descriptionText}>{text}</Text>
      </View>
    );
  }

  if (section.type === 'spec_grid') {
    const fields = Array.isArray(section.fields) ? section.fields : [];
    const emphKey = section.emphasized_field?.key;
    const attrSchema = template?.attributes_schema || {};
    return (
      <View style={styles.section}>
        {section.title && <Text style={styles.sectionLabel}>{section.title}</Text>}
        <View style={styles.specGrid}>
          {fields.map(key => {
            const val = attrs[key];
            if (val == null || val === false) return null;
            const label = attrSchema[key]?.label || key;
            const isEmph = key === emphKey;
            return (
              <View key={key} style={[styles.specBox, isEmph && { backgroundColor: accentDim, borderColor: accent + '40', borderWidth: 1 }]}>
                <Text style={[styles.specVal, isEmph && { color: accent }]}>{formatValue(val)}</Text>
                <Text style={styles.specKey}>{label}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  if (section.type === 'feature_chips') {
    const chips = readPath(attrs, section.source);
    if (!Array.isArray(chips) || chips.length === 0) return null;
    return (
      <View style={styles.section}>
        {section.title && <Text style={styles.sectionLabel}>{section.title}</Text>}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featureRow}>
          {chips.map((c, i) => (
            <View key={i} style={styles.featureChip}>
              <Text style={styles.featureText}>{c}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  if (section.type === 'gallery') {
    const images = readPath(attrs, section.source);
    if (!Array.isArray(images) || images.length === 0) return null;
    if (section.layout === 'carousel') {
      return (
        <View style={styles.section}>
          {section.title && <Text style={styles.sectionLabel}>{section.title}</Text>}
          <FlatList
            data={images}
            keyExtractor={(_, i) => String(i)}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item: src }) => (
              <Image source={{ uri: src }} style={styles.galleryImg} />
            )}
            contentContainerStyle={{ gap: 8 }}
          />
        </View>
      );
    }
    // grid layout
    return (
      <View style={styles.section}>
        {section.title && <Text style={styles.sectionLabel}>{section.title}</Text>}
        <View style={styles.galleryGrid}>
          {images.map((src, i) => (
            <Image key={i} source={{ uri: src }} style={styles.galleryGridImg} />
          ))}
        </View>
      </View>
    );
  }

  if (section.type === 'pricing_tabs' || section.type === 'pickup_options' || section.type === 'repeatable_list') {
    // Not exercised by restaurant or salon. car_rental uses pricing_tabs +
    // pickup_options today (in CarDetailScreen). PR-C migration brings them
    // here. PR-B no-ops them rather than trying to half-implement.
    return null;
  }

  // ── Fashion-1 section types ────────────────────────────────────────────────

  if (section.type === 'variant_selector') {
    // Reads from item.variants[] which the brand store endpoint emits for
    // fashion products. Each variant: { id, size, color, stock, price_override }.
    const variants = Array.isArray(item?.variants) ? item.variants : [];
    if (variants.length === 0) return null;

    const sizes = Array.from(new Set(variants.map(v => v.size).filter(Boolean)));
    const colors = Array.from(new Set(variants.map(v => v.color).filter(Boolean)));

    return (
      <View style={styles.section}>
        {section.title && <Text style={styles.sectionLabel}>{section.title}</Text>}
        {sizes.length > 0 && (
          <View style={{ marginBottom: 8 }}>
            <Text style={styles.variantGroupLabel}>Size</Text>
            <View style={styles.variantChipsRow}>
              {sizes.map(s => {
                const inStock = variants.some(v => v.size === s && (v.stock == null || v.stock > 0));
                return (
                  <View key={s} style={[styles.variantChip, !inStock && styles.variantChipOOS]}>
                    <Text style={[styles.variantChipText, !inStock && { color: 'rgba(255,255,255,0.3)' }]}>
                      {s}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
        {colors.length > 0 && (
          <View>
            <Text style={styles.variantGroupLabel}>Color</Text>
            <View style={styles.variantChipsRow}>
              {colors.map(c => {
                const inStock = variants.some(v => v.color === c && (v.stock == null || v.stock > 0));
                return (
                  <View key={c} style={[styles.variantChip, !inStock && styles.variantChipOOS]}>
                    <Text style={[styles.variantChipText, !inStock && { color: 'rgba(255,255,255,0.3)' }]}>
                      {c}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
        <Text style={styles.variantHint}>
          Tap the primary button below to add this item to cart — you'll pick size/color there.
        </Text>
      </View>
    );
  }

  if (section.type === 'return_policy_notice') {
    const days = readPath(attrs, section.source) ?? item?.return_policy_days;
    if (!days || days <= 0) return null;
    return (
      <View style={[styles.section, styles.returnNotice, { borderColor: accent + '40' }]}>
        <Text style={[styles.returnIcon, { color: accent }]}>↩</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.returnTitle}>{section.title || 'Return policy'}</Text>
          <Text style={styles.returnBody}>
            {days}-day return window. Open Order History after purchase to request a return.
          </Text>
        </View>
      </View>
    );
  }

  return null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderSubtitle(template, data) {
  if (!template || !data) return '';
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = data[k];
    return v == null ? '' : String(v);
  }).trim();
}

function readPath(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

function formatValue(val) {
  if (val === true) return '✓ Yes';
  if (val === false) return '✗ No';
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'number') return String(val);
  return String(val);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07111E' },
  hero: { height: 228, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  heroIcon: { fontSize: 80, opacity: 0.5 },
  backBtn: { position: 'absolute', top: 50, left: 13, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  body: { padding: 15 },
  itemName: { fontSize: 22, fontWeight: '800', color: '#fff' },
  itemSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  brandLink: { marginTop: 8, marginBottom: 4 },
  brandLinkText: { fontSize: 12, fontWeight: '700' },
  dealStrip: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 12, padding: 10, marginVertical: 13 },
  dealAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dealInitial: { fontSize: 11, fontWeight: '800', color: '#000' },
  dealName: { fontSize: 11, fontWeight: '700' },
  dealSub: { fontSize: 10, color: 'rgba(255,255,255,0.42)', marginTop: 1 },
  dealBadge: { borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 },
  dealBadgeText: { fontSize: 12, fontWeight: '800', color: '#000' },
  section: { marginTop: 14 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  descriptionText: { fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 19 },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  specBox: { width: '31%', backgroundColor: '#0D1D2E', borderRadius: 9, padding: 9, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  specVal: { fontSize: 13, fontWeight: '700', color: '#fff' },
  specKey: { fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 2 },
  featureRow: { gap: 6, paddingBottom: 4 },
  featureChip: { backgroundColor: '#142438', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  featureText: { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.7)' },
  galleryImg: { width: 240, height: 160, borderRadius: 12 },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  galleryGridImg: { width: '32%', aspectRatio: 1, borderRadius: 8 },
  ctaWrap: { padding: 12, paddingBottom: 18, backgroundColor: '#07111E', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  unavailBanner: { fontSize: 11, color: 'rgba(255,180,90,0.85)', textAlign: 'center', marginBottom: 8, fontStyle: 'italic' },
  ctaBtn: { borderRadius: 13, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ctaBtnText: { fontSize: 15, fontWeight: '800', color: '#000' },

  // Fashion-1 variant selector + return policy notice
  variantGroupLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 },
  variantChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  variantChip: { backgroundColor: '#142438', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  variantChipOOS: { backgroundColor: 'rgba(20,36,56,0.4)', borderColor: 'rgba(255,255,255,0.05)' },
  variantChipText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  variantHint: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 8, fontStyle: 'italic' },
  returnNotice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, backgroundColor: 'rgba(236,72,153,0.05)' },
  returnIcon: { fontSize: 22, fontWeight: '800' },
  returnTitle: { fontSize: 12, fontWeight: '700', color: '#fff' },
  returnBody: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
});
