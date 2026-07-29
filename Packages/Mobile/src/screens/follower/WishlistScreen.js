/**
 * WishlistScreen — Stage C2, locked board c2-bag-wishlist.html frames 2+3+4.
 * Contract: features/concept-stagec2-bag-wishlist/.
 *
 * Collections as chips (All | <collections> | + New) · 2-col grid mirroring
 * the shop-sheet cards (image, name, price+struck, black-outline Move to
 * Bag) · dead products greyed "Currently unavailable" (server list is a
 * LIVE product join) · long-press a card → assign to collections · active
 * collection chip gets the ⋯ menu (rename / delete) · sized products open
 * the quick size sheet, whose Add button is yellow (a buy action — the only
 * yellow on this screen). Guest-first: everything works logged out.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, Image, FlatList, TouchableOpacity, Pressable, Modal, TextInput,
  ActivityIndicator, Alert, Dimensions, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { followerApi } from '../../services/api';
import { useCart } from '../../services/CartContext';
import {
  loadWishlist, removeWish, createCollection, renameCollection,
  deleteCollection, assignToCollection,
} from '../../services/wishlist';
import { HeartIcon } from '../../components/posts/icons';
import { YELLOW, CREAM } from '../../components/posts/PostCard';

const W = Dimensions.get('window').width;
const CARD_W = (W - 16 * 2 - 12) / 2;

export default function WishlistScreen({ navigation }) {
  const { addItem } = useCart();
  const [data, setData] = useState({ items: [], collections: [] });
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState('all'); // 'all' | collection id
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [assignFor, setAssignFor] = useState(null); // item being assigned
  const [sizeFor, setSizeFor] = useState(null);     // { item, sizes, colourName }
  const [size, setSize] = useState(null);

  const refresh = useCallback(async () => {
    const d = await loadWishlist();
    setData(d);
    setLoading(false);
    if (d.collections.every((c) => c.id !== active) && active !== 'all') setActive('all');
  }, [active]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const activeColl = data.collections.find((c) => c.id === active) || null;
  const items = active === 'all'
    ? data.items
    : data.items.filter((i) => (i.collection_ids || []).includes(active));

  async function unheart(item) {
    await removeWish(item.product_id);
    refresh();
  }

  // Move to Bag — fetch live detail for sizes; unsized adds straight away.
  async function moveToBag(item) {
    if (!item.available) return;
    const res = await followerApi.getProductDetail?.(item.product_id).catch(() => null);
    const d = res?.success ? res.data : {};
    let vj = d?.variants_json ?? null;
    if (typeof vj === 'string') { try { vj = JSON.parse(vj); } catch { vj = null; } }
    const colours = Array.isArray(vj?.colors) ? vj.colors : [];
    const first = colours[0] || null;
    const sizes = first
      ? (Array.isArray(first.sizes) ? first.sizes : [])
      : (Array.isArray(vj?.sizes) ? vj.sizes : (Array.isArray(vj?.options) ? vj.options : []));
    const merged = { ...item, price: d?.offer_price ?? item.offer_price ?? d?.price ?? item.price };
    if (sizes.length) {
      setSize(null);
      setSizeFor({ item: merged, sizes, colourName: first ? (first.color ?? first.colour) : null });
    } else {
      finishAdd(merged, null, null);
    }
  }

  const sizeLabel = (sz) => (typeof sz === 'string' ? sz : (sz?.label || sz?.value || sz?.size));

  function finishAdd(item, pickedSize, colourName) {
    const res = addItem(
      {
        id: item.product_id, name: item.name,
        price: item.price, image_url: item.image_url,
        variant_sku: null,
        variant_label: [colourName, pickedSize].filter(Boolean).join(' · ') || null,
        qty: 1,
      },
      item.brand_id, item.brand_name, null, { cartKind: 'shop', creatorHandle: null }
    );
    setSizeFor(null);
    if (res?.ok !== false) {
      Alert.alert('Added to Bag', item.name, [
        { text: 'Keep browsing', style: 'cancel' },
        { text: 'Go to Bag', onPress: () => navigation.navigate('Cart') },
      ]);
    }
  }

  async function submitNewCollection() {
    const name = newName.trim();
    if (!name) return;
    const coll = await createCollection(name);
    setNewOpen(false); setNewName('');
    if (assignFor && coll?.id) {
      await assignToCollection(assignFor.product_id, coll.id, true);
    }
    refresh();
  }

  async function submitRename() {
    const name = newName.trim();
    if (!name || !activeColl) return;
    await renameCollection(activeColl.id, name);
    setRenaming(false); setNewName('');
    refresh();
  }

  function confirmDelete() {
    setMenuOpen(false);
    Alert.alert('Delete collection', `Delete “${activeColl?.name}”? Items stay in your wishlist.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteCollection(activeColl.id); setActive('all'); refresh(); } },
    ]);
  }

  const renderCard = ({ item }) => (
    <Pressable style={st.card} onLongPress={() => setAssignFor(item)}
      onPress={() => item.available && navigation.navigate('PostProduct', { p: { ...item, brand: { id: item.brand_id, name: item.brand_name } } })}>
      <View style={st.cimgWrap}>
        {item.image_url
          ? <Image source={{ uri: item.image_url }} style={st.cimg} resizeMode="cover" />
          : <View style={[st.cimg, { backgroundColor: CREAM }]} />}
        <TouchableOpacity style={st.heart} onPress={() => unheart(item)} hitSlop={8}>
          <HeartIcon size={15} color="#111" filled />
        </TouchableOpacity>
        {!item.available && (
          <View style={st.gone}><Text style={st.goneTxt}>Currently unavailable</Text></View>
        )}
      </View>
      <View style={st.cbody}>
        <Text style={st.cname} numberOfLines={1}>{item.name}</Text>
        <Text style={st.cpr}>
          ₹{item.offer_price ?? item.price}
          {item.offer_price != null && item.price != null && Number(item.offer_price) < Number(item.price)
            ? <Text style={st.struck}>  ₹{item.price}</Text> : null}
        </Text>
        <TouchableOpacity
          style={[st.mtb, !item.available && { opacity: 0.35 }]}
          disabled={!item.available}
          onPress={() => moveToBag(item)}>
          <Text style={st.mtbTxt}>Move to Bag</Text>
        </TouchableOpacity>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <View style={st.hdr}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={st.back}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>{activeColl ? activeColl.name : 'Wishlist'}</Text>
          <Text style={st.count}>{items.length} item{items.length === 1 ? '' : 's'}</Text>
        </View>
        {activeColl
          ? <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={10}><Text style={st.menuDots}>⋯</Text></TouchableOpacity>
          : <TouchableOpacity onPress={() => navigation.navigate('Cart')}><Text style={st.bagLink}>Bag</Text></TouchableOpacity>}
      </View>

      <View style={st.chips}>
        <TouchableOpacity style={[st.chip, active === 'all' && st.chipOn]} onPress={() => setActive('all')}>
          <Text style={[st.chipTxt, active === 'all' && st.chipTxtOn]}>All</Text>
        </TouchableOpacity>
        {data.collections.map((c) => (
          <TouchableOpacity key={c.id} style={[st.chip, active === c.id && st.chipOn]} onPress={() => setActive(c.id)}>
            <Text style={[st.chipTxt, active === c.id && st.chipTxtOn]}>{c.name} ({c.item_count})</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[st.chip, st.chipNew]} onPress={() => { setAssignFor(null); setNewName(''); setNewOpen(true); }}>
          <Text style={st.chipTxt}>+ New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={st.center}><ActivityIndicator color="#111" /></View>
      ) : items.length === 0 ? (
        <View style={st.center}>
          <Text style={st.emptyTitle}>{active === 'all' ? 'Nothing saved yet' : 'Nothing here yet'}</Text>
          <Text style={st.emptySub}>
            {active === 'all'
              ? 'Tap the heart on any product to keep it here.\nMake collections like “Diwali” or “Office”.'
              : 'Long-press a wishlist item to add it to this collection.'}
          </Text>
          <TouchableOpacity style={st.browseBtn} onPress={() => navigation.goBack()}>
            <Text style={st.browseTxt}>Browse Posts</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.product_id}
          renderItem={renderCard}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
          contentContainerStyle={{ gap: 12, paddingBottom: 30, paddingTop: 4 }}
        />
      )}

      {/* ── new collection / rename ── */}
      <Modal visible={newOpen || renaming} transparent animationType="fade" onRequestClose={() => { setNewOpen(false); setRenaming(false); }}>
        <Pressable style={st.dim} onPress={() => { setNewOpen(false); setRenaming(false); }} />
        <View style={st.modal}>
          <Text style={st.mTitle}>{renaming ? 'Rename collection' : 'New collection'}</Text>
          <TextInput
            style={st.mInput} value={newName} onChangeText={setNewName} autoFocus
            placeholder="e.g. Diwali, Office wear, Gifts…" placeholderTextColor="#B5B5B5" maxLength={40}
          />
          <View style={st.mRow}>
            <TouchableOpacity style={[st.mBtn, st.mBtnDim]} onPress={() => { setNewOpen(false); setRenaming(false); }}>
              <Text style={st.mBtnTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.mBtn, st.mBtnDark]} onPress={renaming ? submitRename : submitNewCollection}>
              <Text style={[st.mBtnTxt, { color: '#FFF' }]}>{renaming ? 'Save' : 'Create'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── collection ⋯ menu ── */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={st.dim} onPress={() => setMenuOpen(false)} />
        <View style={st.menuCard}>
          <TouchableOpacity style={st.mi} onPress={() => { setMenuOpen(false); setNewName(activeColl?.name || ''); setRenaming(true); }}>
            <Text style={st.miTxt}>Rename collection</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[st.mi, { borderBottomWidth: 0 }]} onPress={confirmDelete}>
            <Text style={[st.miTxt, { color: '#D64545' }]}>Delete collection</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── assign to collections (long-press) ── */}
      <Modal visible={!!assignFor} transparent animationType="fade" onRequestClose={() => setAssignFor(null)}>
        <Pressable style={st.dim} onPress={() => setAssignFor(null)} />
        <View style={st.modal}>
          <Text style={st.mTitle}>Add to collection</Text>
          {data.collections.length === 0 && (
            <Text style={st.mHint}>No collections yet — create one below.</Text>
          )}
          {data.collections.map((c) => {
            const on = !!assignFor && (data.items.find((i) => i.product_id === assignFor.product_id)?.collection_ids || []).includes(c.id);
            return (
              <TouchableOpacity key={c.id} style={st.assignRow}
                onPress={async () => { await assignToCollection(assignFor.product_id, c.id, !on); refresh(); }}>
                <Text style={st.assignName}>{c.name}</Text>
                <Text style={[st.assignTick, on && { color: '#111' }]}>{on ? '✓' : ''}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={st.assignNew} onPress={() => { setNewName(''); setNewOpen(true); }}>
            <Text style={st.assignNewTxt}>+ New collection</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[st.mBtn, st.mBtnDark, { marginTop: 14 }]} onPress={() => setAssignFor(null)}>
            <Text style={[st.mBtnTxt, { color: '#FFF' }]}>Done</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── size sheet for Move to Bag ── */}
      <Modal visible={!!sizeFor} transparent animationType="slide" onRequestClose={() => setSizeFor(null)}>
        <Pressable style={st.dim} onPress={() => setSizeFor(null)} />
        <View style={st.sheet}>
          <Text style={st.sTitle}>Select size — {sizeFor?.item?.name}</Text>
          <View style={st.sizes}>
            {(sizeFor?.sizes || []).map((sz) => {
              const lbl = sizeLabel(sz);
              return (
                <TouchableOpacity key={lbl} style={[st.sz, size === lbl && st.szOn]} onPress={() => setSize(lbl)}>
                  <Text style={[st.szTxt, size === lbl && { color: '#FFF' }]}>{lbl}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={[st.addBtn, !size && { opacity: 0.4 }]} disabled={!size}
            onPress={() => finishAdd(sizeFor.item, size, sizeFor.colourName)}>
            <Text style={st.addTxt}>Add to Bag · ₹{sizeFor?.item?.price}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  back: { fontSize: 24, fontWeight: '700', color: '#111', marginTop: -2 },
  title: { fontSize: 17, fontWeight: '800', color: '#111' },
  count: { fontSize: 12, color: '#8A8A8A', fontWeight: '600', marginTop: 1 },
  bagLink: { fontSize: 13, fontWeight: '800', color: '#111' },
  menuDots: { fontSize: 20, color: '#111', letterSpacing: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: '#E4E4E4' },
  chipOn: { backgroundColor: '#111', borderColor: '#111' },
  chipNew: { borderStyle: 'dashed' },
  chipTxt: { fontSize: 12, fontWeight: '700', color: '#555' },
  chipTxtOn: { color: '#FFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#111' },
  emptySub: { fontSize: 12, color: '#9A9A9A', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  browseBtn: { marginTop: 16, backgroundColor: '#111', borderRadius: 999, paddingHorizontal: 26, paddingVertical: 12 },
  browseTxt: { color: '#FFF', fontSize: 12.5, fontWeight: '800' },
  card: { width: CARD_W, borderWidth: 1, borderColor: '#F0F0F0', borderRadius: 14, overflow: 'hidden' },
  cimgWrap: { position: 'relative' },
  // Shared by the Image and its no-image placeholder View, so both keep the
  // same 3:4 box and the grid stays level.
  cimg: { width: '100%', aspectRatio: 3 / 4 },
  heart: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  gone: { position: 'absolute', inset: 0, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.72)', alignItems: 'center', justifyContent: 'center' },
  goneTxt: { fontSize: 11, fontWeight: '800', color: '#666' },
  cbody: { padding: 10 },
  cname: { fontSize: 12, fontWeight: '700', color: '#111' },
  cpr: { fontSize: 13, fontWeight: '800', color: '#111', marginTop: 3 },
  struck: { fontSize: 11, color: '#9A9A9A', textDecorationLine: 'line-through', fontWeight: '600' },
  mtb: { marginTop: 8, borderWidth: 1.5, borderColor: '#111', borderRadius: 9, alignItems: 'center', paddingVertical: 7 },
  mtbTxt: { fontSize: 12, fontWeight: '800', color: '#111' },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  modal: { position: 'absolute', left: 26, right: 26, top: '28%', backgroundColor: '#FFF', borderRadius: 16, padding: 18 },
  mTitle: { fontSize: 15, fontWeight: '800', color: '#111' },
  mHint: { fontSize: 12, color: '#9A9A9A', marginTop: 8 },
  mInput: { marginTop: 12, borderWidth: 1.5, borderColor: '#E4E4E4', borderRadius: 10, padding: 12, fontSize: 13, color: '#111' },
  mRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  mBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10 },
  mBtnDim: { backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#EEE' },
  mBtnDark: { backgroundColor: '#111' },
  mBtnTxt: { fontSize: 13, fontWeight: '800', color: '#111' },
  menuCard: { position: 'absolute', right: 16, top: 90, width: 220, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#EEE', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  mi: { paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F4F4F4' },
  miTxt: { fontSize: 13, fontWeight: '700', color: '#111' },
  assignRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F4F4F4' },
  assignName: { fontSize: 13, fontWeight: '700', color: '#111' },
  assignTick: { fontSize: 15, fontWeight: '800', color: 'transparent' },
  assignNew: { paddingVertical: 12 },
  assignNewTxt: { fontSize: 13, fontWeight: '800', color: '#111' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#FFF', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, paddingBottom: 28 },
  sTitle: { fontSize: 14, fontWeight: '800', color: '#111', marginBottom: 12 },
  sizes: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  sz: { minWidth: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: '#E4E4E4', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  szOn: { backgroundColor: '#111', borderColor: '#111' },
  szTxt: { fontSize: 13, fontWeight: '800', color: '#111' },
  addBtn: { marginTop: 16, backgroundColor: YELLOW, borderRadius: 999, alignItems: 'center', paddingVertical: 14 },
  addTxt: { fontSize: 14, fontWeight: '800', color: '#111' },
});
