/**
 * FindBrandsScreen — F2 (list) · F3 (filters): brands the creator can pitch, with the
 * live status chip per brand. Contract: features/item3-discovery-profiles-groups · prompt §6.6
 */
import React from 'react';
import { View } from 'react-native';
import { influencerApi } from '../../services/api';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import BrandList from '../../components/discovery/BrandList';
import useReferenceLists from '../../hooks/useReferenceLists';
import { C3 } from '../../components/discovery/copy3';

export default function FindBrandsScreen({ navigation }) {
  const lists = useReferenceLists();
  return (
    <View style={base.screen} testID="find-brands">
      <Header title={C3.findBrands.title} onBack={() => navigation.goBack()} />
      <BrandList fetcher={influencerApi.findBrands} countFetcher={influencerApi.findBrands} lists={lists}
        onOpen={(b) => navigation.navigate('BrandOverview', { brandId: b.id })} />
    </View>
  );
}
