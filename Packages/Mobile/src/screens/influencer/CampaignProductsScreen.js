import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Image,
  StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { brandPalette as P, fonts, fmtMoney } from '../../theme/tokens';
import { influencerApi } from '../../services/api';

// Category fallback emoji when a product has no image_url. Keeps cards
// scannable instead of an empty grey box. Preserved verbatim from prior
// version per Flow 32 locked design call #3 (KEEP category emojis as fallback).
const CATEGORY_EMOJI = {
  restaurant:     '🍽️',
  salon:          '💇',
  car_rental:     '🚗',
  bike_rental:    '🏍️',
  fashion:        '👗',
  fashion_walkin: '👗',
  fashion_online: '👕',
  bakery:         '🧁',
  florist:        '💐',
};

/**
 * CampaignProductsScreen — influencer views products that are live in their store
 * via this campaign, and optionally adds a personal recommendation per product.
 *
 * Flow (post Phase 2b — auto-allocation):
 * 1. Products allocated by this LIVE campaign are AUTOMATICALLY live in the
 *    creator's store (resolveStore auto-fills from the live allocation). There is
 *    no manual publish step — listing here = live in store.
 * 2. The only action is the OPTIONAL personal recommendation (a note). Saving a
 *    note attaches the creator's words to an already-live deal; removing the note
 *    leaves the product live — it only clears the words.
 *
 * Reframe (2026-06-14, bug fix): dropped the redundant "Publish to my store" /
 * "Remove from store" gate — it was an illusion after 2b (the product was live
 * regardless of the note, and "remove" only deleted the note). Now: permanent
 * LIVE badge + add/edit/remove RECOMMENDATION only. Note upsert/delete API
 * unchanged (influencer_product_notes = annotation, not a visibility gate).
 *
 * Flow 32 restyle (2026-05-27): brandPalette + Outfit/Plus Jakarta Sans/JetBrains
 * Mono fonts. successPale Live badge + bg2 note cards + ink-bordered note input
 * + ink/white Outfit-Black UPPERCASE CTAs. No action emoji per design call #4.
 */

