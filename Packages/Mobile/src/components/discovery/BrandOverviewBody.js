/**
 * BrandOverviewBody — the shared body of O1/O2 (creator view) and O4 (the brand's own view):
 * header, about, an "accepts" slot, products (first four + See all), posts by creators
 * (empty until item 13), branch cities and links.
 * Contract: features/item3-discovery-profiles-groups · prompt §6.7
 */
import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Avatar } from '../../screens/brand/BrandBlockedCreatorsScreen';
import { TagRow } from '../settings/primitives';
import { ProductGrid, PostGrid } from './bits';
import { C3, subCategoryLabel } from './copy3';

const O = C3.overview;

export default function BrandOverviewBody({ brand, products, viewer, navigation, acceptsNode, ownHint }) {
  const name = brand.business_name || brand.name;
  const line = [ 'Fashion', brand.mainCity, brand.branchCount != null ? `${brand.branchCount} ${brand.branchCount === 1 ? 'branch' : 'branches'}` : null ].filter(Boolean).join(' · ');
  const subs = (brand.subCategories || brand.sub_categories || []).map(subCategoryLabel);
  const rows = products?.rows || [];
  const total = products?.total || 0;
  const openAll = () => navigation.navigate('BrandProducts', { brandId: brand.id, viewer });
  const links = [
    brand.websiteUrl ? { label: brand.websiteUrl.replace(/^https?:\/\//, ''), url: brand.websiteUrl } : null,
    brand.instagramHandle ? { label: `@${brand.instagramHandle}`, url: `https://instagram.com/${brand.instagramHandle}` } : null,
  ].filter(Boolean);

  return (
    <View>
      <View style={s.hero}>
        <Avatar name={name} url={brand.logoUrl || brand.logo_url} size={64} />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={s.name}>{name}</Text>
          <Text style={s.sub} testID="overview-line">{line}</Text>
        </View>
      </View>
      {subs.length ? <View style={{ marginTop: 10 }}><TagRow items={subs} /></View> : null}
      {brand.about ? <Text style={s.about} testID="overview-about">{brand.about}</Text> : null}
      <View style={{ height: 14 }} />
      {acceptsNode}

      <View style={s.section}>
        <View style={s.sectionHead}>
          <Text style={s.sectionTitle}>{O.products(total)}</Text>
          {total > rows.length ? <TouchableOpacity onPress={openAll} testID="see-all-products"><Text style={s.link}>{O.seeAll}</Text></TouchableOpacity> : null}
        </View>
        {rows.length ? <ProductGrid products={rows} onOpen={(p) => navigation.navigate('ProductDetail', { brandId: brand.id, productId: p.id, viewer })} /> : (
          <Text style={s.hint}>{ownHint || 'No products yet.'}</Text>
        )}
        {ownHint && rows.length ? <Text style={s.hint}>{ownHint}</Text> : null}
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>{O.posts}</Text>
        <PostGrid posts={[]} emptyTitle={O.postsEmptyTitle} emptyBody={O.postsEmptyBody(name)} />
      </View>

      {(brand.branchCities || []).length ? (
        <View style={s.section} testID="overview-branches">
          <Text style={s.sectionTitle}>{O.branches(brand.branchCount)}</Text>
          <TagRow items={brand.branchCities} />
          <Text style={s.hint}>{O.branchesHint}</Text>
        </View>
      ) : null}

      {links.length ? (
        <View style={s.section} testID="overview-links">
          <Text style={s.sectionTitle}>{O.links}</Text>
          {links.map(l => (
            <TouchableOpacity key={l.url} onPress={() => Linking.openURL(l.url).catch(() => {})} style={s.linkRow}><Text style={s.link}>{l.label}</Text></TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center' },
  name: { fontFamily: fonts.sansBold, fontSize: 19, color: T.ink },
  sub: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, marginTop: 3 },
  about: { fontFamily: fonts.sansRegular, fontSize: 14, color: T.ink2, lineHeight: 20, marginTop: 10 },
  section: { marginTop: 22 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: T.ink, marginBottom: 8 },
  link: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: T.ink, textDecorationLine: 'underline' },
  linkRow: { paddingVertical: 8 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, lineHeight: 17, marginTop: 6 },
});
