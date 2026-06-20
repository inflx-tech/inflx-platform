/**
 * LocationHeader — Path C-1 tappable location pill.
 *
 * Renders the current location label with a ▼ affordance; tapping opens
 * LocationSheet. Drop-in for the hardcoded location text on DiningHome
 * (and any other discovery surface). `navigation` is forwarded to the
 * sheet so "Add new address" can route to AddressScreen.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { brandPalette as lightColors, fonts } from '../theme/tokens';
import { useAppLocation } from '../contexts/LocationContext';
import LocationSheet from './LocationSheet';

export default function LocationHeader({ navigation, title }) {
  const { location } = useAppLocation();
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable onPress={() => navigation ? navigation.navigate('LocationEntry') : setOpen(true)} hitSlop={6}>
        <Text style={styles.pill}>
          📍 {String(location.label || 'Set location').toUpperCase()}
        </Text>
        {title ? (
          <Text style={styles.title}>{title}</Text>
        ) : (
          <Text style={styles.subtitle}>
            {location.sublabel || 'Tap to change'} <Text style={styles.caret}>▼</Text>
          </Text>
        )}
      </Pressable>
      <LocationSheet visible={open} onClose={() => setOpen(false)} navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    fontFamily: fonts.monoBold,
    fontSize: 10,
    color: lightColors.muted,
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    color: lightColors.ink,
    letterSpacing: -0.4,
    marginTop: 2,
  },
  subtitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: lightColors.muted2,
    marginTop: 2,
  },
  caret: { color: lightColors.yellowText, fontSize: 11 },
});