export default function CampaignProductsScreen({ navigation, route }) {
  const { campaignInfluencerId, campaignName } = route.params || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingNote, setEditingNote] = useState(null); // product_id being edited
  const [activeKind, setActiveKind] = useState(null);   // collab-phase1 — chip filter
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

  async function handleSaveNote(product) {
    const note = noteText.trim() || `Check out this ${product.name}!`;
    setSaving(true);
    try {
      const res = await influencerApi.upsertProductNote({
        product_id: product.id,
        campaign_id: data.campaign_id,
        note_text: note,
      });
      if (res.success || res.data) {
        Alert.alert('Recommendation saved', `Your note now shows with ${product.name}.`);
        setEditingNote(null);
        setNoteText('');
        loadProducts();
      } else {
        Alert.alert('Failed', res.error?.message || 'Could not save recommendation');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveNote(product) {
    // Delete the note only — the product stays live in the store (it's allocated
    // by the live campaign; the note is just an annotation).
    try {
      const notesRes = await influencerApi.getProductNotes(data.campaign_id);
      const notes = notesRes.data?.notes || [];
      const note = notes.find(n => n.product_id === product.id);
      if (note) {
        await influencerApi.deleteProductNote(note.id);
        Alert.alert('Recommendation removed', `${product.name} is still live in your store — only your note was removed.`);
        loadProducts();
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={P.ink} /></View>;
  }

  const products = data?.products || [];
  const brand = data?.brand;
  const notedCount = products.filter(p => p.influencer_note).length;

  // collab-phase1 — group by the product's own kind, not the shop's trade.
  // Every product already carries a kind; this screen was simply never sent it, which is
  // why it could only ever be one flat list. Anything not yet labelled goes to 'Other' so
  // it stays visible and sellable — hiding it would hide real stock, and hide the gap.
  const groups = React.useMemo(() => {
    const by = new Map();
    for (const pr of products) {
      const key = pr.category_key || pr.super_category || 'Other';
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(pr);
    }
    // 'Other' always last, however many there are.
    return [...by.entries()].sort((a, b) =>
      a[0] === 'Other' ? 1 : b[0] === 'Other' ? -1 : a[0].localeCompare(b[0]));
  }, [products]);

  const visible = activeKind
    ? groups.filter(([k]) => k === activeKind)
    : groups;

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[P.ink]} />}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Icon name="chevron-left" size={20} color={P.ink} />
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
          <Text style={[s.statVal, { color: P.successText }]}>{products.length}</Text>
          <Text style={s.statLabel}>Live in store</Text>
        </View>
        <View style={s.stat}>
          <Text style={[s.statVal, { color: P.warnText }]}>{notedCount}</Text>
          <Text style={s.statLabel}>With note</Text>
        </View>
      </View>

      {/* Create Post CTA (Post/Concept Stage A) — the creator's MAIN action:
          these allocated products are the composer's product universe. */}
      {products.length > 0 && (
        <TouchableOpacity
          style={s.createPostCta}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Create', { screen: 'PostComposer' })}
        >
          <Text style={{ fontSize: 20, marginRight: 10 }}>📸</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.createPostTitle}>Create Post with these products</Text>
            <Text style={s.createPostSub}>Pick a concept → photos → tag products → followers shop your post</Text>
          </View>
          <Icon name="chevron-right" size={22} color={P.white} />
        </TouchableOpacity>
      )}

      {/* Info banner */}
      <View style={s.infoBanner}>
        <Icon name="information-outline" size={20} color={P.ink} style={{ marginTop: 1 }} />
        <Text style={s.infoText}>
          Followers discover these products through YOUR POSTS. Create a post above — optional: add a short recommendation note per product below.
        </Text>
      </View>

      {/* Products list */}
      {/* collab-phase1 — one chip per kind, only when there is more than one to choose. */}
      {groups.length > 1 && (
        <View style={s.kindChips}>
          <TouchableOpacity onPress={() => setActiveKind(null)}
            style={[s.kindChip, !activeKind && s.kindChipOn]}>
            <Text style={[s.kindChipTxt, !activeKind && s.kindChipTxtOn]}>ALL {products.length}</Text>
          </TouchableOpacity>
          {groups.map(([kind, items]) => (
            <TouchableOpacity key={kind} onPress={() => setActiveKind(kind === activeKind ? null : kind)}
              style={[s.kindChip, activeKind === kind && s.kindChipOn]}>
              <Text style={[s.kindChipTxt, activeKind === kind && s.kindChipTxtOn]}>
                {String(kind).toUpperCase()} {items.length}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {visible.map(([kind, items]) => (
        <View key={kind}>
          <View style={s.kindHeader}>
            <Text style={s.kindHeaderTxt}>{String(kind).toUpperCase()}</Text>
            <Text style={s.kindHeaderCount}>{items.length}</Text>
          </View>
      {items.map(product => {
        const isEditing = editingNote === product.id;
        const discount = data?.offers?.[0]?.discount_value;

        return (
          <View key={product.id} style={s.productCard}>
            {/* Product info */}
            <View style={s.productHeader}>
              <View style={s.productEmoji}>
                {product.image_url ? (
                  <Image
                    source={{ uri: product.image_url }}
                    style={s.productImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={{ fontSize: 28 }}>
                    {CATEGORY_EMOJI[brand?.category] || '📦'}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.productName}>{product.name}</Text>
                <Text style={s.productDesc}>{product.description || product.section}</Text>
                <View style={s.priceRow}>
                  <Text style={s.price}>{fmtMoney(product.price)}</Text>
                  {discount ? <Text style={s.discountBadge}>{discount}% OFF</Text> : null}
                </View>
              </View>
              {/* Always live — the product is allocated by this live campaign. */}
              <View style={s.liveBadge}>
                <Icon name="check-bold" size={11} color={P.successText} />
                <Text style={s.liveBadgeText}>LIVE</Text>
              </View>
            </View>

            {/* Saved recommendation */}
            {product.influencer_note && !isEditing && (
              <View style={s.noteCard}>
                <Text style={s.noteLabel}>YOUR RECOMMENDATION</Text>
                <Text style={s.noteText}>"{product.influencer_note}"</Text>
                <View style={s.noteActions}>
                  <TouchableOpacity onPress={() => { setEditingNote(product.id); setNoteText(product.influencer_note); }}>
                    <Text style={s.noteEdit}>EDIT</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleRemoveNote(product)}>
                    <Text style={s.noteRemove}>REMOVE NOTE</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Add / edit recommendation form */}
            {isEditing && (
              <View style={s.publishForm}>
                <Text style={s.publishLabel}>
                  {product.influencer_note ? 'UPDATE YOUR RECOMMENDATION' : 'ADD YOUR RECOMMENDATION'}
                </Text>
                <TextInput
                  style={s.noteInput}
                  value={noteText}
                  onChangeText={setNoteText}
                  placeholder="e.g. I love this deal! Best for festive looks…"
                  placeholderTextColor={P.muted3}
                  multiline
                />
                <View style={s.publishActions}>
                  <TouchableOpacity onPress={() => { setEditingNote(null); setNoteText(''); }} style={s.cancelBtn}>
                    <Text style={s.cancelText}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.publishBtn, saving && { opacity: 0.5 }]}
                    onPress={() => handleSaveNote(product)}
                    disabled={saving}
                  >
                    <Text style={s.publishText}>
                      {saving ? 'SAVING…' : product.influencer_note ? 'UPDATE NOTE' : 'SAVE RECOMMENDATION'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Add a recommendation (product is already live) */}
            {!product.influencer_note && !isEditing && (
              <TouchableOpacity
                style={s.quickPublish}
                onPress={() => {
                  setEditingNote(product.id);
                  setNoteText(`Check out this amazing ${product.name}! Great deal.`);
                }}
              >
                <Text style={s.quickPublishText}>+ ADD RECOMMENDATION</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
        </View>
      ))}

      {products.length === 0 && (
        <View style={s.empty}>
          <View style={s.emptyTile}>
            <Text style={{ fontSize: 32 }}>📦</Text>
          </View>
          <Text style={s.emptyTitle}>No products assigned</Text>
          <Text style={s.emptyText}>The brand hasn't linked products to this campaign yet.</Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  createPostCta: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, backgroundColor: P.ink, borderRadius: 14, padding: 14 },
  createPostTitle: { color: '#fff', fontWeight: '800', fontSize: 14 },
  createPostSub: { color: 'rgba(255,255,255,0.7)', fontSize: 10.5, marginTop: 2 },
  container: { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.bg },

  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 11,
    paddingHorizontal: 18, paddingTop: 50, paddingBottom: 14,
    backgroundColor: P.white, borderBottomWidth: 1, borderBottomColor: P.border,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: P.bg2, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBlack },
  subtitle: { fontSize: 10.5, color: P.muted2, marginTop: 3, fontFamily: fonts.monoMedium },

  statsBar: {
    flexDirection: 'row', backgroundColor: P.white, padding: 14,
    borderBottomWidth: 1, borderBottomColor: P.border,
  },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '900', color: P.ink, fontFamily: fonts.monoBold },
  statLabel: { fontSize: 9, color: P.muted2, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: '700', fontFamily: fonts.monoMedium },

  // collab-phase1 — the kind chips and section headers. Deliberately matched to this
  // screen's existing idiom (grey selected state, ink text, bordered cards) rather
  // than a new look, because only the arrangement is changing.
  kindChips: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 7,
    marginHorizontal: 14, marginTop: 4, marginBottom: 10,
  },
  kindChip: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: P.border, backgroundColor: P.white,
  },
  kindChipOn: { backgroundColor: P.ink, borderColor: P.ink },
  kindChipTxt: { fontSize: 10.5, color: P.muted, fontFamily: fonts.monoBold, letterSpacing: 0.3 },
  kindChipTxtOn: { color: P.white },
  kindHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 14, marginTop: 6, marginBottom: 8,
  },
  kindHeaderTxt: { fontSize: 10, color: P.ink, fontFamily: fonts.monoBold, letterSpacing: 0.5 },
  kindHeaderCount: { fontSize: 10, color: P.muted, fontFamily: fonts.monoMedium },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 9,
    marginHorizontal: 14, marginTop: 12, marginBottom: 12, padding: 11,
    backgroundColor: P.warnPale,
    borderRadius: 11, borderWidth: 1, borderColor: P.warn,
  },
  infoText: { flex: 1, fontSize: 11.5, color: P.warnText, lineHeight: 17, fontFamily: fonts.sansRegular },

  productCard: {
    marginHorizontal: 14, marginBottom: 10,
    backgroundColor: P.white, borderRadius: 14,
    borderWidth: 1, borderColor: P.border, overflow: 'hidden',
  },
  productHeader: {
    flexDirection: 'row', padding: 14, gap: 12, alignItems: 'center',
  },
  productEmoji: {
    width: 54, height: 54, borderRadius: 11, backgroundColor: P.bg2,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  productImage: { width: 54, height: 54 },
  productName: { fontSize: 14, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },
  productDesc: { fontSize: 11, color: P.muted, marginTop: 2, fontFamily: fonts.sansRegular },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  price: { fontSize: 15, fontWeight: '900', color: P.ink, fontFamily: fonts.monoBold },
  discountBadge: {
    fontSize: 9.5, fontWeight: '800', color: P.successText,
    backgroundColor: P.successPale, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 5, letterSpacing: 0.2, fontFamily: fonts.monoBold,
  },

  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: P.successPale, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8,
  },
  liveBadgeText: { fontSize: 9, fontWeight: '800', color: P.successText, fontFamily: fonts.monoBold, letterSpacing: 0.3 },

  noteCard: {
    paddingHorizontal: 14, paddingTop: 11, paddingBottom: 12,
    backgroundColor: P.bg2, borderTopWidth: 1, borderTopColor: P.border,
  },
  noteLabel: {
    fontSize: 9, fontWeight: '800', color: P.muted2,
    textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4,
    fontFamily: fonts.monoBold,
  },
  noteText: { fontSize: 12.5, color: P.ink, fontStyle: 'italic', lineHeight: 18, fontFamily: fonts.sansRegular },
  noteActions: { flexDirection: 'row', gap: 14, marginTop: 8 },
  noteEdit: {
    fontSize: 10.5, fontWeight: '800', color: P.ink,
    textTransform: 'uppercase', letterSpacing: 0.3,
    borderBottomWidth: 1, borderStyle: 'dashed', borderBottomColor: P.ink,
    fontFamily: fonts.monoBold,
  },
  noteRemove: {
    fontSize: 10.5, fontWeight: '800', color: P.dangerText,
    textTransform: 'uppercase', letterSpacing: 0.3,
    borderBottomWidth: 1, borderStyle: 'dashed', borderBottomColor: P.dangerText,
    fontFamily: fonts.monoBold,
  },

  publishForm: {
    padding: 14, borderTopWidth: 1, borderTopColor: P.border,
    backgroundColor: P.bg2,
  },
  publishLabel: {
    fontSize: 9.5, fontWeight: '800', color: P.muted2,
    textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 7,
    fontFamily: fonts.monoBold,
  },
  noteInput: {
    borderWidth: 1.5, borderColor: P.ink, borderRadius: 10,
    padding: 11, fontSize: 12, color: P.ink, minHeight: 60,
    backgroundColor: P.white, textAlignVertical: 'top',
    fontFamily: fonts.sansRegular,
  },
  publishActions: { flexDirection: 'row', gap: 8, marginTop: 10, justifyContent: 'flex-end' },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  cancelText: { fontSize: 12, fontWeight: '800', color: P.muted, textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: fonts.displayBold },
  publishBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    backgroundColor: P.ink,
  },
  publishText: { fontSize: 12, fontWeight: '900', color: P.white, textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: fonts.displayBlack },

  quickPublish: {
    paddingVertical: 13, paddingHorizontal: 14,
    borderTopWidth: 1, borderTopColor: P.border,
    borderStyle: 'dashed',
  },
  quickPublishText: {
    fontSize: 12, fontWeight: '800', color: P.ink, textAlign: 'center',
    textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: fonts.displayBold,
  },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 28 },
  emptyTile: {
    width: 66, height: 66, borderRadius: 14, backgroundColor: P.bg2,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: P.ink,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: P.ink, marginBottom: 6, fontFamily: fonts.displayBold },
  emptyText: { fontSize: 11.5, color: P.muted, textAlign: 'center', lineHeight: 17, fontFamily: fonts.sansRegular },
});
