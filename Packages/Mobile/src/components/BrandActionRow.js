import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { evalExpr } from '../../../shared/utils/exprEval';

/**
 * BrandActionRow — schema-driven brand-level CTA row for BrandStoreScreen.
 *
 * Renders brand_config.actions per contracts-v1 §5 ordering rule (locked):
 *   - Transactional actions FIRST as full-width buttons stacked vertically
 *   - Contact actions BENEATH as a horizontal icon row
 *   - Within each group, schema array order respected
 *
 * visible_if expression evaluation: actions with `visible_if` are evaluated
 * against `{ brand_data, brand }` context using the shared exprEval. Failed
 * evaluations hide the action entirely (not greyed). Restaurant's book_slot
 * is the first real exerciser:
 *   "brand_data.accepts_table_booking == true"
 *
 * Contact action source resolution: `source_fields` are looked up against
 * brand fields (phone, whatsapp_phone, latitude, longitude, address_line).
 * If the required field is unset, the action is hidden — never render a
 * "Call" button that opens a blank dialer (per spec §8).
 *
 * Tracking propagation: NON-NEGOTIABLE. Every transactional onAction call
 * receives tracking. Brand-level transactions earn commission identically
 * to listing-level when tracking is present.
 */

export default function BrandActionRow({ brandConfig, brand, brandData, tracking, onAction, accent }) {
  if (!brandConfig?.actions?.length) return null;

  const ctx = { brand_data: brandData || {}, brand: brand || {} };

  const visibleActions = brandConfig.actions.filter(action => {
    if (action.visible_if && !evalExpr(action.visible_if, ctx)) return false;
    if (action.kind === 'contact') {
      // Contact actions hide if their source_fields aren't populated
      const fields = action.source_fields || [];
      const hasAny = fields.some(f => {
        const value = brand?.[f] || brandData?.[f];
        return value != null && value !== '';
      });
      if (!hasAny) return false;
    }
    return true;
  });

  const transactional = visibleActions.filter(a => a.kind === 'transactional');
  const contact = visibleActions.filter(a => a.kind === 'contact');

  return (
    <View style={styles.wrap}>
      {/* Transactional actions — full-width stacked */}
      {transactional.map((action, i) => (
        <TouchableOpacity key={`t-${i}`}
          style={[styles.txButton, { backgroundColor: accent || '#F59E0B' }]}
          onPress={() => onAction?.(action, { tracking, brand, brandData })}>
          <Text style={styles.txButtonText}>{action.label}</Text>
        </TouchableOpacity>
      ))}

      {/* Contact actions — horizontal icon row */}
      {contact.length > 0 && (
        <View style={styles.contactRow}>
          {contact.map((action, i) => (
            <TouchableOpacity key={`c-${i}`}
              style={[styles.contactBtn, { borderColor: (accent || '#F59E0B') + '40' }]}
              onPress={() => handleContactAction(action, brand, brandData)}>
              <Text style={[styles.contactIcon]}>{contactIcon(action.action)}</Text>
              <Text style={[styles.contactLabel, { color: accent || '#F59E0B' }]}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Contact action handlers ─────────────────────────────────────────────────

function handleContactAction(action, brand, brandData) {
  switch (action.action) {
    case 'call': {
      const phone = brand?.phone || brandData?.phone;
      if (!phone) { Alert.alert('No phone number', 'This salon hasn\'t added a phone number.'); return; }
      Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Cannot open dialer'));
      break;
    }
    case 'whatsapp': {
      const phone = brand?.whatsapp_phone || brandData?.whatsapp_phone || brand?.phone;
      if (!phone) { Alert.alert('No WhatsApp number'); return; }
      const url = `whatsapp://send?phone=${phone.replace(/\D/g, '')}`;
      Linking.openURL(url).catch(() =>
        Linking.openURL(`https://wa.me/${phone.replace(/\D/g, '')}`).catch(() =>
          Alert.alert('WhatsApp not installed')));
      break;
    }
    case 'directions': {
      const lat = brand?.latitude || brandData?.latitude;
      const lng = brand?.longitude || brandData?.longitude;
      const addr = brand?.address_line || brandData?.address_line;
      if (lat && lng) {
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`).catch(() =>
          Alert.alert('Cannot open maps'));
      } else if (addr) {
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`).catch(() =>
          Alert.alert('Cannot open maps'));
      } else {
        Alert.alert('No address available');
      }
      break;
    }
    case 'share': {
      // Share intent — handled by parent or platform Share API
      Alert.alert('Share', `Share ${brand?.business_name || 'this brand'}`);
      break;
    }
    default:
      // Unknown contact action — no-op rather than crash
      break;
  }
}

function contactIcon(action) {
  switch (action) {
    case 'call':       return '📞';
    case 'whatsapp':   return '💬';
    case 'directions': return '📍';
    case 'share':      return '↗';
    default:           return '•';
  }
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  txButton: { paddingVertical: 14, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  txButtonText: { fontSize: 14, fontWeight: '800', color: '#000' },
  contactRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  contactBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4,
    paddingVertical: 8, borderRadius: 10, borderWidth: 1,
  },
  contactIcon: { fontSize: 13 },
  contactLabel: { fontSize: 11, fontWeight: '700' },
});
