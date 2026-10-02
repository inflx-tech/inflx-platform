/**
 * Item 11 — R5: picking the products.
 * Contract: features/item11-remote · rules v1.27 §11.2, §7A, §13, §20
 *
 * Her address, her number and her sizes appear HERE and only here — the moment the brand needs
 * them, and not a screen earlier (§11.2 privacy). The server decides whether to send them at
 * all; this screen simply shows what it was given.
 *
 * The products come from her SELLING SCOPE, resolved live by the server. A Pay for Sale or
 * Hybrid collaboration whose scope was never set receives nothing, and the screen says so
 * rather than showing an empty list nobody can explain (v1.27, approval Q3).
 *
 * ui-walk-fixes (board C): "Continue" is a strip under the list (BottomBar), never floating over
 * it; the list is a FormScroll because it holds the search box. The 150 of empty space that only
 * existed to scroll clear of the floating bar is gone.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton, EmptyState } from '../../components/settings/primitives';
import { Skeleton, LoadError, useToast } from '../../components/settings/feedback';
import { COPY } from '../../components/settings/copy';
import { StateBox7 } from '../../components/agreement/bits7';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { BottomBar } from '../../components/shell/BottomBar';
import { FormScroll, FormArea } from '../../components/shell/FormScroll';
import { AddressCard11, ProductRow11 } from '../../components/remote/bits11';
import { C11, MSG11 } from '../../components/remote/copy11';
import { first } from '../../components/invitations/copy5';

const MAX_LINES = 20;

export default function BrandRemoteProductsScreen({ navigation, route }) {
  const { campaignId, setId, ciId } = route.params || {};
  const [sh, setSh] = useState(null);
  const [cat, setCat] = useState(null);
  const [status, setStatus] = useState('loading');
  const [scopeError, setScopeError] = useState(null);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState({});        // productId → { variantId, quantity, disposition }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const { toast, show } = useToast({ inFlow: true });

  const load = useCallback(async () => {
    setStatus((st) => (st === 'ready' ? 'ready' : 'loading'));
    const [r, p] = await Promise.all([
      brandApi.remote(campaignId, setId, ciId),
      brandApi.remoteProducts(campaignId, setId, ciId),
    ]);
    if (!r || !r.success) { setStatus('error'); return; }
    setSh(r.data.shoot);
    // Q3 — a sale collaboration with no scope is a sentence, not an empty list.
    if (!p || !p.success) setScopeError((p && p.error && p.error.message) || null);
    else { setCat(p.data); setScopeError(null); }
    // Start from what is already saved, so reopening the screen does not lose the work.
    const seed = {};
    for (const l of (r.data.shoot.lines || [])) {
      seed[l.productId] = { variantId: l.variantId, quantity: l.quantity, disposition: l.disposition };
    }
    setPicked(seed);
    setStatus('ready');
  }, [campaignId, setId, ciId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function search(text) {
    setQ(text);
    const p = await brandApi.remoteProducts(campaignId, setId, ciId, text || null);
    if (p && p.success) setCat(p.data);
  }

  const count = Object.keys(picked).length;
  const noReturnPickup = sh && sh.address && sh.address.coverage && sh.address.coverage.returnPickup === false;

  /** What the app can check before it asks. The server checks all of it again. */
  function validate() {
    if (!count) return MSG11.NO_LINES;
    if (count > MAX_LINES) return MSG11.TOO_MANY_LINES;
    for (const [pid, line] of Object.entries(picked)) {
      const product = (cat && cat.products || []).find((x) => x.id === pid);
      if (product && product.variants.length && !line.variantId) return MSG11.VARIANT_REQUIRED;
      if (line.quantity < 1 || line.quantity > 5) return MSG11.TOO_MANY_OF_VARIANT;
    }
    return null;
  }

  async function save() {
    const e = validate();
    if (e) { setError(e); return; }
    setError(null); setBusy(true);
    const lines = Object.entries(picked).map(([productId, l]) => ({
      productId, variantId: l.variantId || null, quantity: l.quantity, disposition: l.disposition,
    }));
    const r = await brandApi.remoteSaveLines(campaignId, setId, ciId, { lines });
    setBusy(false);
    if (!r || !r.success) { setError((r && r.error && r.error.message) || COPY.saveFailed); return; }
    navigation.navigate('BrandRemoteBook', { campaignId, setId, ciId });
  }

  if (status === 'loading') return <View style={base.screen}><Header title="Pick products" onBack={() => navigation.goBack()} /><Skeleton rows={6} /></View>;
  if (status === 'error') return <View style={base.screen}><Header title="Pick products" onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const who = sh.creator.name;
  const products = (cat && cat.products) || [];

  return (
    <View style={base.screen} testID="brand-remote-products">
      <Header title="Pick products" onBack={() => navigation.goBack()} />
      <FormArea>
      <FormScroll contentContainerStyle={{ padding: 18 }} keyboardShouldPersistTaps="handled" testID="products-form">

        {/* §11.2 — her address, number and sizes appear now, and only here. */}
        <AddressCard11 address={sh.address} />

        {/* Before any line can be a Return, the brand is warned (R5, approval Q1). */}
        {noReturnPickup
          ? <StateBox7 tone="move" text={C11.brand.noReturnPickup(sh.address.pincode, who)} testID="no-return-warning" />
          : null}

        {scopeError ? (
          <EmptyState title="Nothing to send yet" body={scopeError} />
        ) : (
          <>
            <View style={s.scopeRow}>
              <Text style={s.scope} testID="scope-line">
                {cat.scope.kind === 'catalogue' ? C11.brand.scopeCatalogue : C11.brand.scopeLine(cat.scope.label)}
              </Text>
              <Text style={[s.count, count > MAX_LINES && { color: T.state.declined.fg }]} testID="line-count">
                {C11.brand.ofTwenty(count)}
              </Text>
            </View>

            <TextInput value={q} onChangeText={search} placeholder="Search her products"
              placeholderTextColor={T.ink3} style={s.search} testID="product-search" />

            <Text style={s.hint}>{C11.brand.pickHint}</Text>

            {products.length === 0 ? (
              <EmptyState title="Nothing here" body={q ? 'No product matches that.' : 'There is nothing available to send right now.'} />
            ) : products.map((p) => (
              <ProductRow11
                key={p.id}
                product={p}
                line={picked[p.id] || null}
                disabled={busy}
                onChange={(l) => { setPicked((x) => ({ ...x, [p.id]: { ...l, quantity: l.quantity || 1, disposition: l.disposition || 'gift' } })); setError(null); }}
                onRemove={() => { setPicked((x) => { const n = { ...x }; delete n[p.id]; return n; }); setError(null); }}
              />
            ))}
          </>
        )}
      </FormScroll>
      {toast}
      </FormArea>

      <BottomBar testID="products-actions">
        {error ? <Text style={s.error} testID="products-error">{error}</Text> : null}
        <PrimaryButton label={count ? `Continue · ${C11.brand.ofTwenty(count)}` : 'Continue'}
          disabled={!count || !!scopeError} onPress={save} busy={busy} testID="products-continue" />
      </BottomBar>
    </View>
  );
}

const s = StyleSheet.create({
  scopeRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  scope: { flex: 1, fontFamily: fonts.sansBold, fontSize: 12, color: T.ink2 },
  count: { fontFamily: fonts.sansBold, fontSize: 12, color: T.ink3 },
  search: { borderWidth: 1, borderColor: T.border, borderRadius: 10, padding: 11, marginBottom: 10,
    fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, lineHeight: 17, marginBottom: 14 },
  // The strip keeps its children 8 apart, which is the 8 this line used to carry under itself.
  error: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.state.declined.fg, textAlign: 'center' },
});
