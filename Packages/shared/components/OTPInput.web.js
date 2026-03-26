'use client';
import React, { useRef, useState } from 'react';
import { colors } from '../theme/tokens.js';

export default function OTPInput({ length = 6, value = '', onChange, error = false, disabled = false }) {
  const inputRefs = useRef([]);
  const digits = value.padEnd(length, '').split('').slice(0, length);

  const handleChange = (index, char) => {
    const newDigits = [...digits];
    newDigits[index] = char.slice(-1);
    const newValue = newDigits.join('').replace(/\s/g, '');
    onChange(newValue);
    if (char && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    onChange(pasted);
    inputRefs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={el => inputRefs.current[i] = el}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] || ''}
          disabled={disabled}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          style={{
            width: 44,
            height: 52,
            borderRadius: 12,
            border: `1.5px solid ${error ? colors.red : digits[i] ? colors.navy : colors.border2}`,
            backgroundColor: error ? colors.redPale : colors.surface,
            fontSize: 20,
            fontWeight: 700,
            textAlign: 'center',
            color: colors.t1,
            outline: 'none',
            transition: 'border-color 0.2s',
            boxShadow: digits[i] ? `0 0 0 3px ${colors.navyPale}` : 'none',
          }}
        />
      ))}
    </div>
  );
}
