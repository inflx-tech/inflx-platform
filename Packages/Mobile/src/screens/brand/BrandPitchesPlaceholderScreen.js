/**
 * BrandPitchesPlaceholderScreen — the target of B6 "Open pitches → Creators → Pitches" until
 * item 8 builds the pitch inbox. Contract: features/item2-pitch-invitation-settings
 */

import React from 'react';
import { View } from 'react-native';
import { EmptyState } from '../../components/settings/primitives';
import { Header, s as base } from './BrandPitchSettingsScreen';

export default function BrandPitchesPlaceholderScreen({ navigation }) {
  return (
    <View style={base.screen}>
      <Header title="Pitches" onBack={() => navigation.goBack()} />
      <EmptyState title="Pitches are coming soon" body="Your open pitches will be listed here. Until then, this screen is a placeholder." />
    </View>
  );
}
