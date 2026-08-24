import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { brandPalette as P, fonts } from '../../theme/tokens';

/**
 * <StatusPill status mode />
 *
 * Canonical status → palette map for brand-mobile bucket. Single source of
 * truth introduced in Flow 21 (2026-05-25). Replaces 11 ad-hoc hex palettes
 * across Flows 18-20.
 *
 * Props:
 *   - status: string from the canonical map (or unknown → bg2/muted2)
 *   - mode:   'default' | 'transaction'
 *             - 'transaction' overrides `pending` to warnPale/warnText
 *               (in-flight transaction context, not stale-terminal).
 */

export const STATUS_MAP_DEFAULT = {
  // new/pending-actionable
  new:       { bg: P.warnPale,  fg: P.warnText,  label: 'NEW' },
  submitted: { bg: P.warnPale,  fg: P.warnText,  label: 'NEW' },
  sent:      { bg: P.warnPale,  fg: P.warnText,  label: 'NEW' },
  applied:   { bg: P.warnPale,  fg: P.warnText,  label: 'APPLIED' },     // Flow 22
  negotiating: { bg: P.warnPale, fg: P.warnText, label: 'NEGOTIATING' }, // Flow 22
  pending:   { bg: P.bg2,         fg: P.muted2,      label: 'PENDING' },

  // viewed / responded / contacted (engaged)
  contacted: { bg: P.infoPale,    fg: P.info,        label: 'CONTACTED' },
  viewed:    { bg: P.infoPale,    fg: P.info,        label: 'VIEWED' },
  responded: { bg: P.infoPale,    fg: P.info,        label: 'RESPONDED' },

  // counter (negotiation)
  countered: { bg: P.convPale,    fg: P.conv,        label: 'COUNTERED' },

  // success / converted / accepted / completed
  converted:  { bg: P.successPale, fg: P.successText, label: 'CONVERTED' },
  accepted:   { bg: P.successPale, fg: P.successText, label: 'ACCEPTED' },
  contracted: { bg: P.successPale, fg: P.successText, label: 'CONTRACTED' }, // Flow 22
  active:     { bg: P.successPale, fg: P.successText, label: 'ACTIVE' },     // Flow 22
  completed:  { bg: P.successPale, fg: P.successText, label: 'COMPLETED' },
  live:       { bg: P.successPale, fg: P.successText, label: 'LIVE' },

  // negative / terminal
  rejected:           { bg: P.dangerPale, fg: P.dangerText, label: 'REJECTED' },
  rejected_by_brand:  { bg: P.dangerPale, fg: P.dangerText, label: 'REJECTED' }, // Flow 22 alias
  declined:           { bg: P.dangerPale, fg: P.dangerText, label: 'DECLINED' },
  cancelled:          { bg: P.dangerPale, fg: P.dangerText, label: 'CANCELLED' },

  // terminal-grey
  invited:      { bg: P.bg2, fg: P.muted2, label: 'INVITED' },      // Flow 22
  closed:       { bg: P.bg2, fg: P.muted2, label: 'CLOSED' },
  expired:      { bg: P.bg2, fg: P.muted2, label: 'EXPIRED' },
  withdrawn:    { bg: P.bg2, fg: P.muted2, label: 'WITHDRAWN' },
  refunded:     { bg: P.bg2, fg: P.muted2, label: 'REFUNDED' },
  slots_filled: { bg: P.bg2, fg: P.muted2, label: 'SLOTS FILLED' }, // Flow 22
  walked_away:  { bg: P.bg2, fg: P.muted2, label: 'CLOSED' },       // Flow 23 (negotiation terminal)

  // Negotiation in-flight
  awaiting_brand:      { bg: P.warnPale, fg: P.warnText, label: 'YOUR TURN' },  // Flow 23
  awaiting_influencer: { bg: P.infoPale,   fg: P.info,       label: 'WAITING' },    // Flow 23
  agreed:              { bg: P.successPale,fg: P.successText, label: 'AGREED' },    // Flow 23
  open:                { bg: P.bg2, fg: P.ink, label: 'OPEN' },       // Flow 23

  // Contract lifecycle (Flow 25)
  draft:              { bg: P.bg2,        fg: P.muted2,     label: 'DRAFT' },                // Flow 25
  pending_influencer: { bg: P.warnPale, fg: P.warnText, label: 'AWAITING INFLUENCER' }, // Flow 25
  pending_brand:      { bg: P.warnPale, fg: P.warnText, label: 'YOUR TURN' },           // Flow 25

  // Production-event lifecycle (Flow 27)
  proposed:    { bg: P.bg2,  fg: P.ink,  label: 'PROPOSED' },    // Flow 27
  confirmed:   { bg: P.successPale, fg: P.successText, label: 'CONFIRMED' },   // Flow 27
  in_progress: { bg: P.infoPale,    fg: P.info,        label: 'IN PROGRESS' }, // Flow 27

  // Withdrawal lifecycle (Flow 28)
  processing: { bg: P.infoPale,   fg: P.info,       label: 'PROCESSING' }, // Flow 28
  failed:     { bg: P.dangerPale, fg: P.dangerText, label: 'FAILED' },     // Flow 28

  // Campaign + deliverable + tranche statuses (Flow 31)
  published:          { bg: P.infoPale,    fg: P.info,        label: 'PUBLISHED' }, // Flow 31 (campaign_status)
  revision_requested: { bg: P.warnPale,  fg: P.warnText,  label: 'REVISION' },  // Flow 31 (deliverable_status)
  locked:             { bg: P.bg2,         fg: P.muted2,      label: 'LOCKED' },    // Flow 31 (tranche_status)
  released:           { bg: P.successPale, fg: P.successText, label: 'RELEASED' },  // Flow 31 (tranche_status)
};

const FALLBACK = { bg: P.bg2, fg: P.muted2 };

export default function StatusPill({ status, mode = 'default' }) {
  const key = String(status || '').toLowerCase();
  let cfg = STATUS_MAP_DEFAULT[key] || { ...FALLBACK, label: key.toUpperCase() || '—' };

  // In-flight transaction context: 'pending' is actionable, not terminal
  if (mode === 'transaction' && key === 'pending') {
    cfg = { bg: P.warnPale, fg: P.warnText, label: 'PENDING' };
  }

  // Influencer-POV (Flow 30): flip role-perspective on the 2 negotiation-
  // ambiguous keys. Canonical map labels are brand-POV (Flow 23 origin);
  // influencer-side consumers need them inverted to make sense.
  if (mode === 'influencer') {
    if (key === 'awaiting_brand')      cfg = { bg: P.infoPale,   fg: P.info,       label: 'WAITING' };
    if (key === 'awaiting_influencer') cfg = { bg: P.warnPale, fg: P.warnText, label: 'YOUR TURN' };
  }

  return (
    <View style={[styles.pill, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.text, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 99,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: fonts.monoBold,
    fontSize: 9.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
