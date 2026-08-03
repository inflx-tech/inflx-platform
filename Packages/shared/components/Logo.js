// Logo — the INFLX lockup (web).
//
// Renders the vector mark beside the "inflx" wordmark. The wordmark is
// live text (Plus Jakarta Sans, already loaded in globals.css) rather
// than baked into an image, so it stays crisp at every size and `tone`
// is a pure colour swap with no second asset to keep in sync.
//
// The mark itself is self-contained — brand yellow with a near-black
// band — so it reads correctly on light and dark chrome alike; only the
// wordmark colour responds to `tone`.
//
// API: <Logo tone="light|dark" size="sm|md|lg" />
//   tone  — "light" for dark backgrounds (topbar), "dark" for light bg
//   size  — sm 26px mark / md 34 / lg 42

import React from 'react';
import InflxMark from './InflxMark';

const WORDMARK_FONT =
  "'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, sans-serif";

// Mark height in px; everything else is derived from it so the lockup
// scales as one unit.
const SIZE = { sm: 26, md: 34, lg: 42 };

export default function Logo({ tone = 'dark', size = 'md', className = '' }) {
  const markHeight = SIZE[size] || SIZE.md;
  const isLight = tone === 'light';

  return (
    <span
      className={`inflx-logo ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(markHeight * 0.34),
        userSelect: 'none',
        lineHeight: 1,
      }}
    >
      <InflxMark height={markHeight} decorative />
      <span
        style={{
          fontFamily: WORDMARK_FONT,
          fontWeight: 800,
          fontSize: Math.round(markHeight * 0.82),
          letterSpacing: '-0.02em',
          lineHeight: 1,
          color: isLight ? '#FFFFFF' : '#0D1630',
        }}
      >
        inflx
      </span>
    </span>
  );
}
