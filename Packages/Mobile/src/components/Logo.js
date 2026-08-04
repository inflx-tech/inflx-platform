// Logo — the INFLX logotype (React Native).
//
// The mark IS the letter "i", so the name is spelled once: the lockup
// renders [mark] + "nflx" and reads "inflx". Previously the mark sat
// beside a full "inflx", which wrote the i twice.
//
// The word is drawn as outlines (see InflxLockup) rather than a <Text>.
// As a letter the mark's position depends on exact glyph metrics, and
// this app only bundles PlusJakartaSans-Bold (700) while web uses 800 —
// live text would letterfit differently on the two platforms, and a font
// that failed to resolve would drop the mark into the wrong place inside
// the word. Outlines remove that risk entirely and need no font.
//
// `size` is the ASCENDER height, which is also the mark height, so these
// tokens keep the vertical footprint they had before this change.
//
// Differs from the web twin by design: there is no `wordmark` prop, because
// no mobile surface wants a mark-only logo (that is the brand-web dashboard
// topbar). Add it here only when a screen actually needs it.
//
// API: <Logo tone="light|dark" size="sm|md|lg|xl" />

import React from 'react';
import InflxLockup from './InflxLockup';

const SIZE = { sm: 26, md: 34, lg: 42, xl: 64 };

const WORD_ON_DARK = '#FFFFFF';
const WORD_ON_LIGHT = '#0D1630';

export default function Logo({ tone = 'dark', size = 'md', style }) {
  const height = SIZE[size] || SIZE.md;

  return (
    <InflxLockup
      height={height}
      wordFill={tone === 'light' ? WORD_ON_DARK : WORD_ON_LIGHT}
      style={style}
    />
  );
}
