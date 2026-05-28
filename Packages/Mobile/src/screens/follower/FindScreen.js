import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput } from 'react-native';
import { brandPalette as P, fonts } from '../../theme/tokens';
import { followerApi } from '../../services/api';

/**
 * FindScreen — 7 super-categories with sub-categories and store counts.
 * Tap super-category → CategoryListScreen.
 */

const SUPER_CATEGORIES = [
  {
    key: 'eat', icon: '🍽️', label: 'Eat',
    subs: [
      { key: 'restaurant', label: 'Restaurants & Cafes', icon: '🍽️' },
      { key: 'bakery', label: 'Bakeries', icon: '🎂' },
      { key: 'packaged_food', label: 'Packaged Food', icon: '📦' },
      { key: 'grocery', label: 'Grocery & Supermarkets', icon: '🛒' },
    ],
  },
  {
    key: 'shop', icon: '🛍️', label: 'Shop',
    subs: [
      { key: 'fashion_walkin', label: 'Fashion & Apparel', icon: '👗' },
      { key: 'electronics', label: 'Electronics & Gadgets', icon: '📱' },
      { key: 'jewellery', label: 'Jewellery & Watches', icon: '💎' },
      { key: 'footwear', label: 'Footwear', icon: '👟' },
      { key: 'furniture', label: 'Home Decor & Furniture', icon: '🪴' },
      { key: 'optical', label: 'Optical / Eyewear', icon: '👓' },
      { key: 'pet_shop', label: 'Pet Shops', icon: '🐕' },
      { key: 'flowers_gifting', label: 'Flowers & Gifting', icon: '🌹' },
      { key: 'hardware', label: 'Hardware & Building', icon: '🔨' },
    ],
  },
  {
    key: 'groom', icon: '✨', label: 'Groom',
    subs: [
      { key: 'salon', label: 'Salons & Beauty', icon: '💇' },
      { key: 'home_beauty', label: 'Home Beauty', icon: '💅' },
      { key: 'pet_grooming', label: 'Pet Grooming', icon: '🐾' },
    ],
  },
  {
    key: 'fitness', icon: '💪', label: 'Stay Fit',
    subs: [
      { key: 'gym_fitness', label: 'Gyms & Fitness', icon: '💪' },
      { key: 'clinic_doctor', label: 'Clinics & Doctors', icon: '🏥' },
      { key: 'dental_clinic', label: 'Dental Clinics', icon: '🦷' },
      { key: 'diagnostic_lab', label: 'Diagnostic Labs', icon: '🔬' },
      { key: 'coaching_center', label: 'Coaching & Tutoring', icon: '📚' },
    ],
  },
  {
    key: 'travel', icon: '✈️', label: 'Travel',
    subs: [
      { key: 'car_rental', label: 'Car Rental', icon: '🚗' },
      { key: 'bike_rental', label: 'Bike Rental', icon: '🏍️' },
      { key: 'travel_packages', label: 'Travel Packages', icon: '✈️' },
      { key: 'hotel_homestay', label: 'Hotels & Homestays', icon: '🏨' },
    ],
  },
  {
    key: 'home', icon: '🏠', label: 'Home',
    subs: [
      { key: 'home_services', label: 'Home Services', icon: '🔧' },
      { key: 'pest_control', label: 'Pest Control', icon: '🐛' },
      { key: 'laundry', label: 'Laundry & Dry Cleaning', icon: '👔' },
      { key: 'interior_design', label: 'Interior Design', icon: '🎨' },
      { key: 'coworking_space', label: 'Co-working Spaces', icon: '🏢' },
    ],
  },
  {
    key: 'events', icon: '🎉', label: 'Events',
    subs: [
      { key: 'function_hall', label: 'Event Venues', icon: '🏛️' },
      { key: 'wedding_planner', label: 'Wedding Planners', icon: '💍' },
      { key: 'photography', label: 'Photography Studios', icon: '📸' },
      { key: 'florist', label: 'Florists', icon: '💐' },
      { key: 'legal_ca', label: 'Legal / CA', icon: '⚖️' },
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
          placeholderTextColor={P.muted2}
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
    backgroundColor: P.bg,
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
    backgroundColor: P.white,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 14,
    color: P.ink,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: P.ink,
    fontFamily: fonts.displayBlack,
  },
  searchBar: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: P.white,
    borderWidth: 1.5,
    borderColor: P.ink,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: P.ink,
    padding: 0,
    fontFamily: fonts.sansRegular,
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
    backgroundColor: P.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: P.border,
  },
  categoryIcon: {
    fontSize: 24,
  },
  categoryLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    color: P.ink,
    fontFamily: fonts.displayBlack,
  },
  dealBadge: {
    backgroundColor: P.yellowPale,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  dealBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: P.yellowText,
    fontFamily: fonts.monoBold,
  },
  arrow: {
    fontSize: 14,
    color: P.muted2,
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
    backgroundColor: P.white,
    borderWidth: 1,
    borderColor: P.border,
  },
  subIcon: {
    fontSize: 12,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: P.muted,
  },
  comingSoon: {
    fontSize: 10,
    color: P.muted2,
    marginTop: 6,
    paddingLeft: 16,
    fontStyle: 'italic',
  },
});
