// Logo — INFLX brand placeholder (web).
//
// Renders a dashed [LOGO] placeholder until the founder uploads the
// real artwork. To swap in the real logo:
//   1. Drop the asset at Packages/shared/assets/logo/inflx-logo.png
//      (or .svg) — light variant for dark chrome, dark variant for
//      light backgrounds.
//   2. Set HAS_ASSET = true below; the component will render the
//      image instead. No call-site changes anywhere.
//
// API: <Logo tone="light|dark" size="sm|md|lg" />
//   tone  — "light" for dark backgrounds (topbar), "dark" for light bg
//   size  — controls the placeholder box dimensions (sm 130/8, md 180/14, lg 220/16)

import React from 'react';

const HAS_ASSET = false; // flip to true after uploading the asset

const SIZE = {
  sm: { minWidth: 130, padding: '8px 18px',  fontSize: 12 },
  md: { minWidth: 180, padding: '14px 28px', fontSize: 14 },
  lg: { minWidth: 220, padding: '16px 32px', fontSize: 16 },
};

export default function Logo({ tone = 'dark', size = 'md', className = '' }) {
  if (HAS_ASSET) {
    // When the real asset is uploaded, we render an <img>. Keep the
    // same wrapper so any layout that depends on the placeholder's
    // box still works.
    const src = tone === 'light'
      ? '/inflx-logo-on-dark.png'  // upload as /public/inflx-logo-on-dark.png
      : '/inflx-logo.png';         // upload as /public/inflx-logo.png
    return (
      <img
        src={src}
        alt="inflx"
        className={`inflx-logo ${className}`}
        style={SIZE[size]}
      />
    );
  }

  const s = SIZE[size] || SIZE.md;
  const isLight = tone === 'light';

  const wrapStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: s.minWidth,
    padding: s.padding,
    border: `2px dashed ${isLight ? 'rgba(255,255,255,0.22)' : '#D4D4D8'}`,
    borderRadius: 10,
    background:    isLight ? 'rgba(255,255,255,0.04)' : '#F4F4F5',
    color:         isLight ? 'rgba(255,255,255,0.7)'  : '#71717A',
    fontFamily:    "'JetBrains Mono', ui-monospace, monospace",
    fontWeight: 700,
    fontSize: s.fontSize,
    letterSpacing: '2.5px',
    userSelect: 'none',
  };

  return (
    <span
      role="img"
      aria-label="inflx logo placeholder — upload to replace"
      className={`inflx-logo-placeholder ${className}`}
      style={wrapStyle}
    >
      LOGO
    </span>
  );
}
