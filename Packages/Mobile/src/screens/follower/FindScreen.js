import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput } from 'react-native';
import { darkColors } from '../../theme/tokens';
import { followerApi } from '../../services/api';

/**
 * FindScreen — 7 super-categories with sub-categories and store counts.
 * Tap super-category → CategoryListScreen.
 */

const SUPER_CATEGORIES = [
  {
    key: 'eat', icon: '🍽️', label: 'Eat',
    subs: [
      { key: 'restaurant', label: 'Restaurants', icon: '🍽️' },
      { key: 'bakery', label: 'Bakeries', icon: '🎂' },
      { key: 'packaged_food', label: 'Grocery', icon: '🛒' },
    ],
  },
  {
    key: 'shop', icon: '🛍️', label: 'Shop',
    subs: [
      { key: 'fashion_walkin', label: 'Fashion', icon: '👗' },
      { key: 'fashion_online', label: 'Online Fashion', icon: '🛍️' },
    ],
  },
  {
    key: 'groom', icon: '✨', label: 'Groom',
    subs: [
      { key: 'salon', label: 'Salons', icon: '💇' },
    ],
  },
  {
    key: 'fitness', icon: '💪', label: 'Stay Fit',
    subs: [],
  },
  {
    key: 'travel', icon: '✈️', label: 'Travel',
    subs: [
      { key: 'car_rental', label: 'Car Rental', icon: '🚗' },
    ],
  },
  {
    key: 'home', icon: '🏠', label: 'Home',
    subs: [],
  },
  {
    key: 'events', icon: '🎉', label: 'Events',
    subs: [
      { key: 'function_hall', label: 'Function Halls', icon: '🏛️' },
      { key: 'wedding_planner', label: 'Wedding Planners', icon: '💍' },
      { key: 'florist', label: 'Florists', icon: '💐' },
    ],
  },
];

export default function FindScreen({ navigation }) {
  const [search, setSearch] = useState('');
  const [dealCounts, setDealCounts] = useState({});

  useEffect(() => {
    async function loadCounts() {
      try {
        const res = await followerApi.getCategories?.();
        if (res?.data?.categories) {
          const counts = {};
          for (const cat of res.data.categories) {
            counts[cat.key] = cat.deal_count;
          }
          setDealCounts(counts);
        }
      } catch (err) {
        console.error('FindScreen loadCounts error:', err);
      }
    }
    loadCounts();
  }, []);

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search stores, products, services..."
          placeholderTextColor={darkColors.textMuted}
        />
      </View>

      {/* Super-categories */}
      {SUPER_CATEGORIES.map(sc => (
        <View key={sc.key} style={styles.categorySection}>
          <TouchableOpacity
            style={styles.categoryHeader}
            onPress={() => navigation.navigate('CategoryList', { superCategory: sc.key, label: sc.label, icon: sc.icon })}
          >
            <Text style={styles.categoryIcon}>{sc.icon}</Text>
            <Text style={styles.categoryLabel}>{sc.label}</Text>
            {dealCounts[sc.key] > 0 && (
              <View style={styles.dealBadge}>
                <Text style={styles.dealBadgeText}>{dealCounts[sc.key]} deals</Text>
              </View>
            )}
            <Text style={styles.arrow}>→</Text>
          </TouchableOpacity>

          {/* Sub-categories */}
          {sc.subs.length > 0 && (
            <View style={styles.subsRow}>
              {sc.subs.map(sub => (
                <TouchableOpacity
                  key={sub.key}
                  style={styles.subItem}
                  onPress={() => navigation.navigate('CategoryList', {
                    superCategory: sc.key,
                    subCategory: sub.key,
                    label: sub.label,
                    icon: sub.icon,
                  })}
                >
                  <Text style={styles.subIcon}>{sub.icon}</Text>
                  <Text style={styles.subLabel}>{sub.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {sc.subs.length === 0 && (
            <Text style={styles.comingSoon}>Coming soon</Text>
          )}
        </View>
      ))}

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkColors.bg2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: darkColors.card,
    borderWidth: 1,
    borderColor: darkColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 14,
    color: darkColors.text,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: darkColors.text,
  },
  searchBar: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: darkColors.card,
    borderWidth: 1,
    borderColor: darkColors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: darkColors.text,
    padding: 0,
  },
  categorySection: {
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: darkColors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: darkColors.border,
  },
  categoryIcon: {
    fontSize: 24,
  },
  categoryLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: darkColors.text,
  },
  dealBadge: {
    backgroundColor: darkColors.amberDim,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  dealBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: darkColors.amber,
  },
  arrow: {
    fontSize: 14,
    color: darkColors.textMuted,
  },
  subsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    paddingLeft: 16,
  },
  subItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: darkColors.card,
    borderWidth: 1,
    borderColor: darkColors.border,
  },
  subIcon: {
    fontSize: 12,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: darkColors.textSecondary,
  },
  comingSoon: {
    fontSize: 10,
    color: darkColors.textMuted,
    marginTop: 6,
    paddingLeft: 16,
    fontStyle: 'italic',
  },
});
