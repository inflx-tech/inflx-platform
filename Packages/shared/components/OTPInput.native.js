import React, { useRef } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { colors } from '../theme/tokens.js';

export default function OTPInput({ length = 6, value = '', onChange, error = false, disabled = false }) {
  const inputRefs = useRef([]);
  const digits = value.padEnd(length, '').split('').slice(0, length);

  const handleChange = (index, text) => {
    const char = text.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    const newValue = newDigits.join('');
    onChange(newValue);
    if (char && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index, e) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
      {Array.from({ length }).map((_, i) => (
        <TextInput
          key={i}
          ref={el => inputRefs.current[i] = el}
          value={digits[i] || ''}
          onChangeText={text => handleChange(i, text)}
          onKeyPress={e => handleKeyPress(i, e)}
          keyboardType="number-pad"
          maxLength={1}
          editable={!disabled}
          style={{
            width: 44,
            height: 52,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: error ? colors.red : digits[i] ? colors.navy : colors.border2,
            backgroundColor: error ? colors.redPale : colors.surface,
            fontSize: 20,
            fontWeight: '700',
            textAlign: 'center',
            color: colors.t1,
          }}
        />
      ))}
    </View>
  );
}
