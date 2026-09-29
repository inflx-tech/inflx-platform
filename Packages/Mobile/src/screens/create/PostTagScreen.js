/**
 * PostTagScreen — P11a: tagging products on a photo. Tap the photo where a product is, then pick it.
 * Optional (founder Q4): every picked product is in the post either way. One tag per product; tagging
 * it again moves it. Videos get the product list only.
 * Contract: features/shoppable-posts-v2 · rules §4.7
 */
import React, { useEffect, useState } from 'react';
import { View, ScrollView, Text, TouchableOpacity, Image, Pressable, StyleSheet } from 'react-native';
import { influencerApi } from '../../services/api';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { CP } from '../../components/create/copyCreate';
import { Footer, ErrorLine, useDraft, s as b } from '../../components/create/bitsCreate';

const round = (n) => Math.round(Math.max(0, Math.min(100, n)) * 100) / 100;

export default function PostTagScreen({ navigation, route }) {
  const { postId, index = 0 } = route.params || {};
  const { post, status, reload } = useDraft(postId);
  const [pins, setPins] = useState([]);       // [{ product_id, media_index, x_pct, y_pct }]
  const [box, setBox] = useState({ w: 1, h: 1 });
  const [spot, setSpot] = useState(null);     // { x_pct, y_pct } waiting for a product
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!post) return;
    setPins(post.products.filter(p => p.pin).map(p => ({ product_id: p.id, ...p.pin })));
  }, [post]);

  function tap(e) {
    const { locationX, locationY } = e.nativeEvent;
    setSpot({ x_pct: round((locationX / box.w) * 100), y_pct: round((locationY / box.h) * 100) });
  }
  function choose(productId) {
    setPins(v => [...v.filter(p => p.product_id !== productId), { product_id: productId, media_index: index, ...spot }]);
    setSpot(null);
  }

  async function done() {
    setBusy(true); setErr('');
    const r = await influencerApi.updatePost(postId, { pins });
    setBusy(false);
    if (!r.success) { setErr(r.error?.message || ''); return; }
    navigation.goBack();
  }

  const slide = post && post.media[index];
  const here = pins.filter(p => p.media_index === index);
  const name = (id) => ((post && post.products.find(p => p.id === id)) || {}).name || '';

  return (
    <View style={base.screen} testID="post-tag">
      <Header title={CP.tagTitle(index + 1)} onBack={() => navigation.goBack()} />
      {status === 'loading' ? <Skeleton /> : status === 'error' || !slide ? <LoadError onRetry={reload} /> : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Pressable onPress={tap} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width || 1, h: e.nativeEvent.layout.height || 1 })} style={t.photo} testID="photo">
              <Image source={{ uri: slide.url }} style={t.img} resizeMode="cover" />
              {here.map(p => (
                <View key={p.product_id} pointerEvents="none" style={[t.pin, { left: `${p.x_pct}%`, top: `${p.y_pct}%` }]}>
                  <Text style={t.pinText} numberOfLines={1}>{name(p.product_id)}</Text>
                </View>
              ))}
              {spot ? <View pointerEvents="none" style={[t.dot, { left: `${spot.x_pct}%`, top: `${spot.y_pct}%` }]} /> : null}
            </Pressable>
            <Text style={b.hint}>{CP.tagHint(here.length, post.products.length)}</Text>
            {spot ? (
              <View testID="choose-product">
                <Text style={b.label}>{CP.pickProduct}</Text>
                {post.products.map(p => (
                  <TouchableOpacity key={p.id} style={b.row} onPress={() => choose(p.id)} testID={`choose-${p.id}`}>
                    <Text style={b.rowName}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : post.products.map(p => {
              const pin = pins.find(x => x.product_id === p.id);
              return (
                <View key={p.id} style={b.row} testID={`tagged-${p.id}`}>
                  <Text style={b.rowName}>{p.name}</Text>
                  <Text style={b.rowMeta}>{pin ? CP.onPhoto(pin.media_index + 1) : CP.notTagged}</Text>
                </View>
              );
            })}
            <ErrorLine text={err} />
          </ScrollView>
          <Footer label={CP.done} disabled={busy} busy={busy} onPress={done} />
        </>
      )}
    </View>
  );
}

const t = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 4 / 5, borderRadius: 12, overflow: 'hidden', backgroundColor: T.surface },
  img: { width: '100%', height: '100%' },
  pin: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, maxWidth: 150, transform: [{ translateX: -8 }, { translateY: -8 }] },
  pinText: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: T.ink },
  dot: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: T.bg, borderWidth: 3, borderColor: T.ink, transform: [{ translateX: -7 }, { translateY: -7 }] },
});
