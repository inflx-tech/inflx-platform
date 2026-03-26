import React from 'react';

/**
 * MoneyDisplay — converts paise to ₹ with Indian number formatting
 * @param {number} paise - amount in paise (integer)
 * @param {object} props - additional props
 */
export default function MoneyDisplay({ paise = 0, style, className, showSign = false }) {
  const rupees = paise / 100;

  // Indian number format: 1,00,000 (not 100,000)
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rupees);

  const display = showSign && paise > 0 ? `+${formatted}` : formatted;

  if (typeof document !== 'undefined') {
    // Web (Next.js)
    return <span className={className} style={style}>{display}</span>;
  }

  // React Native fallback
  const { Text } = require('react-native');
  return <Text style={style}>{display}</Text>;
}

/**
 * Utility: convert paise to formatted rupee string (no JSX)
 */
export function formatPaise(paise) {
  const rupees = (paise || 0) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rupees);
}
