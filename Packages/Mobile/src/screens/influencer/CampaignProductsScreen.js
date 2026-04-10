import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { colors, spacing, radius, fmtMoney } from '../../theme/tokens';
import { influencerApi } from '../../services/api';

/**
 * CampaignProductsScreen — influencer views assigned products and publishes to store.
 *
 * Flow:
 * 1. Shows all products assigned via the campaign
 * 2. Influencer adds personal note per product ("I love this deal!")
 * 3. Clicks "Publish to My Store" — product goes live on their influencer store
 */

export default function CampaignProductsScreen({ navigation, route }) {
  const { campaignInfluencerId, campaignName } = route.params || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingNote, setEditingNote] = useState(null); // product_id being edited
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      const res = await influencerApi.getCampaignProducts(campaignInfluencerId);
      const d = res.data || res;
      setData(d);
    } catch (e) {
      console.error('[CampaignProducts] Error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [campaignInfluencerId]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const onRefresh = () => { setRefreshing(true); loadProducts(); };

  async function handlePublish(product) {
    const note = noteText.trim() || `Check out this ${product.name}!`;
    setSaving(true);
    try {
      const res = await influencerApi.upsertProductNote({
        product_id: product.id,
        campaign_id: data.campaign_id,
        note_text: note,
      });
      if (res.success || res.data) {
        Alert.alert('Published! 🎉', `${product.name} is now live on your store`);
        setEditingNote(null);
        setNoteText('');
        loadProducts();
      } else {
        Alert.alert('Failed', res.error?.message || 'Could not publish');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUnpublish(product) {
    // Find the note and delete it
    try {
      const notesRes = await influencerApi.getProductNotes(data.campaign_id);
      const notes = notesRes.data?.notes || [];
      const note = notes.find(n => n.product_id === product.id);
      if (note) {
        await influencerApi.deleteProductNote(note.id);
        Alert.alert('Removed', `${product.name} removed from your store`);
        loadProducts();
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.orange} /></View>;
  }

  const products = data?.products || [];
  const brand = data?.brand;
  const publishedCount = products.filter(p => p.is_published).length;

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.orange]} />}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={{ fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Campaign Products</Text>
          <Text style={s.subtitle}>{campaignName || 'Campaign'} · {brand?.name}</Text>
        </View>
      </View>

      {/* Stats bar */}
      <View style={s.statsBar}>
        <View style={s.stat}>
          <Text style={s.statVal}>{products.length}</Text>
          <Text style={s.statLabel}>Products</Text>
        </View>
        <View style={s.stat}>
          <Text style={[s.statVal, { color: colors.teal }]}>{publishedCount}</Text>
          <Text style={s.statLabel}>Published</Text>
        </View>
        <View style={s.stat}>
          <Text style={[s.statVal, { color: colors.orange }]}>{products.length - publishedCount}</Text>
          <Text style={s.statLabel}>Pending</Text>
        </View>
      </View>

      {/* Info banner */}
      <View style={s.infoBanner}>
        <Text style={s.infoIcon}>💡</Text>
        <Text style={s.infoText}>
          Add your personal recommendation to each product and publish it to your store. Your followers will see these deals!
        </Text>
      </View>

      {/* Products list */}
      {products.map(product => {
        const isEditing = editingNote === product.id;
        const discount = data?.offers?.[0]?.discount_value;

        return (
          <View key={product.id} style={s.productCard}>
            {/* Product info */}
            <View style={s.productHeader}>
              <View style={s.productEmoji}>
                <Text style={{ fontSize: 28 }}>🚗</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.productName}>{product.name}</Text>
                <Text style={s.productDesc}>{product.description || product.section}</Text>
                <View style={s.priceRow}>
                  <Text style={s.price}>{fmtMoney(product.price)}</Text>
                  {discount && <Text style={s.discountBadge}>{discount}% OFF</Text>}
                </View>
              </View>
              {product.is_published && (
                <View style={s.liveBadge}>
                  <Text style={s.liveBadgeText}>✓ Live</Text>
                </View>
              )}
            </View>

            {/* Published note */}
            {product.is_published && product.influencer_note && !isEditing && (
              <View style={s.noteCard}>
                <Text style={s.noteLabel}>Your recommendation:</Text>
                <Text style={s.noteText}>"{product.influencer_note}"</Text>
                <View style={s.noteActions}>
                  <TouchableOpacity onPress={() => { setEditingNote(product.id); setNoteText(product.influencer_note); }}>
                    <Text style={s.noteEdit}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleUnpublish(product)}>
                    <Text style={s.noteRemove}>Remove from store</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Edit note / Publish form */}
            {(isEditing || !product.is_published) && (
              <View style={s.publishForm}>
                <Text style={s.publishLabel}>
                  {product.is_published ? 'Update your recommendation:' : 'Add your recommendation:'}
                </Text>
                <TextInput
                  style={s.noteInput}
                  value={isEditing ? noteText : ''}
                  onChangeText={setNoteText}
                  placeholder="e.g. I love this deal! Best for family trips 🚗"
                  placeholderTextColor={colors.t3}
                  multiline
                  onFocus={() => { if (!isEditing) { setEditingNote(product.id); setNoteText(''); } }}
                />
                <View style={s.publishActions}>
                  {isEditing && (
                    <TouchableOpacity onPress={() => { setEditingNote(null); setNoteText(''); }} style={s.cancelBtn}>
                      <Text style={s.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[s.publishBtn, saving && { opacity: 0.5 }]}
                    onPress={() => { if (!isEditing) setEditingNote(product.id); handlePublish(product); }}
                    disabled={saving}
                  >
                    <Text style={s.publishText}>
                      {saving ? 'Publishing...' : product.is_published ? 'Update' : '🚀 Publish to My Store'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Quick publish without editing */}
            {!product.is_published && editingNote !== product.id && (
              <TouchableOpacity
                style={s.quickPublish}
                onPress={() => {
                  setEditingNote(product.id);
                  setNoteText(`Check out this amazing ${product.name}! Great deal 🔥`);
                }}
              >
                <Text style={s.quickPublishText}>+ Add Note & Publish to Store</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {products.length === 0 && (
        <View style={s.empty}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>📦</Text>
          <Text style={s.emptyTitle}>No products assigned</Text>
          <Text style={s.emptyText}>The brand hasn't linked products to this campaign yet.</Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: spacing.lg, paddingTop: 50, paddingBottom: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: colors.t1 },
  subtitle: { fontSize: 11, color: colors.t3, marginTop: 2 },
  statsBar: {
    flexDirection: 'row', backgroundColor: colors.white, padding: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '800', color: colors.t1 },
  statLabel: { fontSize: 10, color: colors.t3, marginTop: 2 },
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    margin: spacing.lg, padding: 12, backgroundColor: colors.orangePale,
    borderRadius: radius.md, borderWidth: 1, borderColor: '#fde68a',
  },
  infoIcon: { fontSize: 16 },
  infoText: { flex: 1, fontSize: 12, color: '#92400e', lineHeight: 18 },
  productCard: {
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  productHeader: {
    flexDirection: 'row', padding: spacing.lg, gap: 12, alignItems: 'center',
  },
  productEmoji: {
    width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  productName: { fontSize: 14, fontWeight: '700', color: colors.t1 },
  productDesc: { fontSize: 11, color: colors.t3, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  price: { fontSize: 15, fontWeight: '800', color: colors.t1 },
  discountBadge: {
    fontSize: 10, fontWeight: '700', color: colors.teal,
    backgroundColor: colors.tealPale, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  liveBadge: {
    backgroundColor: colors.tealPale, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  liveBadgeText: { fontSize: 10, fontWeight: '700', color: colors.tealDeep },
  noteCard: {
    marginHorizontal: spacing.lg, marginBottom: spacing.lg,
    padding: 12, backgroundColor: colors.surface2, borderRadius: radius.md,
  },
  noteLabel: { fontSize: 10, fontWeight: '600', color: colors.t3, marginBottom: 4 },
  noteText: { fontSize: 13, color: colors.t1, fontStyle: 'italic', lineHeight: 20 },
  noteActions: { flexDirection: 'row', gap: 16, marginTop: 8 },
  noteEdit: { fontSize: 11, fontWeight: '600', color: colors.orange },
  noteRemove: { fontSize: 11, fontWeight: '600', color: colors.red },
  publishForm: {
    padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.surface2,
  },
  publishLabel: { fontSize: 11, fontWeight: '600', color: colors.t2, marginBottom: 6 },
  noteInput: {
    borderWidth: 1.5, borderColor: colors.border2, borderRadius: radius.md,
    padding: 12, fontSize: 13, color: colors.t1, minHeight: 60,
    backgroundColor: colors.white, textAlignVertical: 'top',
  },
  publishActions: { flexDirection: 'row', gap: 8, marginTop: 10, justifyContent: 'flex-end' },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.md },
  cancelText: { fontSize: 12, fontWeight: '600', color: colors.t3 },
  publishBtn: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.md,
    backgroundColor: colors.orange,
  },
  publishText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  quickPublish: {
    paddingVertical: 12, paddingHorizontal: spacing.lg,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  quickPublishText: { fontSize: 12, fontWeight: '600', color: colors.orange, textAlign: 'center' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.t1, marginBottom: 4 },
  emptyText: { fontSize: 12, color: colors.t3, textAlign: 'center', paddingHorizontal: 40 },
});
