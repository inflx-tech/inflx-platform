// Logo — the INFLX logotype (web).
//
// The mark IS the letter "i", so the name is spelled once: the lockup
// renders [mark] + "nflx" and reads "inflx". Previously the mark sat
// beside a full "inflx", which wrote the i twice.
//
// The word is drawn as outlines (see InflxLockup) rather than live text.
// As a letter the mark's position depends on exact glyph metrics, and web
// (Plus Jakarta Sans 800) and mobile (Bold 700) do not agree — outlines
// make the logotype identical on both and remove the font dependency.
//
// `size` is the ASCENDER height, which is also the mark height, so these
// tokens keep the vertical footprint they had before this change.
//
// API: <Logo tone="light|dark" size="sm|md|lg" wordmark={bool} />
//   tone     — "light" for dark backgrounds, "dark" for light ones.
//              Only the word responds; the mark carries its own colours.
//   wordmark — false renders the mark alone, for chrome that already
//              establishes the brand (the dashboard topbar).

import React from 'react';
import InflxLockup from './InflxLockup';
import InflxMark from './InflxMark';

const SIZE = { sm: 26, md: 34, lg: 42 };

const WORD_ON_DARK = '#FFFFFF';
const WORD_ON_LIGHT = '#0D1630';

export default function Logo({ tone = 'dark', size = 'md', className = '', wordmark = true }) {
  const height = SIZE[size] || SIZE.md;

  if (!wordmark) {
    return <InflxMark height={height} className={`inflx-logo ${className}`} />;
  }

  return (
    <InflxLockup
      height={height}
      wordFill={tone === 'light' ? WORD_ON_DARK : WORD_ON_LIGHT}
      className={`inflx-logo ${className}`}
    />
  );
}
